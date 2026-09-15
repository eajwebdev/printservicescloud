<?php

namespace App\Models;

use App\Support\ActivityText;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Branch extends Model
{
    use LogsActivity, SoftDeletes;

    public const STATUSES = [
        'trial' => 'Free trial',
        'active' => 'Subscribed',
        'suspended' => 'Suspended',
        'cancelled' => 'Cancelled',
    ];

    protected $fillable = [
        'name', 'code', 'address', 'phone', 'email', 'active', 'subscription_status', 'monthly_fee', 'trial_ends_on',
        'subscribed_on', 'billing_day', 'next_bill_on', 'grace_until', 'suspended_at', 'suspend_reason', 'billing_notes',
    ];

    protected $casts = [
        'active' => 'boolean',
        'monthly_fee' => 'decimal:2',
        'trial_ends_on' => 'date',
        'subscribed_on' => 'date',
        'next_bill_on' => 'date',
        'grace_until' => 'date',
        'suspended_at' => 'datetime',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['name', 'code', 'active', 'subscription_status', 'monthly_fee', 'trial_ends_on', 'subscribed_on', 'grace_until'])
            ->logOnlyDirty()->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn (string $event) => ActivityText::event($event, $this));
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function billingPayments(): HasMany
    {
        return $this->hasMany(BillingPayment::class);
    }

    /** Staff of a cancelled or switched-off branch can not sign in at all. */
    public function canSignIn(): bool
    {
        return $this->active && ! $this->trashed() && $this->subscription_status !== 'cancelled';
    }

    public function onTrial(): bool
    {
        return $this->subscription_status === 'trial' && $this->trial_ends_on && $this->trial_ends_on->gte(today());
    }

    public function label(): string
    {
        return "{$this->name} ({$this->code})";
    }
}
