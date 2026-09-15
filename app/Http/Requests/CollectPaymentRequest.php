<?php

namespace App\Http\Requests;

use App\Support\BranchRules;
use Illuminate\Validation\Rule;

class CollectPaymentRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'gt:0'],
            'method' => ['required', Rule::in(['cash', 'gcash', 'bank'])],
            'reference' => ['nullable', 'string', 'max:100'],
            'order_id' => ['nullable', 'integer', BranchRules::exists('orders')],
        ];
    }
}
