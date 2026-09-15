<?php

namespace App\Services;

use App\Jobs\NotifyReadyForPickup;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\Receivable;
use App\Models\Service;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderService
{
    public function __construct(
        private OrderStock $orderStock,
        private DrawerService $drawer,
    ) {}

    public function moveOnBoard(Order $order, string $status, User $by, ?int $position = null): Order
    {
        if ($order->type !== 'job' || $order->status === 'voided') {
            throw ValidationException::withMessages(['status' => 'Only open job orders move on the production board.']);
        }

        return DB::transaction(function () use ($order, $status, $by, $position) {
            $from = $order->status;
            $order->status = $status;
            $order->board_position = $position ?? ((int) Order::query()->where('status', $status)->max('board_position') + 1);
            if ($from !== $status) {
                $order->status_changed_at = now();
                $order->released_at = $status === 'released' ? now() : null;
            }
            $order->save();

            if ($from !== $status) {
                activity('production')->performedOn($order)->causedBy($by)
                    ->withProperties(['from' => $from, 'to' => $status])
                    ->log("Moved {$order->order_no} to ".str_replace('_', ' ', $status));

                if ($status === 'ready' && $order->customer?->phone) {
                    NotifyReadyForPickup::dispatch($order->id);
                }
            }

            return $order;
        });
    }

    /** Void an order: put stock and materials back, refund money taken, cancel the receivable. */
    public function void(Order $order, string $reason, User $by): Order
    {
        return DB::transaction(function () use ($order, $reason, $by) {
            $order = Order::query()->with(['items', 'payments', 'receivable'])->whereKey($order->id)->lockForUpdate()->firstOrFail();
            if ($order->status === 'voided') {
                throw ValidationException::withMessages(['reason' => 'This order is already voided.']);
            }

            $cashTaken = round((float) $order->payments->where('method', 'cash')->sum('amount'), 2);
            $session = $cashTaken > 0 ? $this->drawer->requireOpen($by, 'reason') : null;

            foreach ($order->items as $item) {
                $this->orderStock->restore($item, $order, $by, 'void');
            }

            foreach ($order->payments->groupBy('method') as $method => $group) {
                $amount = round((float) $group->sum('amount'), 2);
                if ($method === 'credit' || $amount <= 0) {
                    continue;
                }
                $order->payments()->create([
                    'customer_id' => $order->customer_id,
                    'method' => $method,
                    'kind' => 'refund',
                    'amount' => -$amount,
                    'reference' => 'VOID '.$order->order_no,
                    'cashier_session_id' => $session?->id,
                    'user_id' => $by->id,
                ]);
                if ($method === 'cash' && $session) {
                    $this->drawer->post($session, 'refund', -$amount, $order, "Void {$order->order_no}", $by->id);
                }
            }

            if ($order->receivable && $order->receivable->status === 'open') {
                $order->receivable->update(['status' => 'written_off']);
                Customer::withTrashed()->find($order->customer_id)?->recalculateBalance();
            }

            $order->update([
                'status' => 'voided',
                'voided_at' => now(),
                'void_reason' => $reason,
                'paid' => 0,
                'balance' => 0,
                'status_changed_at' => now(),
            ]);

            activity('sales')->performedOn($order)->causedBy($by)
                ->withProperties(['reason' => $reason, 'refunded_cash' => $cashTaken])
                ->log("Voided {$order->order_no}");

            return $order;
        });
    }
}
