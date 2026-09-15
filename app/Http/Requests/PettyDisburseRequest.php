<?php

namespace App\Http\Requests;

class PettyDisburseRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'gt:0', 'max:1000000'],
            'reason' => ['required', 'string', 'max:255'],
            'ref' => ['nullable', 'string', 'max:100'],
        ];
    }

    public function messages(): array
    {
        return [
            'reason.required' => 'Write what the cash was for so the fund can be reconciled.',
        ];
    }
}
