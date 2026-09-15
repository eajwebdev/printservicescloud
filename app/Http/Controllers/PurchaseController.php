<?php

namespace App\Http\Controllers;

use App\Http\Requests\PurchaseRequest;
use App\Http\Requests\ReceivePurchaseRequest;
use App\Models\InventoryItem;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\Supplier;
use App\Services\PurchaseService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PurchaseController extends Controller
{
    public function __construct(private PurchaseService $purchases) {}

    public function index(Request $request): Response
    {
        $filters = $request->only(['q', 'status', 'supplier']);

        $list = Purchase::query()->with('supplier:id,name')->withCount('items')
            ->when($filters['q'] ?? null, fn ($q, $t) => $q->where('po_no', 'like', "%{$t}%"))
            ->when($filters['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when($filters['supplier'] ?? null, fn ($q, $s) => $q->where('supplier_id', $s))
            ->latest()->paginate(50)->withQueryString()
            ->through(fn (Purchase $p) => [
                'id' => $p->id, 'po_no' => $p->po_no, 'supplier' => $p->supplier?->name, 'status' => $p->status,
                'total' => (float) $p->total, 'items_count' => $p->items_count,
                'expected_at' => $p->expected_at?->toDateString(), 'ordered_at' => $p->ordered_at?->toIso8601String(),
                'received_at' => $p->received_at?->toIso8601String(), 'created_at' => $p->created_at->toIso8601String(),
            ]);

        // Cost trend: last received unit cost per material over the past six months.
        $trend = PurchaseItem::query()
            ->join('purchases', 'purchases.id', '=', 'purchase_items.purchase_id')
            ->whereIn('purchases.status', ['partial', 'received'])
            ->where('purchases.created_at', '>=', now()->subMonths(6))
            ->orderBy('purchases.created_at')
            ->get(['purchase_items.name', 'purchase_items.unit_cost', 'purchases.created_at'])
            // Month buckets are made here, not in SQL, so this runs on MySQL, MariaDB and SQLite alike.
            ->groupBy('name')
            ->map(fn ($rows, $name) => [
                'name' => $name,
                'points' => $rows->groupBy(fn ($r) => \Illuminate\Support\Carbon::parse($r->created_at)->format('Y-m'))
                    ->map(fn ($m, $month) => ['month' => $month, 'cost' => round((float) $m->avg('unit_cost'), 2)])->values(),
            ])
            ->values()->take(6);

        return Inertia::render('Purchases/Index', [
            'purchases' => $list,
            'filters' => $filters,
            'suppliers' => Supplier::query()->orderBy('name')->get(['id', 'name']),
            'counts' => Purchase::query()->selectRaw('status, COUNT(*) as n')->groupBy('status')->pluck('n', 'status'),
            'outstanding' => [
                'count' => Purchase::query()->whereIn('status', ['ordered', 'partial'])->count(),
                'value' => round((float) Purchase::query()->whereIn('status', ['ordered', 'partial'])->sum('total'), 2),
            ],
            'trend' => $trend,
        ]);
    }

    public function create(Request $request): Response
    {
        return Inertia::render('Purchases/Form', $this->formProps(null, $request));
    }

    public function edit(Request $request, Purchase $purchase): Response|RedirectResponse
    {
        if (! in_array($purchase->status, ['draft', 'ordered'], true)) {
            return redirect()->route('purchases.show', $purchase)->with('error', 'Stock has arrived on this PO, so it is locked.');
        }

        return Inertia::render('Purchases/Form', $this->formProps($purchase, $request));
    }

    public function store(PurchaseRequest $request): RedirectResponse
    {
        $purchase = $this->purchases->save(null, $request->validated(), $request->user());

        return redirect()->route('purchases.show', $purchase)->with('success', "{$purchase->po_no} saved.");
    }

    public function update(PurchaseRequest $request, Purchase $purchase): RedirectResponse
    {
        $this->purchases->save($purchase, $request->validated(), $request->user());

        return redirect()->route('purchases.show', $purchase)->with('success', "{$purchase->po_no} updated.");
    }

    public function show(Purchase $purchase): Response
    {
        $purchase->load(['supplier', 'items', 'user:id,name']);

        return Inertia::render('Purchases/Show', [
            'purchase' => [
                'id' => $purchase->id, 'po_no' => $purchase->po_no, 'status' => $purchase->status,
                'supplier' => $purchase->supplier?->only(['id', 'name', 'contact_person', 'phone', 'terms']),
                'expected_at' => $purchase->expected_at?->toDateString(), 'ordered_at' => $purchase->ordered_at?->toIso8601String(),
                'received_at' => $purchase->received_at?->toIso8601String(), 'total' => (float) $purchase->total,
                'notes' => $purchase->notes, 'created_by' => $purchase->user?->name, 'created_at' => $purchase->created_at->toIso8601String(),
                'items' => $purchase->items->map(fn ($i) => [
                    'id' => $i->id, 'item_type' => $i->item_type, 'item_id' => $i->item_id, 'name' => $i->name,
                    'qty_ordered' => (float) $i->qty_ordered, 'qty_received' => (float) $i->qty_received,
                    'unit_cost' => (float) $i->unit_cost, 'line_total' => (float) $i->line_total,
                ]),
            ],
        ]);
    }

    public function markOrdered(Purchase $purchase): RedirectResponse
    {
        if ($purchase->status !== 'draft') {
            return back()->with('error', 'Only drafts can be marked as ordered.');
        }
        $purchase->update(['status' => 'ordered', 'ordered_at' => now()]);

        return back()->with('success', "{$purchase->po_no} marked as ordered.");
    }

    public function receive(ReceivePurchaseRequest $request, Purchase $purchase): RedirectResponse
    {
        $this->purchases->receive($purchase, $request->validated('received'), $request->user());

        return back()->with('success', 'Stock received and costs updated.');
    }

    public function cancel(Purchase $purchase): RedirectResponse
    {
        if (! in_array($purchase->status, ['draft', 'ordered'], true)) {
            return back()->with('error', 'Stock already arrived on this PO, so it can not be cancelled.');
        }
        $purchase->update(['status' => 'cancelled']);

        return back()->with('success', "{$purchase->po_no} cancelled.");
    }

    public function destroy(Purchase $purchase): RedirectResponse
    {
        if ($purchase->status !== 'draft') {
            return back()->with('error', 'Only drafts can be deleted. Cancel an ordered PO instead.');
        }
        $purchase->delete();

        return redirect()->route('purchases.index')->with('success', 'Draft deleted.');
    }

    private function formProps(?Purchase $purchase, Request $request): array
    {
        $purchase?->load('items');
        $prefill = null;
        if (! $purchase && $request->filled('supplier')) {
            // "Reorder low stock" shortcut: pre-fill with this supplier's low items.
            $supplierId = $request->integer('supplier');
            $prefill = InventoryItem::query()->lowStock()->where('supplier_id', $supplierId)->get()
                ->map(fn ($i) => ['item_type' => 'inventory', 'item_id' => $i->id, 'qty_ordered' => max(1, (float) $i->reorder_level * 2 - (float) $i->stock), 'unit_cost' => (float) $i->cost])
                ->concat(Product::query()->lowStock()->where('supplier_id', $supplierId)->get()
                    ->map(fn ($p) => ['item_type' => 'product', 'item_id' => $p->id, 'qty_ordered' => max(1, $p->reorder_level * 2 - $p->stock), 'unit_cost' => (float) $p->cost]))
                ->values();
        }

        return [
            'purchase' => $purchase ? [
                'id' => $purchase->id, 'po_no' => $purchase->po_no, 'status' => $purchase->status, 'supplier_id' => $purchase->supplier_id,
                'expected_at' => $purchase->expected_at?->toDateString(), 'notes' => $purchase->notes,
                'items' => $purchase->items->map(fn ($i) => ['item_type' => $i->item_type, 'item_id' => $i->item_id, 'qty_ordered' => (float) $i->qty_ordered, 'unit_cost' => (float) $i->unit_cost]),
            ] : null,
            'prefill' => ['supplier_id' => $request->integer('supplier') ?: null, 'items' => $prefill],
            'suppliers' => Supplier::query()->orderBy('name')->get(['id', 'name', 'terms']),
            'stockables' => InventoryItem::query()->where('active', true)->orderBy('name')->get()
                ->map(fn ($i) => ['key' => 'inventory:'.$i->id, 'item_type' => 'inventory', 'item_id' => $i->id, 'name' => $i->name, 'unit' => $i->unit, 'cost' => (float) $i->cost, 'stock' => (float) $i->stock, 'supplier_id' => $i->supplier_id])
                ->concat(Product::query()->where('active', true)->whereNull('inventory_item_id')->orderBy('name')->get()
                    ->map(fn ($p) => ['key' => 'product:'.$p->id, 'item_type' => 'product', 'item_id' => $p->id, 'name' => $p->name, 'unit' => 'pc', 'cost' => (float) $p->cost, 'stock' => (float) $p->stock, 'supplier_id' => $p->supplier_id]))
                ->values(),
        ];
    }
}
