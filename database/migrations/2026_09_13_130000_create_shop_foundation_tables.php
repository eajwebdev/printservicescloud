<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->json('value')->nullable();
            $table->timestamps();
        });

        // Row-locked counters for order / quote / PO numbers.
        Schema::create('sequences', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('period', 20);
            $table->unsignedInteger('last_value')->default(0);
            $table->unique(['name', 'period']);
        });

        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('business_name')->nullable();
            $table->string('phone', 40)->nullable();
            $table->string('email')->nullable();
            $table->string('address')->nullable();
            $table->decimal('credit_balance', 12, 2)->default(0);
            $table->decimal('credit_limit', 12, 2)->nullable();
            $table->boolean('is_senior_pwd')->default(false);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index('name');
            $table->index('phone');
        });

        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('contact_person')->nullable();
            $table->string('phone', 40)->nullable();
            $table->string('email')->nullable();
            $table->string('address')->nullable();
            $table->string('terms', 60)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('inventory_items', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('sku', 60)->nullable()->unique();
            $table->string('category', 60)->nullable();
            $table->string('unit', 20); // sqft, sheet, ml, pc, roll, m
            $table->decimal('stock', 14, 3)->default(0);
            $table->decimal('cost', 12, 4)->default(0); // moving-average cost per unit
            $table->decimal('reorder_level', 14, 3)->default(0);
            $table->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('sku', 60)->unique();
            $table->string('barcode', 80)->nullable()->unique();
            $table->string('category', 60)->nullable();
            $table->decimal('price', 12, 2);
            $table->decimal('cost', 12, 4)->default(0);
            $table->integer('stock')->default(0);
            $table->integer('reorder_level')->default(0);
            $table->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
            // When set, this product is a raw material resold over the counter:
            // its stock lives on the inventory item instead of on the product.
            $table->foreignId('inventory_item_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('service_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();
        });

        Schema::create('services', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_category_id')->constrained()->restrictOnDelete();
            $table->string('name');
            $table->string('code', 40)->nullable()->unique();
            $table->enum('pricing_model', ['per_sqft', 'per_piece', 'tiered', 'fixed']);
            $table->decimal('base_price', 12, 2)->default(0);
            $table->decimal('cost', 12, 4)->default(0);
            $table->decimal('min_charge', 12, 2)->default(0);
            $table->json('tiers')->nullable(); // [{min_qty, price}]
            $table->string('unit_label', 30)->default('pc');
            $table->boolean('is_job')->default(false); // defaults the POS to a job order
            $table->unsignedSmallInteger('lead_time_hours')->default(0);
            $table->boolean('active')->default(true);
            $table->text('description')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('service_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->enum('price_type', ['per_piece', 'per_sqft', 'flat', 'percent']);
            $table->decimal('price', 12, 2);
            $table->boolean('active')->default(true);
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();
        });

        Schema::create('service_materials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_id')->constrained()->cascadeOnDelete();
            $table->foreignId('inventory_item_id')->constrained()->restrictOnDelete();
            $table->decimal('qty_per_unit', 12, 4);
            $table->enum('basis', ['per_sqft', 'per_piece'])->default('per_piece');
            $table->timestamps();
            $table->unique(['service_id', 'inventory_item_id']);
        });

        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->string('item_type', 20); // product | inventory
            $table->unsignedBigInteger('item_id');
            $table->enum('type', ['in', 'out', 'adjustment', 'sale', 'purchase', 'return', 'count']);
            $table->decimal('qty', 14, 3); // signed
            $table->decimal('balance_after', 14, 3);
            $table->decimal('unit_cost', 12, 4)->nullable();
            $table->string('reason', 60)->nullable();
            $table->string('ref')->nullable();
            $table->nullableMorphs('source');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
            $table->index(['item_type', 'item_id']);
        });

        Schema::create('purchases', function (Blueprint $table) {
            $table->id();
            $table->string('po_no', 40)->unique();
            $table->foreignId('supplier_id')->constrained()->restrictOnDelete();
            $table->enum('status', ['draft', 'ordered', 'partial', 'received', 'cancelled'])->default('draft');
            $table->date('expected_at')->nullable();
            $table->timestamp('ordered_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->decimal('total', 12, 2)->default(0);
            $table->text('notes')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('purchase_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_id')->constrained()->cascadeOnDelete();
            $table->string('item_type', 20);
            $table->unsignedBigInteger('item_id');
            $table->string('name');
            $table->decimal('qty_ordered', 14, 3);
            $table->decimal('qty_received', 14, 3)->default(0);
            $table->decimal('unit_cost', 12, 4);
            $table->decimal('line_total', 12, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['purchase_items', 'purchases', 'stock_movements', 'service_materials', 'service_options', 'services',
            'service_categories', 'products', 'inventory_items', 'suppliers', 'customers', 'sequences', 'settings'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
