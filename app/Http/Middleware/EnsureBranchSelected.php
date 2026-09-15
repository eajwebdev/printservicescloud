<?php

namespace App\Http\Middleware;

use App\Support\BranchContext;
use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Pages that work inside one branch (the POS, the drawer, stock...). An admin viewing
 * "All branches" is asked to pick one first; opening a record switches to its branch.
 */
class EnsureBranchSelected
{
    public function handle(Request $request, Closure $next): Response
    {
        $context = BranchContext::current();
        if ($context->id() !== null) {
            return $next($request);
        }

        foreach ($request->route()?->parameters() ?? [] as $parameter) {
            if ($parameter instanceof Model && $parameter->getAttribute('branch_id')) {
                $branchId = (int) $parameter->getAttribute('branch_id');
                $request->session()->put(SetBranchContext::SESSION_KEY, $branchId);
                $context->set($branchId);

                return $next($request);
            }
        }

        if ($request->expectsJson()) {
            return response()->json(['message' => 'Pick a branch first.'], 409);
        }

        if ($request->isMethod('get')) {
            $request->session()->put('branch.intended', $request->fullUrl());

            return redirect()->route('branches.pick');
        }

        return back()->with('error', 'Pick a branch at the top of the screen first. That action belongs to one branch.');
    }
}
