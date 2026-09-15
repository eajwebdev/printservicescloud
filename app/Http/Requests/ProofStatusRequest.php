<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class ProofStatusRequest extends AppRequest
{
    public function rules(): array
    {
        return ['status' => ['required', Rule::in(['none', 'waiting', 'approved'])]];
    }
}
