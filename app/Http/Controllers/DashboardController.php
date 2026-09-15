<?php

namespace App\Http\Controllers;

use App\Models\CashierSession;
use App\Models\Expense;
use App\Models\InventoryItem;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PettyCashFund;
use App\Models\Product;
use App\Models\Receivable;
use App\Services\Billing\BillingService;
use App\Support\BranchFilter;
use App\Support\DateRange;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    private const PAGE_ROUTES = [
        'pos' => 'pos.index', 'session' => 'session.index', 'orders' => 'orders.index', 'customers' => 'customers.index',
        'quotations' => 'quotations.index', 'products' => 'products.index', 'services' => 'services.index',
        'inventory' => 'inventory.index', 'purchases' => 'purchases.index', 'expenses' => 'expenses.index',
        'petty_cash' => 'petty.index', 'reports' => 'reports.index', 'settings' => 'settings.index',
        'users' => 'users.index', 'activity' => 'activity.index', 'billing' => 'billing.index',
    ];

    public function index(Request $request, BillingService $billing): Response|RedirectResponse
    {
        $user = $request->user();
        if (! $user->can('dashboard.view')) {
            foreach ($user->pageKeys() as $page) {
                if (isset(self::PAGE_ROUTES[$page])) {
                    return redirect()->route(self::PAGE_ROUTES[$page]);
                }
            }
            abort(403, 'No pages are ticked for your account yet. Ask the owner to give you access.');
        }

        // Sales figures follow the picked dates and branches; stock, the board, receivables and cash are always "right now".
        $filter = BranchFilter::fromRequest($request);
        $ids = $filter->ids;
        [$from, $to] = DateRange::fromRequest($request);
        $length = (int) $from->copy()->startOfDay()->diffInDays($to->copy()->startOfDay()) + 1;
        $prevTo = $from->copy()->subDay()->endOfDay();
        $prevFrom = $prevTo->copy()->subDays($length - 1)->startOfDay();

        $sales = Order::query()->inBranches($ids)->notVoided()->whereBetween('created_at', [$from, $to]);
        $salesTotal = round((float) (clone $sales)->sum('total'), 2);
        $orderCount = (clone $sales)->count();
        $prevSales = round((float) Order::query()->inBranches($ids)->notVoided()->whereBetween('created_at', [$prevFrom, $prevTo])->sum('total'), 2);
        $expenses = round((float) Expense::query()->inBranches($ids)->whereBetween('expense_date', [$from->toDateString(), $to->toDateString()])->sum('amount'), 2);
        $cost = round((float) (clone $sales)->sum('cost_total'), 2);

        $lowInventory = InventoryItem::query()->inBranches($ids)->with('branch:id,code')->lowStock()->orderByRaw('stock / NULLIF(reorder_level, 0)')->limit(6)
            ->get(['id', 'branch_id', 'name', 'unit', 'stock', 'reorder_level'])
            ->map(fn ($i) => ['id' => $i->id, 'type' => 'inventory', 'name' => $i->name, 'unit' => $i->unit, 'stock' => (float) $i->stock, 'reorder_level' => (float) $i->reorder_level, 'branch' => $i->branch?->code]);
        $lowProducts = Product::query()->inBranches($ids)->with('branch:id,code')->lowStock()->limit(6)->get(['id', 'branch_id', 'name', 'stock', 'reorder_level'])
            ->map(fn ($p) => ['id' => $p->id, 'type' => 'product', 'name' => $p->name, 'unit' => 'pc', 'stock' => (float) $p->stock, 'reorder_level' => (float) $p->reorder_level, 'branch' => $p->branch?->code]);

        $cashOnHand = CashierSession::query()->inBranches($ids)->where('status', 'open')->get()->sum(fn ($s) => $s->liveExpectedCash());

        // Net of refunds, so a returned sale doesn't count as money in.
        $byMethod = Payment::query()->inBranches($ids)->whereBetween('created_at', [$from, $to])->whereIn('kind', ['sale', 'settlement', 'refund'])
            ->selectRaw('method, SUM(amount) as total')->groupBy('method')->pluck('total', 'method');

        $dueSoon = Order::query()->inBranches($ids)->jobs()->whereIn('status', ['pending', 'in_production', 'ready'])
            ->with(['customer:id,name', 'branch:id,code'])->orderByRaw('due_at IS NULL, due_at')->limit(7)->get()
            ->map(fn (Order $o) => [
                'id' => $o->id, 'order_no' => $o->order_no, 'customer' => $o->customer?->name ?? 'Walk-in',
                'status' => $o->status, 'due_at' => $o->due_at?->toIso8601String(), 'balance' => (float) $o->balance,
                'rush' => $o->rush, 'total' => (float) $o->total, 'branch' => $o->branch?->code,
            ]);

        return Inertia::render('Dashboard', [
            'range' => ['from' => $from->toDateString(), 'to' => $to->toDateString(), 'days' => $length],
            'branchFilter' => $filter->toArray(),
            'stats' => [
                'sales' => $salesTotal,
                'orders' => $orderCount,
                'average' => $orderCount ? round($salesTotal / $orderCount, 2) : 0,
                'prev_sales' => $prevSales,
                'prev_from' => $prevFrom->toDateString(),
                'prev_to' => $prevTo->toDateString(),
                'gross_profit' => round($salesTotal - $cost, 2),
                'expenses' => $expenses,
                'net' => round($salesTotal - $cost - $expenses, 2),
                'in_production' => Order::query()->inBranches($ids)->where('status', 'in_production')->count(),
                'pending_jobs' => Order::query()->inBranches($ids)->where('status', 'pending')->count(),
                'low_stock' => InventoryItem::query()->inBranches($ids)->lowStock()->count() + Product::query()->inBranches($ids)->lowStock()->count(),
                'receivables' => round((float) Receivable::query()->inBranches($ids)->where('status', 'open')->sum(DB::raw('amount - settled')), 2),
                'cash_on_hand' => round($cashOnHand, 2),
                'petty_balance' => round((float) PettyCashFund::query()->inBranches($ids)->sum('balance'), 2),
            ],
            'chart' => $this->chart($from, $to, $length, $ids),
            'byMethod' => collect(['cash', 'gcash', 'bank', 'credit'])->map(fn ($m) => ['method' => $m, 'total' => round((float) ($byMethod[$m] ?? 0), 2)]),
            'lowStock' => $lowInventory->concat($lowProducts)->take(8)->values(),
            'dueSoon' => $dueSoon,
            'branches' => $filter->locked ? [] : $this->branchBreakdown($filter, $from, $to, $billing),
        ]);
    }

    /** One row per branch, side by side, for admins watching several branches. */
    private function branchBreakdown(BranchFilter $filter, Carbon $from, Carbon $to, BillingService $billing): array
    {
        $ids = $filter->branches()->pluck('id')->all();
        $sales = Order::query()->whereIn('branch_id', $ids)->notVoided()->whereBetween('created_at', [$from, $to])
            ->selectRaw('branch_id, SUM(total) as total, SUM(cost_total) as cost, COUNT(*) as n')->groupBy('branch_id')->get()->keyBy('branch_id');
        $expenses = Expense::query()->whereIn('branch_id', $ids)->whereBetween('expense_date', [$from->toDateString(), $to->toDateString()])
            ->selectRaw('branch_id, SUM(amount) as total')->groupBy('branch_id')->pluck('total', 'branch_id');
        $collected = Payment::query()->whereIn('branch_id', $ids)->whereBetween('created_at', [$from, $to])->whereIn('method', ['cash', 'gcash', 'bank'])
            ->selectRaw('branch_id, SUM(amount) as total')->groupBy('branch_id')->pluck('total', 'branch_id');
        $receivables = Receivable::query()->whereIn('branch_id', $ids)->where('status', 'open')
            ->selectRaw('branch_id, SUM(amount - settled) as total')->groupBy('branch_id')->pluck('total', 'branch_id');
        $jobs = Order::query()->whereIn('branch_id', $ids)->jobs()->whereIn('status', ['pending', 'in_production', 'ready'])
            ->selectRaw('branch_id, COUNT(*) as n')->groupBy('branch_id')->pluck('n', 'branch_id');
        $overdueJobs = Order::query()->whereIn('branch_id', $ids)->jobs()->whereIn('status', ['pending', 'in_production'])->where('due_at', '<', now())
            ->selectRaw('branch_id, COUNT(*) as n')->groupBy('branch_id')->pluck('n', 'branch_id');
        $lowStock = InventoryItem::query()->whereIn('branch_id', $ids)->lowStock()->selectRaw('branch_id, COUNT(*) as n')->groupBy('branch_id')->pluck('n', 'branch_id');
        $drawers = CashierSession::query()->whereIn('branch_id', $ids)->where('status', 'open')->get()->groupBy('branch_id');

        return $filter->branches()->map(function ($b) use ($sales, $expenses, $collected, $receivables, $jobs, $overdueJobs, $lowStock, $drawers, $billing) {
            $total = round((float) ($sales[$b->id]->total ?? 0), 2);
            $cost = round((float) ($sales[$b->id]->cost ?? 0), 2);
            $spent = round((float) ($expenses[$b->id] ?? 0), 2);
            $state = $billing->state($b);

            return [
                'id' => $b->id,
                'name' => $b->name,
                'code' => $b->code,
                'sales' => $total,
                'orders' => (int) ($sales[$b->id]->n ?? 0),
                'average' => ($sales[$b->id]->n ?? 0) ? round($total / $sales[$b->id]->n, 2) : 0,
                'gross_profit' => round($total - $cost, 2),
                'expenses' => $spent,
                'net' => round($total - $cost - $spent, 2),
                'collected' => round((float) ($collected[$b->id] ?? 0), 2),
                'receivables' => round((float) ($receivables[$b->id] ?? 0), 2),
                'open_jobs' => (int) ($jobs[$b->id] ?? 0),
                'overdue_jobs' => (int) ($overdueJobs[$b->id] ?? 0),
                'low_stock' => (int) ($lowStock[$b->id] ?? 0),
                'open_drawers' => ($drawers[$b->id] ?? collect())->count(),
                'cash_on_hand' => round(($drawers[$b->id] ?? collect())->sum(fn ($s) => $s->liveExpectedCash()), 2),
                'billing' => ['status' => $state['status'], 'locked' => $state['locked'], 'overdue_count' => $state['overdue_count']],
            ];
        })->values()->all();
    }

    /**
     * Sales bars for the picked dates. A short range still shows two weeks so the day has context
     * (the picked days are highlighted); long ranges roll up by month to stay readable.
     *
     * @return array{grain: string, points: array<int, array{key: string, total: float, in_range: bool}>}
     */
    private function chart(Carbon $from, Carbon $to, int $length, array $ids): array
    {
        $start = $length < 14 ? $to->copy()->subDays(13)->startOfDay() : $from->copy();
        $daily = Order::query()->inBranches($ids)->notVoided()->whereBetween('created_at', [$start, $to])
            ->selectRaw('DATE(created_at) as d, SUM(total) as total')->groupBy('d')->pluck('total', 'd')
            ->mapWithKeys(fn ($total, $d) => [substr((string) $d, 0, 10) => (float) $total]);

        if ($length > 92) {
            $points = [];
            for ($m = $from->copy()->startOfMonth(); $m->lte($to); $m->addMonth()) {
                $key = $m->format('Y-m');
                $points[] = [
                    'key' => $key,
                    'total' => round($daily->filter(fn ($t, $d) => str_starts_with($d, $key))->sum(), 2),
                    'in_range' => true,
                ];
            }

            return ['grain' => 'month', 'points' => $points];
        }

        $points = [];
        for ($d = $start->copy()->startOfDay(); $d->lte($to); $d->addDay()) {
            $key = $d->toDateString();
            $points[] = ['key' => $key, 'total' => round($daily[$key] ?? 0, 2), 'in_range' => $d->gte($from->copy()->startOfDay())];
        }

        return ['grain' => 'day', 'points' => $points];
    }
}
