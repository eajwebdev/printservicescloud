<?php

namespace App\Services\Billing;

use App\Models\BillingPayment;
use App\Models\Branch;
use App\Models\Invoice;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Branch subscriptions, billed like a utility: each branch gets one bill a month on its billing
 * day, due a few days later. Unpaid bills past their due date are overdue; when a branch piles up
 * enough of them (3 by default) its staff can still sign in but every page shows the bill instead.
 */
class BillingService
{
    public const DEFAULTS = [
        'billing.monthly_fee' => 1699,
        'billing.due_days' => 10,
        'billing.lock_after' => 3,
        'billing.trial_days' => 14,
        'billing.remind_days' => 5,
        'billing.provider_name' => 'SKC Custom Print POS',
        'billing.payment_methods' => ['gcash', 'paymaya', 'card', 'grab_pay', 'qrph'],
    ];

    /** @var array<int, array<string, mixed>> */
    private array $states = [];

    public function setting(string $key): mixed
    {
        return Setting::global($key, self::DEFAULTS[$key] ?? null);
    }

    /**
     * The superadmin's master key: every branch can use the system without a subscription,
     * and billing is paused, until it is switched off again.
     */
    public function freeAccess(): bool
    {
        return (bool) Setting::global('billing.free_access', false);
    }

    public function setFreeAccess(bool $enabled, ?User $by): void
    {
        Setting::putGlobal(['billing.free_access' => $enabled]);
        $this->states = [];
        activity('billing')->causedBy($by)->withProperties(['free_access' => $enabled])
            ->log($enabled ? 'Turned the master key on: every branch has free access' : 'Turned the master key off: subscriptions apply again');
    }

    public function monthlyFee(Branch $branch): float
    {
        return round((float) ($branch->monthly_fee ?? $this->setting('billing.monthly_fee')), 2);
    }

    /**
     * The daily job: end finished trials and issue every bill that has come due.
     *
     * @return array{trials_ended: int, invoices: int}
     */
    public function run(?Carbon $today = null): array
    {
        // While the master key is on, nobody is billed and no trial ends.
        if ($this->freeAccess()) {
            return ['trials_ended' => 0, 'invoices' => 0, 'paused' => true];
        }

        $today = ($today ?? Carbon::today())->copy()->startOfDay();
        $ended = 0;
        $issued = 0;

        Branch::query()->whereIn('subscription_status', ['trial', 'active', 'suspended'])->orderBy('id')->each(function (Branch $branch) use ($today, &$ended, &$issued) {
            if ($branch->subscription_status === 'trial' && $branch->trial_ends_on && $branch->trial_ends_on->lt($today)) {
                $this->activate($branch, $branch->trial_ends_on->copy()->addDay(), null, 'Free trial ended');
                $ended++;
            }
            $issued += $this->issueDue($branch->fresh(), $today)->count();
        });

        return ['trials_ended' => $ended, 'invoices' => $issued];
    }

    /** Issue every bill whose billing date is today or earlier. */
    public function issueDue(Branch $branch, ?Carbon $today = null): Collection
    {
        $today = ($today ?? Carbon::today())->copy()->startOfDay();
        $issued = collect();
        if (! in_array($branch->subscription_status, ['active', 'suspended'], true) || ! $branch->next_bill_on) {
            return $issued;
        }

        // Guard against runaway loops on bad data: at most two years of catch-up at once.
        for ($i = 0; $i < 24 && $branch->next_bill_on->lte($today); $i++) {
            $issued->push($this->issue($branch));
            $branch->refresh();
        }

        return $issued;
    }

    /** Issue the bill for the branch's next period and move its billing date on a month. */
    public function issue(Branch $branch): Invoice
    {
        return DB::transaction(function () use ($branch) {
            $branch = Branch::query()->whereKey($branch->id)->lockForUpdate()->firstOrFail();
            $start = ($branch->next_bill_on ?? Carbon::today())->copy()->startOfDay();
            $next = $this->nextBillingDate($start, (int) ($branch->billing_day ?: min($start->day, 28)));

            $invoice = Invoice::query()->firstOrCreate(
                ['branch_id' => $branch->id, 'period_start' => $start->toDateString()],
                [
                    'number' => 'INV-'.$branch->code.'-'.$start->format('ymd'),
                    'period_end' => $next->copy()->subDay()->toDateString(),
                    'issued_on' => $start->toDateString(),
                    'due_on' => $start->copy()->addDays((int) $this->setting('billing.due_days'))->toDateString(),
                    'amount' => $this->monthlyFee($branch),
                    'status' => 'unpaid',
                    'description' => 'POS subscription, '.$start->format('M j').' to '.$next->copy()->subDay()->format('M j, Y'),
                ],
            );

            $branch->forceFill(['next_bill_on' => $next->toDateString()])->save();
            unset($this->states[$branch->id]);

            if ($invoice->wasRecentlyCreated) {
                activity('billing')->performedOn($branch)->withProperties(['invoice' => $invoice->number, 'amount' => (float) $invoice->amount])
                    ->log("Billed {$branch->name} ₱".number_format((float) $invoice->amount, 2)." ({$invoice->number})");
            }

            return $invoice;
        });
    }

    public function nextBillingDate(Carbon $from, int $billingDay): Carbon
    {
        $next = $from->copy()->startOfMonth()->addMonthNoOverflow();

        return $next->day(min(max(1, $billingDay), 28));
    }

    public function startTrial(Branch $branch, Carbon $until, ?User $by): Branch
    {
        $branch->update([
            'subscription_status' => 'trial',
            'trial_ends_on' => $until->toDateString(),
            'next_bill_on' => null,
            'suspended_at' => null,
            'suspend_reason' => null,
        ]);
        unset($this->states[$branch->id]);
        activity('billing')->performedOn($branch)->causedBy($by)->withProperties(['until' => $until->toDateString()])
            ->log("Free trial for {$branch->name} until ".$until->format('M j, Y'));

        return $branch;
    }

    /** Start (or restart) a paid subscription: the first bill is issued on the start date. */
    public function activate(Branch $branch, Carbon $startsOn, ?User $by, string $note = 'Subscription started'): Branch
    {
        $startsOn = $startsOn->copy()->startOfDay();
        $branch->update([
            'subscription_status' => 'active',
            'subscribed_on' => $branch->subscribed_on ?? $startsOn->toDateString(),
            'billing_day' => min($startsOn->day, 28),
            'next_bill_on' => $startsOn->toDateString(),
            'suspended_at' => null,
            'suspend_reason' => null,
        ]);
        unset($this->states[$branch->id]);
        activity('billing')->performedOn($branch)->causedBy($by)->withProperties(['starts_on' => $startsOn->toDateString(), 'fee' => $this->monthlyFee($branch)])
            ->log("{$note}: {$branch->name}, ₱".number_format($this->monthlyFee($branch), 2).' a month from '.$startsOn->format('M j, Y'));

        $this->issueDue($branch->fresh());

        return $branch->fresh();
    }

    public function suspend(Branch $branch, ?string $reason, ?User $by): Branch
    {
        $branch->update(['subscription_status' => 'suspended', 'suspended_at' => now(), 'suspend_reason' => $reason]);
        unset($this->states[$branch->id]);
        activity('billing')->performedOn($branch)->causedBy($by)->withProperties(['reason' => $reason])->log("Suspended {$branch->name}");

        return $branch;
    }

    public function resume(Branch $branch, ?User $by): Branch
    {
        $status = $branch->next_bill_on || $branch->subscribed_on ? 'active' : 'trial';
        $branch->update(['subscription_status' => $status, 'suspended_at' => null, 'suspend_reason' => null]);
        unset($this->states[$branch->id]);
        activity('billing')->performedOn($branch)->causedBy($by)->log("Resumed {$branch->name}");

        return $branch;
    }

    public function cancel(Branch $branch, ?User $by): Branch
    {
        $branch->update(['subscription_status' => 'cancelled', 'next_bill_on' => null]);
        unset($this->states[$branch->id]);
        activity('billing')->performedOn($branch)->causedBy($by)->log("Cancelled the subscription for {$branch->name}");

        return $branch;
    }

    /**
     * Settle invoices. Used by the PayMongo webhook/return and by the superadmin for cash or bank payments.
     *
     * @param  Collection<int, Invoice>|array<int, int>  $invoices
     */
    public function recordPayment(Branch $branch, Collection|array $invoices, string $channel, ?string $method, ?string $reference, ?User $by, ?string $notes = null): BillingPayment
    {
        return DB::transaction(function () use ($branch, $invoices, $channel, $method, $reference, $by, $notes) {
            $ids = collect($invoices)->map(fn ($i) => $i instanceof Invoice ? $i->id : (int) $i)->all();
            $rows = Invoice::query()->where('branch_id', $branch->id)->whereIn('id', $ids)->where('status', 'unpaid')->lockForUpdate()->get();
            if ($rows->isEmpty()) {
                throw ValidationException::withMessages(['invoices' => 'Those bills are already paid or voided.']);
            }

            $payment = BillingPayment::query()->create([
                'branch_id' => $branch->id,
                'amount' => round((float) $rows->sum('amount'), 2),
                'channel' => $channel,
                'status' => 'paid',
                'method' => $method,
                'reference' => $reference,
                'invoice_ids' => $rows->pluck('id')->all(),
                'paid_at' => now(),
                'notes' => $notes,
                'user_id' => $by?->id,
            ]);
            $this->markInvoicesPaid($payment, $rows);

            return $payment;
        });
    }

    /** Mark a pending online payment as paid (idempotent: webhooks and the return page may both call this). */
    public function completeOnlinePayment(BillingPayment $payment, ?string $providerPaymentId, ?string $method): BillingPayment
    {
        return DB::transaction(function () use ($payment, $providerPaymentId, $method) {
            $payment = BillingPayment::query()->whereKey($payment->id)->lockForUpdate()->firstOrFail();
            if ($payment->status === 'paid') {
                return $payment;
            }
            $payment->update([
                'status' => 'paid',
                'paid_at' => now(),
                'provider_payment_id' => $providerPaymentId,
                'method' => $method ?? $payment->method,
            ]);
            $rows = Invoice::query()->whereIn('id', $payment->invoice_ids ?? [])->where('status', 'unpaid')->lockForUpdate()->get();
            $this->markInvoicesPaid($payment, $rows);

            return $payment;
        });
    }

    private function markInvoicesPaid(BillingPayment $payment, Collection $rows): void
    {
        foreach ($rows as $invoice) {
            $invoice->update(['status' => 'paid', 'paid_at' => now(), 'billing_payment_id' => $payment->id]);
        }
        unset($this->states[$payment->branch_id]);

        activity('billing')->performedOn($payment->branch)->causedBy($payment->user)
            ->withProperties(['invoices' => $rows->pluck('number')->all(), 'amount' => (float) $payment->amount, 'channel' => $payment->channel, 'method' => $payment->method, 'reference' => $payment->reference])
            ->log('Paid ₱'.number_format((float) $payment->amount, 2).' for '.$rows->pluck('number')->implode(', '));
    }

    public function void(Invoice $invoice, ?string $reason, ?User $by): Invoice
    {
        if ($invoice->status === 'paid') {
            throw ValidationException::withMessages(['invoice' => 'Paid bills can not be voided.']);
        }
        $invoice->update(['status' => 'void', 'notes' => trim(($invoice->notes ? $invoice->notes."\n" : '').'Voided: '.$reason)]);
        unset($this->states[$invoice->branch_id]);
        activity('billing')->performedOn($invoice->branch)->causedBy($by)->withProperties(['invoice' => $invoice->number, 'reason' => $reason])->log("Voided bill {$invoice->number}");

        return $invoice;
    }

    /**
     * Everything the app needs to know about a branch's account: whether it is locked, what is owed, and when.
     *
     * @return array{status: string, status_label: string, locked: bool, lock_reason: ?string, warning: bool, overdue_count: int, unpaid_count: int, due_total: float, overdue_total: float, lock_after: int, next_due_on: ?string, next_bill_on: ?string, trial_ends_on: ?string, trial_days_left: ?int, monthly_fee: float, grace_until: ?string, invoices: array<int, array<string, mixed>>}
     */
    public function state(Branch $branch): array
    {
        return $this->states[$branch->id] ??= $this->computeState($branch);
    }

    private function computeState(Branch $branch): array
    {
        $unpaid = Invoice::query()->where('branch_id', $branch->id)->unpaid()->orderBy('period_start')->get();
        $overdue = $unpaid->filter(fn (Invoice $i) => $i->isOverdue());
        $lockAfter = max(1, (int) $this->setting('billing.lock_after'));
        $graced = $branch->grace_until && $branch->grace_until->gte(today());
        $freeAccess = $this->freeAccess();

        $reason = match (true) {
            $branch->subscription_status === 'cancelled' => 'cancelled',
            // The superadmin's master key opens every branch that isn't cancelled.
            $freeAccess => null,
            $branch->subscription_status === 'suspended' => 'suspended',
            $overdue->count() >= $lockAfter && ! $graced => 'overdue',
            default => null,
        };

        $trialLeft = $branch->subscription_status === 'trial' && $branch->trial_ends_on
            ? max(0, (int) today()->diffInDays($branch->trial_ends_on, false))
            : null;
        $nextDue = $unpaid->first()?->due_on;

        return [
            'status' => $branch->subscription_status,
            'status_label' => Branch::STATUSES[$branch->subscription_status] ?? $branch->subscription_status,
            'locked' => $reason !== null,
            'lock_reason' => $reason,
            'free_access' => $freeAccess,
            'warning' => $reason === null && ! $freeAccess && ($overdue->isNotEmpty() || ($nextDue && $nextDue->lte(today()->addDays((int) $this->setting('billing.remind_days'))))),
            'overdue_count' => $overdue->count(),
            'unpaid_count' => $unpaid->count(),
            'due_total' => round((float) $unpaid->sum('amount'), 2),
            'overdue_total' => round((float) $overdue->sum('amount'), 2),
            'lock_after' => $lockAfter,
            'next_due_on' => $nextDue?->toDateString(),
            'next_bill_on' => $branch->next_bill_on?->toDateString(),
            'trial_ends_on' => $branch->trial_ends_on?->toDateString(),
            'trial_days_left' => $trialLeft,
            'monthly_fee' => $this->monthlyFee($branch),
            'grace_until' => $graced ? $branch->grace_until->toDateString() : null,
            'invoices' => $unpaid->map(fn (Invoice $i) => self::invoiceRow($i))->values()->all(),
        ];
    }

    public static function invoiceRow(Invoice $i): array
    {
        return [
            'id' => $i->id,
            'branch_id' => $i->branch_id,
            'branch' => $i->relationLoaded('branch') ? $i->branch?->name : null,
            'number' => $i->number,
            'description' => $i->description,
            'period' => $i->periodLabel(),
            'period_start' => $i->period_start->toDateString(),
            'period_end' => $i->period_end->toDateString(),
            'issued_on' => $i->issued_on->toDateString(),
            'due_on' => $i->due_on->toDateString(),
            'amount' => (float) $i->amount,
            'status' => $i->displayStatus(),
            'days_overdue' => $i->daysOverdue(),
            'paid_at' => $i->paid_at?->toIso8601String(),
            'notes' => $i->notes,
        ];
    }
}
