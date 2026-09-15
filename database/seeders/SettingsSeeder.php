<?php

namespace Database\Seeders;

use App\Http\Controllers\SettingsController;
use App\Models\Branch;
use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingsSeeder extends Seeder
{
    public function run(): void
    {
        // Company-wide defaults every branch starts from.
        Setting::putGlobal(array_merge(SettingsController::DEFAULTS, [
            'tin' => '000-000-000-000',
            'gcash_name' => 'SKC CUSTOM PRINT',
            'bank_name' => 'BDO',
            'bank_account_name' => 'SKC Custom Print',
        ]));

        // What differs per branch: where it is, how to reach it, and where customers send money.
        $gcash = ['KAB' => '0917 555 0100', 'BCD' => '0917 555 0200', 'DGT' => '0917 555 0300'];
        foreach (Branch::query()->get() as $branch) {
            Setting::put([
                'address' => $branch->address ?? '',
                'phone' => $branch->phone ?? '',
                'email' => $branch->email ?? '',
                'gcash_number' => $gcash[$branch->code] ?? ($branch->phone ?? ''),
                'bank_name' => 'BDO '.str_replace('SKC ', '', $branch->name),
                'bank_account_number' => '0000 1234 '.str_pad((string) $branch->id, 4, '0', STR_PAD_LEFT),
            ], $branch->id);
        }
    }
}
