<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Service;
use App\Models\User;

/**
 * What an order line takes off the shelf, and how to put it back.
 * Shared by checkout, voids and order changes so the three always agree.
 */
class OrderStock
{
    public function __construct(private StockService $stock) {}

    /** Deduct a priced line from CartBuilder (product stock, or the service's material recipe). */
    public function deduct(array $line, Order $order, User $by): void
    {
        $meta = ['ref' => $order->order_no, 'source' => $order, 'user_id' => $by->id, 'reason' => 'sale'];

        if ($line['model'] instanceof Product) {
            $this->stock->move($line['model'], -$line['qty'], 'sale', $meta);

            return;
        }

        /** @var Service $service */
        $service = $line['model'];
        foreach ($service->materials as $material) {
            if (! $material->inventoryItem) {
                continue;
            }
            $use = Pricing::materialQty($material->basis, (float) $material->qty_per_unit, (float) $line['qty'], (float) ($line['spec']['sqft'] ?? 0));
            if ($use > 0) {
                // Materials may dip below zero: the job still happened, and the ledger shows the shortfall.
                $this->stock->move($material->inventoryItem, -$use, 'sale', $meta + ['allow_negative' => true]);
            }
        }
    }

    /** Put a saved order line back: product stock, or the materials its service used. */
    public function restore(OrderItem $item, Order $order, User $by, string $reason): void
    {
        $meta = ['ref' => $order->order_no, 'source' => $order, 'user_id' => $by->id, 'reason' => $reason, 'allow_negative' => true];

        if ($item->item_type === 'product') {
            if ($product = Product::withTrashed()->find($item->item_id)) {
                $this->stock->move($product, (float) $item->qty, 'return', $meta);
            }

            return;
        }

        $service = Service::withTrashed()->with('materials.inventoryItem')->find($item->item_id);
        foreach ($service?->materials ?? [] as $material) {
            $use = Pricing::materialQty($material->basis, (float) $material->qty_per_unit, (float) $item->qty, (float) ($item->spec['sqft'] ?? 0));
            if ($use > 0 && $material->inventoryItem) {
                $this->stock->move($material->inventoryItem, $use, 'return', $meta);
            }
        }
    }
}
