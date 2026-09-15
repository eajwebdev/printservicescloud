<?php

namespace App\Models;

use App\Support\ActivityText;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Order extends Model
{
    use Concerns\BelongsToBranch;
    use LogsActivity;

    public const BOARD_STATUSES = ['pending', 'in_production', 'ready', 'released'];

    /** Creation is logged by checkout in plain words ("Rang up sale ..."), so only record later changes here. */
    protected static $recordEvents = ['updated'];

    protected $fillable = [
        'order_no', 'customer_id', 'type', 'status', 'subtotal', 'discount_type', 'discount_value', 'discount_total',
        'senior_pwd', 'senior_pwd_discount', 'tax_total', 'total', 'paid', 'balance', 'cost_total', 'payment_status',
        'due_at', 'rush', 'assigned_to', 'cashier_session_id', 'user_id', 'quotation_id', 'board_position', 'notes',
        'status_changed_at', 'released_at', 'voided_at', 'void_reason', 'print_count', 'proof_status', 'proof_approved_at', 'proof_approved_by',
    ];

    protected $casts = [
        'subtotal' => 'decimal:2',
        'discount_value' => 'decimal:2',
        'discount_total' => 'decimal:2',
        'senior_pwd_discount' => 'decimal:2',
        'tax_total' => 'decimal:2',
        'total' => 'decimal:2',
        'paid' => 'decimal:2',
        'balance' => 'decimal:2',
        'cost_total' => 'decimal:2',
        'senior_pwd' => 'boolean',
        'rush' => 'boolean',
        'due_at' => 'datetime',
        'status_changed_at' => 'datetime',
        'released_at' => 'datetime',
        'voided_at' => 'datetime',
        'proof_approved_at' => 'datetime',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logOnly(['status', 'paid', 'balance', 'payment_status', 'assigned_to', 'due_at'])->logOnlyDirty()->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn (string $event) => ActivityText::event($event, $this));
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class)->withTrashed();
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function files(): HasMany
    {
        return $this->hasMany(OrderFile::class)->latest();
    }

    public function revisions(): HasMany
    {
        return $this->hasMany(OrderRevision::class)->latest();
    }

    public function receivable(): HasOne
    {
        return $this->hasOne(Receivable::class);
    }

    public function cashier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(CashierSession::class, 'cashier_session_id');
    }

    public function scopeJobs(Builder $query): Builder
    {
        return $query->where('type', 'job');
    }

    public function scopeNotVoided(Builder $query): Builder
    {
        return $query->where('status', '!=', 'voided');
    }

    /** Recompute balance and the payment chip from what has actually been received. */
    public function refreshPaymentStatus(): void
    {
        $this->balance = max(0, round((float) $this->total - (float) $this->paid, 2));
        $onCredit = $this->payments()->where('method', 'credit')->exists();

        $this->payment_status = match (true) {
            $this->balance <= 0 => 'paid',
            (float) $this->paid <= 0 && $onCredit => 'credit',
            (float) $this->paid <= 0 => 'unpaid',
            default => 'partial',
        };
    }
}
