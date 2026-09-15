<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\CashierSession;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\Order;
use App\Models\OrderRevision;
use App\Models\Payment;
use App\Models\Receivable;
use App\Models\StockMovement;
use App\Models\User;
use App\Support\BranchFilter;
use App\Support\DateRange;
use App\Support\Shop;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Activitylog\Models\Activity;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The business report for any dates and any mix of branches: profit, cash, staff, customers,
 * production, stock usage, voids and money owed. Every table can be exported as CSV.
 */
class ReportController extends Controller
{
    public const CSV_TYPES = [
        'sales' => 'Daily sales',
        'orders' => 'Order register',
        'payments' => 'Payments ledger',
        'branches' => 'Branch comparison',
        'staff' => 'Staff performance',
        'customers' => 'Top customers',
        'items' => 'Top services and products',
        'expenses' => 'Expenses',
        'voids' => 'Voids and refunds',
        'receivables' => 'Receivables aging',
        'sessions' => 'Drawer sessions',
    ];

    public function index(Request $request): Response
    {
        [$from, $to] = $this->range($request);
        $filter = BranchFilter::fromRequest($request);

        return Inertia::render('Reports/Index', [
            'range' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'branchFilter' => $filter->toArray(),
            'csvTypes' => self::CSV_TYPES,
        ] + $this->build($from, $to, $filter));
    }

    public function csv(Request $request): StreamedResponse
    {
        [$from, $to] = $this->range($request);
        $filter = BranchFilter::fromRequest($request);
        $ids = $filter->ids;
        $type = array_key_exists($request->query('type'), self::CSV_TYPES) ? $request->query('type') : 'sales';
        $data = $this->build($from, $to, $filter);
        $branchNames = Branch::withTrashed()->pluck('name', 'id');

        [$header, $rows] = match ($type) {
            'items' => [['Item', 'Type', 'Category', 'Qty', 'Revenue', 'Cost', 'Margin %'], collect($data['topItems'])->map(fn ($r) => [$r['name'], $r['item_type'], $r['category'], $r['qty'], $r['revenue'], $r['cost'], $r['revenue'] > 0 ? round(($r['revenue'] - $r['cost']) / $r['revenue'] * 100, 1) : ''])],
            'expenses' => [['Date', 'Branch', 'Category', 'Payee', 'Source', 'Amount', 'Recorded by', 'Notes'], Expense::query()->inBranches($ids)->with('user:id,name')->whereBetween('expense_date', [$from->toDateString(), $to->toDateString()])->orderBy('expense_date')->get()
                ->map(fn ($e) => [$e->expense_date->toDateString(), $branchNames[$e->branch_id] ?? '', Expense::CATEGORIES[$e->category], $e->payee, $e->source, $e->amount, $e->user?->name, $e->notes])],
            'receivables' => [['Branch', 'Customer', 'Order', 'Opened', 'Due', 'Days', 'Outstanding'], collect($data['aging']['all'])->map(fn ($r) => [$r['branch'], $r['customer'], $r['order_no'], $r['opened'], $r['due'], $r['days'], $r['outstanding']])],
            'sessions' => [['Session', 'Branch', 'Cashier', 'Opened', 'Closed', 'Float', 'Expected', 'Counted', 'Variance'], collect($data['sessions'])->map(fn ($s) => [$s['id'], $s['branch'], $s['cashier'], $s['opened_at'], $s['closed_at'], $s['opening_float'], $s['expected_cash'], $s['closing_counted'], $s['variance']])],
            'branches' => [['Branch', 'Orders', 'Sales', 'Avg order', 'Cost of goods', 'Gross profit', 'Expenses', 'Net', 'Money collected', 'Discounts', 'Voided', 'Receivables now'], collect($data['byBranch'])->map(fn ($b) => [$b['name'], $b['orders'], $b['sales'], $b['average'], $b['cost'], $b['gross_profit'], $b['expenses'], $b['net'], $b['collected'], $b['discounts'], $b['voided'], $b['receivables']])],
            'staff' => [['Staff', 'Branch', 'Orders', 'Sales', 'Avg order', 'Discounts given', 'Voids', 'Cash collected', 'Drawer over/short'], collect($data['staff'])->map(fn ($s) => [$s['name'], $s['branches'], $s['orders'], $s['sales'], $s['average'], $s['discounts'], $s['voids'], $s['cash'], $s['variance']])],
            'customers' => [['Customer', 'Branch', 'Phone', 'Orders', 'Sales', 'Paid', 'Balance now', 'Last order'], collect($data['topCustomers'])->map(fn ($c) => [$c['name'], $c['branch'], $c['phone'], $c['orders'], $c['sales'], $c['paid'], $c['balance'], $c['last_order_at']])],
            'voids' => [['Date', 'Branch', 'Order', 'Customer', 'Cashier', 'Kind', 'Amount', 'Reason'], collect($data['voids'])->map(fn ($v) => [$v['at'], $v['branch'], $v['order_no'], $v['customer'], $v['user'], $v['kind'], $v['amount'], $v['reason']])],
            'orders' => [['Date', 'Branch', 'Order', 'Type', 'Status', 'Customer', 'Cashier', 'Subtotal', 'Discounts', 'Tax', 'Total', 'Paid', 'Balance', 'Cost', 'Payment'],
                Order::query()->inBranches($ids)->with(['customer:id,name', 'cashier:id,name'])->whereBetween('created_at', [$from, $to])->orderBy('created_at')->get()
                    ->map(fn (Order $o) => [$o->created_at->format('Y-m-d H:i'), $branchNames[$o->branch_id] ?? '', $o->order_no, $o->type, $o->status, $o->customer?->name ?? 'Walk-in', $o->cashier?->name, $o->subtotal, $o->discount_total, $o->tax_total, $o->total, $o->paid, $o->balance, $o->cost_total, $o->payment_status])],
            'payments' => [['Date', 'Branch', 'Order', 'Customer', 'Method', 'Kind', 'Amount', 'Reference', 'Cashier'],
                Payment::query()->inBranches($ids)->with(['order:id,order_no', 'customer:id,name', 'user:id,name'])->whereBetween('created_at', [$from, $to])->orderBy('created_at')->get()
                    ->map(fn (Payment $p) => [$p->created_at->format('Y-m-d H:i'), $branchNames[$p->branch_id] ?? '', $p->order?->order_no, $p->customer?->name, $p->method, $p->kind, $p->amount, $p->reference, $p->user?->name])],
            default => [['Date', 'Orders', 'Sales', 'Cost of goods', 'Expenses', 'Net'], collect($data['daily'])->map(fn ($d) => [$d['date'], $d['orders'], $d['sales'], $d['cost'], $d['expenses'], round($d['sales'] - $d['cost'] - $d['expenses'], 2)])],
        };

        $slug = $filter->ids ? implode('-', $filter->branches()->pluck('code')->all()) : ($filter->locked ? $filter->available->first()?->code : 'all-branches');
        $filename = 'skc-'.strtolower((string) $slug)."-{$type}-{$from->toDateString()}-to-{$to->toDateString()}.csv";

        return response()->streamDownload(function () use ($header, $rows, $filter, $from, $to) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // Excel-friendly UTF-8
            fputcsv($out, [Shop::BRAND.' / '.$filter->label().' / '.$from->toDateString().' to '.$to->toDateString()]);
            fputcsv($out, $header);
            foreach ($rows as $row) {
                fputcsv($out, $row);
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function pdf(Request $request)
    {
        [$from, $to] = $this->range($request);
        $filter = BranchFilter::fromRequest($request);

        return Pdf::loadView('pdf.report', ['r' => $this->build($from, $to, $filter), 'from' => $from, 'to' => $to, 'shop' => Shop::profile(), 'scope' => $filter->label()])
            ->setPaper('a4')
            ->stream("report-{$from->toDateString()}-{$to->toDateString()}.pdf");
    }

    /** @return array{0: Carbon, 1: Carbon} */
    private function range(Request $request): array
    {
        return DateRange::fromRequest($request, 29);
    }

    private function build(Carbon $from, Carbon $to, BranchFilter $filter): array
    {
        $ids = $filter->ids;
        $branchNames = Branch::withTrashed()->pluck('name', 'id');
        $orders = Order::query()->inBranches($ids)->notVoided()->whereBetween('created_at', [$from, $to]);
        $expenseQuery = fn () => Expense::query()->inBranches($ids)->whereBetween('expense_date', [$from->toDateString(), $to->toDateString()]);

        $dailySales = (clone $orders)->selectRaw('DATE(created_at) as d, SUM(total) as sales, SUM(cost_total) as cost, COUNT(*) as n')
            ->groupBy('d')->get()->keyBy(fn ($r) => substr((string) $r->d, 0, 10));
        $dailyExpenses = $expenseQuery()->selectRaw('expense_date as d, SUM(amount) as total')->groupBy('d')->get()
            ->mapWithKeys(fn ($r) => [substr((string) $r->d, 0, 10) => (float) $r->total]);

        $daily = [];
        for ($d = $from->copy(); $d->lte($to); $d->addDay()) {
            $key = $d->toDateString();
            $daily[] = [
                'date' => $key,
                'sales' => round((float) ($dailySales[$key]->sales ?? 0), 2),
                'cost' => round((float) ($dailySales[$key]->cost ?? 0), 2),
                'orders' => (int) ($dailySales[$key]->n ?? 0),
                'expenses' => round((float) ($dailyExpenses[$key] ?? 0), 2),
            ];
        }

        $sales = round((float) (clone $orders)->sum('total'), 2);
        $cost = round((float) (clone $orders)->sum('cost_total'), 2);
        $expenses = round((float) $expenseQuery()->sum('amount'), 2);
        $orderCount = (clone $orders)->count();

        $payments = Payment::query()->inBranches($ids)->whereBetween('created_at', [$from, $to]);
        $byMethod = (clone $payments)->selectRaw('method, SUM(amount) as total')->groupBy('method')->pluck('total', 'method');

        $items = DB::table('order_items')->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.status', '!=', 'voided')->whereBetween('orders.created_at', [$from, $to])
            ->when($ids, fn ($q) => $q->whereIn('orders.branch_id', $ids));

        $byCategory = (clone $items)->selectRaw("COALESCE(order_items.category, 'Uncategorized') as category, SUM(order_items.line_total) as revenue, SUM(order_items.cost_total) as cost, COUNT(DISTINCT orders.id) as orders")
            ->groupBy('category')->orderByDesc('revenue')->get()
            ->map(fn ($r) => ['category' => $r->category, 'revenue' => round((float) $r->revenue, 2), 'cost' => round((float) $r->cost, 2), 'orders' => (int) $r->orders]);

        // Group by name so the same service sold in several branches (different ids) adds up.
        $topItems = (clone $items)->selectRaw('order_items.item_type, order_items.name, MAX(order_items.category) as category, SUM(order_items.qty) as qty, SUM(order_items.line_total) as revenue, SUM(order_items.cost_total) as cost, COUNT(DISTINCT orders.id) as orders')
            ->groupBy('order_items.item_type', 'order_items.name')->orderByDesc('revenue')->limit(25)->get()
            ->map(fn ($r) => ['item_type' => $r->item_type, 'name' => $r->name, 'category' => $r->category, 'qty' => round((float) $r->qty, 2), 'revenue' => round((float) $r->revenue, 2), 'cost' => round((float) $r->cost, 2), 'orders' => (int) $r->orders]);

        $materials = DB::table('stock_movements')->join('inventory_items', 'inventory_items.id', '=', 'stock_movements.item_id')
            ->where('stock_movements.item_type', 'inventory')->whereIn('stock_movements.type', ['sale', 'return'])
            ->whereBetween('stock_movements.created_at', [$from, $to])
            ->when($ids, fn ($q) => $q->whereIn('stock_movements.branch_id', $ids))
            ->selectRaw('inventory_items.name, inventory_items.unit, -SUM(stock_movements.qty) as used, -SUM(stock_movements.qty * inventory_items.cost) as cost')
            ->groupBy('inventory_items.name', 'inventory_items.unit')->orderByDesc('cost')->limit(15)->get()
            ->map(fn ($r) => ['name' => $r->name, 'unit' => $r->unit, 'used' => round((float) $r->used, 2), 'cost' => round((float) $r->cost, 2)]);

        $wastage = StockMovement::query()->inBranches($ids)->where('item_type', 'inventory')->where('type', 'adjustment')->where('qty', '<', 0)
            ->whereIn('reason', ['damaged', 'misprint', 'test_print'])->whereBetween('created_at', [$from, $to])->with('item')->get()
            ->groupBy(fn ($m) => $m->item?->name ?? 'Removed item')
            ->map(fn ($rows, $name) => ['name' => $name, 'unit' => $rows->first()->item?->unit, 'qty' => round(abs((float) $rows->sum('qty')), 2), 'cost' => round(abs($rows->sum(fn ($m) => (float) $m->qty * (float) ($m->item?->cost ?? 0))), 2)])
            ->sortByDesc('cost')->values()->take(10);

        $receivables = Receivable::query()->inBranches($ids)->with(['customer:id,name', 'order:id,order_no'])->where('status', 'open')->get();
        $buckets = ['0-30' => 0, '31-60' => 0, '61-90' => 0, '90+' => 0];
        $agingRows = $receivables->map(function ($r) use (&$buckets, $branchNames) {
            $days = (int) $r->created_at->diffInDays(now());
            $key = $days <= 30 ? '0-30' : ($days <= 60 ? '31-60' : ($days <= 90 ? '61-90' : '90+'));
            $buckets[$key] = round($buckets[$key] + $r->outstanding(), 2);

            return ['branch' => $branchNames[$r->branch_id] ?? null, 'customer' => $r->customer?->name, 'customer_id' => $r->customer_id, 'order_no' => $r->order?->order_no, 'order_id' => $r->order_id, 'opened' => $r->created_at->toDateString(), 'due' => $r->due_date?->toDateString(), 'days' => $days, 'outstanding' => $r->outstanding()];
        })->sortByDesc('days')->values();

        $sessions = CashierSession::query()->inBranches($ids)->with('user:id,name')->whereBetween('opened_at', [$from, $to])->latest('opened_at')->limit(100)->get()
            ->map(fn ($s) => SessionController::sessionRow($s) + ['branch' => $branchNames[$s->branch_id] ?? null]);

        $voidedQuery = Order::query()->inBranches($ids)->where('status', 'voided')->whereBetween('voided_at', [$from, $to]);
        $refunds = (clone $payments)->where('kind', 'refund');

        return [
            'summary' => [
                'sales' => $sales,
                'orders' => $orderCount,
                'avg_order' => $orderCount ? round($sales / $orderCount, 2) : 0,
                'jobs' => (clone $orders)->where('type', 'job')->count(),
                'instant' => (clone $orders)->where('type', 'instant')->count(),
                'cost' => $cost,
                'gross_profit' => round($sales - $cost, 2),
                'expenses' => $expenses,
                'net' => round($sales - $cost - $expenses, 2),
                'margin' => $sales > 0 ? round(($sales - $cost - $expenses) / $sales * 100, 1) : null,
                'discounts' => round((float) (clone $orders)->sum('discount_total') + (float) (clone $items)->sum('order_items.discount_amount'), 2),
                'senior_pwd' => round((float) (clone $orders)->sum('senior_pwd_discount'), 2),
                'tax' => round((float) (clone $orders)->sum('tax_total'), 2),
                'voided' => (clone $voidedQuery)->count(),
                'voided_total' => round((float) (clone $voidedQuery)->sum('total'), 2),
                'refunds' => round(abs((float) (clone $refunds)->sum('amount')), 2),
                'collected' => round((float) (clone $payments)->whereIn('method', ['cash', 'gcash', 'bank'])->sum('amount'), 2),
                'settlements' => round((float) (clone $payments)->where('kind', 'settlement')->sum('amount'), 2),
                'credit_sales' => round((float) (clone $payments)->where('method', 'credit')->sum('amount'), 2),
                'receivables' => round($receivables->sum(fn ($r) => $r->outstanding()), 2),
            ],
            'daily' => $daily,
            'byMethod' => collect(['cash', 'gcash', 'bank', 'credit'])->map(fn ($m) => ['method' => $m, 'total' => round((float) ($byMethod[$m] ?? 0), 2)])->values(),
            'byCategory' => $byCategory,
            'byHour' => $this->byHour(clone $orders),
            'byWeekday' => $this->byWeekday(clone $orders),
            'byBranch' => $this->byBranch($from, $to, $filter),
            'staff' => $this->staff($from, $to, $ids, $branchNames),
            'topCustomers' => $this->topCustomers($from, $to, $ids, $branchNames),
            'production' => $this->production($from, $to, $ids),
            'topItems' => $topItems,
            'materials' => $materials,
            'wastage' => $wastage,
            'expenseCategories' => $expenseQuery()->selectRaw('category, SUM(amount) as total, COUNT(*) as n')->groupBy('category')->orderByDesc('total')->get()
                ->map(fn ($e) => ['category' => Expense::CATEGORIES[$e->category], 'total' => round((float) $e->total, 2), 'count' => (int) $e->n]),
            'expenseSources' => $expenseQuery()->selectRaw('source, SUM(amount) as total')->groupBy('source')->pluck('total', 'source')->map(fn ($v) => round((float) $v, 2)),
            'voids' => $this->voids($from, $to, $ids, $branchNames),
            'aging' => ['buckets' => collect($buckets)->map(fn ($v, $k) => ['bucket' => $k, 'total' => $v])->values(), 'rows' => $agingRows->take(25)->values(), 'all' => $agingRows->all(), 'total' => round($receivables->sum(fn ($r) => $r->outstanding()), 2)],
            'sessions' => $sessions,
        ];
    }

    /** Side-by-side figures for every branch in the filter. */
    private function byBranch(Carbon $from, Carbon $to, BranchFilter $filter): array
    {
        $branches = $filter->branches();
        $ids = $branches->pluck('id')->all();
        if (! $ids) {
            return [];
        }

        $sales = Order::query()->whereIn('branch_id', $ids)->notVoided()->whereBetween('created_at', [$from, $to])
            ->selectRaw('branch_id, SUM(total) as total, SUM(cost_total) as cost, SUM(discount_total) as discounts, COUNT(*) as n')->groupBy('branch_id')->get()->keyBy('branch_id');
        $voided = Order::query()->whereIn('branch_id', $ids)->where('status', 'voided')->whereBetween('voided_at', [$from, $to])
            ->selectRaw('branch_id, COUNT(*) as n')->groupBy('branch_id')->pluck('n', 'branch_id');
        $expenses = Expense::query()->whereIn('branch_id', $ids)->whereBetween('expense_date', [$from->toDateString(), $to->toDateString()])
            ->selectRaw('branch_id, SUM(amount) as total')->groupBy('branch_id')->pluck('total', 'branch_id');
        $collected = Payment::query()->whereIn('branch_id', $ids)->whereBetween('created_at', [$from, $to])->whereIn('method', ['cash', 'gcash', 'bank'])
            ->selectRaw('branch_id, SUM(amount) as total')->groupBy('branch_id')->pluck('total', 'branch_id');
        $receivables = Receivable::query()->whereIn('branch_id', $ids)->where('status', 'open')
            ->selectRaw('branch_id, SUM(amount - settled) as total')->groupBy('branch_id')->pluck('total', 'branch_id');

        $rows = $branches->map(function ($b) use ($sales, $voided, $expenses, $collected, $receivables) {
            $total = round((float) ($sales[$b->id]->total ?? 0), 2);
            $cost = round((float) ($sales[$b->id]->cost ?? 0), 2);
            $spent = round((float) ($expenses[$b->id] ?? 0), 2);
            $n = (int) ($sales[$b->id]->n ?? 0);

            return [
                'id' => $b->id, 'name' => $b->name, 'code' => $b->code,
                'orders' => $n, 'sales' => $total, 'average' => $n ? round($total / $n, 2) : 0,
                'cost' => $cost, 'gross_profit' => round($total - $cost, 2), 'expenses' => $spent, 'net' => round($total - $cost - $spent, 2),
                'margin' => $total > 0 ? round(($total - $cost - $spent) / $total * 100, 1) : null,
                'collected' => round((float) ($collected[$b->id] ?? 0), 2),
                'discounts' => round((float) ($sales[$b->id]->discounts ?? 0), 2),
                'voided' => (int) ($voided[$b->id] ?? 0),
                'receivables' => round((float) ($receivables[$b->id] ?? 0), 2),
            ];
        });
        $grand = max(0.01, $rows->sum('sales'));

        return $rows->map(fn ($r) => $r + ['share' => round($r['sales'] / $grand * 100, 1)])->sortByDesc('sales')->values()->all();
    }

    /** Who rang up what: orders, discounts, voids, and how their drawers counted out. */
    private function staff(Carbon $from, Carbon $to, array $ids, $branchNames): array
    {
        $sales = Order::query()->inBranches($ids)->notVoided()->whereBetween('created_at', [$from, $to])->whereNotNull('user_id')
            ->selectRaw('user_id, SUM(total) as total, SUM(discount_total) as discounts, COUNT(*) as n')->groupBy('user_id')->get()->keyBy('user_id');
        $lineDiscounts = DB::table('order_items')->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.status', '!=', 'voided')->whereBetween('orders.created_at', [$from, $to])->when($ids, fn ($q) => $q->whereIn('orders.branch_id', $ids))
            ->selectRaw('orders.user_id, SUM(order_items.discount_amount) as total')->groupBy('orders.user_id')->pluck('total', 'user_id');
        $branchesByUser = Order::query()->inBranches($ids)->whereBetween('created_at', [$from, $to])->whereNotNull('user_id')
            ->select('user_id', 'branch_id')->distinct()->get()->groupBy('user_id');
        $voids = Order::query()->inBranches($ids)->where('status', 'voided')->whereBetween('voided_at', [$from, $to])
            ->get(['id'])->pluck('id');
        $voidsBy = $voids->isEmpty() ? collect() : Activity::query()->where('log_name', 'sales')->where('subject_type', 'order')->whereIn('subject_id', $voids)
            ->where('description', 'like', 'Voided%')->selectRaw('causer_id, COUNT(*) as n')->groupBy('causer_id')->pluck('n', 'causer_id');
        $cash = Payment::query()->inBranches($ids)->whereBetween('created_at', [$from, $to])->where('method', 'cash')
            ->selectRaw('user_id, SUM(amount) as total')->groupBy('user_id')->pluck('total', 'user_id');
        $variance = CashierSession::query()->inBranches($ids)->where('status', 'closed')->whereBetween('closed_at', [$from, $to])
            ->selectRaw('user_id, SUM(variance) as total, COUNT(*) as n')->groupBy('user_id')->get()->keyBy('user_id');

        $userIds = $sales->keys()->merge($voidsBy->keys())->merge($variance->keys())->unique()->filter();

        return User::query()->whereIn('id', $userIds)->get(['id', 'name'])->map(function (User $u) use ($sales, $lineDiscounts, $branchesByUser, $voidsBy, $cash, $variance, $branchNames) {
            $n = (int) ($sales[$u->id]->n ?? 0);
            $total = round((float) ($sales[$u->id]->total ?? 0), 2);

            return [
                'id' => $u->id,
                'name' => $u->name,
                'branches' => ($branchesByUser[$u->id] ?? collect())->map(fn ($r) => $branchNames[$r->branch_id] ?? '')->unique()->implode(', '),
                'orders' => $n,
                'sales' => $total,
                'average' => $n ? round($total / $n, 2) : 0,
                'discounts' => round((float) ($sales[$u->id]->discounts ?? 0) + (float) ($lineDiscounts[$u->id] ?? 0), 2),
                'voids' => (int) ($voidsBy[$u->id] ?? 0),
                'cash' => round((float) ($cash[$u->id] ?? 0), 2),
                'variance' => round((float) ($variance[$u->id]->total ?? 0), 2),
                'drawers' => (int) ($variance[$u->id]->n ?? 0),
            ];
        })->sortByDesc('sales')->values()->all();
    }

    private function topCustomers(Carbon $from, Carbon $to, array $ids, $branchNames): array
    {
        $rows = Order::query()->inBranches($ids)->notVoided()->whereBetween('created_at', [$from, $to])->whereNotNull('customer_id')
            ->selectRaw('customer_id, SUM(total) as total, SUM(paid) as paid, COUNT(*) as n, MAX(created_at) as last_at')
            ->groupBy('customer_id')->orderByDesc('total')->limit(20)->get();
        $customers = Customer::withTrashed()->whereIn('id', $rows->pluck('customer_id'))->get()->keyBy('id');

        return $rows->map(fn ($r) => [
            'id' => (int) $r->customer_id,
            'name' => $customers[$r->customer_id]->name ?? 'Removed customer',
            'phone' => $customers[$r->customer_id]->phone ?? null,
            'branch' => $branchNames[$customers[$r->customer_id]->branch_id ?? 0] ?? null,
            'orders' => (int) $r->n,
            'sales' => round((float) $r->total, 2),
            'paid' => round((float) $r->paid, 2),
            'balance' => round((float) ($customers[$r->customer_id]->credit_balance ?? 0), 2),
            'last_order_at' => $r->last_at ? Carbon::parse($r->last_at)->toIso8601String() : null,
        ])->all();
    }

    /** Job orders: how many came in, how many went out, how fast, and how many were late. */
    private function production(Carbon $from, Carbon $to, array $ids): array
    {
        $taken = Order::query()->inBranches($ids)->jobs()->notVoided()->whereBetween('created_at', [$from, $to]);
        $released = Order::query()->inBranches($ids)->jobs()->where('status', 'released')->whereBetween('released_at', [$from, $to])->get(['id', 'created_at', 'released_at', 'due_at', 'rush']);
        $hours = $released->map(fn ($o) => $o->created_at->diffInMinutes($o->released_at) / 60);
        $withDue = $released->filter(fn ($o) => $o->due_at);
        $onTime = $withDue->filter(fn ($o) => $o->released_at->lte($o->due_at->copy()->addHours(2)));

        return [
            'taken' => (clone $taken)->count(),
            'taken_value' => round((float) (clone $taken)->sum('total'), 2),
            'rush' => (clone $taken)->where('rush', true)->count(),
            'released' => $released->count(),
            'avg_turnaround_hours' => $hours->isNotEmpty() ? round($hours->avg(), 1) : null,
            'on_time_rate' => $withDue->isNotEmpty() ? round($onTime->count() / $withDue->count() * 100, 1) : null,
            'open_now' => Order::query()->inBranches($ids)->jobs()->whereIn('status', ['pending', 'in_production', 'ready'])->count(),
            'overdue_now' => Order::query()->inBranches($ids)->jobs()->whereIn('status', ['pending', 'in_production'])->where('due_at', '<', now())->count(),
            'ready_uncollected' => round((float) Order::query()->inBranches($ids)->jobs()->where('status', 'ready')->sum('balance'), 2),
            'by_status' => Order::query()->inBranches($ids)->jobs()->whereIn('status', ['pending', 'in_production', 'ready'])
                ->selectRaw('status, COUNT(*) as n')->groupBy('status')->pluck('n', 'status'),
        ];
    }

    /** Voided orders and refunds from changes after checkout. */
    private function voids(Carbon $from, Carbon $to, array $ids, $branchNames): array
    {
        $voided = Order::query()->inBranches($ids)->with(['customer:id,name', 'cashier:id,name'])->where('status', 'voided')->whereBetween('voided_at', [$from, $to])->latest('voided_at')->limit(100)->get()
            ->map(fn (Order $o) => [
                'kind' => 'Void', 'order_id' => $o->id, 'order_no' => $o->order_no, 'branch' => $branchNames[$o->branch_id] ?? null,
                'customer' => $o->customer?->name ?? 'Walk-in', 'user' => $o->cashier?->name, 'amount' => (float) $o->total,
                'reason' => $o->void_reason, 'at' => $o->voided_at?->toIso8601String(),
            ]);

        $orderIds = Order::query()->inBranches($ids)->select('id');
        $returns = OrderRevision::query()->with(['user:id,name'])->whereIn('order_id', $orderIds)->where('refunded', '>', 0)->whereBetween('created_at', [$from, $to])->latest()->limit(100)->get();
        $orders = Order::query()->withoutGlobalScope('branch')->with('customer:id,name')->whereIn('id', $returns->pluck('order_id'))->get()->keyBy('id');
        $returns = $returns->map(fn (OrderRevision $r) => [
            'kind' => 'Return / refund', 'order_id' => $r->order_id, 'order_no' => $orders[$r->order_id]->order_no ?? '', 'branch' => $branchNames[$orders[$r->order_id]->branch_id ?? 0] ?? null,
            'customer' => $orders[$r->order_id]?->customer?->name ?? 'Walk-in', 'user' => $r->user?->name, 'amount' => (float) $r->refunded,
            'reason' => $r->reason, 'at' => $r->created_at->toIso8601String(),
        ]);

        return $voided->concat($returns)->sortByDesc('at')->values()->all();
    }

    /** Sales by hour of day, worked out in PHP so it runs the same on MySQL, MariaDB and SQLite. */
    private function byHour($orders): array
    {
        $hours = array_fill(0, 24, ['orders' => 0, 'sales' => 0.0]);
        foreach ($orders->get(['created_at', 'total']) as $o) {
            $h = (int) $o->created_at->format('G');
            $hours[$h]['orders']++;
            $hours[$h]['sales'] += (float) $o->total;
        }

        return collect($hours)->map(fn ($v, $h) => ['hour' => $h, 'orders' => $v['orders'], 'sales' => round($v['sales'], 2)])
            ->filter(fn ($v) => $v['hour'] >= 6 && $v['hour'] <= 22 || $v['orders'] > 0)->values()->all();
    }

    private function byWeekday($orders): array
    {
        $days = collect(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])->mapWithKeys(fn ($d) => [$d => ['orders' => 0, 'sales' => 0.0]])->all();
        foreach ($orders->get(['created_at', 'total']) as $o) {
            $d = $o->created_at->format('D');
            $days[$d]['orders']++;
            $days[$d]['sales'] += (float) $o->total;
        }

        return collect($days)->map(fn ($v, $d) => ['day' => $d, 'orders' => $v['orders'], 'sales' => round($v['sales'], 2)])->values()->all();
    }
}
