<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HeldCart extends Model
{
    use Concerns\BelongsToBranch;

    protected $fillable = ['user_id', 'label', 'payload', 'total'];

    protected $casts = ['payload' => 'array', 'total' => 'decimal:2'];
}
