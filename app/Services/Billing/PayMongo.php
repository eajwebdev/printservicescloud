<?php

namespace App\Services\Billing;

use App\Models\Setting;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * A thin client for PayMongo Checkout (https://developers.paymongo.com/reference/checkout-session-resource).
 * Keys come from the superadmin's platform settings, falling back to PAYMONGO_* in .env.
 */
class PayMongo
{
    public const BASE_URL = 'https://api.paymongo.com/v1';

    public const METHODS = [
        'gcash' => 'GCash',
        'paymaya' => 'Maya',
        'card' => 'Credit / debit card',
        'grab_pay' => 'GrabPay',
        'qrph' => 'QR Ph',
        'dob' => 'Online banking (BPI, UBP)',
        'billease' => 'BillEase',
    ];

    public function secretKey(): ?string
    {
        return Setting::secret('billing.paymongo_secret_key') ?: config('services.paymongo.secret_key');
    }

    public function publicKey(): ?string
    {
        return Setting::global('billing.paymongo_public_key') ?: config('services.paymongo.public_key');
    }

    public function webhookSecret(): ?string
    {
        return Setting::secret('billing.paymongo_webhook_secret') ?: config('services.paymongo.webhook_secret');
    }

    public function configured(): bool
    {
        return filled($this->secretKey());
    }

    public function liveMode(): bool
    {
        return str_starts_with((string) $this->secretKey(), 'sk_live_');
    }

    /**
     * @param  array<int, array{name: string, amount: float, description?: string}>  $items  amounts in pesos
     * @param  array<int, string>  $methods
     * @param  array<string, string>  $metadata
     * @return array{id: string, checkout_url: string}
     */
    public function createCheckout(array $items, array $methods, string $description, string $reference, string $successUrl, string $cancelUrl, array $metadata = [], ?array $billing = null): array
    {
        $attributes = [
            'line_items' => array_map(fn ($i) => [
                'currency' => 'PHP',
                'amount' => (int) round($i['amount'] * 100),
                'name' => mb_substr($i['name'], 0, 255),
                'description' => mb_substr($i['description'] ?? $i['name'], 0, 255),
                'quantity' => 1,
            ], $items),
            'payment_method_types' => array_values($methods),
            'description' => mb_substr($description, 0, 255),
            'reference_number' => $reference,
            'success_url' => $successUrl,
            'cancel_url' => $cancelUrl,
            'send_email_receipt' => (bool) ($billing['email'] ?? false),
            'show_description' => true,
            'show_line_items' => true,
            'metadata' => array_map('strval', $metadata),
        ];
        if ($billing) {
            $attributes['billing'] = array_filter($billing);
        }

        $data = $this->request('post', '/checkout_sessions', ['data' => ['attributes' => $attributes]]);

        return [
            'id' => (string) $data['data']['id'],
            'checkout_url' => (string) $data['data']['attributes']['checkout_url'],
        ];
    }

    /**
     * Whether a checkout session has been paid, with the payment id and method when it has.
     *
     * @return array{paid: bool, amount: float, payment_id: ?string, method: ?string, status: ?string}
     */
    public function checkoutStatus(string $checkoutId): array
    {
        $data = $this->request('get', '/checkout_sessions/'.urlencode($checkoutId));

        return self::paidFromCheckout($data['data'] ?? []);
    }

    /** Read a checkout_session resource (from the API or a webhook) for its payment. */
    public static function paidFromCheckout(array $checkout): array
    {
        $attributes = $checkout['attributes'] ?? [];
        $payment = collect($attributes['payments'] ?? [])->first(fn ($p) => ($p['attributes']['status'] ?? null) === 'paid');
        $intentStatus = $attributes['payment_intent']['attributes']['status'] ?? null;

        $lineTotal = collect($attributes['line_items'] ?? [])->sum(fn ($l) => (int) ($l['amount'] ?? 0) * (int) ($l['quantity'] ?? 1));
        $paidAmount = $payment ? (int) ($payment['attributes']['amount'] ?? 0) : ($intentStatus === 'succeeded' ? (int) ($attributes['payment_intent']['attributes']['amount'] ?? $lineTotal) : 0);

        return [
            'paid' => $payment !== null || $intentStatus === 'succeeded',
            'amount' => round($paidAmount / 100, 2),
            'payment_id' => $payment['id'] ?? null,
            'method' => $attributes['payment_method_used'] ?? ($payment['attributes']['source']['type'] ?? null),
            'status' => $attributes['status'] ?? null,
        ];
    }

    /**
     * Check the Paymongo-Signature header: "t=<unix>,te=<test sig>,li=<live sig>",
     * where each signature is HMAC-SHA256("<t>.<raw body>", webhook secret).
     */
    public function verifySignature(?string $header, string $payload, int $toleranceSeconds = 600): bool
    {
        $secret = $this->webhookSecret();
        if (! $secret || ! $header) {
            return false;
        }

        $parts = [];
        foreach (explode(',', $header) as $piece) {
            [$k, $v] = array_pad(explode('=', trim($piece), 2), 2, '');
            $parts[$k] = $v;
        }
        if (empty($parts['t']) || ! ctype_digit($parts['t'])) {
            return false;
        }
        if ($toleranceSeconds > 0 && abs(time() - (int) $parts['t']) > $toleranceSeconds) {
            return false;
        }

        $expected = hash_hmac('sha256', $parts['t'].'.'.$payload, $secret);
        foreach (['te', 'li'] as $key) {
            if (! empty($parts[$key]) && hash_equals($expected, $parts[$key])) {
                return true;
            }
        }

        return false;
    }

    private function request(string $method, string $path, array $body = []): array
    {
        $key = $this->secretKey();
        if (! $key) {
            throw new RuntimeException('Online payments are not set up yet. Ask the system provider to add the PayMongo keys.');
        }

        $client = Http::withBasicAuth($key, '')->acceptJson()->asJson()->timeout(20);
        $response = $method === 'get' ? $client->get(self::BASE_URL.$path) : $client->post(self::BASE_URL.$path, $body);

        if ($response->failed()) {
            $detail = $response->json('errors.0.detail') ?? $response->body();
            throw new RuntimeException('PayMongo said: '.mb_substr((string) $detail, 0, 300));
        }

        return $response->json() ?? [];
    }
}
