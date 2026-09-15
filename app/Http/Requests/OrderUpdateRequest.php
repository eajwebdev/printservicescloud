<?php

namespace App\Http\Requests;

use App\Support\BranchRules;

class OrderUpdateRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'assigned_to' => ['nullable', 'integer', BranchRules::staff()],
            'due_at' => ['nullable', 'date'],
            'rush' => ['boolean'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
