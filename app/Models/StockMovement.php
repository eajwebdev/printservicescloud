<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class StockMovement extends Model
{
    use Concerns\BelongsToBranch;

    protected $fillable = ['item_type', 'item_id', 'type', 'qty', 'balance_after', 'unit_cost', 'reason', 'ref', 'source_type', 'source_id', 'user_id'];

    protected $casts = ['qty' => 'decimal:3', 'balance_after' => 'decimal:3', 'unit_cost' => 'decimal:4'];

    public function item(): MorphTo
    {
        return $this->morphTo();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
