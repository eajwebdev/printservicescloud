<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class PurchaseItem extends Model
{
    protected $fillable = ['purchase_id', 'item_type', 'item_id', 'name', 'qty_ordered', 'qty_received', 'unit_cost', 'line_total'];

    protected $casts = ['qty_ordered' => 'decimal:3', 'qty_received' => 'decimal:3', 'unit_cost' => 'decimal:4', 'line_total' => 'decimal:2'];

    public function item(): MorphTo
    {
        return $this->morphTo();
    }
}
