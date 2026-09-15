<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PettyCashFund extends Model
{
    use Concerns\BelongsToBranch;

    protected $fillable = ['name', 'balance', 'float_target', 'low_threshold', 'custodian_id'];

    protected $casts = ['balance' => 'decimal:2', 'float_target' => 'decimal:2', 'low_threshold' => 'decimal:2'];

    /** The shop runs a single petty-cash box. */
    public static function main(): self
    {
        return static::query()->oldest('id')->first()
            ?? static::query()->create(['name' => 'Shop petty cash', 'float_target' => 3000, 'low_threshold' => 500]);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(PettyCashTransaction::class);
    }
}
