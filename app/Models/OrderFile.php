<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderFile extends Model
{
    public const KINDS = ['design' => 'Customer file', 'proof' => 'Proof / layout', 'photo' => 'Photo of finished job', 'other' => 'Other'];

    /** Files live on the private disk and are only served to signed-in staff. */
    public const DISK = 'local';

    protected $fillable = ['order_id', 'kind', 'path', 'original_name', 'mime', 'size', 'note', 'user_id'];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isImage(): bool
    {
        return str_starts_with((string) $this->mime, 'image/') && ! str_contains((string) $this->mime, 'photoshop');
    }
}
