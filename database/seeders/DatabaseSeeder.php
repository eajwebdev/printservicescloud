<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Cache;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        Cache::flush();

        $this->call([
            AccessSeeder::class,
            SettingsSeeder::class,
            CatalogSeeder::class,
            ShopHistorySeeder::class,
            BillingDemoSeeder::class,
        ]);
    }
}
