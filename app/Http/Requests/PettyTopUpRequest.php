<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class PettyTopUpRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'gt:0', 'max:1000000'],
            'funded_from' => ['required', Rule::in(['drawer', 'bank', 'owner'])],
            'ref' => ['nullable', 'string', 'max:100'],
            'reason' => ['nullable', 'string', 'max:255'],
        ];
    }
}
