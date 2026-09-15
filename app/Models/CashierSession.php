<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CashierSession extends Model
{
    use Concerns\BelongsToBranch;

    protected $fillable = ['user_id', 'opening_float', 'expected_cash', 'closing_counted', 'variance', 'status', 'opened_at', 'closed_at', 'opening_note', 'closing_note'];

    protected $casts = [
        'opening_float' => 'decimal:2',
        'expected_cash' => 'decimal:2',
        'closing_counted' => 'decimal:2',
        'variance' => 'decimal:2',
        'opened_at' => 'datetime',
        'closed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function movements(): HasMany
    {
        return $this->hasMany(CashMovement::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /** Opening float plus every signed drawer movement so far. */
    public function liveExpectedCash(): float
    {
        return round((float) $this->opening_float + (float) $this->movements()->sum('amount'), 2);
    }

    public function isOpen(): bool
    {
        return $this->status === 'open';
    }
}
