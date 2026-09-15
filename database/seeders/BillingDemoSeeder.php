<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Invoice;
use App\Models\User;
use App\Services\Billing\BillingService;
use Illuminate\Database\Seeder;

/**
 * Demo subscriptions: SKC Kabankalan pays on time, SKC Bacolod is on a free trial,
 * and SKC Dumaguete is several bills behind, so its staff see the locked bill screen.
 */
class BillingDemoSeeder extends Seeder
{
    public function run(BillingService $billing): void
    {
        $superadmin = User::query()->where('is_superadmin', true)->first();

        if ($kab = Branch::query()->where('code', 'KAB')->first()) {
            $billing->activate($kab, today()->subMonths(2)->subDays(3), $superadmin);
            // Everything but the latest bill was paid by GCash.
            $older = Invoice::query()->where('branch_id', $kab->id)->unpaid()->orderBy('period_start')->get();
            $older->pop();
            foreach ($older as $invoice) {
                $billing->recordPayment($kab, [$invoice->id], 'manual', 'gcash', 'GC'.mt_rand(100000000, 999999999), $superadmin, 'Seeded payment');
            }
        }

        if ($bcd = Branch::query()->where('code', 'BCD')->first()) {
            $billing->startTrial($bcd, today()->addDays(10), $superadmin);
        }

        if ($dgt = Branch::query()->where('code', 'DGT')->first()) {
            $dgt->update(['monthly_fee' => 1499, 'billing_notes' => 'Promo rate for the first year.']);
            $billing->activate($dgt, today()->subMonths(3)->subDays(12), $superadmin);
        }
    }
}
