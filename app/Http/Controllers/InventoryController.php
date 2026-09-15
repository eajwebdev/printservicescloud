<?php

namespace App\Http\Controllers;

use App\Http\Requests\InventoryItemRequest;
use App\Http\Requests\StockAdjustRequest;
use App\Http\Requests\StockCountRequest;
use App\Models\InventoryItem;
use App\Models\Product;
use App\Models\ServiceMaterial;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Services\StockService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class InventoryController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->only(['q', 'category', 'stock']);

        $items = InventoryItem::query()->with('supplier:id,name')
            ->when($filters['q'] ?? null, fn ($q, $t) => $q->where(fn ($w) => $w->where('name', 'like', "%{$t}%")->orWhere('sku', 'like', "%{$t}%")))
            ->when($filters['category'] ?? null, fn ($q, $c) => $q->where('category', $c))
            ->when(($filters['stock'] ?? null) === 'low', fn ($q) => $q->lowStock()->where('stock', '>', 0))
            ->when(($filters['stock'] ?? null) === 'out', fn ($q) => $q->where('stock', '<=', 0))
            ->orderBy('name')->paginate(50)->withQueryString()
            ->through(fn (InventoryItem $i) => self::row($i));

        $recent = StockMovement::query()->with(['user:id,name', 'item'])->latest()->limit(12)->get()
            ->map(fn ($m) => self::movementRow($m));

        return Inertia::render('Inventory/Index', [
            'items' => $items,
            'filters' => $filters,
            'categories' => InventoryItem::query()->whereNotNull('category')->distinct()->orderBy('category')->pluck('category'),
            'suppliers' => Supplier::query()->orderBy('name')->get(['id', 'name']),
            'units' => InventoryItem::UNITS,
            'reasons' => StockService::ADJUST_REASONS,
            'recent' => $recent,
            'stockValue' => round((float) InventoryItem::query()->where('stock', '>', 0)->sum(DB::raw('stock * cost')), 2),
            'counts' => [
                'all' => InventoryItem::query()->count(),
                'low' => InventoryItem::query()->lowStock()->where('stock', '>', 0)->count(),
                'out' => InventoryItem::query()->where('stock', '<=', 0)->count(),
            ],
        ]);
    }

    public function show(InventoryItem $inventoryItem): Response
    {
        $inventoryItem->load('supplier:id,name');
        $ledger = $inventoryItem->movements()->with('user:id,name')->latest()->paginate(30)
            ->through(fn ($m) => self::movementRow($m));

        $usage = StockMovement::query()->where(['item_type' => 'inventory', 'item_id' => $inventoryItem->id, 'type' => 'sale'])
            ->where('created_at', '>=', now()->subDays(30))->sum('qty');

        return Inertia::render('Inventory/Show', [
            'item' => self::row($inventoryItem),
            'ledger' => $ledger,
            'usage30' => abs((float) $usage),
            'usedBy' => ServiceMaterial::query()->with('service:id,name')->where('inventory_item_id', $inventoryItem->id)->get()
                ->map(fn ($m) => ['service_id' => $m->service_id, 'service' => $m->service?->name, 'qty_per_unit' => (float) $m->qty_per_unit, 'basis' => $m->basis]),
            'reasons' => StockService::ADJUST_REASONS,
            'suppliers' => Supplier::query()->orderBy('name')->get(['id', 'name']),
            'units' => InventoryItem::UNITS,
        ]);
    }

    public function store(InventoryItemRequest $request, StockService $stock): RedirectResponse
    {
        $data = $request->validated();
        DB::transaction(function () use ($data, $stock) {
            $item = InventoryItem::query()->create($data);
            if (($data['opening_stock'] ?? 0) > 0) {
                $stock->move($item, (float) $data['opening_stock'], 'in', ['reason' => 'opening_stock', 'ref' => 'Opening stock', 'unit_cost' => $item->cost]);
            }
        });

        return back()->with('success', "Added {$data['name']} to inventory.");
    }

    public function update(InventoryItemRequest $request, InventoryItem $inventoryItem): RedirectResponse
    {
        $inventoryItem->update(collect($request->validated())->except('opening_stock')->all());

        return back()->with('success', "Saved {$inventoryItem->name}.");
    }

    public function destroy(InventoryItem $inventoryItem): RedirectResponse
    {
        if (ServiceMaterial::query()->where('inventory_item_id', $inventoryItem->id)->exists()) {
            return back()->with('error', "{$inventoryItem->name} is in a service recipe. Remove it from those services first.");
        }
        $inventoryItem->delete();

        return redirect()->route('inventory.index')->with('success', "{$inventoryItem->name} removed.");
    }

    public function adjust(StockAdjustRequest $request, StockService $stock): RedirectResponse
    {
        $data = $request->validated();
        $item = $data['item_type'] === 'product' ? Product::query()->findOrFail($data['item_id']) : InventoryItem::query()->findOrFail($data['item_id']);
        $qty = (float) $data['qty'] * ($data['direction'] === 'out' ? -1 : 1);

        DB::transaction(fn () => $stock->move($item, $qty, 'adjustment', [
            'reason' => $data['reason'],
            'ref' => $data['note'] ?? StockService::ADJUST_REASONS[$data['reason']],
            'allow_negative' => false,
        ]));

        return back()->with('success', 'Stock adjusted for '.$item->name.'.');
    }

    public function countSheet(): Response
    {
        return Inertia::render('Inventory/Count', [
            'items' => InventoryItem::query()->where('active', true)->orderBy('category')->orderBy('name')->get()
                ->map(fn ($i) => ['item_type' => 'inventory', 'item_id' => $i->id, 'name' => $i->name, 'category' => $i->category ?? 'Materials', 'unit' => $i->unit, 'system' => (float) $i->stock])
                ->concat(Product::query()->where('active', true)->whereNull('inventory_item_id')->orderBy('name')->get()
                    ->map(fn ($p) => ['item_type' => 'product', 'item_id' => $p->id, 'name' => $p->name, 'category' => 'Products', 'unit' => 'pc', 'system' => (float) $p->stock]))
                ->values(),
        ]);
    }

    public function saveCount(StockCountRequest $request, StockService $stock): RedirectResponse
    {
        $changed = DB::transaction(function () use ($request, $stock) {
            $n = 0;
            foreach ($request->validated('counts') as $row) {
                if ($row['counted'] === null || $row['counted'] === '') {
                    continue;
                }
                $item = $row['item_type'] === 'product' ? Product::query()->find($row['item_id']) : InventoryItem::query()->find($row['item_id']);
                if ($item && $stock->count($item, (float) $row['counted'], ['ref' => 'Stock count '.now()->format('M j')])) {
                    $n++;
                }
            }

            return $n;
        });

        return redirect()->route('inventory.index')->with('success', $changed ? "Count saved. {$changed} item(s) corrected." : 'Count saved. Everything matched.');
    }

    public static function row(InventoryItem $i): array
    {
        return [
            'id' => $i->id, 'name' => $i->name, 'sku' => $i->sku, 'category' => $i->category, 'unit' => $i->unit,
            'stock' => (float) $i->stock, 'cost' => (float) $i->cost, 'reorder_level' => (float) $i->reorder_level,
            'supplier_id' => $i->supplier_id, 'supplier' => $i->supplier?->name, 'active' => $i->active, 'notes' => $i->notes,
            'value' => round(max(0, (float) $i->stock) * (float) $i->cost, 2),
            'low' => (float) $i->stock <= (float) $i->reorder_level,
        ];
    }

    public static function movementRow(StockMovement $m): array
    {
        return [
            'id' => $m->id,
            'item_type' => $m->item_type,
            'item_id' => $m->item_id,
            'item' => $m->relationLoaded('item') ? $m->item?->name : null,
            'type' => $m->type,
            'qty' => (float) $m->qty,
            'balance_after' => (float) $m->balance_after,
            'unit_cost' => $m->unit_cost !== null ? (float) $m->unit_cost : null,
            'reason' => $m->reason ? (StockService::ADJUST_REASONS[$m->reason] ?? str_replace('_', ' ', $m->reason)) : null,
            'ref' => $m->ref,
            'user' => $m->user?->name,
            'at' => $m->created_at->toIso8601String(),
        ];
    }
}
