<?php

namespace App\Http\Controllers\Platform;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\Billing\BillingService;
use App\Services\Billing\PayMongo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Superadmin: subscription pricing, lock rules and the PayMongo account. */
class SettingsController extends Controller
{
    public function index(BillingService $billing, PayMongo $paymongo): Response
    {
        $mask = fn (?string $key) => $key ? substr($key, 0, 8).str_repeat('•', 8).substr($key, -4) : null;

        return Inertia::render('Platform/Settings', [
            'settings' => [
                'monthly_fee' => (float) $billing->setting('billing.monthly_fee'),
                'due_days' => (int) $billing->setting('billing.due_days'),
                'lock_after' => (int) $billing->setting('billing.lock_after'),
                'trial_days' => (int) $billing->setting('billing.trial_days'),
                'remind_days' => (int) $billing->setting('billing.remind_days'),
                'provider_name' => (string) $billing->setting('billing.provider_name'),
                'payment_methods' => array_values((array) $billing->setting('billing.payment_methods')),
                'paymongo_public_key' => (string) (Setting::global('billing.paymongo_public_key') ?? ''),
            ],
            'secrets' => [
                'secret_key' => $mask($paymongo->secretKey()),
                'webhook_secret' => $mask($paymongo->webhookSecret()),
            ],
            'paymongo' => [
                'configured' => $paymongo->configured(),
                'live' => $paymongo->liveMode(),
                'webhook_url' => route('webhooks.paymongo'),
            ],
            'methodOptions' => PayMongo::METHODS,
        ]);
    }

    /** The master key: open every branch without a subscription, or put subscriptions back in force. */
    public function masterKey(Request $request, BillingService $billing): RedirectResponse
    {
        $enabled = $request->validate(['enabled' => ['required', 'boolean']])['enabled'];
        $billing->setFreeAccess((bool) $enabled, $request->user());

        return back()->with('success', $enabled
            ? 'Master key is on. Every branch can use the system without a subscription, and billing is paused.'
            : 'Master key is off. Subscriptions, bills and locks apply again.');
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'monthly_fee' => ['required', 'numeric', 'min:0', 'max:1000000'],
            'due_days' => ['required', 'integer', 'min:0', 'max:60'],
            'lock_after' => ['required', 'integer', 'min:1', 'max:24'],
            'trial_days' => ['required', 'integer', 'min:1', 'max:365'],
            'remind_days' => ['required', 'integer', 'min:0', 'max:30'],
            'provider_name' => ['required', 'string', 'max:120'],
            'payment_methods' => ['required', 'array', 'min:1'],
            'payment_methods.*' => [Rule::in(array_keys(PayMongo::METHODS))],
            'paymongo_public_key' => ['nullable', 'string', 'max:200', 'regex:/^pk_(test|live)_/'],
            'paymongo_secret_key' => ['nullable', 'string', 'max:200', 'regex:/^sk_(test|live)_/'],
            'paymongo_webhook_secret' => ['nullable', 'string', 'max:200'],
            'clear_secrets' => ['boolean'],
        ], [
            'paymongo_public_key.regex' => 'A public key starts with pk_test_ or pk_live_.',
            'paymongo_secret_key.regex' => 'A secret key starts with sk_test_ or sk_live_.',
        ]);

        Setting::putGlobal([
            'billing.monthly_fee' => round((float) $data['monthly_fee'], 2),
            'billing.due_days' => (int) $data['due_days'],
            'billing.lock_after' => (int) $data['lock_after'],
            'billing.trial_days' => (int) $data['trial_days'],
            'billing.remind_days' => (int) $data['remind_days'],
            'billing.provider_name' => $data['provider_name'],
            'billing.payment_methods' => array_values($data['payment_methods']),
            'billing.paymongo_public_key' => $data['paymongo_public_key'] ?? null,
        ]);

        // Blank secret fields keep what is saved; "clear" removes them.
        if ($request->boolean('clear_secrets')) {
            Setting::putSecret('billing.paymongo_secret_key', null);
            Setting::putSecret('billing.paymongo_webhook_secret', null);
        }
        if (! empty($data['paymongo_secret_key'])) {
            Setting::putSecret('billing.paymongo_secret_key', $data['paymongo_secret_key']);
        }
        if (! empty($data['paymongo_webhook_secret'])) {
            Setting::putSecret('billing.paymongo_webhook_secret', $data['paymongo_webhook_secret']);
        }

        activity('billing')->causedBy($request->user())->withProperties(collect($data)->except(['paymongo_secret_key', 'paymongo_webhook_secret'])->all())->log('Updated platform billing settings');

        return back()->with('success', 'Platform settings saved. New bills use the new amounts; bills already issued keep theirs.');
    }
}
