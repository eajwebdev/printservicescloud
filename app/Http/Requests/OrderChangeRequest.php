<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class OrderChangeRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', 'min:3', 'max:255'],
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
            'expected_total' => ['nullable', 'numeric'],
            'collect_amount' => ['nullable', 'numeric', 'min:0'],
            'collect_method' => ['nullable', Rule::in(['cash', 'gcash', 'bank'])],
            'collect_reference' => ['nullable', 'string', 'max:100'],
            'refund_method' => ['nullable', Rule::in(['cash', 'gcash', 'bank'])],
            'refund_reference' => ['nullable', 'string', 'max:100'],
        ];
    }

    public function messages(): array
    {
        return [
            'reason.required' => 'Say why the order changed, e.g. "Customer added 2 more tarps" or "Returned 1 frame".',
            'lines.required' => 'An order needs at least one item. To cancel everything, void the order instead.',
        ];
    }
}
