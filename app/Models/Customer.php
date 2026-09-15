<?php

namespace App\Models;

use App\Support\ActivityText;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Customer extends Model
{
    use Concerns\BelongsToBranch;
    use LogsActivity, SoftDeletes;

    protected $fillable = ['name', 'business_name', 'phone', 'email', 'address', 'credit_limit', 'is_senior_pwd', 'notes'];

    protected $casts = [
        'credit_balance' => 'decimal:2',
        'credit_limit' => 'decimal:2',
        'is_senior_pwd' => 'boolean',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable()->logOnlyDirty()->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn (string $event) => ActivityText::event($event, $this));
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function receivables(): HasMany
    {
        return $this->hasMany(Receivable::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function recalculateBalance(): void
    {
        $this->credit_balance = (float) $this->receivables()->where('status', 'open')->sum(DB::raw('amount - settled'));
        $this->saveQuietly();
    }
}
