<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class SettingsRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:60'],
            'email' => ['nullable', 'email', 'max:120'],
            'tin' => ['nullable', 'string', 'max:40'],
            'receipt_footer' => ['nullable', 'string', 'max:500'],
            'quotation_terms' => ['nullable', 'string', 'max:2000'],
            'quotation_valid_days' => ['required', 'integer', 'min:1', 'max:365'],
            'tax_mode' => ['required', Rule::in(['none', 'inclusive', 'exclusive'])],
            'tax_rate' => ['required', 'numeric', 'min:0', 'max:50'],
            'senior_pwd_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'rush_fee_percent' => ['required', 'numeric', 'min:0', 'max:500'],
            'credit_terms_days' => ['required', 'integer', 'min:0', 'max:365'],
            'order_no_format' => ['required', 'string', 'max:40', 'regex:/\{#+\}/'],
            'quotation_no_format' => ['required', 'string', 'max:40', 'regex:/\{#+\}/'],
            'purchase_no_format' => ['required', 'string', 'max:40', 'regex:/\{#+\}/'],
            'gcash_name' => ['nullable', 'string', 'max:80'],
            'gcash_number' => ['nullable', 'string', 'max:40'],
            'bank_name' => ['nullable', 'string', 'max:80'],
            'bank_account_name' => ['nullable', 'string', 'max:80'],
            'bank_account_number' => ['nullable', 'string', 'max:60'],
            'sms_ready_enabled' => ['boolean'],
            'receipt_paper' => ['required', 'integer', Rule::in([58, 80])],
            'auto_print' => ['boolean'],
            'print_claim_stub' => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'order_no_format.regex' => 'Include a counter like {####} in the format.',
            'quotation_no_format.regex' => 'Include a counter like {###} in the format.',
            'purchase_no_format.regex' => 'Include a counter like {###} in the format.',
        ];
    }
}
