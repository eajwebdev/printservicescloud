<?php

namespace App\Http\Requests;

class LogoRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'logo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ];
    }
}
