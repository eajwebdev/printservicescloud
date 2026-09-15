<?php

namespace App\Http\Middleware;

use App\Services\Billing\BillingService;
use App\Support\BillingLockProps;
use App\Support\BranchContext;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

/**
 * A branch that has fallen too far behind on its bills (or was suspended) can still sign in,
 * but every page shows the bill and how to pay it until the account is settled.
 */
class EnsureSubscriptionActive
{
    /** Routes that stay open while locked, so the branch can pay or sign out. */
    private const ALWAYS_OPEN = ['logout', 'billing.*', 'branches.*', 'platform.*'];

    public function __construct(private BillingService $billing) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $branch = BranchContext::current()->branch();

        if (! $user || $user->is_superadmin || ! $branch || $request->routeIs(...self::ALWAYS_OPEN)) {
            return $next($request);
        }

        $state = $this->billing->state($branch);
        if (! $state['locked']) {
            return $next($request);
        }

        if ($request->expectsJson() && ! $request->header('X-Inertia')) {
            return response()->json(['message' => 'This branch is locked until its bill is paid.', 'billing' => $state], 423);
        }

        if (! $request->isMethod('get')) {
            return redirect()->route('billing.locked');
        }

        return Inertia::render('Billing/Locked', BillingLockProps::for($branch, $state, $user))
            ->toResponse($request)
            ->setStatusCode(200);
    }
}
