<?php

namespace App\Http\Controllers;

use App\Http\Requests\UserRequest;
use App\Models\Branch;
use App\Models\Order;
use App\Models\User;
use App\Support\Access;
use App\Support\BranchContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $pages = Access::pages();
        $actor = $request->user();
        $branchId = BranchContext::current()->id();
        $filters = $request->only(['branch']);

        $users = $this->visibleUsers($actor)
            ->with(['roles:id,name', 'permissions:id,name', 'roles.permissions:id,name', 'branch:id,name,code'])
            // In a branch, show its staff (admins are listed too, since they work there as well).
            ->when($branchId, fn ($q) => $q->where(fn ($w) => $w->where('branch_id', $branchId)->orWhere('is_owner', true)))
            ->when(! $branchId && ($filters['branch'] ?? null), fn ($q) => $q->where('branch_id', $filters['branch']))
            ->orderByDesc('is_superadmin')->orderByDesc('is_owner')->orderBy('name')->get()
            ->map(fn (User $u) => [
                'id' => $u->id, 'name' => $u->name, 'email' => $u->email, 'phone' => $u->phone,
                'role' => $u->roleLabel(),
                'is_owner' => $u->is_owner, 'is_superadmin' => $u->is_superadmin, 'active' => $u->active,
                'branch' => $u->canAccessAllBranches() ? 'All branches' : ($u->branch?->name ?? 'No branch'),
                'branch_id' => $u->branch_id,
                'last_login_at' => $u->last_login_at?->toIso8601String(),
                'pages' => $u->canAccessAllBranches() ? array_keys($pages) : collect($pages)->keys()->filter(fn ($p) => $u->hasPermissionTo("{$p}.view"))->values(),
            ]);

        return Inertia::render('Users/Index', [
            'users' => $users,
            'pageLabels' => collect($pages)->map(fn ($p) => $p['label']),
            'branches' => $actor->canAccessAllBranches() ? Branch::query()->orderBy('name')->get(['id', 'name', 'code']) : [],
            'filters' => $filters,
        ]);
    }

    public function create(Request $request): Response
    {
        return Inertia::render('Users/Form', $this->formProps(null, $request->user()));
    }

    public function edit(Request $request, User $user): Response
    {
        $this->guard($request->user(), $user);

        return Inertia::render('Users/Form', $this->formProps($user, $request->user()));
    }

    public function store(UserRequest $request): RedirectResponse
    {
        $data = $this->branchFields($request->validated(), $request->user(), null);
        $user = DB::transaction(function () use ($data) {
            $user = User::query()->create(collect($data)->only(['name', 'email', 'phone', 'password', 'active', 'branch_id', 'is_owner'])->all());
            $this->syncAccess($user, $data);

            return $user;
        });

        return redirect()->route('users.index')->with('success', "{$user->name} can now sign in.");
    }

    public function update(UserRequest $request, User $user): RedirectResponse
    {
        $this->guard($request->user(), $user);
        $data = $this->branchFields($request->validated(), $request->user(), $user);
        if (($user->is_owner || $user->is_superadmin) && ! ($data['active'] ?? true) && $user->id === $request->user()->id) {
            return back()->with('error', 'You can not deactivate your own admin account.');
        }
        if ($user->id === $request->user()->id && ! ($data['active'] ?? true)) {
            return back()->with('error', 'You can not deactivate your own account while signed in.');
        }
        if ($user->id === $request->user()->id && $user->is_owner && ! $data['is_owner']) {
            return back()->with('error', 'You can not remove your own all-branch access.');
        }

        DB::transaction(function () use ($user, $data) {
            $fields = collect($data)->only(['name', 'email', 'phone', 'active', 'branch_id', 'is_owner']);
            if (! empty($data['password'])) {
                $fields['password'] = $data['password'];
            }
            $user->update($fields->all());
            $this->syncAccess($user, $data);
        });

        return redirect()->route('users.index')->with('success', "Saved access for {$user->name}.");
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        $this->guard($request->user(), $user);
        if ($user->is_superadmin || $user->id === $request->user()->id) {
            return back()->with('error', 'That account can not be removed.');
        }
        if ($user->cashierSessions()->withoutGlobalScope('branch')->exists() || Order::withoutGlobalScope('branch')->where('user_id', $user->id)->exists()) {
            $user->update(['active' => false]);

            return back()->with('success', "{$user->name} has sales history, so the account was deactivated instead of deleted.");
        }
        $user->delete();

        return back()->with('success', 'User deleted.');
    }

    /** Branch managers only see and manage their own branch's staff; nobody but the superadmin touches the superadmin. */
    private function visibleUsers(User $actor)
    {
        return User::query()
            ->when(! $actor->is_superadmin, fn ($q) => $q->where('is_superadmin', false))
            ->when(! $actor->canAccessAllBranches(), fn ($q) => $q->where('branch_id', $actor->branch_id)->where('is_owner', false));
    }

    private function guard(User $actor, User $target): void
    {
        abort_unless($this->visibleUsers($actor)->whereKey($target->id)->exists(), 404);
    }

    /** Who decides the branch: admins pick it (or all branches); branch managers can only add to their own. */
    private function branchFields(array $data, User $actor, ?User $target): array
    {
        if (! $actor->canAccessAllBranches()) {
            $data['is_owner'] = false;
            $data['branch_id'] = $actor->branch_id;

            return $data;
        }

        $data['is_owner'] = (bool) ($data['all_branches'] ?? false);
        $data['branch_id'] = $data['is_owner'] ? null : ($data['branch_id'] ?? BranchContext::current()->id());
        if ($target?->is_superadmin) {
            $data['is_owner'] = $target->is_owner;
            $data['branch_id'] = null;
        }

        return $data;
    }

    /**
     * The checkboxes are the truth: the role is a label, and each ticked box
     * is granted directly so unticking always removes access.
     */
    private function syncAccess(User $user, array $data): void
    {
        if ($user->canAccessAllBranches()) {
            $user->syncRoles([Role::findOrCreate('Admin', 'web')]);
            $user->syncPermissions(Access::allPermissionNames());
            app(PermissionRegistrar::class)->forgetCachedPermissions();

            return;
        }
        $role = Role::findOrCreate($data['role'], 'web');
        $user->syncRoles([$role]);
        // Role permissions are only a template; strip them so the boxes decide.
        $user->syncPermissions($data['permissions'] ?? []);
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    private function formProps(?User $user, User $actor): array
    {
        return [
            'user' => $user ? [
                'id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'phone' => $user->phone,
                'active' => $user->active, 'is_owner' => $user->is_owner, 'is_superadmin' => $user->is_superadmin,
                'branch_id' => $user->branch_id,
                'role' => $user->roles->first()?->name ?? 'Cashier',
                'permissions' => $user->canAccessAllBranches() ? Access::allPermissionNames() : $user->getDirectPermissions()->pluck('name')->values(),
            ] : null,
            'pages' => collect(Access::pages())->map(fn ($p, $key) => ['key' => $key] + $p)->values(),
            'actionLabels' => Access::ACTION_LABELS,
            'templates' => Access::roleTemplates(),
            'branches' => $actor->canAccessAllBranches() ? Branch::query()->orderBy('name')->get(['id', 'name', 'code']) : [],
            'canChooseBranch' => $actor->canAccessAllBranches(),
            'defaultBranchId' => BranchContext::current()->id() ?? $actor->branch_id,
            'actorBranch' => $actor->branch?->name,
        ];
    }
}
