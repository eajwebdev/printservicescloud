<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Receivable;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReceivableService
{
    public function __construct(private DrawerService $drawer) {}

    /**
     * Collect money against a customer's account. Applied to the given order's
     * receivable first, then to the oldest open balances.
     *
     * @return Collection<int, Payment>
     */
    public function settle(Customer $customer, float $amount, string $method, ?string $reference, User $by, ?int $orderId = null): Collection
    {
        return DB::transaction(function () use ($customer, $amount, $method, $reference, $by, $orderId) {
            $customer = Customer::query()->whereKey($customer->id)->lockForUpdate()->firstOrFail();
            $open = Receivable::query()
                ->where('customer_id', $customer->id)
                ->where('status', 'open')
                ->lockForUpdate()
                ->get()
                ->sortBy(fn ($r) => [$r->order_id === $orderId ? 0 : 1, $r->created_at->timestamp])
                ->values();

            $owed = round($open->sum(fn ($r) => $r->outstanding()), 2);
            if ($owed <= 0) {
                throw ValidationException::withMessages(['amount' => "{$customer->name} has nothing outstanding."]);
            }
            if ($amount - $owed > 0.009) {
                throw ValidationException::withMessages(['amount' => 'That is more than the ₱'.number_format($owed, 2).' this account owes.']);
            }
            if (in_array($method, ['gcash', 'bank'], true) && blank($reference)) {
                throw ValidationException::withMessages(['reference' => 'Add the reference number for this '.($method === 'gcash' ? 'GCash' : 'bank').' payment.']);
            }

            $session = $method === 'cash' ? $this->drawer->requireOpen($by, 'amount') : $by->openSession;
            $left = round($amount, 2);
            $payments = collect();

            foreach ($open as $receivable) {
                if ($left <= 0) {
                    break;
                }
                $apply = round(min($left, $receivable->outstanding()), 2);
                $receivable->settled = round((float) $receivable->settled + $apply, 2);
                $receivable->status = $receivable->outstanding() <= 0 ? 'settled' : 'open';
                $receivable->save();

                $payment = Payment::query()->create([
                    'order_id' => $receivable->order_id,
                    'customer_id' => $customer->id,
                    'receivable_id' => $receivable->id,
                    'method' => $method,
                    'kind' => 'settlement',
                    'amount' => $apply,
                    'reference' => $reference,
                    'cashier_session_id' => $session?->id,
                    'user_id' => $by->id,
                ]);
                $payments->push($payment);

                if ($receivable->order_id && $order = Order::query()->lockForUpdate()->find($receivable->order_id)) {
                    $order->paid = round((float) $order->paid + $apply, 2);
                    $order->refreshPaymentStatus();
                    $order->save();
                }

                if ($method === 'cash' && $session) {
                    $this->drawer->post($session, 'collection', $apply, $payment, 'Collected from '.$customer->name, $by->id);
                }
                $left = round($left - $apply, 2);
            }

            $customer->recalculateBalance();

            activity('receivables')->performedOn($customer)->causedBy($by)
                ->withProperties(['amount' => $amount, 'method' => $method, 'reference' => $reference])
                ->log('Collected ₱'.number_format($amount, 2).' from '.$customer->name);

            return $payments;
        });
    }
}
