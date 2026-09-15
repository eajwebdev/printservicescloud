<?php

namespace App\Http\Requests;

use App\Models\Service;
use App\Support\BranchRules;
use Illuminate\Validation\Rule;

class ServiceRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'service_category_id' => ['required', 'integer', BranchRules::exists('service_categories')],
            'name' => ['required', 'string', 'max:120'],
            'code' => ['nullable', 'string', 'max:40', BranchRules::unique('services', 'code')->ignore($this->route('service'))],
            'pricing_model' => ['required', Rule::in(Service::PRICING_MODELS)],
            'base_price' => ['required', 'numeric', 'min:0'],
            'cost' => ['nullable', 'numeric', 'min:0'],
            'min_charge' => ['nullable', 'numeric', 'min:0'],
            'unit_label' => ['required', 'string', 'max:30'],
            'is_job' => ['boolean'],
            'lead_time_hours' => ['nullable', 'integer', 'min:0', 'max:2000'],
            'active' => ['boolean'],
            'description' => ['nullable', 'string', 'max:1000'],
            'tiers' => ['nullable', 'array', 'required_if:pricing_model,tiered'],
            'tiers.*.min_qty' => ['required', 'numeric', 'min:1'],
            'tiers.*.price' => ['required', 'numeric', 'min:0'],
            'options' => ['nullable', 'array'],
            'options.*.id' => ['nullable', 'integer'],
            'options.*.name' => ['required', 'string', 'max:80'],
            'options.*.price_type' => ['required', Rule::in(['per_piece', 'per_sqft', 'flat', 'percent'])],
            'options.*.price' => ['required', 'numeric', 'min:0'],
            'options.*.active' => ['boolean'],
            'materials' => ['nullable', 'array'],
            'materials.*.inventory_item_id' => ['required', 'integer', 'distinct', BranchRules::exists('inventory_items')],
            'materials.*.qty_per_unit' => ['required', 'numeric', 'gt:0'],
            'materials.*.basis' => ['required', Rule::in(['per_sqft', 'per_piece'])],
        ];
    }

    public function messages(): array
    {
        return [
            'tiers.required_if' => 'Tiered pricing needs at least one quantity break.',
            'materials.*.inventory_item_id.distinct' => 'Each material can only appear once in the recipe.',
        ];
    }
}
