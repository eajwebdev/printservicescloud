<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceOption extends Model
{
    protected $fillable = ['service_id', 'name', 'price_type', 'price', 'active', 'sort'];

    protected $casts = ['price' => 'decimal:2', 'active' => 'boolean'];
}
