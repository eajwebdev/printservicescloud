<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class StockAdjustRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'item_type' => ['required', Rule::in(['product', 'inventory'])],
            'item_id' => ['required', 'integer'],
            'direction' => ['required', Rule::in(['in', 'out'])],
            'qty' => ['required', 'numeric', 'gt:0'],
            'reason' => ['required', Rule::in(array_keys(\App\Services\StockService::ADJUST_REASONS))],
            'note' => ['nullable', 'string', 'max:255'],
        ];
    }
}
