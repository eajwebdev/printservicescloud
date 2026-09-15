<?php

namespace App\Http\Controllers;

use App\Models\BillingPayment;
use App\Models\Branch;
use App\Models\Invoice;
use App\Models\User;
use App\Services\Billing\BillingService;
use App\Services\Billing\PayMongo;
use App\Support\BillingLockProps;
use App\Support\BranchContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/** Branch-side billing: see the bills, and pay them online through PayMongo. */
class BillingController extends Controller
{
    public function __construct(private BillingService $billing, private PayMongo $paymongo) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $context = BranchContext::current();
        $branches = Branch::query()
            ->when($context->id(), fn ($q, $id) => $q->whereKey($id))
            ->when(! $user->canAccessAllBranches(), fn ($q) => $q->whereKey($user->branch_id))
            ->orderBy('name')->get();
        $ids = $branches->pluck('id')->all();

        $filters = $request->only(['status', 'branch']);
        $invoices = Invoice::query()->with('branch:id,name,code')->whereIn('branch_id', $ids)
            ->when($filters['branch'] ?? null, fn ($q, $b) => $q->where('branch_id', $b))
            ->when($filters['status'] ?? null, fn ($q, $s) => match ($s) {
                'overdue' => $q->overdue(),
                'unpaid' => $q->unpaid(),
                default => $q->where('status', $s),
            })
            ->latest('period_start')->latest('id')->paginate(30)->withQueryString()
            ->through(fn (Invoice $i) => BillingService::invoiceRow($i));

        return Inertia::render('Billing/Index', [
            'accounts' => $branches->map(fn (Branch $b) => ['id' => $b->id, 'name' => $b->name, 'code' => $b->code] + $this->billing->state($b))->values(),
            'invoices' => $invoices,
            'payments' => BillingPayment::query()->with(['branch:id,name', 'user:id,name'])->whereIn('branch_id', $ids)->where('status', 'paid')->latest('paid_at')->limit(20)->get()
                ->map(fn (BillingPayment $p) => [
                    'id' => $p->id,
                    'branch' => $p->branch?->name,
                    'amount' => (float) $p->amount,
                    'channel' => $p->channel,
                    'method' => $p->method,
                    'reference' => $p->reference ?? $p->provider_payment_id,
                    'paid_at' => $p->paid_at?->toIso8601String(),
                    'user' => $p->user?->name,
                    'invoices' => Invoice::query()->whereIn('id', $p->invoice_ids ?? [])->pluck('number'),
                ]),
            'filters' => $filters,
            'onlineReady' => $this->paymongo->configured(),
            'methods' => $this->methodLabels(),
            'canPay' => $user->can('billing.pay'),
        ]);
    }

    /** The bill screen on its own, for form posts that land while locked. */
    public function locked(Request $request): Response|RedirectResponse
    {
        $branch = BranchContext::current()->branch();
        $state = $branch ? $this->billing->state($branch) : null;
        if (! $branch || ! $state['locked']) {
            return redirect()->route('dashboard');
        }

        return Inertia::render('Billing/Locked', BillingLockProps::for($branch, $state, $request->user()));
    }

    /** Start a PayMongo checkout for some or all of a branch's unpaid bills. */
    public function pay(Request $request): HttpResponse
    {
        $data = $request->validate([
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'invoice_ids' => ['nullable', 'array'],
            'invoice_ids.*' => ['integer'],
        ]);
        $user = $request->user();
        $branch = Branch::query()->findOrFail($data['branch_id']);
        abort_unless($user->canAccessBranch($branch->id), 403, 'You can only pay bills for your own branch.');

        // Anyone at a locked branch may pay to reopen it; otherwise it takes the "Pay bills" checkbox.
        $state = $this->billing->state($branch);
        abort_unless($state['locked'] || $user->can('billing.pay'), 403, 'Your account can see bills but not pay them. Ask a manager.');

        $invoices = Invoice::query()->where('branch_id', $branch->id)->unpaid()
            ->when($data['invoice_ids'] ?? null, fn ($q, $ids) => $q->whereIn('id', $ids))
            ->orderBy('period_start')->get();
        if ($invoices->isEmpty()) {
            return back()->with('success', 'Nothing to pay. This branch is up to date.');
        }
        if (! $this->paymongo->configured()) {
            return back()->with('error', 'Online payment is not set up yet. Contact the system provider to pay by bank transfer or cash.');
        }

        $payment = BillingPayment::query()->create([
            'branch_id' => $branch->id,
            'amount' => round((float) $invoices->sum('amount'), 2),
            'channel' => 'paymongo',
            'status' => 'pending',
            'invoice_ids' => $invoices->pluck('id')->all(),
            'user_id' => $user->id,
        ]);

        try {
            $checkout = $this->paymongo->createCheckout(
                $invoices->map(fn (Invoice $i) => [
                    'name' => "{$i->number}, {$branch->name}",
                    'amount' => (float) $i->amount,
                    'description' => $i->description ?? $i->periodLabel(),
                ])->all(),
                (array) $this->billing->setting('billing.payment_methods'),
                $this->billing->setting('billing.provider_name').": {$branch->name} subscription",
                'BP-'.$payment->id,
                route('billing.return', $payment),
                route('billing.return', [$payment, 'cancelled' => 1]),
                ['billing_payment_id' => (string) $payment->id, 'branch_id' => (string) $branch->id],
                ['name' => $user->name, 'email' => $user->email, 'phone' => $user->phone],
            );
        } catch (\Throwable $e) {
            Log::warning('PayMongo checkout failed', ['payment' => $payment->id, 'error' => $e->getMessage()]);
            $payment->update(['status' => 'failed', 'notes' => mb_substr($e->getMessage(), 0, 500)]);

            return back()->with('error', 'We could not open the payment page. '.$e->getMessage());
        }

        $payment->update(['checkout_id' => $checkout['id'], 'checkout_url' => $checkout['checkout_url']]);
        activity('billing')->performedOn($branch)->causedBy($user)
            ->withProperties(['payment' => $payment->id, 'amount' => (float) $payment->amount])
            ->log('Opened online payment for '.$invoices->pluck('number')->implode(', '));

        return Inertia::location($checkout['checkout_url']);
    }

    /** PayMongo sends the payer back here. The webhook is the source of truth, but we check now so the lock lifts at once. */
    public function returned(Request $request, BillingPayment $billingPayment): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user->canAccessBranch($billingPayment->branch_id), 404);

        if ($request->boolean('cancelled')) {
            return redirect()->to($this->afterPayment($user))->with('error', 'Payment was cancelled. Your bill is still open.');
        }

        if ($billingPayment->status !== 'paid' && $billingPayment->checkout_id) {
            try {
                $status = $this->paymongo->checkoutStatus($billingPayment->checkout_id);
                if ($status['paid'] && abs($status['amount'] - (float) $billingPayment->amount) < 0.01) {
                    $this->billing->completeOnlinePayment($billingPayment, $status['payment_id'], $status['method']);
                }
            } catch (\Throwable $e) {
                Log::warning('PayMongo status check failed', ['payment' => $billingPayment->id, 'error' => $e->getMessage()]);
            }
        }

        return $billingPayment->fresh()->status === 'paid'
            ? redirect()->to($this->afterPayment($user))->with('success', 'Payment received, thank you. ₱'.number_format((float) $billingPayment->amount, 2).' was applied to your bill.')
            : redirect()->to($this->afterPayment($user))->with('success', 'Payment is processing. The bill shows as paid as soon as PayMongo confirms it.');
    }

    /** A printable statement of one bill. */
    public function print(Request $request, Invoice $invoice): \Illuminate\Http\Response
    {
        abort_unless($request->user()->canAccessBranch($invoice->branch_id), 404);
        $invoice->load(['branch', 'payment']);

        return response()->view('print.invoice', [
            'invoice' => $invoice,
            'provider' => $this->billing->setting('billing.provider_name'),
            'logo' => asset('skclogo.png'),
        ]);
    }

    private function afterPayment(User $user): string
    {
        return $user->can('billing.view') ? route('billing.index') : route('dashboard');
    }

    private function methodLabels(): array
    {
        return collect((array) $this->billing->setting('billing.payment_methods'))->map(fn ($m) => PayMongo::METHODS[$m] ?? $m)->values()->all();
    }
}
