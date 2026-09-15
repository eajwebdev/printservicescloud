<?php

namespace App\Http\Requests;

class OpenSessionRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'opening_float' => ['required', 'numeric', 'min:0', 'max:1000000'],
            'note' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'opening_float.required' => 'Count the cash in the drawer and enter the starting amount. Enter 0 if it is empty.',
        ];
    }
}
