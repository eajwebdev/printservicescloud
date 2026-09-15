<?php

namespace App\Http\Requests;

class HoldCartRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'label' => ['required', 'string', 'max:80'],
            'payload' => ['required', 'array'],
            'total' => ['required', 'numeric', 'min:0'],
        ];
    }
}
