<?php

namespace Tests\Feature;

use App\Models\BillingPayment;
use App\Models\Branch;
use App\Models\InventoryItem;
use App\Models\Invoice;
use App\Models\Service;
use App\Models\Setting;
use App\Models\User;
use App\Services\Billing\BillingService;
use Database\Seeders\AccessSeeder;
use Database\Seeders\CatalogSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BillingTest extends TestCase
{
    use RefreshDatabase;

    private Branch $kab;

    private User $superadmin;

    private User $admin;

    private User $cashier;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-09-15 09:00:00');
        $this->seed([AccessSeeder::class, SettingsSeeder::class]);
        $this->kab = Branch::query()->where('code', 'KAB')->firstOrFail();
        $this->superadmin = User::query()->where('is_superadmin', true)->firstOrFail();
        $this->admin = User::query()->where('email', 'admin@skc.test')->firstOrFail();
        $this->cashier = User::query()->where('email', 'cashier@skc.test')->firstOrFail();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function billing(): BillingService
    {
        return app(BillingService::class);
    }

    public function test_subscription_bills_monthly_at_the_default_price(): void
    {
        $this->actingAs($this->superadmin)->post(route('platform.branches.activate', $this->kab), ['starts_on' => '2026-09-15'])->assertSessionHasNoErrors();

        $first = Invoice::query()->where('branch_id', $this->kab->id)->sole();
        $this->assertEquals(1699, (float) $first->amount);
        $this->assertSame('2026-09-15', $first->period_start->toDateString());
        $this->assertSame('2026-10-14', $first->period_end->toDateString());
        $this->assertSame('2026-09-25', $first->due_on->toDateString());

        // Running the job again the same day issues nothing new; a month later issues the next bill.
        $this->billing()->run();
        $this->assertSame(1, Invoice::query()->count());
        Carbon::setTestNow('2026-10-15 00:30:00');
        $this->billing()->run();
        $this->assertSame(2, Invoice::query()->where('branch_id', $this->kab->id)->count());

        // A branch-specific price applies to new bills.
        $this->kab->update(['monthly_fee' => 1499]);
        Carbon::setTestNow('2026-11-15 00:30:00');
        $this->billing()->run();
        $this->assertEquals(1499, (float) Invoice::query()->latest('period_start')->first()->amount);
    }

    public function test_free_trial_is_not_billed_until_it_ends(): void
    {
        $this->actingAs($this->superadmin)->post(route('platform.branches.trial', $this->kab), ['until' => '2026-09-30'])->assertSessionHasNoErrors();
        $this->billing()->run();
        $this->assertSame(0, Invoice::query()->count());
        $this->actingAs($this->cashier)->get(route('dashboard'))->assertOk()->assertInertia(fn ($page) => $page->component('Dashboard')->where('billing.status', 'trial'));

        Carbon::setTestNow('2026-10-01 00:30:00');
        $this->billing()->run();
        $this->assertSame('active', $this->kab->fresh()->subscription_status);
        $this->assertSame('2026-10-01', Invoice::query()->sole()->period_start->toDateString());
    }

    public function test_three_overdue_bills_lock_the_branch_until_paid(): void
    {
        $this->billing()->activate($this->kab, Carbon::parse('2026-06-01'), $this->superadmin);
        // Jun, Jul, Aug and Sep bills; Jun to Aug are past due, Sep (due Sep 11) is also past due on Sep 15.
        $this->assertSame(4, Invoice::query()->count());

        $this->actingAs($this->cashier)->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('Billing/Locked')->where('state.locked', true)->where('state.overdue_count', 4)->where('state.due_total', 6796));
        $this->actingAs($this->cashier)->post(route('session.open'), ['opening_float' => 100])->assertRedirect(route('billing.locked'));

        // Other branches keep working.
        $bcdCashier = User::query()->where('email', 'bacolod.cashier@skc.test')->firstOrFail();
        $this->actingAs($bcdCashier)->get(route('dashboard'))->assertInertia(fn ($page) => $page->component('Dashboard'));

        // Paying one bill leaves three overdue: still locked. Paying one more drops below the limit and reopens the branch.
        $bills = Invoice::query()->orderBy('period_start')->get();
        $this->billing()->recordPayment($this->kab, $bills->take(1), 'manual', 'bank', 'BDO-123', $this->superadmin);
        $this->actingAs($this->cashier)->get(route('dashboard'))->assertInertia(fn ($page) => $page->component('Billing/Locked')->where('state.overdue_count', 3));

        $this->actingAs($this->superadmin)->post(route('platform.invoices.pay'), [
            'invoice_ids' => [$bills[1]->id], 'method' => 'cash', 'reference' => 'OR-55',
        ])->assertSessionHasNoErrors();
        $this->actingAs($this->cashier)->get(route('dashboard'))->assertInertia(fn ($page) => $page
            ->component('Dashboard')
            ->where('billing.locked', false)
            ->where('billing.warning', true)
            ->where('billing.overdue_count', 2));
    }

    public function test_one_overdue_bill_warns_but_keeps_the_branch_open(): void
    {
        $this->billing()->activate($this->kab, Carbon::parse('2026-08-20'), $this->superadmin);

        $this->actingAs($this->cashier)->get(route('dashboard'))->assertInertia(fn ($page) => $page
            ->component('Dashboard')
            ->where('billing.locked', false)
            ->where('billing.warning', true)
            ->where('billing.overdue_count', 1));
    }

    public function test_suspended_branch_is_locked_and_grace_date_is_not_a_bypass_for_suspension(): void
    {
        $this->actingAs($this->superadmin)->post(route('platform.branches.suspend', $this->kab), ['reason' => 'Chargeback'])->assertSessionHasNoErrors();
        $this->kab->update(['grace_until' => '2026-12-31']);

        $this->actingAs($this->cashier)->get(route('orders.index'))->assertInertia(fn ($page) => $page->component('Billing/Locked')->where('state.lock_reason', 'suspended'));
        $this->actingAs($this->superadmin)->post(route('platform.branches.resume', $this->kab))->assertSessionHasNoErrors();
        $this->actingAs($this->cashier)->get(route('dashboard'))->assertInertia(fn ($page) => $page->component('Dashboard'));
    }

    public function test_paymongo_checkout_then_webhook_marks_bills_paid(): void
    {
        Setting::putSecret('billing.paymongo_secret_key', 'sk_test_abc123');
        Setting::putSecret('billing.paymongo_webhook_secret', 'whsk_test_secret');
        $this->billing()->activate($this->kab, Carbon::parse('2026-06-01'), $this->superadmin);

        Http::fake([
            'api.paymongo.com/v1/checkout_sessions' => Http::response(['data' => ['id' => 'cs_test_1', 'attributes' => ['checkout_url' => 'https://checkout.paymongo.com/cs_test_1']]]),
        ]);

        // A locked branch's cashier may pay even without the "Pay bills" checkbox.
        $this->actingAs($this->cashier)->post(route('billing.pay'), ['branch_id' => $this->kab->id], ['X-Inertia' => 'true'])
            ->assertStatus(409)
            ->assertHeader('X-Inertia-Location', 'https://checkout.paymongo.com/cs_test_1');

        Http::assertSent(fn ($request) => $request->url() === 'https://api.paymongo.com/v1/checkout_sessions'
            && $request['data']['attributes']['line_items'][0]['amount'] === 169900
            && count($request['data']['attributes']['line_items']) === 4);

        $payment = BillingPayment::query()->sole();
        $this->assertSame('pending', $payment->status);
        $this->assertEquals(6796, (float) $payment->amount);

        $body = json_encode(['data' => ['id' => 'evt_1', 'type' => 'event', 'attributes' => [
            'type' => 'checkout_session.payment.paid',
            'livemode' => false,
            'data' => ['id' => 'cs_test_1', 'type' => 'checkout_session', 'attributes' => [
                'payment_method_used' => 'gcash',
                'metadata' => ['billing_payment_id' => (string) $payment->id],
                'payments' => [['id' => 'pay_1', 'attributes' => ['status' => 'paid', 'amount' => 679600]]],
            ]],
        ]]]);

        // A forged event is refused.
        $this->call('POST', route('webhooks.paymongo'), [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_PAYMONGO_SIGNATURE' => 't='.time().',te=forged'], $body)->assertStatus(401);
        $this->assertSame('pending', $payment->fresh()->status);

        $t = time();
        $signature = hash_hmac('sha256', $t.'.'.$body, 'whsk_test_secret');
        $this->call('POST', route('webhooks.paymongo'), [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_PAYMONGO_SIGNATURE' => "t={$t},te={$signature},li="], $body)->assertOk();

        $this->assertSame('paid', $payment->fresh()->status);
        $this->assertSame('gcash', $payment->fresh()->method);
        $this->assertSame(0, Invoice::query()->unpaid()->count());
        $this->actingAs($this->cashier)->get(route('dashboard'))->assertInertia(fn ($page) => $page->component('Dashboard'));

        // Replaying the same event changes nothing.
        $this->call('POST', route('webhooks.paymongo'), [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_PAYMONGO_SIGNATURE' => "t={$t},te={$signature},li="], $body)->assertOk();
        $this->assertSame(1, BillingPayment::query()->count());
    }

    public function test_only_the_superadmin_manages_subscriptions(): void
    {
        $this->actingAs($this->admin)->get(route('platform.branches.index'))->assertForbidden();
        $this->actingAs($this->admin)->post(route('platform.branches.trial', $this->kab), ['until' => '2027-01-01'])->assertForbidden();
        $this->actingAs($this->cashier)->put(route('platform.settings.update'), [])->assertForbidden();

        $this->actingAs($this->superadmin)->get(route('platform.branches.index'))->assertOk()->assertInertia(fn ($page) => $page->has('branches', 3)->where('defaults.monthly_fee', 1699));
        $this->actingAs($this->superadmin)->put(route('platform.settings.update'), [
            'monthly_fee' => 1899, 'due_days' => 7, 'lock_after' => 2, 'trial_days' => 7, 'remind_days' => 3,
            'provider_name' => 'EAJ Web Dev', 'payment_methods' => ['gcash', 'card'],
            'paymongo_secret_key' => 'sk_test_newkey',
        ])->assertSessionHasNoErrors();
        $this->assertEquals(1899, Setting::global('billing.monthly_fee'));
        $this->assertSame('sk_test_newkey', Setting::secret('billing.paymongo_secret_key'));
        $this->assertNotSame('sk_test_newkey', Setting::global('billing.paymongo_secret_key'));
    }

    public function test_superadmin_adds_a_branch_on_trial_with_a_copied_catalog(): void
    {
        $this->seed(CatalogSeeder::class);

        $this->actingAs($this->superadmin)->post(route('platform.branches.store'), [
            'name' => 'Sipalay', 'code' => 'sip', 'address' => 'Poblacion, Sipalay City', 'active' => true,
            'start' => 'trial', 'trial_days' => 21, 'copy_from' => $this->kab->id,
        ])->assertSessionHasNoErrors();

        $sip = Branch::query()->where('code', 'SIP')->firstOrFail();
        $this->assertSame('trial', $sip->subscription_status);
        $this->assertSame('2026-10-06', $sip->trial_ends_on->toDateString());
        $this->assertSame(
            Service::withoutGlobalScope('branch')->where('branch_id', $this->kab->id)->count(),
            Service::withoutGlobalScope('branch')->where('branch_id', $sip->id)->count(),
        );
        $this->assertSame(0.0, (float) InventoryItem::withoutGlobalScope('branch')->where('branch_id', $sip->id)->sum('stock'));
    }
}
