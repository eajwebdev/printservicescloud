<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Support\Brand;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** The public site visitors see before signing in: services, how orders work, and where each branch is. */
class LandingController extends Controller
{
    public function __invoke(Request $request): Response
    {
        return Inertia::render('Landing', [
            'branches' => Branch::query()
                ->where('active', true)
                ->where('subscription_status', '!=', 'cancelled')
                ->orderByRaw("CASE code WHEN 'KAB' THEN 0 WHEN 'DGT' THEN 1 WHEN 'BCD' THEN 2 ELSE 3 END")
                ->orderBy('name')
                ->get(['name', 'code', 'address', 'phone', 'email'])
                ->map(fn (Branch $b) => $b->only(['name', 'code', 'address', 'phone', 'email']))
                ->values(),
            'site' => Brand::site(),
            'signedIn' => $request->user() !== null,
        ]);
    }
}
