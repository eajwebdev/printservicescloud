<?php

namespace App\Http\Middleware;

use App\Models\Branch;
use App\Models\InventoryItem;
use App\Models\Order;
use App\Models\Product;
use App\Models\Setting;
use App\Services\Billing\BillingService;
use App\Support\BranchContext;
use App\Support\Shop;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        $user = $request->user();
        $context = BranchContext::current();

        return [
            ...parent::share($request),
            'demo' => app()->isLocal() || config('app.demo_logins'),
            'shop' => fn () => [
                'name' => Setting::get('business_name', Shop::BRAND),
                'tagline' => Setting::get('tagline', Shop::TAGLINE),
                'logo' => Shop::logoUrl(),
                'rush_fee_percent' => (float) Setting::get('rush_fee_percent', 30),
                'senior_pwd_percent' => (float) Setting::get('senior_pwd_percent', 20),
                'tax_rate' => (float) Setting::get('tax_rate', 0),
                'tax_mode' => Setting::get('tax_mode', 'none'),
                'auto_print' => (bool) Setting::get('auto_print', true),
                'receipt_paper' => (int) Setting::get('receipt_paper', 80),
            ],
            'auth' => fn () => $user ? [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->roleLabel(),
                    'is_owner' => (bool) $user->is_owner,
                    'is_superadmin' => (bool) $user->is_superadmin,
                    'all_branches' => $user->canAccessAllBranches(),
                ],
                'pages' => $user->pageKeys(),
                'permissions' => $user->permissionNames(),
            ] : null,
            'branch' => fn () => $user ? $this->branch($user, $context) : null,
            'billing' => fn () => $user ? $this->billing($user, $context) : null,
            'drawer' => fn () => $user && $context->id() ? $this->drawer($user) : null,
            'badges' => fn () => $user ? [
                'low_stock' => InventoryItem::query()->lowStock()->count() + Product::query()->lowStock()->count(),
                'in_production' => Order::query()->where('status', 'in_production')->count(),
                'overdue' => Order::query()->jobs()->whereIn('status', ['pending', 'in_production'])->where('due_at', '<', now())->count(),
            ] : null,
            'flash' => fn () => [
                'success' => $request->session()->get('success'),
                'error' => $request->session()->get('error'),
                'receipt' => $request->session()->get('receipt'),
                'created_customer' => $request->session()->get('created_customer'),
            ],
        ];
    }

    private function branch($user, BranchContext $context): array
    {
        $current = $context->branch();

        return [
            'current' => $current ? ['id' => $current->id, 'name' => $current->name, 'code' => $current->code] : null,
            'can_switch' => $user->canAccessAllBranches(),
            'list' => $user->canAccessAllBranches()
                ? Branch::query()->orderBy('name')->get(['id', 'name', 'code'])->map(fn ($b) => $b->only(['id', 'name', 'code']))->values()
                : ($current ? [['id' => $current->id, 'name' => $current->name, 'code' => $current->code]] : []),
        ];
    }

    /** What the bill reminder needs: the current branch's account, or for admins on "All branches", which branches are behind. */
    private function billing($user, BranchContext $context): ?array
    {
        $service = app(BillingService::class);
        $current = $context->branch();

        if ($current) {
            $state = $service->state($current);

            return [
                'scope' => 'branch',
                'branch' => ['id' => $current->id, 'name' => $current->name],
                'can_pay' => $user->can('billing.pay'),
                'can_view' => $user->can('billing.view'),
            ] + array_intersect_key($state, array_flip(['status', 'status_label', 'locked', 'warning', 'overdue_count', 'unpaid_count', 'due_total', 'overdue_total', 'lock_after', 'next_due_on', 'trial_days_left', 'trial_ends_on', 'invoices']));
        }

        if (! $user->canAccessAllBranches() || $user->is_superadmin) {
            return null;
        }

        $behind = Branch::query()->orderBy('name')->get()
            ->map(fn (Branch $b) => ['id' => $b->id, 'name' => $b->name] + array_intersect_key($service->state($b), array_flip(['locked', 'overdue_count', 'due_total'])))
            ->filter(fn ($b) => $b['overdue_count'] > 0 || $b['locked'])
            ->values();

        return ['scope' => 'all', 'branches' => $behind, 'can_pay' => true, 'can_view' => true];
    }

    private function drawer($user): ?array
    {
        $session = $user->openSession;
        if (! $session) {
            return ['open' => false];
        }

        return [
            'open' => true,
            'id' => $session->id,
            'opened_at' => $session->opened_at->toIso8601String(),
            'stale' => $session->opened_at->lt(today()),
            'opening_float' => (float) $session->opening_float,
            'expected_cash' => $session->liveExpectedCash(),
        ];
    }
}
