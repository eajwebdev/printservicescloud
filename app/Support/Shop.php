<?php

namespace App\Support;

use App\Models\Setting;

class Shop
{
    public const BRAND = 'EAJ Custom Print';

    public const TAGLINE = 'Custom prints, done right.';

    /** The default logo shipped with the app. */
    public const LOGO = 'eajlogo.svg';

    /** Business profile used on receipts, quotations and statements, for the current branch. */
    public static function profile(): array
    {
        $branch = BranchContext::current()->branch();

        return [
            'name' => Brand::name(),
            'branch' => $branch?->name,
            'branch_code' => $branch?->code,
            'tagline' => Brand::tagline(),
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

    /** "EAJ Kabankalan" when the branch already carries the brand's short name, otherwise "EAJ Custom Print, Kabankalan". */
    public static function displayName(): string
    {
        $branch = BranchContext::current()->branch();
        $name = Brand::name();

        return $branch ? (str_starts_with($branch->name, Brand::shortName()) ? $branch->name : "{$name}, {$branch->name}") : $name;
    }

    /** File path for PDFs (dompdf reads from disk). */
    public static function logoPath(): ?string
    {
        return Brand::logoPath();
    }

    public static function logoUrl(): string
    {
        return Brand::logoUrl();
    }
}
