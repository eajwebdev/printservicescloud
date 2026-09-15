<?php

namespace App\Models;

use App\Support\ActivityText;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Supplier extends Model
{
    use Concerns\BelongsToBranch;
    use LogsActivity, SoftDeletes;

    protected $fillable = ['name', 'contact_person', 'phone', 'email', 'address', 'terms', 'notes'];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable()->logOnlyDirty()->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn (string $event) => ActivityText::event($event, $this));
    }

    public function purchases(): HasMany
    {
        return $this->hasMany(Purchase::class);
    }
}
