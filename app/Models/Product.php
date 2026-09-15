<?php

namespace App\Models;

use App\Support\ActivityText;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Product extends Model
{
    use Concerns\BelongsToBranch;
    use LogsActivity, SoftDeletes;

    protected $fillable = ['name', 'sku', 'barcode', 'category', 'price', 'cost', 'reorder_level', 'supplier_id', 'inventory_item_id', 'active'];

    protected $casts = [
        'price' => 'decimal:2',
        'cost' => 'decimal:4',
        'active' => 'boolean',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logOnly(['name', 'sku', 'price', 'cost', 'reorder_level', 'active'])->logOnlyDirty()->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn (string $event) => ActivityText::event($event, $this));
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }

    public function movements(): MorphMany
    {
        return $this->morphMany(StockMovement::class, 'item');
    }

    /** Units on hand, reading through to the linked raw material when this product is a resold material. */
    public function availableStock(): float
    {
        return $this->inventory_item_id && $this->inventoryItem
            ? (float) $this->inventoryItem->stock
            : (float) $this->stock;
    }

    public function scopeLowStock(Builder $query): Builder
    {
        return $query->where('active', true)->whereNull('inventory_item_id')->whereColumn('stock', '<=', 'reorder_level');
    }
}
