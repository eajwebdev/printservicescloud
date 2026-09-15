<?php

namespace App\Http\Requests;

use App\Support\BranchRules;
use Illuminate\Validation\Rule;

class CheckoutRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in(['instant', 'job'])],
            'customer_id' => ['nullable', 'integer', BranchRules::exists('customers')],
            'lines' => ['required', 'array', 'min:1', 'max:100'],
            'lines.*.item_type' => ['required', Rule::in(['product', 'service'])],
            'lines.*.item_id' => ['required', 'integer'],
            'lines.*.qty' => ['required', 'numeric', 'gt:0', 'max:100000'],
            'lines.*.spec' => ['nullable', 'array'],
            'lines.*.spec.width' => ['nullable', 'numeric', 'min:0', 'max:10000'],
            'lines.*.spec.height' => ['nullable', 'numeric', 'min:0', 'max:10000'],
            'lines.*.spec.unit' => ['nullable', Rule::in(['ft', 'in', 'cm'])],
            'lines.*.spec.option_ids' => ['nullable', 'array'],
            'lines.*.spec.option_ids.*' => ['integer'],
            'lines.*.spec.rush' => ['nullable', 'boolean'],
            'lines.*.discount_type' => ['nullable', Rule::in(['percent', 'amount'])],
            'lines.*.discount_value' => ['nullable', 'numeric', 'min:0'],
            'lines.*.note' => ['nullable', 'string', 'max:255'],
            'discount_type' => ['nullable', Rule::in(['percent', 'amount'])],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
            'senior_pwd' => ['boolean'],
            'payments' => ['present', 'array', 'max:4'],
            'payments.*.method' => ['required', Rule::in(['cash', 'gcash', 'bank', 'credit'])],
            'payments.*.amount' => ['required', 'numeric', 'min:0'],
            'payments.*.tendered' => ['nullable', 'numeric', 'min:0'],
            'payments.*.reference' => ['nullable', 'string', 'max:100'],
            'due_at' => ['nullable', 'date', 'required_if:type,job'],
            'assigned_to' => ['nullable', 'integer', BranchRules::staff()],
            'rush' => ['boolean'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'quotation_id' => ['nullable', 'integer', BranchRules::exists('quotations')],
            'expected_total' => ['nullable', 'numeric'],
        ];
    }

    public function messages(): array
    {
        return [
            'lines.required' => 'The cart is empty. Add a product or service first.',
            'due_at.required_if' => 'Set when this job is due so production knows the deadline.',
        ];
    }
}
