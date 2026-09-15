<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Setting;
use App\Support\Shop;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Receipts as plain HTML sized for thermal paper, printed by the browser in one tap.
 * With Chrome started using --kiosk-printing, they print silently to the default printer.
 */
class PrintController extends Controller
{
    public function receipt(Request $request, Order $order): Response
    {
        $order->load(['customer', 'items', 'payments', 'cashier:id,name', 'assignee:id,name']);

        // Anything after the first copy is marked so a reprint can't pass as a new sale.
        // A preview (viewing on screen) isn't a printed copy.
        $preview = $request->boolean('preview');
        $copy = (int) $order->print_count + ($preview ? 0 : 1);
        if (! $preview) {
            $order->forceFill(['print_count' => $copy])->saveQuietly();
            activity('sales')->performedOn($order)->causedBy($request->user())
                ->withProperties(['copy' => $copy])
                ->log($copy === 1 ? "Printed receipt for {$order->order_no}" : "Reprinted receipt for {$order->order_no} (copy {$copy})");
        }

        return response()->view('print.receipt', [
            'order' => $order,
            'shop' => array_diff_key(Shop::profile(), ['logo_path' => 1]),
            'logo' => Shop::logoUrl(),
            'paper' => (int) Setting::get('receipt_paper', 80) === 58 ? 58 : 80,
            'claimStub' => $order->type === 'job' && Setting::get('print_claim_stub', true),
            'copy' => $copy,
            'autoPrint' => ! $request->boolean('preview'),
        ])->header('Cache-Control', 'no-store');
    }
}
