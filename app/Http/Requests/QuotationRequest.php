<?php

namespace App\Http\Requests;

use App\Support\BranchRules;
use Illuminate\Validation\Rule;

class QuotationRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'customer_id' => ['nullable', 'integer', BranchRules::exists('customers')],
            'customer_name' => ['nullable', 'string', 'max:120', 'required_without:customer_id'],
            'valid_until' => ['nullable', 'date'],
            'lines' => ['required', 'array', 'min:1', 'max:100'],
            'lines.*.item_type' => ['required', Rule::in(['product', 'service'])],
            'lines.*.item_id' => ['required', 'integer'],
            'lines.*.qty' => ['required', 'numeric', 'gt:0', 'max:100000'],
            'lines.*.spec' => ['nullable', 'array'],
            'lines.*.spec.width' => ['nullable', 'numeric', 'min:0'],
            'lines.*.spec.height' => ['nullable', 'numeric', 'min:0'],
            'lines.*.spec.unit' => ['nullable', Rule::in(['ft', 'in', 'cm'])],
            'lines.*.spec.option_ids' => ['nullable', 'array'],
            'lines.*.spec.rush' => ['nullable', 'boolean'],
            'lines.*.discount_type' => ['nullable', Rule::in(['percent', 'amount'])],
            'lines.*.discount_value' => ['nullable', 'numeric', 'min:0'],
            'lines.*.note' => ['nullable', 'string', 'max:255'],
            'discount_type' => ['nullable', Rule::in(['percent', 'amount'])],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'status' => ['nullable', Rule::in(['draft', 'sent'])],
        ];
    }

    public function messages(): array
    {
        return [
            'lines.required' => 'Add at least one item to quote.',
            'customer_name.required_without' => 'Pick a customer or type the name this quote is for.',
        ];
    }
}
