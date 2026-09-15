<?php

namespace App\Http\Requests;

class CloseSessionRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'closing_counted' => ['required', 'numeric', 'min:0', 'max:10000000'],
            'note' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'closing_counted.required' => 'Count the physical cash in the drawer and enter the total.',
        ];
    }
}
