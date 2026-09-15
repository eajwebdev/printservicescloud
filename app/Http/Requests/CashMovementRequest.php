<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class CashMovementRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in(['paid_out', 'cash_drop', 'adjustment'])],
            'direction' => ['required', Rule::in(['in', 'out'])],
            'amount' => ['required', 'numeric', 'gt:0', 'max:1000000'],
            'note' => ['required', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'note.required' => 'Write what this cash was for, e.g. "Bank deposit" or "Paid rider".',
        ];
    }
}
