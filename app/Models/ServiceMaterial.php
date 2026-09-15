<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ServiceMaterial extends Model
{
    protected $fillable = ['service_id', 'inventory_item_id', 'qty_per_unit', 'basis'];

    protected $casts = ['qty_per_unit' => 'decimal:4'];

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class)->withTrashed();
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class)->withTrashed();
    }
}
