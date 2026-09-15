<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A branch's monthly subscription bill. */
class Invoice extends Model
{
    protected $fillable = [
        'branch_id', 'number', 'period_start', 'period_end', 'issued_on', 'due_on', 'amount', 'status', 'paid_at',
        'billing_payment_id', 'description', 'notes',
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'issued_on' => 'date',
        'due_on' => 'date',
        'amount' => 'decimal:2',
        'paid_at' => 'datetime',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class)->withTrashed();
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(BillingPayment::class, 'billing_payment_id');
    }

    public function scopeUnpaid(Builder $query): Builder
    {
        return $query->where('status', 'unpaid');
    }

    public function scopeOverdue(Builder $query): Builder
    {
        return $query->where('status', 'unpaid')->whereDate('due_on', '<', today());
    }

    public function isOverdue(): bool
    {
        return $this->status === 'unpaid' && $this->due_on->lt(today());
    }

    /** unpaid | overdue | paid | void */
    public function displayStatus(): string
    {
        return $this->isOverdue() ? 'overdue' : $this->status;
    }

    public function daysOverdue(): int
    {
        return $this->isOverdue() ? (int) $this->due_on->diffInDays(today()) : 0;
    }

    public function periodLabel(): string
    {
        return $this->period_start->format('M j, Y').' to '.$this->period_end->format('M j, Y');
    }
}
