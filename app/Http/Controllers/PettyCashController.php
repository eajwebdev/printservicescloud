<?php

namespace App\Http\Controllers;

use App\Http\Requests\PettyDisburseRequest;
use App\Http\Requests\PettyFundRequest;
use App\Http\Requests\PettyReconcileRequest;
use App\Http\Requests\PettyTopUpRequest;
use App\Models\PettyCashFund;
use App\Models\PettyCashTransaction;
use App\Services\PettyCashService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PettyCashController extends Controller
{
    public function __construct(private PettyCashService $petty) {}

    public function index(Request $request): Response
    {
        $fund = PettyCashFund::main();
        $monthStart = now()->startOfMonth();

        return Inertia::render('PettyCash/Index', [
            'fund' => [
                'id' => $fund->id, 'name' => $fund->name, 'balance' => (float) $fund->balance,
                'float_target' => (float) $fund->float_target, 'low_threshold' => (float) $fund->low_threshold,
                'low' => (float) $fund->balance <= (float) $fund->low_threshold,
                'spent_month' => abs((float) $fund->transactions()->where('type', 'out')->where('created_at', '>=', $monthStart)->sum('amount')),
                'topped_month' => (float) $fund->transactions()->where('type', 'in')->where('created_at', '>=', $monthStart)->sum('amount'),
            ],
            'transactions' => $fund->transactions()->with(['user:id,name', 'expense:id,category'])->latest()->latest('id')->paginate(30)
                ->through(fn (PettyCashTransaction $t) => [
                    'id' => $t->id, 'type' => $t->type, 'amount' => (float) $t->amount, 'balance_after' => (float) $t->balance_after,
                    'reason' => $t->reason, 'ref' => $t->ref, 'funded_from' => $t->funded_from, 'expense_id' => $t->expense_id,
                    'user' => $t->user?->name, 'at' => $t->created_at->toIso8601String(),
                ]),
            'drawerOpen' => (bool) $request->user()->openSession,
        ]);
    }

    public function topUp(PettyTopUpRequest $request): RedirectResponse
    {
        $d = $request->validated();
        $this->petty->topUp((float) $d['amount'], $d['funded_from'], $d['ref'] ?? null, $d['reason'] ?? null, $request->user());

        return back()->with('success', 'Petty cash topped up by ₱'.number_format((float) $d['amount'], 2).'.');
    }

    public function disburse(PettyDisburseRequest $request): RedirectResponse
    {
        $d = $request->validated();
        $this->petty->disburse((float) $d['amount'], $d['reason'], $d['ref'] ?? null, $request->user());

        return back()->with('success', 'Paid ₱'.number_format((float) $d['amount'], 2).' from petty cash.');
    }

    public function reconcile(PettyReconcileRequest $request): RedirectResponse
    {
        $tx = $this->petty->reconcile((float) $request->validated('counted'), $request->validated('note'), $request->user());

        return back()->with('success', $tx
            ? 'Counted. The fund was '.((float) $tx->amount < 0 ? 'short' : 'over').' by ₱'.number_format(abs((float) $tx->amount), 2).' and is now corrected.'
            : 'Counted. The box matches the books.');
    }

    public function updateFund(PettyFundRequest $request): RedirectResponse
    {
        PettyCashFund::main()->update($request->validated());

        return back()->with('success', 'Fund limits saved.');
    }
}
