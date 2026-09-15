<?php

namespace App\Http\Controllers;

use App\Http\Requests\CollectPaymentRequest;
use App\Http\Requests\CustomerRequest;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Payment;
use App\Services\ReceivableService;
use App\Support\Shop;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CustomerController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->only(['q', 'owing', 'sort', 'senior']);

        $customers = Customer::query()
            ->withCount(['orders' => fn ($q) => $q->notVoided()])
            ->withSum(['orders as lifetime_value' => fn ($q) => $q->notVoided()], 'total')
            ->withMax('orders as last_order_at', 'created_at')
            ->when($filters['q'] ?? null, fn ($q, $t) => $q->where(fn ($w) => $w->where('name', 'like', "%{$t}%")->orWhere('phone', 'like', "%{$t}%")->orWhere('business_name', 'like', "%{$t}%")))
            ->when($filters['owing'] ?? null, fn ($q) => $q->where('credit_balance', '>', 0))
            ->when($filters['senior'] ?? null, fn ($q) => $q->where('is_senior_pwd', true))
            ->when(($filters['sort'] ?? '') === 'balance', fn ($q) => $q->orderByDesc('credit_balance'), fn ($q) => $q->when(($filters['sort'] ?? '') === 'recent', fn ($r) => $r->orderByDesc('last_order_at'), fn ($r) => $r->orderBy('name')))
            ->paginate(50)->withQueryString()
            ->through(fn (Customer $c) => [
                'id' => $c->id, 'name' => $c->name, 'business_name' => $c->business_name, 'phone' => $c->phone,
                'email' => $c->email, 'address' => $c->address, 'notes' => $c->notes,
                'credit_balance' => (float) $c->credit_balance, 'credit_limit' => $c->credit_limit !== null ? (float) $c->credit_limit : null,
                'is_senior_pwd' => $c->is_senior_pwd, 'orders_count' => $c->orders_count,
                'lifetime_value' => round((float) $c->lifetime_value, 2), 'last_order_at' => $c->last_order_at,
            ]);

        return Inertia::render('Customers/Index', [
            'customers' => $customers,
            'filters' => $filters,
            'totalOwed' => round((float) Customer::query()->sum('credit_balance'), 2),
            'counts' => [
                'all' => Customer::query()->count(),
                'owing' => Customer::query()->where('credit_balance', '>', 0)->count(),
                'senior' => Customer::query()->where('is_senior_pwd', true)->count(),
            ],
        ]);
    }

    /** Quick view for the side panel: contact, what they owe, and their latest orders. */
    public function peek(Customer $customer): \Illuminate\Http\JsonResponse
    {
        return response()->json([
            'customer' => [
                'id' => $customer->id, 'name' => $customer->name, 'business_name' => $customer->business_name,
                'phone' => $customer->phone, 'email' => $customer->email, 'address' => $customer->address, 'notes' => $customer->notes,
                'credit_balance' => (float) $customer->credit_balance, 'credit_limit' => $customer->credit_limit !== null ? (float) $customer->credit_limit : null,
                'is_senior_pwd' => $customer->is_senior_pwd,
                'lifetime_value' => round((float) $customer->orders()->notVoided()->sum('total'), 2),
                'orders_count' => $customer->orders()->notVoided()->count(),
            ],
            'orders' => $customer->orders()->with('items:id,order_id,name,qty,spec')->latest()->limit(8)->get()->map(fn (Order $o) => OrderController::card($o)),
            'openReceivables' => $customer->receivables()->with('order:id,order_no')->where('status', 'open')->oldest()->get()
                ->map(fn ($r) => ['id' => $r->id, 'order_id' => $r->order_id, 'order_no' => $r->order?->order_no, 'outstanding' => $r->outstanding(), 'days' => (int) $r->created_at->diffInDays(now())]),
        ]);
    }

    public function show(Customer $customer): Response
    {
        $orders = $customer->orders()->with('items:id,order_id,name,qty,spec')->latest()->limit(50)->get();

        return Inertia::render('Customers/Show', [
            'customer' => [
                'id' => $customer->id, 'name' => $customer->name, 'business_name' => $customer->business_name,
                'phone' => $customer->phone, 'email' => $customer->email, 'address' => $customer->address,
                'notes' => $customer->notes, 'credit_balance' => (float) $customer->credit_balance,
                'credit_limit' => $customer->credit_limit !== null ? (float) $customer->credit_limit : null,
                'is_senior_pwd' => $customer->is_senior_pwd, 'created_at' => $customer->created_at->toIso8601String(),
                'lifetime_value' => round((float) $customer->orders()->notVoided()->sum('total'), 2),
                'orders_count' => $customer->orders()->notVoided()->count(),
            ],
            'orders' => $orders->map(fn (Order $o) => OrderController::card($o)),
            'statement' => $this->statement_lines($customer),
            'openReceivables' => $customer->receivables()->with('order:id,order_no')->where('status', 'open')->oldest()->get()
                ->map(fn ($r) => [
                    'id' => $r->id, 'order_id' => $r->order_id, 'order_no' => $r->order?->order_no,
                    'amount' => (float) $r->amount, 'settled' => (float) $r->settled, 'outstanding' => $r->outstanding(),
                    'due_date' => $r->due_date?->toDateString(), 'created_at' => $r->created_at->toIso8601String(),
                    'days' => (int) $r->created_at->diffInDays(now()),
                ]),
        ]);
    }

    public function store(CustomerRequest $request): RedirectResponse
    {
        $customer = Customer::query()->create($request->validated());

        return back()->with('success', "Added {$customer->name}.");
    }

    public function update(CustomerRequest $request, Customer $customer): RedirectResponse
    {
        $customer->update($request->validated());

        return back()->with('success', "Saved {$customer->name}.");
    }

    public function destroy(Customer $customer): RedirectResponse
    {
        if ((float) $customer->credit_balance > 0) {
            return back()->with('error', "{$customer->name} still owes ₱".number_format((float) $customer->credit_balance, 2).'. Settle the account before removing it.');
        }
        $customer->delete();

        return redirect()->route('customers.index')->with('success', 'Customer removed. Their past orders keep the name.');
    }

    public function settle(CollectPaymentRequest $request, Customer $customer, ReceivableService $receivables): RedirectResponse
    {
        $receivables->settle($customer, (float) $request->validated('amount'), $request->validated('method'), $request->validated('reference'), $request->user(), $request->validated('order_id'));

        return back()->with('success', 'Collected ₱'.number_format((float) $request->validated('amount'), 2)." from {$customer->name}.");
    }

    public function statement(Customer $customer)
    {
        return Pdf::loadView('pdf.statement', [
            'customer' => $customer,
            'lines' => $this->statement_lines($customer),
            'shop' => Shop::profile(),
        ])->setPaper('a4')->stream("statement-{$customer->id}.pdf");
    }

    /** Charges (orders left with a balance) and payments against the account, with a running balance. */
    private function statement_lines(Customer $customer): array
    {
        $charges = $customer->receivables()->with('order:id,order_no,created_at')->get()->map(fn ($r) => [
            'date' => $r->created_at, 'ref' => $r->order?->order_no ?? 'Charge', 'description' => $r->status === 'written_off' ? 'Order voided' : 'Balance on order',
            'charge' => (float) $r->amount, 'payment' => 0.0, 'written_off' => $r->status === 'written_off',
        ]);
        $writeOffs = $customer->receivables()->with('order:id,order_no')->where('status', 'written_off')->get()->map(fn ($r) => [
            'date' => $r->updated_at, 'ref' => $r->order?->order_no ?? '', 'description' => 'Void reversal',
            'charge' => 0.0, 'payment' => round((float) $r->amount - (float) $r->settled, 2), 'written_off' => true,
        ]);
        $payments = Payment::query()->with('order:id,order_no')->where('customer_id', $customer->id)->where('kind', 'settlement')->get()->map(fn ($p) => [
            'date' => $p->created_at, 'ref' => $p->reference ?: ($p->order?->order_no ?? ''), 'description' => 'Payment, '.strtoupper($p->method),
            'charge' => 0.0, 'payment' => (float) $p->amount, 'written_off' => false,
        ]);

        $running = 0;

        return $charges->concat($writeOffs)->concat($payments)->sortBy('date')->values()->map(function ($l) use (&$running) {
            $running = round($running + $l['charge'] - $l['payment'], 2);

            return ['date' => $l['date']->toIso8601String(), 'ref' => $l['ref'], 'description' => $l['description'], 'charge' => $l['charge'], 'payment' => $l['payment'], 'balance' => $running];
        })->all();
    }
}
