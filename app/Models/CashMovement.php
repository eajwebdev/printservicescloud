<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class CashMovement extends Model
{
    public const LABELS = [
        'sale' => 'Cash sale',
        'collection' => 'Balance collected',
        'refund' => 'Refund',
        'expense' => 'Expense paid',
        'petty_out' => 'To petty cash',
        'paid_out' => 'Paid out',
        'cash_drop' => 'Cash drop',
        'adjustment' => 'Adjustment',
    ];

    protected $fillable = ['cashier_session_id', 'type', 'amount', 'source_type', 'source_id', 'note', 'user_id'];

    protected $casts = ['amount' => 'decimal:2'];

    public function session(): BelongsTo
    {
        return $this->belongsTo(CashierSession::class, 'cashier_session_id');
    }

    public function source(): MorphTo
    {
        return $this->morphTo();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
