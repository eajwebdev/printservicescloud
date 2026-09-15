<?php

namespace App\Http\Requests;

class PettyReconcileRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'counted' => ['required', 'numeric', 'min:0'],
            'note' => ['nullable', 'string', 'max:255'],
        ];
    }
}
