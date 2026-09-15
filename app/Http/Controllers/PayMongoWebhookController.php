<?php

namespace App\Http\Controllers;

use App\Models\BillingPayment;
use App\Services\Billing\BillingService;
use App\Services\Billing\PayMongo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Receives PayMongo events. Register https://your-domain/webhooks/paymongo in the PayMongo
 * dashboard for the checkout_session.payment.paid event and paste its secret into Platform settings.
 */
class PayMongoWebhookController extends Controller
{
    public function __invoke(Request $request, PayMongo $paymongo, BillingService $billing): JsonResponse
    {
        $payload = $request->getContent();
        if (! $paymongo->verifySignature($request->header('Paymongo-Signature'), $payload)) {
            Log::warning('PayMongo webhook rejected: bad signature');

            return response()->json(['message' => 'Invalid signature.'], 401);
        }

        $event = $request->json('data.attributes', []);
        $checkout = $event['data'] ?? [];

        if (($event['type'] ?? null) !== 'checkout_session.payment.paid' || ($checkout['type'] ?? null) !== 'checkout_session') {
            return response()->json(['message' => 'Ignored.']);
        }

        $paymentId = $checkout['attributes']['metadata']['billing_payment_id'] ?? null;
        $payment = BillingPayment::query()
            ->where(fn ($q) => $q->where('checkout_id', $checkout['id'] ?? '')->when($paymentId, fn ($w) => $w->orWhere('id', $paymentId)))
            ->first();
        if (! $payment) {
            Log::warning('PayMongo webhook for an unknown checkout', ['checkout' => $checkout['id'] ?? null]);

            return response()->json(['message' => 'Unknown checkout.']);
        }

        $status = PayMongo::paidFromCheckout($checkout);
        if ($status['paid'] && abs($status['amount'] - (float) $payment->amount) > 0.009) {
            Log::error('PayMongo paid amount does not match the bill', ['payment' => $payment->id, 'expected' => (float) $payment->amount, 'paid' => $status['amount']]);
            $payment->update(['notes' => 'Paid amount ₱'.number_format($status['amount'], 2).' does not match. Check PayMongo before applying.']);

            return response()->json(['message' => 'Amount mismatch.']);
        }
        if ($status['paid']) {
            $billing->completeOnlinePayment($payment, $status['payment_id'], $status['method']);
        }

        return response()->json(['message' => 'OK']);
    }
}
