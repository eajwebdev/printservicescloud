<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $this->replaceSetting('business_name', 'SKC Custom Print', 'EAJ Custom Print');
        $this->replaceSetting('brand_short', 'SKC', 'EAJ');
        $this->replaceSetting('gcash_name', 'SKC CUSTOM PRINT', 'EAJ CUSTOM PRINT');
        $this->replaceSetting('bank_account_name', 'SKC Custom Print', 'EAJ Custom Print');
        $this->replaceSetting('billing.provider_name', 'SKC Custom Print POS', 'EAJ Custom Print POS');

        DB::table('branches')->where('name', 'SKC Kabankalan')->update(['name' => 'EAJ Kabankalan', 'email' => 'kabankalan@eajcustomprint.test']);
        DB::table('branches')->where('name', 'SKC Dumaguete')->update(['name' => 'EAJ Dumaguete', 'email' => 'dumaguete@eajcustomprint.test']);
        DB::table('branches')->where('name', 'SKC Bacolod')->update(['name' => 'EAJ Bacolod', 'email' => 'bacolod@eajcustomprint.test']);
        DB::table('users')->where('name', 'SKC Owner')->update(['name' => 'EAJ Owner']);
    }

    public function down(): void
    {
        $this->replaceSetting('business_name', 'EAJ Custom Print', 'SKC Custom Print');
        $this->replaceSetting('brand_short', 'EAJ', 'SKC');
        $this->replaceSetting('gcash_name', 'EAJ CUSTOM PRINT', 'SKC CUSTOM PRINT');
        $this->replaceSetting('bank_account_name', 'EAJ Custom Print', 'SKC Custom Print');
        $this->replaceSetting('billing.provider_name', 'EAJ Custom Print POS', 'SKC Custom Print POS');

        DB::table('branches')->where('name', 'EAJ Kabankalan')->update(['name' => 'SKC Kabankalan', 'email' => 'kabankalan@skccustomprint.test']);
        DB::table('branches')->where('name', 'EAJ Dumaguete')->update(['name' => 'SKC Dumaguete', 'email' => 'dumaguete@skccustomprint.test']);
        DB::table('branches')->where('name', 'EAJ Bacolod')->update(['name' => 'SKC Bacolod', 'email' => 'bacolod@skccustomprint.test']);
        DB::table('users')->where('name', 'EAJ Owner')->update(['name' => 'SKC Owner']);
    }

    private function replaceSetting(string $key, string $from, string $to): void
    {
        DB::table('settings')
            ->whereNull('branch_id')
            ->where('key', $key)
            ->where('value', json_encode($from))
            ->update(['value' => json_encode($to)]);
    }
};
