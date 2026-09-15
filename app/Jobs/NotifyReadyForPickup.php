<?php

namespace App\Jobs;

use App\Models\Order;
use App\Models\Setting;
use App\Services\Sms\SmsGateway;
use App\Support\BranchContext;
use App\Support\Shop;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class NotifyReadyForPickup implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $orderId) {}

    public function handle(SmsGateway $sms): void
    {
        $order = Order::query()->withoutGlobalScope('branch')->with('customer')->find($this->orderId);
        if (! $order) {
            return;
        }

        // Queue workers have no signed-in branch; read the order's own branch settings.
        BranchContext::current()->run($order->branch_id, function () use ($order, $sms) {
            if (! $order->customer?->phone || ! Setting::get('sms_ready_enabled', true)) {
                return;
            }
            $this->send($order, $sms);
        });
    }

    private function send(Order $order, SmsGateway $sms): void
    {
        $shop = Shop::displayName();
        $balance = (float) $order->balance > 0 ? ' Balance due: P'.number_format((float) $order->balance, 2).'.' : '';

        $sms->send($order->customer->phone, "{$shop}: Your order {$order->order_no} is ready for pickup.{$balance} Salamat!");
    }
}
