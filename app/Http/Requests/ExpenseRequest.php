<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class ExpenseRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'expense_date' => ['required', 'date', 'before_or_equal:today'],
            'category' => ['required', Rule::in(array_keys(\App\Models\Expense::CATEGORIES))],
            'amount' => ['required', 'numeric', 'gt:0', 'max:10000000'],
            'payee' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'source' => ['required', Rule::in(['drawer', 'petty', 'bank'])],
            'receipt' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
        ];
    }

    public function messages(): array
    {
        return [
            'expense_date.before_or_equal' => 'Expenses can not be dated in the future.',
        ];
    }
}
