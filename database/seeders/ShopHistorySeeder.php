<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Customer;
use App\Models\InventoryItem;
use App\Models\Order;
use App\Models\Product;
use App\Models\Quotation;
use App\Models\Service;
use App\Models\Supplier;
use App\Models\User;
use App\Services\CartBuilder;
use App\Services\CheckoutService;
use App\Services\DrawerService;
use App\Services\ExpenseService;
use App\Services\OrderService;
use App\Services\PettyCashService;
use App\Services\PurchaseService;
use App\Services\ReceivableService;
use App\Services\Sequence;
use App\Support\BranchContext;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Bus;

/**
 * Plays two weeks of shop life through the real services, with the clock
 * moved back, so drawers, stock, receivables and reports all reconcile.
 */
class ShopHistorySeeder extends Seeder
{
    private CheckoutService $checkout;

    private OrderService $orders;

    private array $services;

    private array $products;

    private Carbon $today;

    public function run(
        CheckoutService $checkout,
        DrawerService $drawer,
        OrderService $orders,
        ReceivableService $receivables,
        ExpenseService $expenses,
        PettyCashService $petty,
        PurchaseService $purchases,
        CartBuilder $cart,
    ): void {
        Bus::fake(); // no "ready for pickup" SMS jobs for seeded history
        $this->checkout = $checkout;
        $this->orders = $orders;

        // Kabankalan has two weeks of history, Dumaguete and Bacolod about a week each.
        foreach (self::HISTORY_DAYS as $code => $days) {
            $branch = Branch::query()->where('code', $code)->first();
            if (! $branch) {
                continue;
            }
            mt_srand(20260913 + $branch->id);
            BranchContext::current()->run($branch->id, fn () => $this->history($branch, $days, $drawer, $receivables, $expenses, $petty, $purchases, $cart));
        }
    }

    public const HISTORY_DAYS = ['KAB' => 13, 'DGT' => 8, 'BCD' => 6];

    private function history(Branch $branch, int $days, DrawerService $drawer, ReceivableService $receivables, ExpenseService $expenses, PettyCashService $petty, PurchaseService $purchases, CartBuilder $cart): void
    {
        $this->today = Carbon::today();
        $this->services = Service::query()->pluck('id', 'code')->all();
        $this->products = Product::query()->pluck('id', 'sku')->all();

        $owner = User::query()->where('is_owner', true)->firstOrFail();
        $cashier = $this->staff($branch, 'Cashier') ?? $owner;
        $production = $this->staff($branch, 'Production') ?? $cashier;
        $customers = Customer::query()->get()->keyBy('name');

        $this->at($this->today->copy()->subDays(15)->setTime(8, 30));
        $petty->topUp(3000, 'owner', 'OWNER-CASH', 'Initial petty cash fund', $owner);

        // A received PO from before the history window.
        $po = $purchases->save(null, [
            'supplier_id' => Supplier::query()->where('name', 'Visayas Sign Materials')->value('id'),
            'items' => [
                ['item_type' => 'inventory', 'item_id' => $this->inv('TARP-13'), 'qty_ordered' => 600, 'unit_cost' => 4.70],
                ['item_type' => 'inventory', 'item_id' => $this->inv('EYE-10'), 'qty_ordered' => 1000, 'unit_cost' => 0.33],
            ],
            'submit' => true,
        ], $owner);
        $this->at($this->today->copy()->subDays(13)->setTime(10, 15));
        $purchases->receive($po, $po->items->mapWithKeys(fn ($i) => [$i->id => (float) $i->qty_ordered])->all(), $owner);

        $regulars = $customers->values();

        for ($day = $days; $day >= 1; $day--) {
            $date = $this->today->copy()->subDays($day);
            if ($date->isSunday()) {
                continue;
            }
            $seller = $day % 4 === 0 ? $owner : $cashier;

            $this->at($date->copy()->setTime(8, 0));
            $session = $drawer->open($seller, $seller->is($owner) ? 2000 : 1000);

            $minute = 8 * 60 + 20;
            $sales = mt_rand(7, 13);
            for ($i = 0; $i < $sales; $i++) {
                $minute += mt_rand(15, 45);
                $this->at($date->copy()->startOfDay()->addMinutes($minute));
                $this->instantSale($seller, mt_rand(0, 4) === 0 ? $regulars->random() : null);
            }

            // One or two job orders a day.
            foreach (range(1, mt_rand(1, 2)) as $j) {
                $minute += mt_rand(20, 50);
                $this->at($date->copy()->startOfDay()->addMinutes($minute));
                $this->jobOrder($seller, $regulars->random(), $production, $day);
            }

            // Everyday cash-outs from the drawer.
            if ($day % 3 === 0) {
                $this->at($date->copy()->setTime(13, 5));
                $expenses->record(['expense_date' => $date->toDateString(), 'category' => 'supplies', 'amount' => mt_rand(3, 9) * 25, 'payee' => 'Gaisano Mall', 'notes' => 'Weeding tools and cutter blades', 'source' => 'drawer'], $seller);
            }
            if ($day % 5 === 0) {
                $this->at($date->copy()->setTime(15, 40));
                $expenses->record(['expense_date' => $date->toDateString(), 'category' => 'transport', 'amount' => 150, 'payee' => 'Tricycle delivery', 'notes' => 'Delivered jerseys to client', 'source' => 'petty'], $seller);
            }

            // Collect on an older credit now and then.
            if ($day % 4 === 1 && $owing = Customer::query()->where('credit_balance', '>', 0)->inRandomOrder()->first()) {
                $this->at($date->copy()->setTime(16, 10));
                $receivables->settle($owing, round(min((float) $owing->credit_balance, max(100, (float) $owing->credit_balance / 2)), 2), mt_rand(0, 1) ? 'cash' : 'gcash', 'GC'.mt_rand(100000000, 999999999), $seller);
            }

            // Move yesterday-and-older jobs along the board.
            $this->at($date->copy()->setTime(17, 30));
            foreach (Order::query()->jobs()->whereIn('status', ['pending', 'in_production', 'ready'])->where('created_at', '<', $date->copy()->subDays(1))->get() as $job) {
                $next = ['pending' => 'in_production', 'in_production' => 'ready', 'ready' => 'released'][$job->status];
                if ($next === 'released' && (float) $job->balance > 0) {
                    $this->at($date->copy()->setTime(17, 35));
                    $receivables->settle($job->customer, (float) $job->balance, 'cash', null, $seller, $job->id);
                }
                $this->orders->moveOnBoard($job->fresh(), $next, $production);
            }

            $this->at($date->copy()->setTime(18, 45));
            $session->refresh();
            $variance = [0, 0, 0, 0, -20, 10, -5, 0][mt_rand(0, 7)];
            $drawer->close($session, $session->liveExpectedCash() + $variance, $variance ? 'Recounted twice' : null, $seller);
        }

        // Monthly bills paid by bank.
        $this->at($this->today->copy()->subDays(10)->setTime(11, 0));
        $expenses->record(['expense_date' => $this->today->copy()->subDays(10)->toDateString(), 'category' => 'rent', 'amount' => 15000, 'payee' => 'Gatuslao Commercial Bldg.', 'notes' => 'Shop space, monthly', 'source' => 'bank'], $owner);
        $this->at($this->today->copy()->subDays(6)->setTime(11, 0));
        $expenses->record(['expense_date' => $this->today->copy()->subDays(6)->toDateString(), 'category' => 'utilities', 'amount' => 6840.50, 'payee' => 'CENECO', 'notes' => 'Electricity', 'source' => 'bank'], $owner);
        $expenses->record(['expense_date' => $this->today->copy()->subDays(6)->toDateString(), 'category' => 'utilities', 'amount' => 1699, 'payee' => 'PLDT Home', 'notes' => 'Internet', 'source' => 'bank'], $owner);
        $this->at($this->today->copy()->subDays(3)->setTime(17, 0));
        $expenses->record(['expense_date' => $this->today->copy()->subDays(3)->toDateString(), 'category' => 'salaries', 'amount' => 9600, 'payee' => 'Staff payroll', 'notes' => 'Half-month wages', 'source' => 'bank'], $owner);
        $expenses->record(['expense_date' => $this->today->copy()->subDays(3)->toDateString(), 'category' => 'marketing', 'amount' => 800, 'payee' => 'Facebook Ads', 'notes' => 'League jersey promo', 'source' => 'bank'], $owner);
        $this->at($this->today->copy()->subDays(2)->setTime(9, 30));
        $expenses->record(['expense_date' => $this->today->copy()->subDays(2)->toDateString(), 'category' => 'repairs', 'amount' => 450, 'payee' => 'RJ Electronics', 'notes' => 'Heat press thermostat', 'source' => 'petty'], $owner);

        // Purchases still in flight.
        $this->at($this->today->copy()->subDays(2)->setTime(14, 0));
        $open = $purchases->save(null, [
            'supplier_id' => Supplier::query()->where('name', 'Negros Print Supply')->value('id'),
            'expected_at' => $this->today->copy()->addDays(2)->toDateString(),
            'items' => [
                ['item_type' => 'inventory', 'item_id' => $this->inv('LAM-A4'), 'qty_ordered' => 200, 'unit_cost' => 3.40],
                ['item_type' => 'product', 'item_id' => $this->products['TAPE-TR'], 'qty_ordered' => 12, 'unit_cost' => 105],
                ['item_type' => 'product', 'item_id' => $this->products['TMB-20'], 'qty_ordered' => 24, 'unit_cost' => 175],
            ],
            'submit' => true,
        ], $owner);
        $purchases->save(null, [
            'supplier_id' => Supplier::query()->where('name', 'Visayas Sign Materials')->value('id'),
            'notes' => 'Check price of clear vinyl before sending',
            'items' => [['item_type' => 'inventory', 'item_id' => $this->inv('VNL-CLR'), 'qty_ordered' => 150, 'unit_cost' => 10.50]],
        ], $owner);

        // Quotations.
        $this->at($this->today->copy()->subDays(4)->setTime(10, 20));
        $this->quote($cart, $owner, $customers['Brgy. Tampalon Council']->id, null, 'sent', [
            ['item_type' => 'service', 'item_id' => $this->services['TARP'], 'qty' => 12, 'spec' => ['width' => 4, 'height' => 8, 'unit' => 'ft', 'option_ids' => $this->optionIds('TARP', ['Eyelets (4 corners)'])]],
            ['item_type' => 'service', 'item_id' => $this->services['DRI-EVT'], 'qty' => 40, 'spec' => ['option_ids' => $this->optionIds('DRI-EVT', ['Sublimated back'])]],
            ['item_type' => 'service', 'item_id' => $this->services['LAYOUT-F'], 'qty' => 1, 'spec' => []],
        ], 'Fiesta 2026 street banners and staff shirts. Deliver to barangay hall.');
        $this->at($this->today->copy()->subDays(1)->setTime(15, 0));
        $this->quote($cart, $owner, null, 'Hacienda Luisa Resort', 'draft', [
            ['item_type' => 'service', 'item_id' => $this->services['ACR-SIGN'], 'qty' => 1, 'spec' => ['width' => 6, 'height' => 2, 'unit' => 'ft', 'option_ids' => $this->optionIds('ACR-SIGN', ['LED backlight', 'Installation'])]],
            ['item_type' => 'service', 'item_id' => $this->services['LASER-WOOD'], 'qty' => 20, 'spec' => ['width' => 8, 'height' => 12, 'unit' => 'in', 'option_ids' => []]],
            ['item_type' => 'service', 'item_id' => $this->services['VINYL'], 'qty' => 50, 'spec' => ['width' => 4, 'height' => 4, 'unit' => 'in', 'option_ids' => []]],
        ], 'Lobby acrylic sign with lights, laser-cut room number plates and stickers.');

        // Today: the owner's drawer is open with a float and a few sales; the cashier's is closed so the POS lock shows.
        $today = $this->today->copy();
        $this->at($today->copy()->setTime(8, 5));
        $session = $drawer->open($owner, 2000, 'Two 500s, eight 100s, rest in coins');
        foreach ([8 * 60 + 40, 9 * 60 + 15, 9 * 60 + 50] as $m) {
            $this->at($today->copy()->startOfDay()->addMinutes($m));
            $this->instantSale($owner, null);
        }

        // Guarantee every board column has cards, including a credit job with a balance.
        $this->at($today->copy()->setTime(10, 30));
        $creditLines = [
            ['item_type' => 'service', 'item_id' => $this->services['TARP'], 'qty' => 2, 'spec' => ['width' => 3, 'height' => 6, 'unit' => 'ft', 'option_ids' => $this->optionIds('TARP', ['Eyelets (4 corners)'])]],
            ['item_type' => 'service', 'item_id' => $this->services['SUBJ'], 'qty' => 12, 'spec' => ['option_ids' => $this->optionIds('SUBJ', ['Name & number'])]],
        ];
        $credit = $this->checkout->checkout($owner, [
            'type' => 'job',
            'customer_id' => $customers['Riverside NHS, SSG']->id,
            'lines' => $creditLines,
            'payments' => [['method' => 'credit', 'amount' => $cart->build($creditLines, null, 0, false)['totals']['total']]],
            'due_at' => $today->copy()->addDay()->setTime(16, 0)->toDateTimeString(),
            'assigned_to' => $production->id,
            'notes' => 'Intramurals jerseys. Charge to SSG fund; purchase order to follow.',
        ]);
        $this->orders->moveOnBoard($credit, 'ready', $production);

        $this->at($today->copy()->setTime(11, 10));
        $rush = $this->jobOrder($owner, $customers['JM Bakeshop'], $production, 0, true);
        $this->orders->moveOnBoard($rush, 'in_production', $production);

        $this->at($today->copy()->setTime(11, 45));
        $sweet = $this->jobOrder($owner, $customers['Negros Riders Club'], $production, 0);

        // Proofs sent out today, one still waiting on the customer's go-ahead.
        $sweet->forceFill(['proof_status' => 'waiting'])->saveQuietly();
        $rush->forceFill(['proof_status' => 'approved', 'proof_approved_at' => $today->copy()->setTime(11, 30), 'proof_approved_by' => $production->id])->saveQuietly();

        // One overdue job still in production.
        $late = Order::query()->jobs()->where('status', 'in_production')->oldest()->first();
        $late?->forceFill(['due_at' => $today->copy()->subDay()->setTime(17, 0)])->saveQuietly();

        $this->at(null);
    }

    private function staff(Branch $branch, string $role): ?User
    {
        return User::query()->where('branch_id', $branch->id)->whereHas('roles', fn ($q) => $q->where('name', $role))->orderBy('id')->first();
    }

    private function at(?Carbon $time): void
    {
        Carbon::setTestNow($time);
    }

    private function inv(string $sku): int
    {
        return (int) InventoryItem::query()->where('sku', $sku)->value('id');
    }

    private function optionIds(string $code, array $names): array
    {
        return Service::query()->where('code', $code)->firstOrFail()->options()->whereIn('name', $names)->pluck('id')->all();
    }

    private function instantSale(User $seller, ?Customer $customer): Order
    {
        $pool = [
            fn () => ['item_type' => 'service', 'item_id' => $this->services['DTF-SQFT'], 'qty' => mt_rand(1, 4), 'spec' => ['width' => [8, 10, 12][mt_rand(0, 2)], 'height' => [10, 12][mt_rand(0, 1)], 'unit' => 'in', 'option_ids' => []]],
            fn () => ['item_type' => 'service', 'item_id' => $this->services['LAM-A4'], 'qty' => mt_rand(1, 4), 'spec' => []],
            fn () => ['item_type' => 'service', 'item_id' => $this->services['BLUEPRINT'], 'qty' => mt_rand(1, 8), 'spec' => []],
            fn () => ['item_type' => 'service', 'item_id' => $this->services['VECTOR'], 'qty' => 1, 'spec' => []],
            fn () => ['item_type' => 'service', 'item_id' => $this->services['LAYOUT-S'], 'qty' => 1, 'spec' => []],
            fn () => ['item_type' => 'service', 'item_id' => $this->services['KEYCHAIN'], 'qty' => mt_rand(2, 10), 'spec' => ['option_ids' => []]],
            fn () => ['item_type' => 'product', 'item_id' => $this->products['STK-LOGO'], 'qty' => mt_rand(1, 3)],
            fn () => ['item_type' => 'product', 'item_id' => $this->products['SHR-CTN'], 'qty' => 1],
            fn () => ['item_type' => 'product', 'item_id' => $this->products['MUG-BLK'], 'qty' => mt_rand(1, 2)],
            fn () => ['item_type' => 'product', 'item_id' => $this->products['KEY-BLK'], 'qty' => mt_rand(1, 4)],
            fn () => ['item_type' => 'product', 'item_id' => $this->products['LANY-SUB'], 'qty' => 1],
            fn () => ['item_type' => 'product', 'item_id' => $this->products['CAP-TRK'], 'qty' => 1],
        ];

        $lines = [];
        foreach ((array) array_rand($pool, mt_rand(1, 3)) as $key) {
            $lines[] = $pool[$key]();
        }
        $lines = array_values(array_filter($lines, function ($l) {
            return $l['item_type'] !== 'product' || Product::query()->find($l['item_id'])->availableStock() >= $l['qty'];
        }));
        if (! $lines) {
            $lines = [['item_type' => 'service', 'item_id' => $this->services['LAM-A4'], 'qty' => 2, 'spec' => []]];
        }

        $total = app(CartBuilder::class)->build($lines, null, 0, false)['totals']['total'];
        $roll = mt_rand(1, 10);
        $payments = match (true) {
            $roll <= 7 => [['method' => 'cash', 'amount' => $total, 'tendered' => $this->tender($total)]],
            $roll <= 9 => [['method' => 'gcash', 'amount' => $total, 'reference' => (string) mt_rand(1000000000, 9999999999)]],
            default => [['method' => 'cash', 'amount' => round($total / 2, 2), 'tendered' => round($total / 2, 2)], ['method' => 'gcash', 'amount' => round($total - round($total / 2, 2), 2), 'reference' => (string) mt_rand(1000000000, 9999999999)]],
        };

        return $this->checkout->checkout($seller, [
            'type' => 'instant',
            'customer_id' => $customer?->id,
            'lines' => $lines,
            'payments' => $payments,
        ]);
    }

    private function jobOrder(User $seller, Customer $customer, User $production, int $daysAgo, bool $rush = false): Order
    {
        // The customer list was loaded at the start; their balance has moved since.
        $customer = $customer->fresh();
        $templates = [
            [['item_type' => 'service', 'item_id' => $this->services['TARP'], 'qty' => mt_rand(1, 3), 'spec' => ['width' => [2, 3, 4][mt_rand(0, 2)], 'height' => [3, 5, 6, 8][mt_rand(0, 3)], 'unit' => 'ft', 'option_ids' => $this->optionIds('TARP', ['Eyelets (4 corners)'])]]],
            [['item_type' => 'service', 'item_id' => $this->services['VINYL'], 'qty' => mt_rand(20, 100), 'spec' => ['width' => 3, 'height' => 3, 'unit' => 'in', 'option_ids' => $this->optionIds('VINYL', ['Matte lamination'])]]],
            [['item_type' => 'service', 'item_id' => $this->services['SUBJ'], 'qty' => mt_rand(8, 15), 'spec' => ['option_ids' => $this->optionIds('SUBJ', ['Name & number'])]], ['item_type' => 'service', 'item_id' => $this->services['LAYOUT-S'], 'qty' => 1, 'spec' => []]],
            [['item_type' => 'service', 'item_id' => $this->services['DTF-SHIRT'], 'qty' => [6, 12, 20][mt_rand(0, 2)], 'spec' => ['option_ids' => $this->optionIds('DTF-SHIRT', ['Back print, A4'])]]],
            [['item_type' => 'service', 'item_id' => $this->services['MUG'], 'qty' => mt_rand(2, 14), 'spec' => ['option_ids' => []]]],
            [['item_type' => 'service', 'item_id' => $this->services['DECAL'], 'qty' => 1, 'spec' => ['width' => 24, 'height' => 12, 'unit' => 'in', 'option_ids' => $this->optionIds('DECAL', ['Installation'])]], ['item_type' => 'product', 'item_id' => $this->products['DECAL-MC'], 'qty' => 1]],
            [['item_type' => 'service', 'item_id' => $this->services['SINTRA'], 'qty' => 1, 'spec' => ['width' => 2, 'height' => 3, 'unit' => 'ft', 'option_ids' => []]], ['item_type' => 'service', 'item_id' => $this->services['LOGO'], 'qty' => 1, 'spec' => ['option_ids' => []]]],
            [['item_type' => 'service', 'item_id' => $this->services['LASER-ACR'], 'qty' => mt_rand(2, 6), 'spec' => ['width' => 6, 'height' => 8, 'unit' => 'in', 'option_ids' => $this->optionIds('LASER-ACR', ['Engraving'])]]],
            [['item_type' => 'service', 'item_id' => $this->services['3DPRINT'], 'qty' => mt_rand(60, 250), 'spec' => ['option_ids' => []]], ['item_type' => 'service', 'item_id' => $this->services['3DMODEL'], 'qty' => 1, 'spec' => []]],
        ];
        $lines = $templates[mt_rand(0, count($templates) - 1)];
        if ($rush) {
            $lines[0]['spec']['rush'] = true;
        }
        $lines = array_values(array_filter($lines, fn ($l) => $l['item_type'] !== 'product' || Product::query()->find($l['item_id'])->availableStock() >= $l['qty']));

        $total = app(CartBuilder::class)->build($lines, null, 0, false)['totals']['total'];
        $style = mt_rand(1, 10);
        $payments = match (true) {
            $style <= 5 => [['method' => 'cash', 'amount' => round($total * 0.5, 2), 'tendered' => $this->tender($total * 0.5)]],
            $style <= 7 => [['method' => 'gcash', 'amount' => round($total * 0.5, 2), 'reference' => (string) mt_rand(1000000000, 9999999999)]],
            $style <= 9 => [['method' => 'cash', 'amount' => $total, 'tendered' => $this->tender($total)]],
            default => [['method' => 'credit', 'amount' => $total]],
        };
        if ($customer->credit_limit !== null && ($style === 10 || $style <= 7) && (float) $customer->credit_balance + $total > (float) $customer->credit_limit) {
            $payments = [['method' => 'cash', 'amount' => $total, 'tendered' => $this->tender($total)]];
        }

        $now = Carbon::now();

        return $this->checkout->checkout($seller, [
            'type' => 'job',
            'customer_id' => $customer->id,
            'lines' => $lines,
            'payments' => $payments,
            'due_at' => $now->copy()->addDays($rush ? 0 : mt_rand(1, 3))->setTime($rush ? 17 : 16, 0)->toDateTimeString(),
            'assigned_to' => $production->id,
            'rush' => $rush,
        ]);
    }

    private function quote(CartBuilder $cart, User $by, ?int $customerId, ?string $name, string $status, array $lines, string $notes): void
    {
        $built = $cart->build($lines, null, 0, false);
        $quote = Quotation::query()->create([
            'quote_no' => Sequence::next('quotation'),
            'customer_id' => $customerId,
            'customer_name' => $name,
            'status' => $status,
            'valid_until' => Carbon::now()->addDays(15)->toDateString(),
            'subtotal' => $built['totals']['subtotal'],
            'discount_total' => 0,
            'tax_total' => $built['totals']['tax_total'],
            'total' => $built['totals']['total'],
            'notes' => $notes,
            'user_id' => $by->id,
        ]);
        foreach ($built['lines'] as $line) {
            $quote->items()->create(CartBuilder::row($line, ['item_type', 'item_id', 'name', 'spec', 'qty', 'unit_price', 'gross', 'discount_type', 'discount_value', 'discount_amount', 'line_total', 'note']));
        }
    }

    private function tender(float $amount): float
    {
        foreach ([20, 50, 100, 200, 500, 1000] as $bill) {
            if ($amount <= $bill) {
                return (float) $bill;
            }
        }

        return (float) (ceil($amount / 1000) * 1000);
    }
}
