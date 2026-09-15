<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cashier_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->decimal('opening_float', 12, 2);
            $table->decimal('expected_cash', 12, 2)->nullable(); // frozen at close
            $table->decimal('closing_counted', 12, 2)->nullable();
            $table->decimal('variance', 12, 2)->nullable();
            $table->enum('status', ['open', 'closed'])->default('open');
            $table->dateTime('opened_at');
            $table->timestamp('closed_at')->nullable();
            $table->text('opening_note')->nullable();
            $table->text('closing_note')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'status']);
        });

        // Every peso that enters or leaves the drawer, signed. Expected cash = float + SUM(amount).
        Schema::create('cash_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cashier_session_id')->constrained()->cascadeOnDelete();
            $table->enum('type', ['sale', 'collection', 'refund', 'expense', 'petty_out', 'paid_out', 'cash_drop', 'adjustment']);
            $table->decimal('amount', 12, 2);
            $table->nullableMorphs('source');
            $table->string('note')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('quotations', function (Blueprint $table) {
            $table->id();
            $table->string('quote_no', 40)->unique();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->string('customer_name')->nullable();
            $table->enum('status', ['draft', 'sent', 'accepted', 'converted', 'expired'])->default('draft');
            $table->date('valid_until')->nullable();
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->string('discount_type', 10)->nullable();
            $table->decimal('discount_value', 12, 2)->default(0);
            $table->decimal('discount_total', 12, 2)->default(0);
            $table->decimal('tax_total', 12, 2)->default(0);
            $table->decimal('total', 12, 2)->default(0);
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('order_id')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('quotation_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quotation_id')->constrained()->cascadeOnDelete();
            $table->enum('item_type', ['product', 'service']);
            $table->unsignedBigInteger('item_id');
            $table->string('name');
            $table->json('spec')->nullable();
            $table->decimal('qty', 12, 3);
            $table->decimal('unit_price', 12, 2);
            $table->decimal('gross', 12, 2);
            $table->string('discount_type', 10)->nullable();
            $table->decimal('discount_value', 12, 2)->default(0);
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->decimal('line_total', 12, 2);
            $table->string('note')->nullable();
            $table->timestamps();
        });

        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_no', 40)->unique();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('type', ['instant', 'job']);
            $table->enum('status', ['completed', 'pending', 'in_production', 'ready', 'released', 'voided'])->index();
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->string('discount_type', 10)->nullable();
            $table->decimal('discount_value', 12, 2)->default(0);
            $table->decimal('discount_total', 12, 2)->default(0); // order-level + senior/PWD
            $table->boolean('senior_pwd')->default(false);
            $table->decimal('senior_pwd_discount', 12, 2)->default(0);
            $table->decimal('tax_total', 12, 2)->default(0);
            $table->decimal('total', 12, 2)->default(0);
            $table->decimal('paid', 12, 2)->default(0);   // real money received (cash/gcash/bank)
            $table->decimal('balance', 12, 2)->default(0); // still owed
            $table->decimal('cost_total', 12, 2)->default(0);
            $table->enum('payment_status', ['paid', 'partial', 'credit', 'unpaid'])->default('paid');
            $table->dateTime('due_at')->nullable();
            $table->boolean('rush')->default(false);
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('cashier_session_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('quotation_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('board_position')->default(0);
            $table->text('notes')->nullable();
            $table->timestamp('status_changed_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->string('void_reason')->nullable();
            $table->timestamps();
            $table->index('created_at');
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->enum('item_type', ['product', 'service']);
            $table->unsignedBigInteger('item_id');
            $table->string('name');
            $table->string('category', 60)->nullable();
            $table->json('spec')->nullable(); // width/height/unit/sqft/options/rush
            $table->decimal('qty', 12, 3);
            $table->decimal('unit_price', 12, 2);
            $table->decimal('gross', 12, 2);
            $table->string('discount_type', 10)->nullable();
            $table->decimal('discount_value', 12, 2)->default(0);
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->decimal('line_total', 12, 2);
            $table->decimal('cost_total', 12, 2)->default(0);
            $table->string('note')->nullable();
            $table->timestamps();
            $table->index(['item_type', 'item_id']);
        });

        Schema::create('receivables', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained()->restrictOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('amount', 12, 2);
            $table->decimal('settled', 12, 2)->default(0);
            $table->enum('status', ['open', 'settled', 'written_off'])->default('open');
            $table->date('due_date')->nullable();
            $table->timestamps();
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('receivable_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('method', ['cash', 'gcash', 'bank', 'credit']);
            $table->enum('kind', ['sale', 'settlement', 'refund'])->default('sale');
            $table->decimal('amount', 12, 2);
            $table->decimal('tendered', 12, 2)->nullable();
            $table->string('reference', 100)->nullable();
            $table->foreignId('cashier_session_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
            $table->index(['method', 'created_at']);
        });

        Schema::create('petty_cash_funds', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->decimal('balance', 12, 2)->default(0);
            $table->decimal('float_target', 12, 2)->default(0);
            $table->decimal('low_threshold', 12, 2)->default(0);
            $table->foreignId('custodian_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->date('expense_date');
            $table->enum('category', ['rent', 'utilities', 'salaries', 'supplies', 'repairs', 'transport', 'marketing', 'misc']);
            $table->decimal('amount', 12, 2);
            $table->string('payee')->nullable();
            $table->text('notes')->nullable();
            $table->string('receipt_path')->nullable();
            $table->enum('source', ['drawer', 'petty', 'bank']);
            $table->foreignId('cashier_session_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
            $table->index(['expense_date', 'category']);
        });

        Schema::create('petty_cash_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('petty_cash_fund_id')->constrained()->cascadeOnDelete();
            $table->enum('type', ['in', 'out', 'adjustment']);
            $table->decimal('amount', 12, 2); // signed
            $table->decimal('balance_after', 12, 2);
            $table->string('reason');
            $table->string('ref', 100)->nullable();
            $table->enum('funded_from', ['drawer', 'bank', 'owner'])->nullable();
            $table->foreignId('expense_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('held_carts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('label');
            $table->json('payload');
            $table->decimal('total', 12, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['held_carts', 'petty_cash_transactions', 'expenses', 'petty_cash_funds', 'payments', 'receivables',
            'order_items', 'orders', 'quotation_items', 'quotations', 'cash_movements', 'cashier_sessions'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
