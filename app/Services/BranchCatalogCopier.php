<?php

namespace App\Services;

use App\Models\InventoryItem;
use App\Models\Product;
use App\Models\Service;
use App\Models\ServiceCategory;
use App\Models\Supplier;
use App\Support\BranchContext;
use Illuminate\Support\Facades\DB;

/**
 * Give a new branch the same price list as an existing one: suppliers, materials, products,
 * service categories and services with their options and material recipes. Stock starts at zero.
 */
class BranchCatalogCopier
{
    /** @return array{suppliers: int, materials: int, products: int, services: int} */
    public function copy(int $fromBranchId, int $toBranchId): array
    {
        $context = BranchContext::current();

        return DB::transaction(function () use ($context, $fromBranchId, $toBranchId) {
            [$suppliers, $materials, $products, $categories, $services] = $context->run($fromBranchId, fn () => [
                Supplier::query()->get(),
                InventoryItem::query()->get(),
                Product::query()->get(),
                ServiceCategory::query()->get(),
                Service::query()->with(['options', 'materials'])->get(),
            ]);

            return $context->run($toBranchId, function () use ($suppliers, $materials, $products, $categories, $services) {
                $supplierMap = [];
                foreach ($suppliers as $s) {
                    $supplierMap[$s->id] = Supplier::query()->create($s->only(['name', 'contact_person', 'phone', 'email', 'address', 'terms', 'notes']))->id;
                }

                $materialMap = [];
                foreach ($materials as $m) {
                    $copy = InventoryItem::query()->create($m->only(['name', 'sku', 'category', 'unit', 'cost', 'reorder_level', 'active', 'notes']) + [
                        'supplier_id' => $supplierMap[$m->supplier_id] ?? null,
                    ]);
                    $materialMap[$m->id] = $copy->id;
                }

                foreach ($products as $p) {
                    Product::query()->create($p->only(['name', 'sku', 'barcode', 'category', 'price', 'cost', 'reorder_level', 'active']) + [
                        'supplier_id' => $supplierMap[$p->supplier_id] ?? null,
                        'inventory_item_id' => $materialMap[$p->inventory_item_id] ?? null,
                    ]);
                }

                $categoryMap = [];
                foreach ($categories as $c) {
                    $categoryMap[$c->id] = ServiceCategory::query()->create($c->only(['name', 'sort']))->id;
                }

                foreach ($services as $s) {
                    if (! isset($categoryMap[$s->service_category_id])) {
                        continue;
                    }
                    $copy = Service::query()->create($s->only(['name', 'code', 'pricing_model', 'base_price', 'cost', 'min_charge', 'tiers', 'unit_label', 'is_job', 'lead_time_hours', 'active', 'description']) + [
                        'service_category_id' => $categoryMap[$s->service_category_id],
                    ]);
                    foreach ($s->options as $o) {
                        $copy->options()->create($o->only(['name', 'price_type', 'price', 'active', 'sort']));
                    }
                    foreach ($s->materials as $m) {
                        if (isset($materialMap[$m->inventory_item_id])) {
                            $copy->materials()->create(['inventory_item_id' => $materialMap[$m->inventory_item_id], 'qty_per_unit' => $m->qty_per_unit, 'basis' => $m->basis]);
                        }
                    }
                }

                return ['suppliers' => count($supplierMap), 'materials' => count($materialMap), 'products' => $products->count(), 'services' => $services->count()];
            });
        });
    }
}
