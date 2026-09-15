<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderRevision extends Model
{
    protected $fillable = ['order_id', 'reason', 'old_total', 'new_total', 'collected', 'refunded', 'old_lines', 'new_lines', 'user_id'];

    protected $casts = [
        'old_total' => 'decimal:2',
        'new_total' => 'decimal:2',
        'collected' => 'decimal:2',
        'refunded' => 'decimal:2',
        'old_lines' => 'array',
        'new_lines' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
