<?php

namespace App\Http\Requests;

use App\Models\InventoryItem;
use App\Support\BranchRules;
use Illuminate\Validation\Rule;

class InventoryItemRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'sku' => ['nullable', 'string', 'max:60', BranchRules::unique('inventory_items', 'sku')->ignore($this->route('inventoryItem'))],
            'category' => ['nullable', 'string', 'max:60'],
            'unit' => ['required', Rule::in(InventoryItem::UNITS)],
            'cost' => ['nullable', 'numeric', 'min:0'],
            'opening_stock' => ['nullable', 'numeric', 'min:0'],
            'reorder_level' => ['nullable', 'numeric', 'min:0'],
            'supplier_id' => ['nullable', 'integer', BranchRules::exists('suppliers')],
            'active' => ['boolean'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
