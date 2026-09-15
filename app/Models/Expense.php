<?php

namespace App\Models;

use App\Support\ActivityText;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Expense extends Model
{
    use Concerns\BelongsToBranch;
    use LogsActivity;

    public const CATEGORIES = [
        'rent' => 'Rent',
        'utilities' => 'Utilities',
        'salaries' => 'Salaries & wages',
        'supplies' => 'Supplies',
        'repairs' => 'Repairs',
        'transport' => 'Transport',
        'marketing' => 'Marketing',
        'misc' => 'Miscellaneous',
    ];

    protected $fillable = ['expense_date', 'category', 'amount', 'payee', 'notes', 'receipt_path', 'source', 'cashier_session_id', 'user_id'];

    protected $casts = ['expense_date' => 'date', 'amount' => 'decimal:2'];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logOnly(['expense_date', 'category', 'amount', 'payee', 'source'])->logOnlyDirty()->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn (string $event) => ActivityText::event($event, $this));
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
