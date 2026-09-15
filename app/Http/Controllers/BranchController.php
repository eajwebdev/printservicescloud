<?php

namespace App\Http\Controllers;

use App\Http\Middleware\SetBranchContext;
use App\Models\Branch;
use App\Services\Billing\BillingService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Admins and the superadmin move between branches, or view all of them at once. */
class BranchController extends Controller
{
    public function pick(Request $request, BillingService $billing): Response|RedirectResponse
    {
        $user = $request->user();
        if (! $user->canAccessAllBranches()) {
            return redirect()->route('dashboard');
        }

        return Inertia::render('Branches/Pick', [
            'branches' => Branch::query()->orderBy('name')->get()->map(fn (Branch $b) => [
                'id' => $b->id,
                'name' => $b->name,
                'code' => $b->code,
                'address' => $b->address,
                'active' => $b->active,
                'billing' => array_intersect_key($billing->state($b), array_flip(['status', 'status_label', 'locked', 'lock_reason', 'overdue_count', 'due_total', 'trial_days_left'])),
            ]),
            'intended' => $request->session()->get('branch.intended'),
        ]);
    }

    public function switch(Request $request): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user->canAccessAllBranches(), 403, 'Your account works in one branch only.');

        $data = $request->validate([
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'redirect' => ['nullable', 'string', 'max:2000'],
        ]);
        $branchId = $data['branch_id'] ?? null;

        if ($branchId) {
            $request->session()->put(SetBranchContext::SESSION_KEY, (int) $branchId);
        } else {
            $request->session()->forget(SetBranchContext::SESSION_KEY);
        }

        $branch = $branchId ? Branch::query()->find($branchId) : null;
        $intended = $request->session()->pull('branch.intended');
        $target = $data['redirect'] ?? $intended;

        // Only follow addresses on this site.
        $host = $target ? parse_url($target, PHP_URL_HOST) : null;
        if (! $target || ! str_starts_with((string) parse_url($target, PHP_URL_PATH), '/') || ($host && $host !== $request->getHost())) {
            $target = route('dashboard');
        }

        return redirect()->to($target)->with('success', $branch ? "Now working in {$branch->name}." : 'Now viewing all branches.');
    }
}
