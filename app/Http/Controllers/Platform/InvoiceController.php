<?php

namespace App\Http\Controllers\Platform;

use App\Http\Controllers\Controller;
use App\Models\BillingPayment;
use App\Models\Branch;
use App\Models\Invoice;
use App\Services\Billing\BillingService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Superadmin: every branch bill, with manual payments for cash or bank transfers. */
class InvoiceController extends Controller
{
    public function __construct(private BillingService $billing) {}

    public function index(Request $request): Response
    {
        $filters = $request->only(['branch', 'status', 'month', 'q']);
        $month = ! empty($filters['month']) && preg_match('/^\d{4}-\d{2}$/', $filters['month']) ? Carbon::createFromFormat('Y-m', $filters['month'])->startOfMonth() : null;

        $base = Invoice::query()
            ->when($filters['branch'] ?? null, fn ($q, $b) => $q->where('branch_id', $b))
            ->when($month, fn ($q, $m) => $q->whereBetween('issued_on', [$m->toDateString(), $m->copy()->endOfMonth()->toDateString()]))
            ->when($filters['q'] ?? null, fn ($q, $t) => $q->where('number', 'like', "%{$t}%"));

        $invoices = (clone $base)->with('branch:id,name,code')
            ->when($filters['status'] ?? null, fn ($q, $s) => match ($s) {
                'overdue' => $q->overdue(),
                'unpaid' => $q->unpaid(),
                default => $q->where('status', $s),
            })
            ->latest('issued_on')->latest('id')->paginate(40)->withQueryString()
            ->through(fn (Invoice $i) => BillingService::invoiceRow($i));

        return Inertia::render('Platform/Invoices', [
            'invoices' => $invoices,
            'filters' => $filters,
            'branches' => Branch::query()->orderBy('name')->get(['id', 'name', 'code']),
            'totals' => [
                'billed' => round((float) (clone $base)->where('status', '!=', 'void')->sum('amount'), 2),
                'paid' => round((float) (clone $base)->where('status', 'paid')->sum('amount'), 2),
                'unpaid' => round((float) (clone $base)->unpaid()->sum('amount'), 2),
                'overdue' => round((float) (clone $base)->overdue()->sum('amount'), 2),
                'count' => (clone $base)->count(),
            ],
            'payments' => BillingPayment::query()->with(['branch:id,name', 'user:id,name'])->latest()->limit(25)->get()->map(fn (BillingPayment $p) => [
                'id' => $p->id,
                'branch' => $p->branch?->name,
                'amount' => (float) $p->amount,
                'channel' => $p->channel,
                'status' => $p->status,
                'method' => $p->method,
                'reference' => $p->reference ?? $p->provider_payment_id ?? $p->checkout_id,
                'user' => $p->user?->name,
                'at' => ($p->paid_at ?? $p->created_at)->toIso8601String(),
                'notes' => $p->notes,
            ]),
        ]);
    }

    public function recordPayment(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'invoice_ids' => ['required', 'array', 'min:1'],
            'invoice_ids.*' => ['integer', 'exists:invoices,id'],
            'method' => ['required', Rule::in(['cash', 'bank', 'gcash', 'check', 'other'])],
            'reference' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $invoices = Invoice::query()->whereIn('id', $data['invoice_ids'])->get();
        $branchIds = $invoices->pluck('branch_id')->unique();
        if ($branchIds->count() !== 1) {
            return back()->with('error', 'Record payments for one branch at a time.');
        }

        $payment = $this->billing->recordPayment(Branch::withTrashed()->findOrFail($branchIds->first()), $invoices, 'manual', $data['method'], $data['reference'] ?? null, $request->user(), $data['notes'] ?? null);

        return back()->with('success', 'Recorded ₱'.number_format((float) $payment->amount, 2).' for '.$invoices->pluck('number')->implode(', ').'.');
    }

    public function void(Request $request, Invoice $invoice): RedirectResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:255']]);
        $this->billing->void($invoice, $data['reason'], $request->user());

        return back()->with('success', "{$invoice->number} voided.");
    }

    /** Run the daily billing job now. */
    public function run(Request $request): RedirectResponse
    {
        $result = $this->billing->run();
        if ($result['paused'] ?? false) {
            return back()->with('error', 'Billing is paused while the master key is on. Turn it off to issue bills.');
        }

        return back()->with('success', "Billing run done: {$result['invoices']} bill(s) issued, {$result['trials_ended']} trial(s) ended.");
    }
}
