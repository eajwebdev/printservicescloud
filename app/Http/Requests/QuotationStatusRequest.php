<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class QuotationStatusRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(['draft', 'sent', 'accepted', 'expired'])],
        ];
    }
}
