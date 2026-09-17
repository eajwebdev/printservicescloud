<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\Service;
use App\Models\Setting;
use App\Models\User;
use App\Services\BackupService;
use Database\Seeders\AccessSeeder;
use Database\Seeders\CatalogSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Everything that happens to an order after the sale: printing, files and proofs, changes and refunds, and backups. */
class OrderAftercareTest extends TestCase
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
        $this->cashier = User::query()->where('email', 'cashier@skccustomprint.test')->firstOrFail();
        Bus::fake();
    }

    private function openDrawer(User $user, float $float = 1000): void
    {
        $this->actingAs($user)->post(route('session.open'), ['opening_float' => $float])->assertSessionHasNoErrors();
    }

    private function sellPens(int $qty): Order
    {
        $pen = Product::query()->where('sku', 'STK-LOGO')->firstOrFail();
        $this->actingAs($this->cashier)->post(route('pos.checkout'), [
            'type' => 'instant',
            'lines' => [['item_type' => 'product', 'item_id' => $pen->id, 'qty' => $qty]],
            'payments' => [['method' => 'cash', 'amount' => 12 * $qty]],
        ])->assertSessionHasNoErrors();

        return Order::query()->latest('id')->firstOrFail();
    }

    private function mugJob(Customer $customer): Order
    {
        $mug = Service::query()->where('code', 'MUG')->firstOrFail();
        $this->actingAs($this->cashier)->post(route('pos.checkout'), [
            'type' => 'job',
            'customer_id' => $customer->id,
            'lines' => [['item_type' => 'service', 'item_id' => $mug->id, 'qty' => 12, 'spec' => []]],
            'payments' => [['method' => 'gcash', 'amount' => 1000, 'reference' => '1234567890123']],
            'due_at' => now()->addDay()->toDateTimeString(),
        ])->assertSessionHasNoErrors();

        return Order::query()->latest('id')->firstOrFail();
    }

    public function test_thermal_receipt_counts_prints_and_marks_reprints(): void
    {
        $this->openDrawer($this->cashier);
        $order = $this->sellPens(2);

        $this->actingAs($this->cashier)->get(route('orders.print', $order))
            ->assertOk()->assertSee($order->order_no)->assertSee('afterprint', false)->assertDontSee('REPRINT');
        $this->actingAs($this->cashier)->get(route('orders.print', $order))
            ->assertOk()->assertSee('REPRINT');

        $this->assertSame(2, $order->fresh()->print_count);
        $this->assertDatabaseHas('activity_log', ['subject_id' => $order->id, 'description' => "Reprinted receipt for {$order->order_no} (copy 2)"]);

        // Preview neither counts nor auto-prints.
        $this->actingAs($this->cashier)->get(route('orders.print', [$order, 'preview' => 1]))->assertOk()->assertDontSee('afterprint', false);
        $this->assertSame(2, $order->fresh()->print_count);
    }

    public function test_job_files_proof_approval_and_private_download(): void
    {
        Storage::fake('local');
        $this->openDrawer($this->cashier);
        $order = $this->mugJob(Customer::query()->where('name', 'Rodel Dela Cruz')->firstOrFail());

        $this->actingAs($this->cashier)->post(route('orders.files.store', $order), [
            'kind' => 'proof',
            'files' => [UploadedFile::fake()->image('mug-proof.png', 400, 300)],
        ])->assertSessionHasNoErrors();

        $order->refresh();
        $file = $order->files()->sole();
        $this->assertSame('waiting', $order->proof_status);
        Storage::disk('local')->assertExists($file->path);

        $this->actingAs($this->owner)->get(route('orders.peek', $order))
            ->assertJsonPath('order.files.0.name', 'mug-proof.png')
            ->assertJsonPath('order.proof_status', 'waiting');
        $this->actingAs($this->cashier)->get(route('orders.files.show', [$order, $file]))->assertOk();

        // Only real design formats get in.
        $this->actingAs($this->cashier)->post(route('orders.files.store', $order), [
            'kind' => 'design',
            'files' => [UploadedFile::fake()->create('virus.exe', 10)],
        ])->assertSessionHasErrors();

        $this->actingAs($this->cashier)->patch(route('orders.proof', $order), ['status' => 'approved'])->assertSessionHasNoErrors();
        $order->refresh();
        $this->assertSame('approved', $order->proof_status);
        $this->assertSame($this->cashier->id, $order->proof_approved_by);

        $this->actingAs($this->cashier)->delete(route('orders.files.destroy', [$order, $file]))->assertSessionHasNoErrors();
        Storage::disk('local')->assertMissing($file->path);
        $this->assertSame('approved', $order->fresh()->proof_status);
    }

    public function test_adding_items_after_checkout_collects_the_difference_and_moves_stock(): void
    {
        $this->openDrawer($this->cashier, 1000);
        $order = $this->sellPens(2);
        $pen = Product::query()->where('sku', 'STK-LOGO')->firstOrFail();
        $stock = $pen->stock;

        $this->actingAs($this->cashier)->get(route('orders.change', $order))
            ->assertInertia(fn ($page) => $page->component('Orders/Change')->where('lines.0.qty', 2)->where('canRefund', false));

        // A walk-in has to pay for the extra 3 pens now.
        $this->actingAs($this->cashier)->put(route('orders.change.save', $order), [
            'reason' => 'Customer wanted 3 more pens',
            'lines' => [['item_type' => 'product', 'item_id' => $pen->id, 'qty' => 5]],
            'expected_total' => 60,
        ])->assertSessionHasErrors('collect_amount');
        $this->assertEquals(24, (float) $order->fresh()->total);
        $this->assertSame($stock, $pen->fresh()->stock);

        $this->actingAs($this->cashier)->put(route('orders.change.save', $order), [
            'reason' => 'Customer wanted 3 more pens',
            'lines' => [['item_type' => 'product', 'item_id' => $pen->id, 'qty' => 5]],
            'expected_total' => 60,
            'collect_amount' => 36,
            'collect_method' => 'cash',
        ])->assertSessionHasNoErrors()->assertRedirect(route('orders.show', $order));

        $order->refresh();
        $this->assertEquals(60, (float) $order->total);
        $this->assertEquals(60, (float) $order->paid);
        $this->assertEquals(0, (float) $order->balance);
        $this->assertSame($stock - 3, $pen->fresh()->stock);
        $this->assertEquals(1060, $this->cashier->openSession->liveExpectedCash());
        $this->assertDatabaseHas('order_revisions', ['order_id' => $order->id, 'collected' => 36, 'refunded' => 0]);
    }

    public function test_returning_items_needs_refund_access_and_pays_back_from_the_drawer(): void
    {
        $this->openDrawer($this->cashier, 1000);
        $order = $this->sellPens(5);
        $pen = Product::query()->where('sku', 'STK-LOGO')->firstOrFail();
        $stock = $pen->stock;
        $payload = [
            'reason' => 'Returned 4 pens',
            'lines' => [['item_type' => 'product', 'item_id' => $pen->id, 'qty' => 1]],
            'expected_total' => 12,
            'refund_method' => 'cash',
        ];

        $this->actingAs($this->cashier)->put(route('orders.change.save', $order), $payload)->assertSessionHasErrors('lines');
        $this->assertEquals(60, (float) $order->fresh()->total);

        $this->openDrawer($this->owner, 500);
        $this->actingAs($this->owner)->put(route('orders.change.save', $order), $payload)->assertSessionHasNoErrors();

        $order->refresh();
        $this->assertEquals(12, (float) $order->total);
        $this->assertEquals(12, (float) $order->paid);
        $this->assertSame($stock + 4, $pen->fresh()->stock);
        $this->assertDatabaseHas('payments', ['order_id' => $order->id, 'kind' => 'refund', 'amount' => -48]);
        $this->assertEquals(452, $this->owner->openSession->liveExpectedCash());
    }

    public function test_changing_a_customer_job_updates_their_balance(): void
    {
        $this->openDrawer($this->cashier);
        $customer = Customer::query()->where('name', 'Rodel Dela Cruz')->firstOrFail();
        $order = $this->mugJob($customer);
        $mug = Service::query()->where('code', 'MUG')->firstOrFail();

        $this->actingAs($this->cashier)->put(route('orders.change.save', $order), [
            'reason' => 'Two more mugs for the office',
            'lines' => [['item_type' => 'service', 'item_id' => $mug->id, 'qty' => 14, 'spec' => []]],
        ])->assertSessionHasNoErrors();

        $order->refresh();
        $this->assertGreaterThan(1920, (float) $order->total);
        $this->assertEquals((float) $order->total - 1000, (float) $order->balance);
        $this->assertEquals((float) $order->balance, (float) $order->receivable->fresh()->amount);
        $this->assertEquals((float) $order->balance, (float) $customer->fresh()->credit_balance);
    }

    public function test_voided_orders_can_not_be_changed(): void
    {
        $this->openDrawer($this->cashier);
        $order = $this->sellPens(1);
        $order->update(['status' => 'voided']);
        $pen = Product::query()->where('sku', 'STK-LOGO')->firstOrFail();

        $this->actingAs($this->owner)->put(route('orders.change.save', $order), [
            'reason' => 'Oops',
            'lines' => [['item_type' => 'product', 'item_id' => $pen->id, 'qty' => 3]],
        ])->assertSessionHasErrors('lines');
    }

    public function test_backup_and_restore_round_trip(): void
    {
        Storage::fake('local');
        $this->openDrawer($this->cashier);
        $order = $this->sellPens(2);

        $this->actingAs($this->owner)->post(route('settings.backups.store'))->assertSessionHasNoErrors();
        $backups = app(BackupService::class)->list();
        $this->assertCount(1, $backups);
        $this->actingAs($this->owner)->get(route('settings.backups.download', $backups[0]['name']))->assertOk();
        $this->actingAs($this->cashier)->get(route('settings.backups.download', $backups[0]['name']))->assertForbidden();

        // Things go wrong after the backup...
        Setting::put(['business_name' => 'Wrong Name']);
        $order->items()->delete();
        $order->delete();

        $counts = app(BackupService::class)->restore(app(BackupService::class)->path($backups[0]['name']));

        $this->assertSame(1, $counts['orders']);
        $this->assertNotNull(Order::query()->find($order->id));
        $this->assertSame(1, Order::query()->find($order->id)->items()->count());
        $this->assertNotSame('Wrong Name', Setting::get('business_name'));
    }
}
