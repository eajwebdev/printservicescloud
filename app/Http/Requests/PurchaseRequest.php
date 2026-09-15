<?php

namespace App\Http\Requests;

use App\Support\BranchRules;
use Illuminate\Validation\Rule;

class PurchaseRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'supplier_id' => ['required', 'integer', BranchRules::exists('suppliers')],
            'expected_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'submit' => ['boolean'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.item_type' => ['required', Rule::in(['product', 'inventory'])],
            'items.*.item_id' => ['required', 'integer'],
            'items.*.qty_ordered' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_cost' => ['required', 'numeric', 'min:0'],
        ];
    }

    public function messages(): array
    {
        return [
            'items.required' => 'Add at least one item to order.',
        ];
    }
}
