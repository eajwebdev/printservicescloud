<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\InventoryItem;
use App\Models\Order;
use App\Models\Product;
use App\Models\Quotation;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Feeds the Ctrl/Cmd-K palette. Only returns records from pages the user can open. */
class SearchController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        $user = $request->user();
        if (mb_strlen($q) < 2) {
            return response()->json(['results' => []]);
        }
        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $q).'%';
        $results = collect();

        if ($user->can('orders.view')) {
            $results = $results->concat(Order::query()->with('customer:id,name')
                ->where(fn ($w) => $w->where('order_no', 'like', $like)->orWhereHas('customer', fn ($c) => $c->where('name', 'like', $like)))
                ->latest()->limit(5)->get()
                ->map(fn ($o) => ['group' => 'Orders', 'label' => $o->order_no, 'hint' => ($o->customer?->name ?? 'Walk-in').', ₱'.number_format((float) $o->total, 2), 'url' => route('orders.show', $o)]));
        }
        if ($user->can('customers.view')) {
            $results = $results->concat(Customer::query()->where(fn ($w) => $w->where('name', 'like', $like)->orWhere('phone', 'like', $like)->orWhere('business_name', 'like', $like))
                ->limit(5)->get()
                ->map(fn ($c) => ['group' => 'Customers', 'label' => $c->name, 'hint' => $c->phone ?? $c->business_name ?? '', 'url' => route('customers.show', $c)]));
        }
        if ($user->can('products.view')) {
            $results = $results->concat(Product::query()->where(fn ($w) => $w->where('name', 'like', $like)->orWhere('sku', 'like', $like)->orWhere('barcode', $q))
                ->limit(5)->get()
                ->map(fn ($p) => ['group' => 'Products', 'label' => $p->name, 'hint' => $p->sku, 'url' => route('products.show', $p)]));
        }
        if ($user->can('services.view')) {
            $results = $results->concat(Service::query()->where('name', 'like', $like)->limit(5)->get()
                ->map(fn ($s) => ['group' => 'Services', 'label' => $s->name, 'hint' => str_replace('_', ' ', $s->pricing_model), 'url' => $user->can('services.edit') ? route('services.edit', $s) : route('services.index')]));
        }
        if ($user->can('inventory.view')) {
            $results = $results->concat(InventoryItem::query()->where(fn ($w) => $w->where('name', 'like', $like)->orWhere('sku', 'like', $like))->limit(5)->get()
                ->map(fn ($i) => ['group' => 'Inventory', 'label' => $i->name, 'hint' => rtrim(rtrim((string) $i->stock, '0'), '.').' '.$i->unit.' on hand', 'url' => route('inventory.show', $i)]));
        }
        if ($user->can('quotations.view')) {
            $results = $results->concat(Quotation::query()->where('quote_no', 'like', $like)->orWhere('customer_name', 'like', $like)->limit(4)->get()
                ->map(fn ($qt) => ['group' => 'Quotations', 'label' => $qt->quote_no, 'hint' => '₱'.number_format((float) $qt->total, 2), 'url' => route('quotations.show', $qt)]));
        }

        return response()->json(['results' => $results->values()]);
    }
}
