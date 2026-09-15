<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // How many times the receipt was printed; copies after the first say REPRINT.
            $table->unsignedSmallInteger('print_count')->default(0)->after('void_reason');
            // none: no proof needed; waiting: proof sent, customer hasn't said yes; approved.
            $table->enum('proof_status', ['none', 'waiting', 'approved'])->default('none')->after('print_count');
            $table->dateTime('proof_approved_at')->nullable()->after('proof_status');
            $table->foreignId('proof_approved_by')->nullable()->after('proof_approved_at')->constrained('users')->nullOnDelete();
        });

        Schema::create('order_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->enum('kind', ['design', 'proof', 'photo', 'other'])->default('design');
            $table->string('path');
            $table->string('original_name');
            $table->string('mime', 120)->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->string('note')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        // Changes to an order after checkout (items added, returned, repriced), kept for the audit trail.
        Schema::create('order_revisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('reason');
            $table->decimal('old_total', 12, 2);
            $table->decimal('new_total', 12, 2);
            $table->decimal('collected', 12, 2)->default(0);
            $table->decimal('refunded', 12, 2)->default(0);
            $table->json('old_lines');
            $table->json('new_lines');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        // New checkbox for existing installs; owners and Admins get it straight away.
        if (Schema::hasTable('permissions')) {
            app(PermissionRegistrar::class)->forgetCachedPermissions();
            $permission = Permission::findOrCreate('orders.refund', 'web');
            foreach (['Admin', 'Manager'] as $role) {
                if ($r = \Spatie\Permission\Models\Role::query()->where('name', $role)->first()) {
                    $r->givePermissionTo($permission);
                }
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('order_revisions');
        Schema::dropIfExists('order_files');
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('proof_approved_by');
            $table->dropColumn(['print_count', 'proof_status', 'proof_approved_at']);
        });
    }
};
