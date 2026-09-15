<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\Quotation;
use App\Models\Receivable;
use App\Models\Service;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CheckoutService
{
    public function __construct(
        private CartBuilder $cart,
        private OrderStock $orderStock,
        private DrawerService $drawer,
    ) {}

    /**
     * Complete a sale or job order in one transaction: price, number, deduct
     * stock and materials, take payments, post cash, book any receivable.
     */
    public function checkout(User $user, array $data): Order
    {
        return DB::transaction(function () use ($user, $data) {
            $session = $this->drawer->requireOpen($user);

            $canDiscount = $user->can('pos.discount');
            $built = $this->cart->build(
                $data['lines'],
                $data['discount_type'] ?? null,
                (float) ($data['discount_value'] ?? 0),
                (bool) ($data['senior_pwd'] ?? false),
                $canDiscount,
            );
            $totals = $built['totals'];
            $total = $totals['total'];

            if (isset($data['expected_total']) && abs((float) $data['expected_total'] - $total) > 0.01) {
                throw ValidationException::withMessages([
                    'lines' => 'Prices changed while you were ringing this up. The cart now totals ₱'.number_format($total, 2).'. Check it and confirm again.',
                ]);
            }

            $type = $data['type'];
            $customer = ! empty($data['customer_id']) ? Customer::query()->lockForUpdate()->find($data['customer_id']) : null;

            $payments = collect($data['payments'] ?? [])->filter(fn ($p) => (float) $p['amount'] > 0)->values();
            $money = round((float) $payments->whereIn('method', ['cash', 'gcash', 'bank'])->sum('amount'), 2);
            $credit = round((float) $payments->where('method', 'credit')->sum('amount'), 2);

            if ($money + $credit - $total > 0.009) {
                throw ValidationException::withMessages(['payments' => 'Payments add up to more than the total. Enter what is applied to this order; the change is worked out from the cash tendered.']);
            }

            $balance = round($total - $money, 2);
            if ($type === 'instant' && round($total - $money - $credit, 2) > 0) {
                throw ValidationException::withMessages(['payments' => 'An instant sale must be settled now. Collect the rest, put it on Credit, or switch to a job order for a downpayment.']);
            }
            if ($balance > 0 && ! $customer) {
                throw ValidationException::withMessages(['customer_id' => 'Attach a customer before leaving a balance or selling on credit. Walk-ins pay in full.']);
            }
            if ($customer && $customer->credit_limit !== null && $balance > 0
                && (float) $customer->credit_balance + $balance > (float) $customer->credit_limit) {
                throw ValidationException::withMessages(['customer_id' => "{$customer->name} would go past their ₱".number_format((float) $customer->credit_limit, 2).' credit limit. Collect more now or raise the limit.']);
            }
            foreach ($payments as $i => $payment) {
                if (in_array($payment['method'], ['gcash', 'bank'], true) && blank($payment['reference'] ?? null)) {
                    throw ValidationException::withMessages(["payments.$i.reference" => 'Add the '.($payment['method'] === 'gcash' ? 'GCash' : 'bank').' reference number so this payment can be traced.']);
                }
            }

            $isJob = $type === 'job';
            $order = Order::query()->create([
                'order_no' => Sequence::next('order'),
                'customer_id' => $customer?->id,
                'type' => $type,
                'status' => $isJob ? 'pending' : 'completed',
                'subtotal' => $totals['subtotal'],
                'discount_type' => $totals['discount_amount'] > 0 ? ($data['discount_type'] ?? null) : null,
                'discount_value' => $totals['discount_amount'] > 0 ? (float) ($data['discount_value'] ?? 0) : 0,
                'discount_total' => $totals['discount_total'],
                'senior_pwd' => (bool) ($data['senior_pwd'] ?? false),
                'senior_pwd_discount' => $totals['senior_pwd_discount'],
                'tax_total' => $totals['tax_total'],
                'total' => $total,
                'paid' => $money,
                'balance' => max(0, $balance),
                'cost_total' => $built['cost_total'],
                'due_at' => $isJob ? ($data['due_at'] ?? null) : null,
                'rush' => (bool) ($data['rush'] ?? false) || $built['lines']->contains(fn ($l) => $l['spec']['rush'] ?? false),
                'assigned_to' => $isJob ? ($data['assigned_to'] ?? null) : null,
                'cashier_session_id' => $session->id,
                'user_id' => $user->id,
                'quotation_id' => $data['quotation_id'] ?? null,
                'notes' => $data['notes'] ?? null,
                'status_changed_at' => now(),
                'board_position' => $isJob ? (int) Order::query()->where('status', 'pending')->max('board_position') + 1 : 0,
            ]);

            foreach ($built['lines'] as $line) {
                $order->items()->create(CartBuilder::row($line));
                $this->orderStock->deduct($line, $order, $user);
            }

            foreach ($payments as $payment) {
                $row = $order->payments()->create([
                    'customer_id' => $customer?->id,
                    'method' => $payment['method'],
                    'kind' => 'sale',
                    'amount' => round((float) $payment['amount'], 2),
                    'tendered' => $payment['method'] === 'cash' ? ($payment['tendered'] ?? null) : null,
                    'reference' => $payment['reference'] ?? null,
                    'cashier_session_id' => $session->id,
                    'user_id' => $user->id,
                ]);
                if ($payment['method'] === 'cash') {
                    $this->drawer->post($session, 'sale', (float) $row->amount, $order, $order->order_no, $user->id);
                }
            }

            $order->refreshPaymentStatus();
            $order->saveQuietly();

            if ($order->balance > 0 && $customer) {
                Receivable::query()->create([
                    'customer_id' => $customer->id,
                    'order_id' => $order->id,
                    'amount' => $order->balance,
                    'due_date' => $order->due_at?->toDateString() ?? now()->addDays((int) \App\Models\Setting::get('credit_terms_days', 30))->toDateString(),
                ]);
                $customer->recalculateBalance();
            }

            if (! empty($data['quotation_id'])) {
                Quotation::query()->whereKey($data['quotation_id'])->update(['status' => 'converted', 'order_id' => $order->id]);
            }

            activity('sales')->performedOn($order)->causedBy($user)
                ->withProperties(['total' => $total, 'paid' => $money, 'balance' => $order->balance, 'type' => $type])
                ->log($isJob ? "Took job order {$order->order_no}" : "Rang up sale {$order->order_no}");

            return $order;
        });
    }
}
