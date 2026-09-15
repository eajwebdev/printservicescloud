<?php

namespace App\Http\Requests;

use App\Support\BranchRules;

class ProductRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'sku' => ['required', 'string', 'max:60', BranchRules::unique('products', 'sku')->ignore($this->route('product'))],
            'barcode' => ['nullable', 'string', 'max:80', BranchRules::unique('products', 'barcode')->ignore($this->route('product'))],
            'category' => ['nullable', 'string', 'max:60'],
            'price' => ['required', 'numeric', 'min:0'],
            'cost' => ['nullable', 'numeric', 'min:0'],
            'opening_stock' => ['nullable', 'integer', 'min:0'],
            'reorder_level' => ['nullable', 'integer', 'min:0'],
            'supplier_id' => ['nullable', 'integer', BranchRules::exists('suppliers')],
            'inventory_item_id' => ['nullable', 'integer', BranchRules::exists('inventory_items')],
            'active' => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'sku.unique' => 'Another product already uses this SKU.',
            'barcode.unique' => 'Another product already uses this barcode.',
        ];
    }
}
