<?php

namespace App\Http\Middleware;

use App\Models\Branch;
use App\Support\BranchContext;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Pins each request to a branch before route models are resolved, so a branch
 * account can never load another branch's records by guessing an id.
 */
class SetBranchContext
{
    public const SESSION_KEY = 'branch_id';

    public function handle(Request $request, Closure $next): Response
    {
        $context = BranchContext::current();
        $user = $request->user();

        if (! $user) {
            $context->set(null);

            return $next($request);
        }

        if ($user->canAccessAllBranches()) {
            $id = (int) $request->session()->get(self::SESSION_KEY) ?: null;
            if ($id && ! Branch::query()->whereKey($id)->exists()) {
                $request->session()->forget(self::SESSION_KEY);
                $id = null;
            }
            $context->set($id);

            return $next($request);
        }

        $branch = $user->branch;
        if (! $branch || ! $branch->canSignIn()) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect()->route('login')->withErrors([
                'email' => $branch
                    ? "{$branch->name} is closed on the system. Contact your administrator."
                    : 'Your account is not assigned to a branch yet. Ask the administrator to set one.',
            ]);
        }

        $context->set($branch->id);

        return $next($request);
    }
}
