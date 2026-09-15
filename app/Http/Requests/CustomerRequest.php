<?php

namespace App\Http\Requests;

class CustomerRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'business_name' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40', 'regex:/^[0-9+\-\s()]+$/'],
            'email' => ['nullable', 'email', 'max:120'],
            'address' => ['nullable', 'string', 'max:255'],
            'credit_limit' => ['nullable', 'numeric', 'min:0'],
            'is_senior_pwd' => ['boolean'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function messages(): array
    {
        return [
            'phone.regex' => 'Use digits only for the phone, like 0917 123 4567.',
        ];
    }
}
