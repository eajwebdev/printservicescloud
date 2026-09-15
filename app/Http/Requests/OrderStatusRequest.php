<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class OrderStatusRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(\App\Models\Order::BOARD_STATUSES)],
            'position' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
