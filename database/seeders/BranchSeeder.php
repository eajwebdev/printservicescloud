<?php

namespace Database\Seeders;

use App\Models\Branch;
use Illuminate\Database\Seeder;

/** SKC Custom Print's branches. Every branch starts on a free trial; BillingDemoSeeder sets up the demo subscriptions. */
class BranchSeeder extends Seeder
{
    public const BRANCHES = [
        'KAB' => ['name' => 'SKC Kabankalan', 'address' => 'Guanzon St., Brgy. 1 Poblacion, Kabankalan City, Negros Occidental 6111', 'phone' => '0917 555 0100', 'email' => 'kabankalan@skccustomprint.test'],
        'DGT' => ['name' => 'SKC Dumaguete', 'address' => 'Perdices St., Brgy. Poblacion 3, Dumaguete City, Negros Oriental 6200', 'phone' => '0917 555 0300', 'email' => 'dumaguete@skccustomprint.test'],
        'BCD' => ['name' => 'SKC Bacolod', 'address' => 'Lacson St., Brgy. Villamonte, Bacolod City, Negros Occidental 6100', 'phone' => '0917 555 0200', 'email' => 'bacolod@skccustomprint.test'],
    ];

    public function run(): void
    {
        foreach (self::BRANCHES as $code => $row) {
            Branch::query()->updateOrCreate(['code' => $code], $row + [
                'active' => true,
                'subscription_status' => 'trial',
                'trial_ends_on' => today()->addDays(30)->toDateString(),
            ]);
        }
    }
}
