<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Model;

/** Plain-language descriptions for model events in the activity log. */
class ActivityText
{
    public static function event(string $event, Model $model): string
    {
        $label = ucfirst(str_replace('_', ' ', $model->getMorphClass()));
        $name = $model->getAttribute('order_no')
            ?? $model->getAttribute('po_no')
            ?? $model->getAttribute('quote_no')
            ?? $model->getAttribute('name');

        $verb = match ($event) {
            'created' => 'Added',
            'updated' => 'Updated',
            'deleted' => 'Removed',
            'restored' => 'Restored',
            default => ucfirst($event),
        };

        return trim("{$verb} ".strtolower($label).($name ? " {$name}" : ''));
    }
}
