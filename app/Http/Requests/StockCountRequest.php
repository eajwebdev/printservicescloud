<?php

namespace App\Http\Requests;

class StockCountRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'counts' => ['required', 'array', 'min:1'],
            'counts.*.item_type' => ['required', 'in:product,inventory'],
            'counts.*.item_id' => ['required', 'integer'],
            'counts.*.counted' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
