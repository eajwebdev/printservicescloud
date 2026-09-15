<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class ExpenseUpdateRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'expense_date' => ['required', 'date', 'before_or_equal:today'],
            'category' => ['required', Rule::in(array_keys(\App\Models\Expense::CATEGORIES))],
            'payee' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'receipt' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
        ];
    }
}
