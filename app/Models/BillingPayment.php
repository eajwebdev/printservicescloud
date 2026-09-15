<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Money received for one or more subscription invoices, online through PayMongo or recorded by hand. */
class BillingPayment extends Model
{
    protected $fillable = [
        'branch_id', 'amount', 'channel', 'status', 'checkout_id', 'checkout_url', 'provider_payment_id', 'method',
        'reference', 'invoice_ids', 'paid_at', 'notes', 'user_id',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'invoice_ids' => 'array',
        'paid_at' => 'datetime',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class)->withTrashed();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }
}
