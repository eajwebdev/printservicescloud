<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    use Concerns\BelongsToBranch;

    public const METHODS = ['cash', 'gcash', 'bank', 'credit'];

    protected $fillable = ['order_id', 'customer_id', 'receivable_id', 'method', 'kind', 'amount', 'tendered', 'reference', 'cashier_session_id', 'user_id'];

    protected $casts = ['amount' => 'decimal:2', 'tendered' => 'decimal:2'];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class)->withTrashed();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
