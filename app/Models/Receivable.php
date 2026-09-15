<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Receivable extends Model
{
    use Concerns\BelongsToBranch;

    protected $fillable = ['customer_id', 'order_id', 'amount', 'settled', 'status', 'due_date'];

    protected $casts = ['amount' => 'decimal:2', 'settled' => 'decimal:2', 'due_date' => 'date'];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class)->withTrashed();
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function outstanding(): float
    {
        return round((float) $this->amount - (float) $this->settled, 2);
    }
}
