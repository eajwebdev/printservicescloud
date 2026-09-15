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

class InventoryItem extends Model
{
    use Concerns\BelongsToBranch;
    use LogsActivity, SoftDeletes;

    public const UNITS = ['sqft', 'sheet', 'ml', 'g', 'pc', 'roll', 'm', 'pack'];

    protected $fillable = ['name', 'sku', 'category', 'unit', 'cost', 'reorder_level', 'supplier_id', 'active', 'notes'];

    protected $casts = [
        'stock' => 'decimal:3',
        'cost' => 'decimal:4',
        'reorder_level' => 'decimal:3',
        'active' => 'boolean',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logOnly(['name', 'sku', 'unit', 'cost', 'reorder_level', 'active'])->logOnlyDirty()->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn (string $event) => ActivityText::event($event, $this));
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function movements(): MorphMany
    {
        return $this->morphMany(StockMovement::class, 'item');
    }

    public function scopeLowStock(Builder $query): Builder
    {
        return $query->where('active', true)->whereColumn('stock', '<=', 'reorder_level');
    }
}
