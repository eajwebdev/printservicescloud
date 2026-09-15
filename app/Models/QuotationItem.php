<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuotationItem extends Model
{
    protected $fillable = [
        'quotation_id', 'item_type', 'item_id', 'name', 'spec', 'qty', 'unit_price', 'gross',
        'discount_type', 'discount_value', 'discount_amount', 'line_total', 'note',
    ];

    protected $casts = [
        'spec' => 'array',
        'qty' => 'decimal:3',
        'unit_price' => 'decimal:2',
        'gross' => 'decimal:2',
        'discount_value' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'line_total' => 'decimal:2',
    ];
}
