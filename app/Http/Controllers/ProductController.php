<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProductRequest;
use App\Models\InventoryItem;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Services\StockService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ProductController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->only(['q', 'category', 'stock', 'status']);

        $products = Product::query()->with(['supplier:id,name', 'inventoryItem:id,name,stock,unit'])
            ->when($filters['q'] ?? null, fn ($q, $t) => $q->where(fn ($w) => $w->where('name', 'like', "%{$t}%")->orWhere('sku', 'like', "%{$t}%")->orWhere('barcode', $t)))
            ->when($filters['category'] ?? null, fn ($q, $c) => $q->where('category', $c))
            ->when(($filters['stock'] ?? null) === 'low', fn ($q) => $q->lowStock()->where('stock', '>', 0))
            ->when(($filters['stock'] ?? null) === 'out', fn ($q) => $q->whereNull('inventory_item_id')->where('stock', '<=', 0))
            ->when(($filters['status'] ?? null) === 'inactive', fn ($q) => $q->where('active', false), fn ($q) => $q->where('active', true))
            ->orderBy('name')->paginate(50)->withQueryString()
            ->through(fn (Product $p) => self::row($p));

        return Inertia::render('Products/Index', [
            'products' => $products,
            'filters' => $filters,
            'categories' => Product::query()->whereNotNull('category')->distinct()->orderBy('category')->pluck('category'),
            'suppliers' => Supplier::query()->orderBy('name')->get(['id', 'name']),
            'materials' => InventoryItem::query()->where('active', true)->orderBy('name')->get(['id', 'name', 'unit']),
            'reasons' => StockService::ADJUST_REASONS,
            'counts' => [
                'active' => Product::query()->where('active', true)->count(),
                'low' => Product::query()->lowStock()->where('stock', '>', 0)->count(),
                'out' => Product::query()->where('active', true)->whereNull('inventory_item_id')->where('stock', '<=', 0)->count(),
                'inactive' => Product::query()->where('active', false)->count(),
            ],
        ]);
    }

    public function show(Product $product): Response
    {
        $product->load(['supplier:id,name', 'inventoryItem:id,name,stock,unit']);
        $ledger = StockMovement::query()->with('user:id,name')
            ->where(fn ($q) => $q->where(['item_type' => 'product', 'item_id' => $product->id])
                ->when($product->inventory_item_id, fn ($w) => $w->orWhere(fn ($x) => $x->where(['item_type' => 'inventory', 'item_id' => $product->inventory_item_id]))))
            ->latest()->paginate(30)
            ->through(fn (StockMovement $m) => InventoryController::movementRow($m));

        $sold30 = DB::table('order_items')->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('order_items.item_type', 'product')->where('order_items.item_id', $product->id)
            ->where('orders.status', '!=', 'voided')->where('orders.created_at', '>=', now()->subDays(30))
            ->selectRaw('COALESCE(SUM(order_items.qty),0) as qty, COALESCE(SUM(order_items.line_total),0) as revenue')->first();

        return Inertia::render('Products/Show', [
            'product' => self::row($product),
            'ledger' => $ledger,
            'sold30' => ['qty' => (float) $sold30->qty, 'revenue' => (float) $sold30->revenue],
        ]);
    }

    public function store(ProductRequest $request, StockService $stock): RedirectResponse
    {
        $data = $request->validated();
        DB::transaction(function () use ($data, $stock) {
            $product = Product::query()->create($data);
            if (! $product->inventory_item_id && ($data['opening_stock'] ?? 0) > 0) {
                $stock->move($product, (float) $data['opening_stock'], 'in', ['reason' => 'opening_stock', 'ref' => 'Opening stock', 'unit_cost' => $product->cost]);
            }
        });

        return back()->with('success', "Added {$data['name']}.");
    }

    public function update(ProductRequest $request, Product $product): RedirectResponse
    {
        $product->update(collect($request->validated())->except('opening_stock')->all());

        return back()->with('success', "Saved {$product->name}.");
    }

    public function destroy(Product $product): RedirectResponse
    {
        $product->delete();

        return redirect()->route('products.index')->with('success', "{$product->name} removed from the catalog. Past sales keep their record.");
    }

    public static function row(Product $p): array
    {
        return [
            'id' => $p->id, 'name' => $p->name, 'sku' => $p->sku, 'barcode' => $p->barcode, 'category' => $p->category,
            'price' => (float) $p->price, 'cost' => (float) $p->cost, 'stock' => $p->availableStock(),
            'reorder_level' => (int) $p->reorder_level, 'supplier_id' => $p->supplier_id, 'supplier' => $p->supplier?->name,
            'inventory_item_id' => $p->inventory_item_id, 'inventory_item' => $p->inventoryItem?->name,
            'active' => $p->active,
            'margin' => (float) $p->price > 0 ? round(((float) $p->price - (float) $p->cost) / (float) $p->price * 100, 1) : null,
            'low' => ! $p->inventory_item_id && $p->stock <= $p->reorder_level,
        ];
    }
}
