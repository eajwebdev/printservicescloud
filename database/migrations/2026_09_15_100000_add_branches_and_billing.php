<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Multi-branch SKC Custom Print: every shop record belongs to a branch, document numbers are
 * unique per branch, and each branch carries its own monthly subscription and invoices.
 */
return new class extends Migration
{
    /** Tables whose rows belong to exactly one branch. */
    private const BRANCH_TABLES = [
        'customers', 'suppliers', 'inventory_items', 'products', 'service_categories', 'services', 'stock_movements',
        'purchases', 'cashier_sessions', 'quotations', 'orders', 'receivables', 'payments', 'petty_cash_funds',
        'expenses', 'held_carts',
    ];

    /** table => [old unique index, columns that become unique within a branch] */
    private const PER_BRANCH_UNIQUE = [
        'products' => [['products_sku_unique', ['sku']], ['products_barcode_unique', ['barcode']]],
        'inventory_items' => [['inventory_items_sku_unique', ['sku']]],
        'service_categories' => [['service_categories_name_unique', ['name']]],
        'services' => [['services_code_unique', ['code']]],
        'purchases' => [['purchases_po_no_unique', ['po_no']]],
        'quotations' => [['quotations_quote_no_unique', ['quote_no']]],
        'orders' => [['orders_order_no_unique', ['order_no']]],
        'sequences' => [['sequences_name_period_unique', ['name', 'period']]],
        'settings' => [['settings_key_unique', ['key']]],
    ];

    public function up(): void
    {
        Schema::create('branches', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code', 10)->unique();
            $table->string('address')->nullable();
            $table->string('phone', 40)->nullable();
            $table->string('email')->nullable();
            $table->boolean('active')->default(true);
            // Subscription
            $table->enum('subscription_status', ['trial', 'active', 'suspended', 'cancelled'])->default('trial');
            $table->decimal('monthly_fee', 10, 2)->nullable(); // null = platform default
            $table->date('trial_ends_on')->nullable();
            $table->date('subscribed_on')->nullable();
            $table->unsignedTinyInteger('billing_day')->nullable(); // 1..28
            $table->date('next_bill_on')->nullable();
            $table->date('grace_until')->nullable(); // superadmin can keep a branch open past the lock until this date
            $table->timestamp('suspended_at')->nullable();
            $table->string('suspend_reason')->nullable();
            $table->text('billing_notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        // Existing installs keep their data in a first branch; fresh installs get branches from the seeder.
        $mainId = null;
        if (DB::table('users')->exists()) {
            $mainId = DB::table('branches')->insertGetId([
                'name' => 'Main branch',
                'code' => 'MAIN',
                'active' => true,
                'subscription_status' => 'trial',
                'trial_ends_on' => now()->addDays(30)->toDateString(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        foreach (self::BRANCH_TABLES as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->foreignId('branch_id')->nullable()->after('id')->constrained()->restrictOnDelete();
            });
            if ($mainId) {
                DB::table($name)->update(['branch_id' => $mainId]);
            }
        }

        foreach (['sequences', 'settings'] as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->foreignId('branch_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
            });
        }
        if ($mainId) {
            DB::table('sequences')->update(['branch_id' => $mainId]);
        }

        foreach (self::PER_BRANCH_UNIQUE as $name => $indexes) {
            Schema::table($name, function (Blueprint $table) use ($indexes) {
                foreach ($indexes as [$old, $columns]) {
                    $table->dropUnique($old);
                    $table->unique(['branch_id', ...$columns]);
                }
            });
        }

        Schema::table('orders', fn (Blueprint $table) => $table->index(['branch_id', 'created_at']));
        Schema::table('payments', fn (Blueprint $table) => $table->index(['branch_id', 'created_at']));
        Schema::table('expenses', fn (Blueprint $table) => $table->index(['branch_id', 'expense_date']));

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('branch_id')->nullable()->after('id')->constrained()->nullOnDelete();
            $table->boolean('is_superadmin')->default(false)->after('is_owner');
        });
        if ($mainId) {
            DB::table('users')->where('is_owner', false)->update(['branch_id' => $mainId]);
        }

        $activity = config('activitylog.table_name', 'activity_log');
        if (Schema::hasTable($activity)) {
            Schema::table($activity, function (Blueprint $table) {
                $table->unsignedBigInteger('branch_id')->nullable()->index();
            });
            if ($mainId) {
                DB::table($activity)->update(['branch_id' => $mainId]);
            }
        }

        // Monthly bills, one per branch per billing period.
        Schema::create('billing_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount', 10, 2);
            $table->enum('channel', ['paymongo', 'manual']);
            $table->enum('status', ['pending', 'paid', 'failed', 'expired'])->default('pending');
            $table->string('checkout_id', 120)->nullable()->index();
            $table->string('checkout_url', 500)->nullable();
            $table->string('provider_payment_id', 120)->nullable();
            $table->string('method', 40)->nullable(); // gcash, card, paymaya, bank, cash...
            $table->string('reference', 120)->nullable();
            $table->json('invoice_ids');
            $table->timestamp('paid_at')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->string('number', 40)->unique();
            $table->date('period_start');
            $table->date('period_end');
            $table->date('issued_on');
            $table->date('due_on');
            $table->decimal('amount', 10, 2);
            $table->enum('status', ['unpaid', 'paid', 'void'])->default('unpaid');
            $table->timestamp('paid_at')->nullable();
            $table->foreignId('billing_payment_id')->nullable()->constrained()->nullOnDelete();
            $table->string('description')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['branch_id', 'period_start']);
            $table->index(['status', 'due_on']);
        });

        // New checkboxes: the billing page.
        if (Schema::hasTable('permissions')) {
            app(PermissionRegistrar::class)->forgetCachedPermissions();
            foreach (['billing.view', 'billing.pay'] as $name) {
                $permission = Permission::findOrCreate($name, 'web');
                foreach (['Admin', 'Manager'] as $role) {
                    Role::query()->where('name', $role)->first()?->givePermissionTo($permission);
                }
            }
        }

        // Old installs used "PR-" document numbers; new ones carry the branch code.
        foreach (['order_no_format' => ['PR-{YYMM}-{####}', '{BR}-{YYMM}-{####}'], 'quotation_no_format' => ['QT-{YYMM}-{###}', 'QT-{BR}-{YYMM}-{###}'], 'purchase_no_format' => ['PO-{YYYY}-{###}', 'PO-{BR}-{YYYY}-{###}']] as $key => [$old, $new]) {
            DB::table('settings')->where('key', $key)->where('value', json_encode($old))->update(['value' => json_encode($new)]);
        }
        DB::table('settings')->where('key', 'business_name')->where('value', json_encode('Print Request'))->update(['value' => json_encode('SKC Custom Print')]);
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('billing_payments');

        $activity = config('activitylog.table_name', 'activity_log');
        if (Schema::hasColumn($activity, 'branch_id')) {
            Schema::table($activity, function (Blueprint $table) {
                $table->dropIndex(['branch_id']);
                $table->dropColumn('branch_id');
            });
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('branch_id');
            $table->dropColumn('is_superadmin');
        });

        // MySQL/MariaDB won't drop an index a foreign key leans on, so the keys go first.
        $tables = [...self::BRANCH_TABLES, 'sequences', 'settings'];
        foreach ($tables as $name) {
            Schema::table($name, fn (Blueprint $table) => $table->dropForeign(['branch_id']));
        }

        Schema::table('orders', fn (Blueprint $table) => $table->dropIndex(['branch_id', 'created_at']));
        Schema::table('payments', fn (Blueprint $table) => $table->dropIndex(['branch_id', 'created_at']));
        Schema::table('expenses', fn (Blueprint $table) => $table->dropIndex(['branch_id', 'expense_date']));

        foreach (self::PER_BRANCH_UNIQUE as $name => $indexes) {
            Schema::table($name, function (Blueprint $table) use ($indexes) {
                foreach ($indexes as [$old, $columns]) {
                    $table->dropUnique(['branch_id', ...$columns]);
                    $table->unique($columns, $old);
                }
            });
        }

        foreach ($tables as $name) {
            Schema::table($name, fn (Blueprint $table) => $table->dropColumn('branch_id'));
        }

        Schema::dropIfExists('branches');
    }
};
