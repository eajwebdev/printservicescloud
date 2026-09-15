<?php

namespace App\Http\Requests;

class PettyFundRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'float_target' => ['required', 'numeric', 'min:0'],
            'low_threshold' => ['required', 'numeric', 'min:0'],
        ];
    }
}
