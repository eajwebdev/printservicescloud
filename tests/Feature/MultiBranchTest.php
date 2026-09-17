<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Support\BranchContext;
use Database\Seeders\AccessSeeder;
use Database\Seeders\CatalogSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Tests\TestCase;

class MultiBranchTest extends TestCase
{
    use RefreshDatabase;

    private Branch $kab;

    private Branch $bcd;

    private User $admin;

    private User $kabCashier;

    private User $bcdCashier;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([AccessSeeder::class, SettingsSeeder::class, CatalogSeeder::class]);
        Bus::fake();
        $this->kab = Branch::query()->where('code', 'KAB')->firstOrFail();
        $this->bcd = Branch::query()->where('code', 'BCD')->firstOrFail();
        $this->admin = User::query()->where('email', 'admin')->firstOrFail();
        $this->kabCashier = User::query()->where('email', 'cashier')->firstOrFail();
        $this->bcdCashier = User::query()->where('email', 'bacolod.cashier')->firstOrFail();
    }

    /** Sell one pen at the cashier's branch and return the order, read without any branch filter. */
    private function sellPen(User $cashier, Branch $branch): Order
    {
        $pen = BranchContext::current()->run($branch->id, fn () => Product::query()->where('sku', 'STK-LOGO')->firstOrFail());
        $this->actingAs($cashier)->post(route('session.open'), ['opening_float' => 500])->assertSessionHasNoErrors();
        $this->actingAs($cashier)->post(route('pos.checkout'), [
            'type' => 'instant',
            'lines' => [['item_type' => 'product', 'item_id' => $pen->id, 'qty' => 1]],
            'payments' => [['method' => 'cash', 'amount' => 12]],
        ])->assertSessionHasNoErrors();

        return Order::withoutGlobalScope('branch')->where('branch_id', $branch->id)->latest('id')->firstOrFail();
    }

    public function test_each_branch_has_its_own_catalog_numbers_and_orders(): void
    {
        $kabOrder = $this->sellPen($this->kabCashier, $this->kab);
        $bcdOrder = $this->sellPen($this->bcdCashier, $this->bcd);

        // Same SKUs in both branches, and document numbers that never collide.
        $this->assertSame(Branch::query()->count(), Product::withoutGlobalScope('branch')->where('sku', 'STK-LOGO')->count());
        $this->assertStringStartsWith('KAB-', $kabOrder->order_no);
        $this->assertStringStartsWith('BCD-', $bcdOrder->order_no);
        $this->assertNotSame($kabOrder->order_no, $bcdOrder->order_no);

        // Stock only left the branch that sold it.
        $stock = fn (Branch $b) => (int) Product::withoutGlobalScope('branch')->where('branch_id', $b->id)->where('sku', 'STK-LOGO')->value('stock');
        $this->assertSame(89, $stock($this->kab));
        $this->assertSame(89, $stock($this->bcd));

        // A branch never sees another branch's records, even by guessing the id.
        $this->actingAs($this->bcdCashier)->get(route('orders.show', $kabOrder))->assertNotFound();
        $this->actingAs($this->bcdCashier)->get(route('orders.index', ['view' => 'list']))
            ->assertInertia(fn ($page) => $page->where('orders.total', 1)->where('orders.data.0.order_no', $bcdOrder->order_no));
    }

    public function test_branch_staff_can_not_use_another_branchs_customer_or_product(): void
    {
        $kabCustomer = BranchContext::current()->run($this->kab->id, fn () => Customer::query()->firstOrFail());
        $kabPen = BranchContext::current()->run($this->kab->id, fn () => Product::query()->where('sku', 'STK-LOGO')->firstOrFail());

        $this->actingAs($this->bcdCashier)->post(route('session.open'), ['opening_float' => 500]);
        $this->actingAs($this->bcdCashier)->post(route('pos.checkout'), [
            'type' => 'instant',
            'customer_id' => $kabCustomer->id,
            'lines' => [['item_type' => 'product', 'item_id' => $kabPen->id, 'qty' => 1]],
            'payments' => [['method' => 'cash', 'amount' => 12]],
        ])->assertSessionHasErrors(['customer_id']);

        $this->actingAs($this->bcdCashier)->post(route('pos.checkout'), [
            'type' => 'instant',
            'lines' => [['item_type' => 'product', 'item_id' => $kabPen->id, 'qty' => 1]],
            'payments' => [['method' => 'cash', 'amount' => 12]],
        ])->assertSessionHasErrors(['lines.0.item_id']);

        $this->assertSame(0, Order::withoutGlobalScope('branch')->count());
    }

    public function test_admin_sees_all_branches_filters_them_and_picks_one_to_work(): void
    {
        $this->sellPen($this->kabCashier, $this->kab);
        $this->sellPen($this->bcdCashier, $this->bcd);
        BranchContext::current()->set(null);

        // Consolidated by default, with a row per branch.
        $this->actingAs($this->admin)->get(route('dashboard'))->assertInertia(fn ($page) => $page
            ->where('stats.orders', 2)
            ->where('stats.sales', 24)
            ->where('branchFilter.label', 'All branches')
            ->has('branches', 3));

        // Narrowed to one branch.
        $this->actingAs($this->admin)->get(route('dashboard', ['branches' => [$this->bcd->id]]))->assertInertia(fn ($page) => $page
            ->where('stats.orders', 1)
            ->where('branchFilter.selected', [$this->bcd->id])
            ->has('branches', 1));

        // Reports follow the same filter, with branch comparison and staff tables.
        $this->actingAs($this->admin)->get(route('reports.index', ['branches' => [$this->kab->id, $this->bcd->id]]))->assertInertia(fn ($page) => $page
            ->where('summary.orders', 2)
            ->has('byBranch', 2)
            ->has('staff', 2));
        $this->actingAs($this->admin)->get(route('reports.csv', ['type' => 'branches']))->assertOk();
        $this->actingAs($this->admin)->get(route('reports.csv', ['type' => 'payments', 'branches' => [$this->kab->id]]))->assertOk();

        // Branch-bound pages ask the admin to pick a branch first.
        $this->actingAs($this->admin)->get(route('pos.index'))->assertRedirect(route('branches.pick'));
        $this->actingAs($this->admin)->post(route('branches.switch'), ['branch_id' => $this->bcd->id])->assertRedirect(route('pos.index'));
        $this->actingAs($this->admin)->get(route('pos.index'))->assertOk();

        // Branch staff can not widen their view.
        $this->actingAs($this->kabCashier)->post(route('branches.switch'), ['branch_id' => $this->bcd->id])->assertForbidden();
    }

    public function test_opening_a_record_from_all_branches_switches_to_its_branch(): void
    {
        $order = $this->sellPen($this->bcdCashier, $this->bcd);
        BranchContext::current()->set(null);

        $this->actingAs($this->admin)->get(route('orders.show', $order))->assertOk()
            ->assertSessionHas('branch_id', $this->bcd->id);
    }

    public function test_staff_of_a_closed_branch_can_not_sign_in(): void
    {
        $this->bcd->update(['active' => false]);

        $this->app['auth']->forgetGuards(); // the catalog seeder signs the owner in
        $this->post('/login', ['email' => 'bacolod.cashier', 'password' => 'password'])->assertSessionHasErrors('email');
        $this->assertGuest();

        $this->post('/login', ['email' => 'cashier', 'password' => 'password'])->assertSessionHasNoErrors();
        $this->assertAuthenticatedAs($this->kabCashier);
    }

    public function test_branch_managers_only_manage_their_own_staff(): void
    {
        $manager = User::query()->where('email', 'bacolod.manager')->firstOrFail();
        $manager->givePermissionTo(['users.view', 'users.edit', 'users.create']);

        $this->actingAs($manager)->get(route('users.index'))->assertInertia(fn ($page) => $page
            ->where('users', fn ($users) => collect($users)->every(fn ($u) => $u['branch'] === 'SKC Bacolod')));
        $this->actingAs($manager)->get(route('users.edit', $this->kabCashier))->assertNotFound();

        // A new account from a branch manager always lands in their branch, never all branches.
        $this->actingAs($manager)->post(route('users.store'), [
            'name' => 'New Bacolod Staff', 'email' => 'new@skc.test', 'password' => 'password123', 'role' => 'Cashier',
            'active' => true, 'all_branches' => true, 'branch_id' => $this->kab->id, 'permissions' => ['pos.view'],
        ])->assertSessionHasNoErrors();
        $created = User::query()->where('email', 'new@skc.test')->firstOrFail();
        $this->assertSame($this->bcd->id, $created->branch_id);
        $this->assertFalse($created->is_owner);
    }
}
