<?php

namespace App\Http\Requests;

class VoidOrderRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', 'min:3', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'reason.required' => 'Say why this order is being voided. It goes in the audit trail.',
        ];
    }
}
