<?php

namespace App\Http\Controllers\Platform;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Setting;
use App\Services\Billing\BillingService;
use App\Services\BranchCatalogCopier;
use App\Support\BranchContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Superadmin: the branches on the system and their subscriptions. */
class BranchController extends Controller
{
    public function __construct(private BillingService $billing) {}

    public function index(Request $request): Response
    {
        $filters = $request->only(['q', 'status']);
        $monthStart = now()->startOfMonth();

        $branches = Branch::query()->withCount('users')
            ->when($filters['q'] ?? null, fn ($q, $t) => $q->where(fn ($w) => $w->where('name', 'like', "%{$t}%")->orWhere('code', 'like', "%{$t}%")))
            ->when($filters['status'] ?? null, function ($q, $s) {
                return match ($s) {
                    'locked', 'overdue' => $q->whereIn('id', Invoice::query()->overdue()->select('branch_id')),
                    default => $q->where('subscription_status', $s),
                };
            })
            ->orderBy('name')->get();

        $salesMonth = Order::withoutGlobalScope('branch')->notVoided()->where('created_at', '>=', $monthStart)
            ->selectRaw('branch_id, SUM(total) as total, COUNT(*) as n')->groupBy('branch_id')->get()->keyBy('branch_id');

        $rows = $branches->map(function (Branch $b) use ($salesMonth) {
            $state = $this->billing->state($b);

            return [
                'id' => $b->id,
                'name' => $b->name,
                'code' => $b->code,
                'address' => $b->address,
                'phone' => $b->phone,
                'email' => $b->email,
                'active' => $b->active,
                'monthly_fee' => $b->monthly_fee !== null ? (float) $b->monthly_fee : null,
                'effective_fee' => $state['monthly_fee'],
                'subscribed_on' => $b->subscribed_on?->toDateString(),
                'billing_day' => $b->billing_day,
                'billing_notes' => $b->billing_notes,
                'suspend_reason' => $b->suspend_reason,
                'grace_until_raw' => $b->grace_until?->toDateString(),
                'users_count' => $b->users_count,
                'sales_month' => round((float) ($salesMonth[$b->id]->total ?? 0), 2),
                'orders_month' => (int) ($salesMonth[$b->id]->n ?? 0),
                'paid_total' => round((float) Invoice::query()->where('branch_id', $b->id)->where('status', 'paid')->sum('amount'), 2),
            ] + $state;
        })->values();

        if (($filters['status'] ?? null) === 'locked') {
            $rows = $rows->where('locked', true)->values();
        }

        $all = Branch::query()->get();
        $states = $all->map(fn (Branch $b) => $this->billing->state($b));

        return Inertia::render('Platform/Branches', [
            'branches' => $rows,
            'filters' => $filters,
            'summary' => [
                'branches' => $all->count(),
                'trial' => $all->where('subscription_status', 'trial')->count(),
                'active' => $all->where('subscription_status', 'active')->count(),
                'suspended' => $all->where('subscription_status', 'suspended')->count(),
                'locked' => $states->where('locked', true)->count(),
                'mrr' => round($all->where('subscription_status', 'active')->sum(fn (Branch $b) => $this->billing->monthlyFee($b)), 2),
                'outstanding' => round((float) Invoice::query()->unpaid()->sum('amount'), 2),
                'overdue' => round((float) Invoice::query()->overdue()->sum('amount'), 2),
                'collected_month' => round((float) Invoice::query()->where('status', 'paid')->where('paid_at', '>=', now()->startOfMonth())->sum('amount'), 2),
            ],
            'freeAccess' => $this->billing->freeAccess(),
            'defaults' => [
                'monthly_fee' => (float) $this->billing->setting('billing.monthly_fee'),
                'trial_days' => (int) $this->billing->setting('billing.trial_days'),
                'lock_after' => (int) $this->billing->setting('billing.lock_after'),
                'due_days' => (int) $this->billing->setting('billing.due_days'),
            ],
            'copyFrom' => $all->map(fn (Branch $b) => ['id' => $b->id, 'name' => $b->name])->values(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request, null) + $request->validate([
            'start' => ['required', Rule::in(['trial', 'paid'])],
            'trial_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'starts_on' => ['nullable', 'date'],
            'copy_from' => ['nullable', 'integer', 'exists:branches,id'],
        ]);

        $branch = DB::transaction(function () use ($data, $request) {
            $branch = Branch::query()->create(collect($data)->only(['name', 'code', 'address', 'phone', 'email', 'active', 'monthly_fee', 'billing_notes'])->all() + ['subscription_status' => 'trial']);

            // A new branch starts with the catalog of an existing one (services, products, materials, suppliers), stock at zero.
            if (! empty($data['copy_from'])) {
                app(BranchCatalogCopier::class)->copy((int) $data['copy_from'], $branch->id);
            }
            BranchContext::current()->run($branch->id, fn () => Setting::put(['address' => $data['address'] ?? '', 'phone' => $data['phone'] ?? '', 'email' => $data['email'] ?? ''], $branch->id));

            if ($data['start'] === 'paid') {
                $this->billing->activate($branch, Carbon::parse($data['starts_on'] ?? today()), $request->user());
            } else {
                $this->billing->startTrial($branch, today()->addDays((int) ($data['trial_days'] ?? $this->billing->setting('billing.trial_days'))), $request->user());
            }

            return $branch;
        });

        return back()->with('success', "{$branch->name} is on the system. Add its staff in Users & access.");
    }

    public function update(Request $request, Branch $branch): RedirectResponse
    {
        $data = $this->validated($request, $branch) + $request->validate([
            'grace_until' => ['nullable', 'date'],
        ]);
        $branch->update($data);

        return back()->with('success', "Saved {$branch->name}.");
    }

    public function trial(Request $request, Branch $branch): RedirectResponse
    {
        $data = $request->validate(['until' => ['required', 'date', 'after_or_equal:today']]);
        $this->billing->startTrial($branch, Carbon::parse($data['until']), $request->user());

        return back()->with('success', "{$branch->name} can use the system free until ".Carbon::parse($data['until'])->format('M j, Y').'.');
    }

    public function activate(Request $request, Branch $branch): RedirectResponse
    {
        $data = $request->validate(['starts_on' => ['required', 'date']]);
        $this->billing->activate($branch, Carbon::parse($data['starts_on']), $request->user());

        return back()->with('success', "{$branch->name} is subscribed at ₱".number_format($this->billing->monthlyFee($branch), 2).' a month.');
    }

    public function suspend(Request $request, Branch $branch): RedirectResponse
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:255']]);
        $this->billing->suspend($branch, $data['reason'] ?? null, $request->user());

        return back()->with('success', "{$branch->name} is suspended. Its staff see the bill screen until you resume it.");
    }

    public function resume(Request $request, Branch $branch): RedirectResponse
    {
        $this->billing->resume($branch, $request->user());

        return back()->with('success', "{$branch->name} is back on.");
    }

    public function cancel(Request $request, Branch $branch): RedirectResponse
    {
        $this->billing->cancel($branch, $request->user());

        return back()->with('success', "{$branch->name} is cancelled. Its staff can no longer sign in; the data is kept.");
    }

    /** Issue the next bill now instead of waiting for the billing day. */
    public function bill(Request $request, Branch $branch): RedirectResponse
    {
        if (! in_array($branch->subscription_status, ['active', 'suspended'], true)) {
            return back()->with('error', 'Start a paid subscription for this branch first.');
        }
        $invoice = $this->billing->issue($branch);

        return back()->with('success', "Issued {$invoice->number} for ₱".number_format((float) $invoice->amount, 2).'.');
    }

    private function validated(Request $request, ?Branch $branch): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'code' => ['required', 'string', 'max:10', 'regex:/^[A-Za-z0-9]+$/', Rule::unique('branches', 'code')->ignore($branch)],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:40'],
            'email' => ['nullable', 'email', 'max:120'],
            'active' => ['boolean'],
            'monthly_fee' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
            'billing_notes' => ['nullable', 'string', 'max:2000'],
        ], ['code.regex' => 'Use letters and numbers only, like KAB or BCD2.']);
        $data['code'] = strtoupper($data['code']);

        return $data;
    }
}
