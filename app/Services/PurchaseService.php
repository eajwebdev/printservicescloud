<?php

namespace App\Services;

use App\Models\InventoryItem;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PurchaseService
{
    public function __construct(private StockService $stock) {}

    public function save(?Purchase $purchase, array $data, User $by): Purchase
    {
        return DB::transaction(function () use ($purchase, $data, $by) {
            if ($purchase && ! in_array($purchase->status, ['draft', 'ordered'], true)) {
                throw ValidationException::withMessages(['items' => 'Received purchase orders are locked. Start a new PO for extra stock.']);
            }

            $purchase ??= new Purchase(['po_no' => Sequence::next('purchase'), 'status' => 'draft', 'user_id' => $by->id]);
            $purchase->fill([
                'supplier_id' => $data['supplier_id'],
                'expected_at' => $data['expected_at'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);
            $purchase->save();

            $purchase->items()->delete();
            $total = 0;
            foreach ($data['items'] as $row) {
                $model = $row['item_type'] === 'product' ? Product::query()->findOrFail($row['item_id']) : InventoryItem::query()->findOrFail($row['item_id']);
                $line = round((float) $row['qty_ordered'] * (float) $row['unit_cost'], 2);
                $total += $line;
                $purchase->items()->create([
                    'item_type' => $row['item_type'],
                    'item_id' => $model->id,
                    'name' => $model->name,
                    'qty_ordered' => $row['qty_ordered'],
                    'unit_cost' => $row['unit_cost'],
                    'line_total' => $line,
                ]);
            }
            $purchase->update(['total' => round($total, 2)]);

            if (($data['submit'] ?? false) && $purchase->status === 'draft') {
                $purchase->update(['status' => 'ordered', 'ordered_at' => now()]);
            }

            return $purchase;
        });
    }

    /** @param array<int, float> $quantities purchase_item_id => qty received now */
    public function receive(Purchase $purchase, array $quantities, User $by): Purchase
    {
        return DB::transaction(function () use ($purchase, $quantities, $by) {
            $purchase = Purchase::query()->with('items')->whereKey($purchase->id)->lockForUpdate()->firstOrFail();
            if (! in_array($purchase->status, ['ordered', 'partial'], true)) {
                throw ValidationException::withMessages(['items' => 'Mark this PO as ordered before receiving stock.']);
            }

            $receivedAny = false;
            foreach ($purchase->items as $item) {
                $qty = round((float) ($quantities[$item->id] ?? 0), 3);
                if ($qty <= 0) {
                    continue;
                }
                $remaining = (float) $item->qty_ordered - (float) $item->qty_received;
                if ($qty - $remaining > 0.0005) {
                    throw ValidationException::withMessages(["items.{$item->id}" => "Only {$remaining} of {$item->name} is still due on this PO."]);
                }
                $model = $item->item_type === 'product' ? Product::withTrashed()->findOrFail($item->item_id) : InventoryItem::withTrashed()->findOrFail($item->item_id);
                $this->stock->receive($model, $qty, (float) $item->unit_cost, [
                    'ref' => $purchase->po_no, 'source' => $purchase, 'user_id' => $by->id, 'reason' => 'purchase',
                ]);
                $item->increment('qty_received', $qty);
                $receivedAny = true;
            }

            if (! $receivedAny) {
                throw ValidationException::withMessages(['items' => 'Enter how much arrived for at least one line.']);
            }

            $purchase->load('items');
            $complete = $purchase->items->every(fn ($i) => (float) $i->qty_received >= (float) $i->qty_ordered);
            $purchase->update(['status' => $complete ? 'received' : 'partial', 'received_at' => $complete ? now() : $purchase->received_at]);

            activity('purchases')->performedOn($purchase)->causedBy($by)->log(($complete ? 'Received ' : 'Partly received ').$purchase->po_no);

            return $purchase;
        });
    }
}
