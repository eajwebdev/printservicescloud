<?php

namespace App\Models;

use App\Support\ActivityText;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Service extends Model
{
    use Concerns\BelongsToBranch;
    use LogsActivity, SoftDeletes;

    public const PRICING_MODELS = ['per_sqft', 'per_piece', 'tiered', 'fixed'];

    protected $fillable = [
        'service_category_id', 'name', 'code', 'pricing_model', 'base_price', 'cost', 'min_charge', 'tiers',
        'unit_label', 'is_job', 'lead_time_hours', 'active', 'description',
    ];

    protected $casts = [
        'base_price' => 'decimal:2',
        'cost' => 'decimal:4',
        'min_charge' => 'decimal:2',
        'tiers' => 'array',
        'is_job' => 'boolean',
        'active' => 'boolean',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logOnly(['name', 'pricing_model', 'base_price', 'cost', 'min_charge', 'active'])->logOnlyDirty()->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn (string $event) => ActivityText::event($event, $this));
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ServiceCategory::class, 'service_category_id');
    }

    public function options(): HasMany
    {
        return $this->hasMany(ServiceOption::class)->orderBy('sort');
    }

    public function materials(): HasMany
    {
        return $this->hasMany(ServiceMaterial::class);
    }
}
