<?php

namespace Tests\Feature;

use App\Http\Controllers\ReportController;
use App\Models\Branch;
use App\Models\Invoice;
use App\Models\User;
use App\Services\Billing\BillingService;
use Database\Seeders\AccessSeeder;
use Database\Seeders\CatalogSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/** Every branch, billing and platform page opens for the people who should see it. */
class BranchPagesSmokeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([AccessSeeder::class, SettingsSeeder::class, CatalogSeeder::class]);
        $this->app['auth']->forgetGuards();
        $kab = Branch::query()->where('code', 'KAB')->firstOrFail();
        app(BillingService::class)->activate($kab, Carbon::today()->subDays(20), null);
    }

    public function test_public_landing_page_lists_the_branches(): void
    {
        $this->get(route('home'))->assertOk()->assertInertia(fn ($p) => $p
            ->component('Landing')
            ->where('signedIn', false)
            ->has('branches', 3)
            ->where('branches.0.name', 'EAJ Kabankalan')
            ->where('branches.1.name', 'EAJ Dumaguete')
            ->where('branches.2.name', 'EAJ Bacolod')
            ->missing('branches.0.subscription_status'));

        // Cancelled branches drop off the public site.
        Branch::query()->where('code', 'BCD')->update(['subscription_status' => 'cancelled']);
        $this->get(route('home'))->assertInertia(fn ($p) => $p->has('branches', 2));

        $admin = User::query()->where('email', 'admin')->firstOrFail();
        $this->actingAs($admin)->get(route('home'))->assertOk()->assertInertia(fn ($p) => $p->where('signedIn', true));
        $this->actingAs($admin)->get('/dashboard')->assertOk()->assertInertia(fn ($p) => $p->component('Dashboard'));
    }

    public function test_superadmin_pages(): void
    {
        $superadmin = User::query()->where('is_superadmin', true)->firstOrFail();
        $invoice = Invoice::query()->firstOrFail();

        $this->actingAs($superadmin)->get(route('platform.branches.index'))->assertOk()->assertInertia(fn ($p) => $p->component('Platform/Branches')->has('branches', 3));
        $this->actingAs($superadmin)->get(route('platform.branches.index', ['status' => 'overdue']))->assertOk();
        $this->actingAs($superadmin)->get(route('platform.invoices.index', ['status' => 'unpaid', 'month' => now()->format('Y-m')]))->assertOk()->assertInertia(fn ($p) => $p->component('Platform/Invoices'));
        $this->actingAs($superadmin)->get(route('platform.settings.index'))->assertOk()->assertInertia(fn ($p) => $p->component('Platform/Settings')->where('paymongo.configured', false));
        $this->actingAs($superadmin)->get(route('platform.branding.index'))->assertOk()->assertInertia(fn ($p) => $p->component('Platform/Branding'));
        $this->actingAs($superadmin)->get(route('billing.invoices.print', $invoice))->assertOk()->assertSee($invoice->number);
        $this->actingAs($superadmin)->get(route('dashboard'))->assertOk()->assertInertia(fn ($p) => $p->component('Dashboard')->where('auth.user.is_superadmin', true));
        $this->actingAs($superadmin)->post(route('platform.billing.run'))->assertSessionHasNoErrors();
    }

    public function test_admin_pages_on_all_branches_and_in_one(): void
    {
        $admin = User::query()->where('email', 'admin')->firstOrFail();
        $kab = Branch::query()->where('code', 'KAB')->firstOrFail();

        foreach (['dashboard', 'reports.index', 'users.index', 'activity.index', 'billing.index', 'branches.pick', 'users.create'] as $name) {
            $this->actingAs($admin)->get(route($name))->assertOk();
        }
        $this->actingAs($admin)->get(route('reports.pdf'))->assertOk()->assertHeader('content-type', 'application/pdf');
        foreach (array_keys(ReportController::CSV_TYPES) as $type) {
            $this->actingAs($admin)->get(route('reports.csv', ['type' => $type]))->assertOk();
        }

        $this->actingAs($admin)->post(route('branches.switch'), ['branch_id' => $kab->id]);
        foreach (['dashboard', 'pos.index', 'orders.index', 'settings.index', 'inventory.index', 'reports.index', 'billing.index', 'session.index'] as $name) {
            $this->actingAs($admin)->get(route($name))->assertOk();
        }
        $this->actingAs($admin)->get(route('settings.index'))->assertInertia(fn ($p) => $p->where('branch.code', 'KAB')->where('canEditBrand', false)->where('brand.name', 'EAJ Custom Print')->has('backups'));
    }

    public function test_branch_manager_sees_only_their_branch(): void
    {
        $manager = User::query()->where('email', 'manager')->firstOrFail();

        $this->actingAs($manager)->get(route('dashboard'))->assertOk()->assertInertia(fn ($p) => $p
            ->where('branchFilter.locked', true)
            ->where('branches', [])
            ->where('branch.current.code', 'KAB')
            ->where('branch.can_switch', false));
        $this->actingAs($manager)->get(route('reports.index'))->assertOk()->assertInertia(fn ($p) => $p->where('byBranch', fn ($rows) => count($rows) === 1));
        $this->actingAs($manager)->get(route('billing.index'))->assertOk()->assertInertia(fn ($p) => $p->has('accounts', 1));
        $this->actingAs($manager)->get(route('branches.pick'))->assertRedirect(route('dashboard'));
        $this->actingAs($manager)->get(route('platform.branches.index'))->assertForbidden();
    }
}
