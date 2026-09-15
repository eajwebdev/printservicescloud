<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ServiceCategory extends Model
{
    use Concerns\BelongsToBranch;

    protected $fillable = ['name', 'sort'];

    public function services(): HasMany
    {
        return $this->hasMany(Service::class);
    }
}
