<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Route-level enforcement of the page checkboxes: `page:products` needs
 * products.view, `page:products,edit` needs products.edit.
 */
class EnsurePageAccess
{
    public function handle(Request $request, Closure $next, string $page, string $action = 'view'): Response
    {
        $user = $request->user();

        if (! $user || ! $user->can("{$page}.{$action}")) {
            abort(403, $action === 'view'
                ? 'Your account does not have access to this page. Ask the owner to tick it on your user profile.'
                : 'Your account can open this page but cannot do that here. Ask the owner for access.');
        }

        return $next($request);
    }
}
