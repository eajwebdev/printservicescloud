<?php

use App\Http\Middleware\EnsureBranchSelected;
use App\Http\Middleware\EnsurePageAccess;
use App\Http\Middleware\EnsureSubscriptionActive;
use App\Http\Middleware\EnsureSuperadmin;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SetBranchContext;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        $middleware->web(append: [
            SetBranchContext::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
        // The branch must be known before route models load, so branch scoping applies to them.
        $middleware->prependToPriorityList(before: SubstituteBindings::class, prepend: SetBranchContext::class);
        $middleware->alias([
            'page' => EnsurePageAccess::class,
            'branch' => EnsureBranchSelected::class,
            'subscribed' => EnsureSubscriptionActive::class,
            'superadmin' => EnsureSuperadmin::class,
        ]);
        $middleware->validateCsrfTokens(except: ['webhooks/paymongo']);
        $middleware->redirectGuestsTo('/login');
        $middleware->redirectUsersTo('/dashboard');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Render 403 / 404 / 419 / 500 inside the app shell instead of a bare Laravel page.
        $exceptions->respond(function (Response $response, Throwable $e, Request $request) {
            $status = $response->getStatusCode();
            $renderable = app()->hasDebugModeEnabled() ? [403, 404, 419, 503] : [403, 404, 419, 500, 503];

            if (! $request->expectsJson() && in_array($status, $renderable, true) && ! $request->is('api/*')) {
                if ($status === 419) {
                    return back()->with('error', 'Your session timed out. Try that again.');
                }

                return Inertia::render('Errors/Status', [
                    'status' => $status,
                    'message' => $status === 403 ? ($e->getMessage() ?: null) : null,
                ])->toResponse($request)->setStatusCode($status);
            }

            return $response;
        });
    })->create();
