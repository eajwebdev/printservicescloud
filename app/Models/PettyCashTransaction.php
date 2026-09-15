<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PettyCashTransaction extends Model
{
    protected $fillable = ['petty_cash_fund_id', 'type', 'amount', 'balance_after', 'reason', 'ref', 'funded_from', 'expense_id', 'user_id'];

    protected $casts = ['amount' => 'decimal:2', 'balance_after' => 'decimal:2'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function expense(): BelongsTo
    {
        return $this->belongsTo(Expense::class);
    }
}
