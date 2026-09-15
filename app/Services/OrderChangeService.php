<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderRevision;
use App\Models\Receivable;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Change the items on an order after checkout: add more, return some, fix a size.
 * Old lines go back on the shelf, new lines come off it, and the money difference is
 * collected, refunded, or left on the customer's account. Every change is kept as a revision.
 */
class OrderChangeService
{
    public function __construct(
        private CartBuilder $cart,
        private OrderStock $orderStock,
        private DrawerService $drawer,
    ) {}

    public function apply(Order $order, array $data, User $by): Order
    {
        return DB::transaction(function () use ($order, $data, $by) {
            $order = Order::query()->with(['items', 'receivable', 'customer'])->whereKey($order->id)->lockForUpdate()->firstOrFail();
            if ($order->status === 'voided') {
                throw ValidationException::withMessages(['lines' => 'This order was voided and can not be changed.']);
            }

            // The order keeps the discounts it was sold with. Staff without discount rights can't add new ones:
            // a line only keeps a discount if the same item already had one.
            $lines = $data['lines'];
            if (! $by->can('pos.discount')) {
                $existing = $order->items->filter(fn ($i) => $i->discount_type)->keyBy(fn ($i) => $i->item_type.':'.$i->item_id);
                $lines = array_map(function ($line) use ($existing) {
                    $old = $existing->get($line['item_type'].':'.$line['item_id']);
                    $line['discount_type'] = $old?->discount_type;
                    $line['discount_value'] = $old ? (float) $old->discount_value : 0;

                    return $line;
                }, $lines);
            }

            $built = $this->cart->build(
                $lines,
                $order->discount_type,
                (float) $order->discount_value,
                (bool) $order->senior_pwd,
                true,
            );
            $totals = $built['totals'];
            $oldTotal = (float) $order->total;
            $newTotal = $totals['total'];

            if (isset($data['expected_total']) && abs((float) $data['expected_total'] - $newTotal) > 0.01) {
                throw ValidationException::withMessages(['lines' => 'Prices changed while you were editing. The order now totals ₱'.number_format($newTotal, 2).'. Check it and save again.']);
            }
            if ($newTotal < $oldTotal - 0.009 && ! $by->can('orders.refund')) {
                throw ValidationException::withMessages(['lines' => 'Lowering an order total counts as a return. Your account can add items but not refund; ask a manager.']);
            }

            $oldLines = $order->items->map(fn ($i) => ['name' => $i->name, 'qty' => (float) $i->qty, 'line_total' => (float) $i->line_total, 'spec' => $i->spec])->values()->all();

            // Everything from the old version goes back, then the new version comes off the shelf.
            foreach ($order->items as $item) {
                $this->orderStock->restore($item, $order, $by, 'order_change');
            }
            $order->items()->delete();
            foreach ($built['lines'] as $line) {
                $order->items()->create(CartBuilder::row($line));
                $this->orderStock->deduct($line, $order, $by);
            }

            $order->fill([
                'subtotal' => $totals['subtotal'],
                'discount_total' => $totals['discount_total'],
                'senior_pwd_discount' => $totals['senior_pwd_discount'],
                'tax_total' => $totals['tax_total'],
                'total' => $newTotal,
                'cost_total' => $built['cost_total'],
                'rush' => $order->rush || $built['lines']->contains(fn ($l) => $l['spec']['rush'] ?? false),
            ]);

            $paid = (float) $order->paid;
            $difference = round($newTotal - $paid, 2);
            $collected = 0.0;
            $refunded = 0.0;

            if ($difference < -0.009) {
                $refunded = -$difference;
                $method = $data['refund_method'] ?? 'cash';
                $session = $method === 'cash' ? $this->drawer->requireOpen($by, 'refund_method') : $by->openSession;
                $order->payments()->create([
                    'customer_id' => $order->customer_id,
                    'method' => $method,
                    'kind' => 'refund',
                    'amount' => -$refunded,
                    'reference' => $data['refund_reference'] ?? 'CHANGE '.$order->order_no,
                    'cashier_session_id' => $session?->id,
                    'user_id' => $by->id,
                ]);
                if ($method === 'cash' && $session) {
                    $this->drawer->post($session, 'refund', -$refunded, $order, "Refund on {$order->order_no}", $by->id);
                }
                $order->paid = round($paid - $refunded, 2);
            } elseif ($difference > 0.009 && (float) ($data['collect_amount'] ?? 0) > 0) {
                $collected = round(min((float) $data['collect_amount'], $difference), 2);
                $method = $data['collect_method'] ?? 'cash';
                if (in_array($method, ['gcash', 'bank'], true) && blank($data['collect_reference'] ?? null)) {
                    throw ValidationException::withMessages(['collect_reference' => 'Add the reference number for this '.($method === 'gcash' ? 'GCash' : 'bank').' payment.']);
                }
                $session = $method === 'cash' ? $this->drawer->requireOpen($by, 'collect_method') : $by->openSession;
                $payment = $order->payments()->create([
                    'customer_id' => $order->customer_id,
                    'method' => $method,
                    'kind' => 'sale',
                    'amount' => $collected,
                    'reference' => $data['collect_reference'] ?? null,
                    'cashier_session_id' => $session?->id,
                    'user_id' => $by->id,
                ]);
                if ($method === 'cash' && $session) {
                    $this->drawer->post($session, 'sale', $collected, $order, "Added items, {$order->order_no}", $by->id);
                }
                $order->paid = round($paid + $collected, 2);
            }

            $order->refreshPaymentStatus();
            if ((float) $order->balance > 0 && ! $order->customer_id) {
                throw ValidationException::withMessages(['collect_amount' => 'This is a walk-in sale, so the extra ₱'.number_format((float) $order->balance, 2).' has to be collected now.']);
            }
            $order->save();

            // Keep the customer's account in step with the new balance.
            $receivable = $order->receivable;
            if ($receivable) {
                $receivable->amount = round((float) $receivable->settled + (float) $order->balance, 2);
                $receivable->status = (float) $order->balance > 0 ? 'open' : 'settled';
                $receivable->save();
            } elseif ((float) $order->balance > 0) {
                Receivable::query()->create([
                    'customer_id' => $order->customer_id,
                    'order_id' => $order->id,
                    'amount' => $order->balance,
                    'due_date' => $order->due_at?->toDateString() ?? now()->addDays((int) Setting::get('credit_terms_days', 30))->toDateString(),
                ]);
            }
            if ($order->customer_id) {
                Customer::withTrashed()->find($order->customer_id)?->recalculateBalance();
            }

            $newLines = $built['lines']->map(fn ($l) => ['name' => $l['name'], 'qty' => (float) $l['qty'], 'line_total' => $l['line_total'], 'spec' => $l['spec']])->values()->all();
            OrderRevision::query()->create([
                'order_id' => $order->id,
                'reason' => $data['reason'],
                'old_total' => $oldTotal,
                'new_total' => $newTotal,
                'collected' => $collected,
                'refunded' => $refunded,
                'old_lines' => $oldLines,
                'new_lines' => $newLines,
                'user_id' => $by->id,
            ]);

            activity('sales')->performedOn($order)->causedBy($by)
                ->withProperties(['reason' => $data['reason'], 'old_total' => $oldTotal, 'new_total' => $newTotal, 'collected' => $collected, 'refunded' => $refunded])
                ->log("Changed items on {$order->order_no}: ₱".number_format($oldTotal, 2).' to ₱'.number_format($newTotal, 2));

            return $order;
        });
    }
}
