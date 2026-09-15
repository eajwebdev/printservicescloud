<?php

namespace App\Services;

use App\Models\InventoryItem;
use App\Models\Product;
use App\Models\StockMovement;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

/**
 * Every stock change goes through here so the ledger always matches the count.
 * Call inside a DB transaction; rows are locked before they are changed.
 */
class StockService
{
    public const ADJUST_REASONS = [
        'count_correction' => 'Count correction',
        'damaged' => 'Damaged',
        'misprint' => 'Misprint / wastage',
        'test_print' => 'Test print / sample',
        'found' => 'Found stock',
        'returned_to_supplier' => 'Returned to supplier',
        'other' => 'Other',
    ];

    /**
     * Move stock by a signed quantity and write the ledger row.
     */
    public function move(Product|InventoryItem $item, float $qty, string $type, array $meta = []): StockMovement
    {
        // A product that is a resold raw material keeps its stock on the inventory item.
        if ($item instanceof Product && $item->inventory_item_id) {
            $item = InventoryItem::query()->whereKey($item->inventory_item_id)->lockForUpdate()->firstOrFail();
        } else {
            $item = $item->newQuery()->withTrashed()->whereKey($item->getKey())->lockForUpdate()->firstOrFail();
        }

        $current = (float) $item->stock;
        $next = round($current + $qty, 3);

        if ($item instanceof Product && $next < 0 && ! ($meta['allow_negative'] ?? false)) {
            throw ValidationException::withMessages([
                'lines' => "Only {$this->fmt($current)} left of {$item->name}. Lower the quantity or restock first.",
            ]);
        }

        $item->forceFill(['stock' => $item instanceof Product ? (int) round($next) : $next])->saveQuietly();

        return StockMovement::query()->create([
            'item_type' => $item instanceof Product ? 'product' : 'inventory',
            'item_id' => $item->getKey(),
            'type' => $type,
            'qty' => $qty,
            'balance_after' => $next,
            'unit_cost' => $meta['unit_cost'] ?? null,
            'reason' => $meta['reason'] ?? null,
            'ref' => $meta['ref'] ?? null,
            'source_type' => isset($meta['source']) && $meta['source'] instanceof Model ? $meta['source']->getMorphClass() : null,
            'source_id' => isset($meta['source']) && $meta['source'] instanceof Model ? $meta['source']->getKey() : null,
            'user_id' => $meta['user_id'] ?? auth()->id(),
        ]);
    }

    /** Receive stock at a unit cost, updating the moving-average cost. */
    public function receive(Product|InventoryItem $item, float $qty, float $unitCost, array $meta = []): StockMovement
    {
        $target = $item instanceof Product && $item->inventory_item_id
            ? InventoryItem::query()->whereKey($item->inventory_item_id)->lockForUpdate()->firstOrFail()
            : $item->newQuery()->withTrashed()->whereKey($item->getKey())->lockForUpdate()->firstOrFail();

        $onHand = max(0, (float) $target->stock);
        $oldCost = (float) $target->cost;
        $newCost = ($onHand + $qty) > 0 ? (($onHand * $oldCost) + ($qty * $unitCost)) / ($onHand + $qty) : $unitCost;
        $target->forceFill(['cost' => round($newCost, 4)])->saveQuietly();

        return $this->move($item, $qty, 'purchase', $meta + ['unit_cost' => $unitCost]);
    }

    /** Set an item to a physically counted quantity. */
    public function count(Product|InventoryItem $item, float $counted, array $meta = []): ?StockMovement
    {
        $current = $item instanceof Product ? $item->availableStock() : (float) $item->stock;
        $diff = round($counted - $current, 3);
        if (abs($diff) < 0.0005) {
            return null;
        }

        return $this->move($item, $diff, 'count', $meta + ['reason' => 'count_correction', 'allow_negative' => true]);
    }

    private function fmt(float $n): string
    {
        return rtrim(rtrim(number_format($n, 3, '.', ''), '0'), '.');
    }
}
