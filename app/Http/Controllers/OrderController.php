<?php

namespace App\Http\Controllers;

use App\Http\Requests\CollectPaymentRequest;
use App\Http\Requests\OrderChangeRequest;
use App\Http\Requests\OrderStatusRequest;
use App\Http\Requests\OrderUpdateRequest;
use App\Http\Requests\VoidOrderRequest;
use App\Models\Order;
use App\Models\OrderFile;
use App\Models\User;
use App\Services\OrderChangeService;
use App\Services\OrderService;
use App\Services\ReceivableService;
use App\Support\Shop;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Activitylog\Models\Activity;

class OrderController extends Controller
{
    public const VIEWS = ['today', 'board', 'list'];

    /**
     * One hub with three tabs: sales rung up today, the production board, and every order.
     * The last tab used is remembered so staff land where they work.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $view = $request->query('view');
        if (! in_array($view, self::VIEWS, true)) {
            $view = $request->session()->get('orders.view') ?? ($user->can('pos.view') ? 'today' : 'board');
        }
        $request->session()->put('orders.view', $view);

        $filters = $request->only(['q', 'status', 'payment', 'type', 'from', 'to', 'assigned', 'due', 'rush', 'mine']);
        $shared = [
            'view' => $view,
            'filters' => $filters,
            'counts' => $this->counts($user),
            'staff' => User::query()->workingHere()->where('active', true)->orderBy('name')->get(['id', 'name']),
            'highlight' => $request->integer('highlight') ?: null,
        ];

        $common = fn ($query) => $query
            ->when($filters['q'] ?? null, function ($q, $term) {
                $like = '%'.trim($term).'%';
                $q->where(fn ($w) => $w->where('order_no', 'like', $like)
                    ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', $like)->orWhere('phone', 'like', $like)));
            })
            ->when($filters['payment'] ?? null, fn ($q, $p) => $p === 'owing' ? $q->where('balance', '>', 0)->where('status', '!=', 'voided') : $q->where('payment_status', $p))
            ->when($filters['assigned'] ?? null, fn ($q, $a) => $a === 'none' ? $q->whereNull('assigned_to') : $q->where('assigned_to', $a))
            ->when($filters['type'] ?? null, fn ($q, $t) => $q->where('type', $t));

        $query = $common(Order::query()
            ->with(['customer:id,name,phone', 'assignee:id,name', 'cashier:id,name', 'items:id,order_id,name,qty,spec,item_type', 'payments:id,order_id,method,amount'])
            ->withCount('files'));

        if ($view === 'board') {
            $cards = (clone $query)->jobs()
                ->where(fn ($q) => $q->whereIn('status', ['pending', 'in_production', 'ready'])
                    ->orWhere(fn ($r) => $r->where('status', 'released')->where('released_at', '>=', now()->subDays(2))))
                ->when(($filters['due'] ?? null) === 'overdue', fn ($q) => $q->whereIn('status', ['pending', 'in_production'])->where('due_at', '<', now()))
                ->when(($filters['due'] ?? null) === 'today', fn ($q) => $q->whereBetween('due_at', [now()->startOfDay(), now()->endOfDay()]))
                ->when($filters['rush'] ?? null, fn ($q) => $q->where('rush', true))
                // Most urgent first: rush, then earliest due date; undated jobs sink.
                ->orderByDesc('rush')->orderByRaw('due_at IS NULL')->orderBy('due_at')
                ->get()
                ->map(fn (Order $o) => self::card($o));

            return Inertia::render('Orders/Board', $shared + ['cards' => $cards]);
        }

        $scope = fn ($query) => $query
            ->when($view === 'today', fn ($q) => $q->whereDate('created_at', today()))
            ->when($view === 'today' && ($filters['mine'] ?? null), fn ($q) => $q->where('user_id', $user->id))
            ->when($view === 'list' && ($filters['status'] ?? null), fn ($q) => $q->where('status', $filters['status']))
            ->when($view === 'list' && ($filters['from'] ?? null), fn ($q) => $q->whereDate('created_at', '>=', $filters['from']))
            ->when($view === 'list' && ($filters['to'] ?? null), fn ($q) => $q->whereDate('created_at', '<=', $filters['to']));

        $orders = $scope($query)
            ->latest()->latest('id')->paginate(50)->withQueryString()
            ->through(fn (Order $o) => self::card($o));

        // Totals cover every order matching the filters, not just this page. Voided orders are listed but never counted as money.
        $sums = $scope($common(Order::query()))->toBase()->selectRaw(
            "COUNT(*) as n,
            SUM(CASE WHEN status = 'voided' THEN 1 ELSE 0 END) as voided,
            COALESCE(SUM(CASE WHEN status = 'voided' THEN 0 ELSE total END), 0) as total,
            COALESCE(SUM(CASE WHEN status = 'voided' THEN 0 ELSE paid END), 0) as paid,
            COALESCE(SUM(CASE WHEN status = 'voided' THEN 0 ELSE balance END), 0) as balance"
        )->first();

        return Inertia::render('Orders/Index', $shared + [
            'orders' => $orders,
            'totals' => [
                'count' => (int) $sums->n - (int) $sums->voided,
                'voided' => (int) $sums->voided,
                'total' => round((float) $sums->total, 2),
                'paid' => round((float) $sums->paid, 2),
                'balance' => round((float) $sums->balance, 2),
            ],
        ]);
    }

    /** Everything the side panel needs, as JSON, so staff can act without leaving the list. */
    public function peek(Order $order): JsonResponse
    {
        return response()->json(['order' => self::detail($order)]);
    }

    public function show(Order $order): Response
    {
        $timeline = Activity::query()->with('causer')
            ->where('subject_type', $order->getMorphClass())->where('subject_id', $order->id)
            ->latest()->limit(50)->get()
            ->map(fn (Activity $a) => [
                'id' => $a->id,
                'description' => $a->description,
                'causer' => $a->causer?->name,
                'at' => $a->created_at->toIso8601String(),
            ]);

        return Inertia::render('Orders/Show', [
            'order' => self::detail($order),
            'timeline' => $timeline,
            'staff' => User::query()->workingHere()->where('active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    private function counts(User $user): array
    {
        return [
            'today' => Order::query()->notVoided()->whereDate('created_at', today())->count(),
            'board' => Order::query()->jobs()->whereIn('status', ['pending', 'in_production', 'ready'])->count(),
            'overdue' => Order::query()->jobs()->whereIn('status', ['pending', 'in_production'])->where('due_at', '<', now())->count(),
            'ready' => Order::query()->jobs()->where('status', 'ready')->count(),
            'due_today' => Order::query()->jobs()->whereIn('status', ['pending', 'in_production', 'ready'])->whereBetween('due_at', [now()->startOfDay(), now()->endOfDay()])->count(),
            'rush' => Order::query()->jobs()->whereIn('status', ['pending', 'in_production'])->where('rush', true)->count(),
            'to_collect' => round((float) Order::query()->jobs()->where('status', 'ready')->sum('balance'), 2),
        ];
    }

    public static function detail(Order $order): array
    {
        $order->loadMissing(['customer', 'items', 'payments.user:id,name', 'assignee:id,name', 'cashier:id,name', 'files.user:id,name', 'revisions.user:id,name']);

        return self::card($order) + [
            'print_count' => (int) $order->print_count,
            'proof_approved_at' => $order->proof_approved_at?->toIso8601String(),
            'files' => $order->files->map(fn (OrderFile $f) => [
                'id' => $f->id, 'kind' => $f->kind, 'name' => $f->original_name, 'mime' => $f->mime, 'size' => (int) $f->size,
                'is_image' => $f->isImage(), 'note' => $f->note, 'user' => $f->user?->name, 'at' => $f->created_at->toIso8601String(),
                'url' => route('orders.files.show', [$order->id, $f->id]),
                'preview_url' => route('orders.files.show', [$order->id, $f->id, 'inline' => 1]),
            ])->values(),
            'revisions' => $order->revisions->map(fn ($r) => [
                'id' => $r->id, 'reason' => $r->reason, 'old_total' => (float) $r->old_total, 'new_total' => (float) $r->new_total,
                'collected' => (float) $r->collected, 'refunded' => (float) $r->refunded, 'user' => $r->user?->name, 'at' => $r->created_at->toIso8601String(),
                'old_lines' => $r->old_lines, 'new_lines' => $r->new_lines,
            ])->values(),
            'subtotal' => (float) $order->subtotal,
            'discount_total' => (float) $order->discount_total,
            'senior_pwd' => $order->senior_pwd,
            'senior_pwd_discount' => (float) $order->senior_pwd_discount,
            'tax_total' => (float) $order->tax_total,
            'cost_total' => (float) $order->cost_total,
            'notes' => $order->notes,
            'void_reason' => $order->void_reason,
            'assigned_to' => $order->assigned_to,
            'customer_id' => $order->customer_id,
            'customer_phone' => $order->customer?->phone,
            'customer_balance' => (float) ($order->customer?->credit_balance ?? 0),
            'lines' => $order->items->map(fn ($i) => [
                'id' => $i->id, 'item_type' => $i->item_type, 'name' => $i->name, 'spec' => $i->spec,
                'qty' => (float) $i->qty, 'unit_price' => (float) $i->unit_price, 'gross' => (float) $i->gross,
                'discount_amount' => (float) $i->discount_amount, 'line_total' => (float) $i->line_total, 'note' => $i->note,
            ])->values(),
            'payments' => $order->payments->sortBy('created_at')->values()->map(fn ($p) => [
                'id' => $p->id, 'method' => $p->method, 'kind' => $p->kind, 'amount' => (float) $p->amount,
                'tendered' => $p->tendered !== null ? (float) $p->tendered : null, 'reference' => $p->reference,
                'user' => $p->user?->name, 'at' => $p->created_at->toIso8601String(),
            ]),
        ];
    }

    /** Change the items on an order after checkout (add, return, fix a size). */
    public function change(Request $request, Order $order): Response|RedirectResponse
    {
        if ($order->status === 'voided') {
            return redirect()->route('orders.show', $order)->with('error', 'This order was voided and can not be changed.');
        }
        $order->load(['items', 'customer']);

        return Inertia::render('Orders/Change', [
            'order' => self::detail($order),
            'lines' => $order->items->map(fn ($i) => [
                'item_type' => $i->item_type,
                'item_id' => $i->item_id,
                'qty' => (float) $i->qty,
                'spec' => $i->spec ?? [],
                'discount_type' => $i->discount_type,
                'discount_value' => (float) $i->discount_value,
                'note' => $i->note ?? '',
            ])->values(),
            'orderDiscount' => ['type' => $order->discount_type, 'value' => (float) $order->discount_value, 'senior_pwd' => $order->senior_pwd],
            'catalog' => PosController::catalog(),
            'canRefund' => $request->user()->can('orders.refund'),
            'canDiscount' => $request->user()->can('pos.discount'),
        ]);
    }

    public function saveChange(OrderChangeRequest $request, Order $order, OrderChangeService $changes): RedirectResponse
    {
        $updated = $changes->apply($order, $request->validated(), $request->user());

        return redirect()->route('orders.show', $updated)->with('success', "{$updated->order_no} updated. New total ₱".number_format((float) $updated->total, 2).'.');
    }

    public function status(OrderStatusRequest $request, Order $order, OrderService $service): RedirectResponse
    {
        $service->moveOnBoard($order, $request->validated('status'), $request->user(), $request->validated('position'));

        return back();
    }

    public function update(OrderUpdateRequest $request, Order $order): RedirectResponse
    {
        $order->update($request->validated());

        return back()->with('success', "Updated {$order->order_no}.");
    }

    public function void(VoidOrderRequest $request, Order $order, OrderService $service): RedirectResponse
    {
        $service->void($order, $request->validated('reason'), $request->user());

        return back()->with('success', "{$order->order_no} voided. Stock is back on the shelf and any cash was refunded from your drawer.");
    }

    public function collect(CollectPaymentRequest $request, Order $order, ReceivableService $receivables): RedirectResponse
    {
        if (! $order->customer_id || (float) $order->balance <= 0) {
            return back()->with('error', 'This order has no balance to collect.');
        }
        if ((float) $request->validated('amount') - (float) $order->balance > 0.009) {
            return back()->withErrors(['amount' => 'This order only owes ₱'.number_format((float) $order->balance, 2).'.']);
        }

        $receivables->settle($order->customer, (float) $request->validated('amount'), $request->validated('method'), $request->validated('reference'), $request->user(), $order->id);

        return back()->with('success', 'Payment recorded on '.$order->order_no.'.');
    }

    public function receipt(Order $order)
    {
        $order->load(['customer', 'items', 'payments', 'cashier:id,name']);

        return Pdf::loadView('pdf.receipt', ['order' => $order, 'shop' => Shop::profile()])
            ->setPaper([0, 0, 226.77, 360 + $order->items->count() * 34 + $order->payments->count() * 14])
            ->stream("receipt-{$order->order_no}.pdf");
    }

    public function ticket(Order $order)
    {
        $order->load(['customer', 'items', 'assignee:id,name']);

        return Pdf::loadView('pdf.ticket', ['order' => $order, 'shop' => Shop::profile()])
            ->setPaper('a5')
            ->stream("job-ticket-{$order->order_no}.pdf");
    }

    public static function card(Order $o): array
    {
        return [
            'id' => $o->id,
            'order_no' => $o->order_no,
            'type' => $o->type,
            'status' => $o->status,
            'customer' => $o->customer?->name ?? 'Walk-in',
            'summary' => $o->relationLoaded('items')
                ? $o->items->take(3)->map(fn ($i) => self::lineSummary($i->name, (float) $i->qty, $i->spec))->implode('; ').($o->items->count() > 3 ? '; +'.($o->items->count() - 3).' more' : '')
                : null,
            'total' => (float) $o->total,
            'paid' => (float) $o->paid,
            'balance' => (float) $o->balance,
            'payment_status' => $o->payment_status,
            'due_at' => $o->due_at?->toIso8601String(),
            'rush' => $o->rush,
            'assignee' => $o->relationLoaded('assignee') ? $o->assignee?->name : null,
            'cashier' => $o->relationLoaded('cashier') ? $o->cashier?->name : null,
            'methods' => $o->relationLoaded('payments') ? $o->payments->where('amount', '>', 0)->pluck('method')->unique()->values()->all() : [],
            'created_at' => $o->created_at->toIso8601String(),
            'status_changed_at' => $o->status_changed_at?->toIso8601String(),
            'released_at' => $o->released_at?->toIso8601String(),
            'proof_status' => $o->proof_status ?? 'none',
            'files_count' => (int) ($o->files_count ?? ($o->relationLoaded('files') ? $o->files->count() : 0)),
        ];
    }

    public static function lineSummary(string $name, float $qty, ?array $spec): string
    {
        $qtyText = rtrim(rtrim(number_format($qty, 3, '.', ''), '0'), '.');
        $size = ($spec['width'] ?? null) ? ' '.rtrim(rtrim((string) $spec['width'], '0'), '.').'×'.rtrim(rtrim((string) $spec['height'], '0'), '.').' '.$spec['unit'] : '';

        return "{$qtyText}× {$name}{$size}";
    }
}
