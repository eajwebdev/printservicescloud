<?php

namespace App\Http\Requests;

class ReceivePurchaseRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'received' => ['required', 'array'],
            'received.*' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
