<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\CashierSession;
use App\Models\Customer;
use App\Models\InventoryItem;
use App\Models\Order;
use App\Models\PettyCashFund;
use App\Models\Product;
use App\Models\Quotation;
use App\Models\Service;
use App\Models\User;
use App\Support\Access;
use Database\Seeders\AccessSeeder;
use Database\Seeders\CatalogSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Tests\TestCase;

class ShopFlowTest extends TestCase
{
    use RefreshDatabase;

    private Branch $branch;

    private User $owner;

    private User $cashier;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([AccessSeeder::class, SettingsSeeder::class, CatalogSeeder::class]);
        $this->branch = $this->useBranch('KAB');
        $this->owner = User::query()->where('is_owner', true)->firstOrFail();
        $this->cashier = User::query()->where('email', 'cashier@skc.test')->firstOrFail();
        Bus::fake();
    }

    private function service(string $code): Service
    {
        return Service::query()->where('code', $code)->with('options')->firstOrFail();
    }

    private function openDrawer(User $user, float $float = 1000): void
    {
        $this->actingAs($user)->post(route('session.open'), ['opening_float' => $float])->assertSessionHasNoErrors();
    }

    public function test_pos_is_locked_until_the_drawer_is_open(): void
    {
        $product = Product::query()->where('sku', 'STK-LOGO')->firstOrFail();

        $this->actingAs($this->cashier)
            ->post(route('pos.checkout'), [
                'type' => 'instant',
                'lines' => [['item_type' => 'product', 'item_id' => $product->id, 'qty' => 1]],
                'payments' => [['method' => 'cash', 'amount' => 12]],
            ])
            ->assertSessionHasErrors('session');

        $this->assertSame(0, Order::query()->count());
    }

    public function test_mixed_cart_deducts_product_stock_and_service_materials_and_posts_cash(): void
    {
        $this->openDrawer($this->cashier, 1000);
        $pen = Product::query()->where('sku', 'STK-LOGO')->firstOrFail();
        $tarp = $this->service('TARP');
        $eyelets = $tarp->options->firstWhere('name', 'Eyelets (4 corners)');
        $roll = InventoryItem::query()->where('sku', 'TARP-13')->firstOrFail();
        $ink = InventoryItem::query()->where('sku', 'INK-ECO')->firstOrFail();
        $penStock = $pen->stock;
        $rollStock = (float) $roll->stock;
        $inkStock = (float) $ink->stock;

        // 2 logo stickers (₱24) + 1 tarp 3×5 ft = 15 sqft × ₱15 = ₱225 + ₱20 eyelets = ₱245. Total ₱269.
        $this->actingAs($this->cashier)->post(route('pos.checkout'), [
            'type' => 'instant',
            'lines' => [
                ['item_type' => 'product', 'item_id' => $pen->id, 'qty' => 2],
                ['item_type' => 'service', 'item_id' => $tarp->id, 'qty' => 1, 'spec' => ['width' => 3, 'height' => 5, 'unit' => 'ft', 'option_ids' => [$eyelets->id]]],
            ],
            'payments' => [['method' => 'cash', 'amount' => 269, 'tendered' => 500]],
            'expected_total' => 269,
        ])->assertSessionHasNoErrors()->assertSessionHas('receipt', fn ($r) => $r['change'] == 231);

        $order = Order::query()->with('items')->sole();
        $this->assertSame('completed', $order->status);
        $this->assertEquals(269, (float) $order->total);
        $this->assertSame('paid', $order->payment_status);

        $this->assertSame($penStock - 2, $pen->fresh()->stock);
        $this->assertEqualsWithDelta($rollStock - 15, (float) $roll->fresh()->stock, 0.001);
        $this->assertEqualsWithDelta($inkStock - 18, (float) $ink->fresh()->stock, 0.001);

        $session = CashierSession::query()->where('user_id', $this->cashier->id)->sole();
        $this->assertEquals(1269, $session->liveExpectedCash());
    }

    public function test_price_change_between_screen_and_server_is_caught(): void
    {
        $this->openDrawer($this->cashier);
        $pen = Product::query()->where('sku', 'STK-LOGO')->firstOrFail();

        $this->actingAs($this->cashier)->post(route('pos.checkout'), [
            'type' => 'instant',
            'lines' => [['item_type' => 'product', 'item_id' => $pen->id, 'qty' => 1]],
            'payments' => [['method' => 'cash', 'amount' => 10]],
            'expected_total' => 10,
        ])->assertSessionHasErrors('lines');
    }

    public function test_partial_job_order_books_receivable_and_lands_on_board(): void
    {
        $this->openDrawer($this->cashier);
        $customer = Customer::query()->where('name', 'Rodel Dela Cruz')->firstOrFail();
        $mug = $this->service('MUG');

        // 12 mugs hit the ₱160 tier: ₱1,920. Downpayment ₱1,000 by GCash.
        $this->actingAs($this->cashier)->post(route('pos.checkout'), [
            'type' => 'job',
            'customer_id' => $customer->id,
            'lines' => [['item_type' => 'service', 'item_id' => $mug->id, 'qty' => 12, 'spec' => []]],
            'payments' => [['method' => 'gcash', 'amount' => 1000, 'reference' => '1234567890123']],
            'due_at' => now()->addDay()->toDateTimeString(),
        ])->assertSessionHasNoErrors();

        $order = Order::query()->sole();
        $this->assertSame('pending', $order->status);
        $this->assertEquals(1920, (float) $order->total);
        $this->assertEquals(920, (float) $order->balance);
        $this->assertSame('partial', $order->payment_status);
        $this->assertEquals(920, (float) $customer->fresh()->credit_balance);

        // GCash never touches the drawer.
        $this->assertEquals(1000, CashierSession::query()->sole()->liveExpectedCash());

        $this->actingAs($this->owner)->get(route('orders.index', ['view' => 'board']))
            ->assertInertia(fn ($page) => $page->component('Orders/Board')->where('cards.0.order_no', $order->order_no)->where('counts.board', 1));
    }

    public function test_new_sales_are_easy_to_find_in_sales_today_and_peek(): void
    {
        $this->openDrawer($this->cashier);
        $pen = Product::query()->where('sku', 'STK-LOGO')->firstOrFail();

        $this->actingAs($this->cashier)->post(route('pos.checkout'), [
            'type' => 'instant',
            'lines' => [['item_type' => 'product', 'item_id' => $pen->id, 'qty' => 1]],
            'payments' => [['method' => 'cash', 'amount' => 12]],
        ])->assertSessionHasNoErrors();
        $order = Order::query()->sole();

        // A cashier landing on Orders sees today's sales first, with the new sale on top.
        $this->actingAs($this->cashier)->get(route('orders.index'))
            ->assertInertia(fn ($page) => $page->component('Orders/Index')->where('view', 'today')
                ->where('orders.data.0.order_no', $order->order_no)
                ->where('orders.data.0.methods', ['cash'])
                ->where('totals.count', 1));

        // The POS lists it under recent sales.
        $this->actingAs($this->cashier)->get(route('pos.index'))
            ->assertInertia(fn ($page) => $page->where('recentOrders.0.id', $order->id));

        // Search by order number from All orders, then peek without leaving the page.
        $this->actingAs($this->cashier)->get(route('orders.index', ['view' => 'list', 'q' => $order->order_no]))
            ->assertInertia(fn ($page) => $page->where('orders.total', 1));
        $this->actingAs($this->cashier)->getJson(route('orders.peek', $order))
            ->assertOk()->assertJsonPath('order.order_no', $order->order_no)->assertJsonPath('order.lines.0.name', $pen->name);

        // The last tab is remembered.
        $this->actingAs($this->cashier)->get(route('orders.index'))->assertInertia(fn ($page) => $page->where('view', 'list'));
    }

    public function test_list_pages_offer_quick_filters_and_customer_shortcuts(): void
    {
        $customer = Customer::query()->where('name', 'JM Bakeshop')->firstOrFail();

        $this->actingAs($this->owner)->get(route('customers.index'))
            ->assertInertia(fn ($page) => $page->has('counts.owing')->where('counts.all', Customer::query()->count()));
        $this->actingAs($this->owner)->getJson(route('customers.peek', $customer))
            ->assertOk()->assertJsonPath('customer.name', 'JM Bakeshop');

        // "New sale for this customer" arrives at the POS with them attached.
        $this->actingAs($this->owner)->get(route('pos.index', ['customer' => $customer->id]))
            ->assertInertia(fn ($page) => $page->where('presetCustomer.id', $customer->id));

        $low = InventoryItem::query()->where('sku', 'LAM-A4')->firstOrFail();
        $this->actingAs($this->owner)->get(route('inventory.index', ['stock' => 'low']))
            ->assertInertia(fn ($page) => $page->where('counts.low', 1)->where('items.data.0.id', $low->id));

        $this->actingAs($this->owner)->get(route('products.index', ['stock' => 'low']))->assertOk()->assertInertia(fn ($page) => $page->has('counts.out'));
        $this->actingAs($this->owner)->get(route('quotations.index', ['status' => 'expired']))->assertOk()->assertInertia(fn ($page) => $page->has('counts.expired'));
        $this->actingAs($this->owner)->get(route('purchases.index'))->assertOk()->assertInertia(fn ($page) => $page->has('counts'));
        $this->actingAs($this->owner)->get(route('services.index'))->assertOk()->assertInertia(fn ($page) => $page->has('categories.0.count'));
    }

    public function test_walk_in_can_not_leave_a_balance(): void
    {
        $this->openDrawer($this->cashier);
        $mug = $this->service('MUG');

        $this->actingAs($this->cashier)->post(route('pos.checkout'), [
            'type' => 'job',
            'lines' => [['item_type' => 'service', 'item_id' => $mug->id, 'qty' => 1, 'spec' => []]],
            'payments' => [['method' => 'cash', 'amount' => 50]],
            'due_at' => now()->addDay()->toDateTimeString(),
        ])->assertSessionHasErrors('customer_id');
    }

    public function test_credit_sale_then_settlement_and_drawer_close_variance(): void
    {
        $this->openDrawer($this->cashier, 500);
        $customer = Customer::query()->where('name', 'JM Bakeshop')->firstOrFail();
        $lam = $this->service('LAM-A4');

        $this->actingAs($this->cashier)->post(route('pos.checkout'), [
            'type' => 'instant',
            'customer_id' => $customer->id,
            'lines' => [['item_type' => 'service', 'item_id' => $lam->id, 'qty' => 5, 'spec' => []]],
            'payments' => [['method' => 'credit', 'amount' => 200]],
        ])->assertSessionHasNoErrors();

        $order = Order::query()->sole();
        $this->assertSame('credit', $order->payment_status);
        $this->assertEquals(200, (float) $customer->fresh()->credit_balance);

        $this->actingAs($this->cashier)->post(route('customers.settle', $customer), ['amount' => 200, 'method' => 'cash'])->assertSessionHasNoErrors();

        $this->assertEquals(0, (float) $customer->fresh()->credit_balance);
        $this->assertSame('paid', $order->fresh()->payment_status);

        // A ₱150 cash expense from the drawer, then count ₱540: expected 500 + 200 − 150 = 550, short ₱10.
        $this->actingAs($this->cashier)->post(route('expenses.store'), [
            'expense_date' => now()->toDateString(), 'category' => 'transport', 'amount' => 150, 'source' => 'drawer', 'payee' => 'Rider',
        ])->assertSessionHasNoErrors();

        $this->actingAs($this->cashier)->post(route('session.close'), ['closing_counted' => 540])->assertSessionHasNoErrors();
        $session = CashierSession::query()->sole();
        $this->assertSame('closed', $session->status);
        $this->assertEquals(550, (float) $session->expected_cash);
        $this->assertEquals(-10, (float) $session->variance);
    }

    public function test_petty_cash_top_up_from_drawer_and_disbursement(): void
    {
        $this->openDrawer($this->owner, 2000);

        $this->actingAs($this->owner)->post(route('petty.topup'), ['amount' => 800, 'funded_from' => 'drawer'])->assertSessionHasNoErrors();
        $this->actingAs($this->owner)->post(route('expenses.store'), [
            'expense_date' => now()->toDateString(), 'category' => 'supplies', 'amount' => 120, 'source' => 'petty',
        ])->assertSessionHasNoErrors();

        $this->assertEquals(680, (float) PettyCashFund::main()->balance);
        $this->assertEquals(1200, CashierSession::query()->sole()->liveExpectedCash());

        $this->actingAs($this->owner)->post(route('petty.disburse'), ['amount' => 5000, 'reason' => 'Too much'])->assertSessionHasErrors('amount');
    }

    public function test_board_move_persists_and_void_restores_stock(): void
    {
        $this->openDrawer($this->owner);
        $customer = Customer::query()->firstOrFail();
        $frame = Product::query()->where('sku', 'SHR-DRI')->firstOrFail();
        $before = $frame->stock;

        $this->actingAs($this->owner)->post(route('pos.checkout'), [
            'type' => 'job',
            'customer_id' => $customer->id,
            'lines' => [['item_type' => 'product', 'item_id' => $frame->id, 'qty' => 1]],
            'payments' => [['method' => 'cash', 'amount' => 160]],
            'due_at' => now()->addDay()->toDateTimeString(),
        ])->assertSessionHasNoErrors();
        $order = Order::query()->sole();

        $this->actingAs($this->owner)->patch(route('orders.status', $order), ['status' => 'in_production'])->assertSessionHasNoErrors();
        $this->assertSame('in_production', $order->fresh()->status);

        $this->actingAs($this->owner)->post(route('orders.void', $order), ['reason' => 'Customer cancelled'])->assertSessionHasNoErrors();
        $this->assertSame('voided', $order->fresh()->status);
        $this->assertSame($before, $frame->fresh()->stock);
        $this->assertEquals(1000, CashierSession::query()->sole()->liveExpectedCash());
    }

    public function test_unticked_pages_are_hidden_and_blocked(): void
    {
        $this->actingAs($this->cashier)->get(route('settings.index'))->assertForbidden();
        $this->actingAs($this->cashier)->get(route('users.index'))->assertForbidden();
        $this->actingAs($this->cashier)->put(route('settings.update'), [])->assertForbidden();

        $this->actingAs($this->cashier)->get(route('pos.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('auth.pages', fn ($pages) => ! collect($pages)->contains('settings') && collect($pages)->contains('pos')));

        // Ticking the box through the user form grants it immediately.
        $perms = array_merge(Access::roleTemplates()['Cashier'], ['settings.view']);
        $this->actingAs($this->owner)->put(route('users.update', $this->cashier), [
            'name' => $this->cashier->name, 'email' => $this->cashier->email, 'role' => 'Cashier', 'active' => true, 'permissions' => $perms, 'branch_id' => $this->branch->id,
        ])->assertSessionHasNoErrors();

        $this->actingAs($this->cashier->fresh())->get(route('settings.index'))->assertOk();
    }

    public function test_receipt_quotation_and_session_pdfs_render(): void
    {
        $this->openDrawer($this->owner);
        $pen = Product::query()->where('sku', 'STK-LOGO')->firstOrFail();
        $this->actingAs($this->owner)->post(route('pos.checkout'), [
            'type' => 'instant',
            'lines' => [['item_type' => 'product', 'item_id' => $pen->id, 'qty' => 1]],
            'payments' => [['method' => 'cash', 'amount' => 12, 'tendered' => 20]],
        ]);
        $order = Order::query()->sole();

        $this->actingAs($this->owner)->get(route('orders.receipt', $order))->assertOk()->assertHeader('content-type', 'application/pdf');

        $tarp = $this->service('TARP');
        $this->actingAs($this->owner)->post(route('quotations.store'), [
            'customer_name' => 'Hacienda Luisa Resort',
            'lines' => [['item_type' => 'service', 'item_id' => $tarp->id, 'qty' => 2, 'spec' => ['width' => 4, 'height' => 8, 'unit' => 'ft', 'option_ids' => []]]],
        ])->assertSessionHasNoErrors();
        $quote = Quotation::query()->sole();
        $this->assertEquals(960, (float) $quote->total);

        $this->actingAs($this->owner)->get(route('quotations.pdf', $quote))->assertOk()->assertHeader('content-type', 'application/pdf');
        $this->actingAs($this->owner)->post(route('quotations.convert', $quote))->assertRedirect(route('pos.index', ['quotation' => $quote->id]));
        $this->actingAs($this->owner)->get(route('session.pdf', CashierSession::query()->sole()))->assertOk();
    }

    public function test_all_orders_totals_follow_the_filters_and_skip_voided(): void
    {
        $this->openDrawer($this->cashier);
        $customer = Customer::query()->where('name', 'Rodel Dela Cruz')->firstOrFail();
        $pen = Product::query()->where('sku', 'STK-LOGO')->firstOrFail();
        $mug = $this->service('MUG');

        // ₱36 paid cash, ₱1,920 job with ₱1,000 down, and a ₱24 sale that gets voided.
        $this->actingAs($this->cashier)->post(route('pos.checkout'), ['type' => 'instant', 'lines' => [['item_type' => 'product', 'item_id' => $pen->id, 'qty' => 3]], 'payments' => [['method' => 'cash', 'amount' => 36]]])->assertSessionHasNoErrors();
        $this->actingAs($this->cashier)->post(route('pos.checkout'), [
            'type' => 'job', 'customer_id' => $customer->id,
            'lines' => [['item_type' => 'service', 'item_id' => $mug->id, 'qty' => 12, 'spec' => []]],
            'payments' => [['method' => 'gcash', 'amount' => 1000, 'reference' => '1234567890123']],
            'due_at' => now()->addDay()->toDateTimeString(),
        ])->assertSessionHasNoErrors();
        $this->actingAs($this->cashier)->post(route('pos.checkout'), ['type' => 'instant', 'lines' => [['item_type' => 'product', 'item_id' => $pen->id, 'qty' => 2]], 'payments' => [['method' => 'cash', 'amount' => 24]]])->assertSessionHasNoErrors();
        Order::query()->latest('id')->first()->update(['status' => 'voided']);

        $this->actingAs($this->owner)->get(route('orders.index', ['view' => 'list']))
            ->assertInertia(fn ($page) => $page->where('totals.count', 2)->where('totals.voided', 1)
                ->where('totals.total', 1956)->where('totals.paid', 1036)->where('totals.balance', 920));

        $this->actingAs($this->owner)->get(route('orders.index', ['view' => 'list', 'payment' => 'owing']))
            ->assertInertia(fn ($page) => $page->where('totals.count', 1)->where('totals.total', 1920)->where('totals.balance', 920));

        $this->actingAs($this->owner)->get(route('orders.index', ['view' => 'list', 'from' => now()->subDays(3)->toDateString(), 'to' => now()->subDay()->toDateString()]))
            ->assertInertia(fn ($page) => $page->where('totals.count', 0)->where('totals.total', 0));
    }

    public function test_dashboard_sales_follow_the_picked_dates(): void
    {
        $this->openDrawer($this->owner);
        $pen = Product::query()->where('sku', 'STK-LOGO')->firstOrFail();
        $sell = fn (int $qty) => $this->actingAs($this->owner)->post(route('pos.checkout'), [
            'type' => 'instant',
            'lines' => [['item_type' => 'product', 'item_id' => $pen->id, 'qty' => $qty]],
            'payments' => [['method' => 'cash', 'amount' => 12 * $qty]],
        ])->assertSessionHasNoErrors();

        $sell(3); // ₱36 today
        $old = Order::query()->sole();
        $old->forceFill(['created_at' => now()->subDays(5)])->saveQuietly();
        $old->payments()->update(['created_at' => now()->subDays(5)]);
        $sell(2); // ₱24 today

        $today = now()->toDateString();

        // Default is today, with a two-week chart for context and the day highlighted.
        $this->actingAs($this->owner)->get(route('dashboard'))->assertInertia(fn ($page) => $page
            ->where('range.from', $today)->where('range.days', 1)
            ->where('stats.sales', 24)->where('stats.orders', 1)
            ->where('chart.grain', 'day')->has('chart.points', 14)
            ->where('chart.points.13.in_range', true)->where('chart.points.12.in_range', false)
            ->where('byMethod.0.total', 24));

        $this->actingAs($this->owner)->get(route('dashboard', ['from' => now()->subDays(6)->toDateString(), 'to' => $today]))
            ->assertInertia(fn ($page) => $page->where('range.days', 7)->where('stats.sales', 60)->where('stats.orders', 2)->where('stats.average', 30));

        // Dates in the wrong order are swapped; a long range rolls up by month.
        $this->actingAs($this->owner)->get(route('dashboard', ['from' => $today, 'to' => now()->subMonths(5)->startOfMonth()->toDateString()]))
            ->assertInertia(fn ($page) => $page->where('chart.grain', 'month')->has('chart.points', 6)->where('stats.sales', 60));

        // Garbage falls back to today instead of erroring.
        $this->actingAs($this->owner)->get(route('dashboard', ['from' => 'yesterday', 'to' => '2026-99-99']))
            ->assertOk()->assertInertia(fn ($page) => $page->where('range.from', $today)->where('stats.sales', 24));
    }
}
