<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Support\BranchContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class LoginController extends Controller
{
    public function show(): Response
    {
        return Inertia::render('Auth/Login');
    }

    public function store(LoginRequest $request): RedirectResponse
    {
        $credentials = $request->only('email', 'password') + ['active' => true];

        if (! Auth::attempt($credentials, $request->boolean('remember'))) {
            throw ValidationException::withMessages([
                'email' => 'That email and password don\'t match an active account. Check both and try again.',
            ]);
        }

        $user = $request->user();

        // Branch staff sign in only while their branch is on the system. A branch behind on its bill
        // still signs in; the bill screen takes over from there.
        if (! $user->canAccessAllBranches() && (! $user->branch || ! $user->branch->canSignIn())) {
            Auth::guard('web')->logout();
            throw ValidationException::withMessages([
                'email' => $user->branch
                    ? "{$user->branch->name} is closed on the system. Contact your administrator."
                    : 'Your account is not assigned to a branch yet. Ask the administrator to set one.',
            ]);
        }

        $request->session()->regenerate();
        $user->forceFill(['last_login_at' => now()])->saveQuietly();
        BranchContext::current()->set($user->branch_id);
        activity('auth')->causedBy($user)->log('Signed in');

        return redirect()->intended(route('dashboard'));
    }

    public function destroy(Request $request): RedirectResponse
    {
        activity('auth')->causedBy($request->user())->log('Signed out');
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
