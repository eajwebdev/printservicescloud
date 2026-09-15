<?php

namespace App\Support;

use App\Models\Setting;

class Shop
{
    public const BRAND = 'SKC Custom Print';

    public const TAGLINE = 'Custom prints, done right.';

    /** The default logo shipped with the app. */
    public const LOGO = 'skclogo.png';

    /** Business profile used on receipts, quotations and statements, for the current branch. */
    public static function profile(): array
    {
        $branch = BranchContext::current()->branch();

        return [
            'name' => Setting::get('business_name', self::BRAND),
            'branch' => $branch?->name,
            'branch_code' => $branch?->code,
            'tagline' => Setting::get('tagline', self::TAGLINE),
            'address' => Setting::get('address', $branch?->address ?? ''),
            'phone' => Setting::get('phone', $branch?->phone ?? ''),
            'email' => Setting::get('email', $branch?->email ?? ''),
            'tin' => Setting::get('tin', ''),
            'logo_path' => self::logoPath(),
            'receipt_footer' => Setting::get('receipt_footer', ''),
            'quotation_terms' => Setting::get('quotation_terms', ''),
            'gcash' => trim(Setting::get('gcash_name', '').' '.Setting::get('gcash_number', '')),
            'bank' => trim(Setting::get('bank_name', '').' / '.Setting::get('bank_account_name', '').' / '.Setting::get('bank_account_number', ''), ' /'),
            'tax_mode' => Setting::get('tax_mode', 'none'),
            'tax_rate' => (float) Setting::get('tax_rate', 0),
        ];
    }

    /** "SKC Custom Print, Kabankalan" for headers that name the branch. */
    public static function displayName(): string
    {
        $branch = BranchContext::current()->branch();
        $name = (string) Setting::get('business_name', self::BRAND);

        return $branch ? (str_starts_with($branch->name, 'SKC') ? $branch->name : "{$name}, {$branch->name}") : $name;
    }

    /** File path for PDFs (dompdf reads from disk). */
    public static function logoPath(): ?string
    {
        $uploaded = Setting::get('logo_path');
        $path = $uploaded ? storage_path('app/public/'.$uploaded) : public_path(self::LOGO);

        return is_file($path) ? $path : (is_file(public_path(self::LOGO)) ? public_path(self::LOGO) : null);
    }

    public static function logoUrl(): string
    {
        $uploaded = Setting::get('logo_path');

        return $uploaded ? asset('storage/'.$uploaded) : asset(self::LOGO);
    }
}
