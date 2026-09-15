<?php

namespace App\Http\Controllers;

use App\Http\Requests\CheckoutRequest;
use App\Http\Requests\CustomerRequest;
use App\Http\Requests\HoldCartRequest;
use App\Models\Customer;
use App\Models\HeldCart;
use App\Models\Order;
use App\Models\Product;
use App\Models\Quotation;
use App\Models\Service;
use App\Models\ServiceCategory;
use App\Models\Setting;
use App\Models\User;
use App\Services\CheckoutService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PosController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $quote = null;
        if ($request->filled('quotation') && $q = Quotation::query()->with(['items', 'customer'])->find($request->integer('quotation'))) {
            if ($q->status !== 'converted') {
                $quote = [
                    'id' => $q->id,
                    'quote_no' => $q->quote_no,
                    'customer' => $q->customer ? self::customerPayload($q->customer) : null,
                    'discount_type' => $q->discount_type,
                    'discount_value' => (float) $q->discount_value,
                    'notes' => $q->notes,
                    'lines' => $q->items->map(fn ($i) => [
                        'item_type' => $i->item_type,
                        'item_id' => $i->item_id,
                        'qty' => (float) $i->qty,
                        'spec' => $i->spec,
                        'discount_type' => $i->discount_type,
                        'discount_value' => (float) $i->discount_value,
                        'note' => $i->note,
                    ]),
                ];
            }
        }

        return Inertia::render('Pos/Index', [
            'catalog' => self::catalog(),
            'staff' => User::query()->workingHere()->where('active', true)->orderBy('name')->get(['id', 'name']),
            'held' => HeldCart::query()->where('user_id', $user->id)->latest()->get(['id', 'label', 'payload', 'total', 'created_at']),
            'recentOrders' => Order::query()->with('customer:id,name')->where('user_id', $user->id)->whereDate('created_at', today())->latest()->latest('id')->limit(10)->get()
                ->map(fn (Order $o) => ['id' => $o->id, 'order_no' => $o->order_no, 'type' => $o->type, 'status' => $o->status, 'customer' => $o->customer?->name ?? 'Walk-in', 'total' => (float) $o->total, 'balance' => (float) $o->balance, 'created_at' => $o->created_at->toIso8601String()]),
            'recentCustomers' => Customer::query()->latest('updated_at')->limit(8)->get()->map(fn ($c) => self::customerPayload($c)),
            'quote' => $quote,
            'presetCustomer' => ! $quote && $request->filled('customer') && ($c = Customer::query()->find($request->integer('customer'))) ? self::customerPayload($c) : null,
            'canDiscount' => $user->can('pos.discount'),
            'payTo' => [
                'gcash' => trim(Setting::get('gcash_name', '').' '.Setting::get('gcash_number', '')),
                'bank' => trim(Setting::get('bank_name', '').' '.Setting::get('bank_account_number', '')),
            ],
        ]);
    }

    public function checkout(CheckoutRequest $request, CheckoutService $checkout): RedirectResponse
    {
        $order = $checkout->checkout($request->user(), $request->validated());

        $change = collect($request->validated('payments'))
            ->where('method', 'cash')
            ->sum(fn ($p) => max(0, (float) ($p['tendered'] ?? 0) - (float) $p['amount']));

        return back()->with('receipt', [
            'order_id' => $order->id,
            'order_no' => $order->order_no,
            'type' => $order->type,
            'change' => round($change, 2),
        ]);
    }

    public function quickCustomer(CustomerRequest $request): RedirectResponse
    {
        $customer = Customer::query()->create($request->validated());

        return back()->with('success', "Added {$customer->name}.")->with('created_customer', self::customerPayload($customer));
    }

    public function searchCustomers(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $q).'%';

        return response()->json([
            'customers' => Customer::query()
                ->when($q !== '', fn ($w) => $w->where(fn ($x) => $x->where('name', 'like', $like)->orWhere('phone', 'like', $like)->orWhere('business_name', 'like', $like)))
                ->orderBy('name')->limit(12)->get()->map(fn ($c) => self::customerPayload($c)),
        ]);
    }

    public function hold(HoldCartRequest $request): RedirectResponse
    {
        HeldCart::query()->create($request->validated() + ['user_id' => $request->user()->id]);

        return back()->with('success', 'Sale parked. Pick it up from Held orders.');
    }

    public function releaseHeld(Request $request, HeldCart $heldCart): RedirectResponse
    {
        abort_unless($heldCart->user_id === $request->user()->id, 403, 'That parked sale belongs to another cashier.');
        $heldCart->delete();

        return back();
    }

    public static function customerPayload(Customer $c): array
    {
        return [
            'id' => $c->id,
            'name' => $c->name,
            'phone' => $c->phone,
            'business_name' => $c->business_name,
            'credit_balance' => (float) $c->credit_balance,
            'credit_limit' => $c->credit_limit !== null ? (float) $c->credit_limit : null,
            'is_senior_pwd' => $c->is_senior_pwd,
        ];
    }

    /** Everything the POS and quotation builder need to price client-side. */
    public static function catalog(): array
    {
        return [
            'products' => Product::query()->with('inventoryItem:id,stock')->where('active', true)->orderBy('name')->get()
                ->map(fn (Product $p) => [
                    'id' => $p->id, 'name' => $p->name, 'sku' => $p->sku, 'barcode' => $p->barcode,
                    'category' => $p->category, 'price' => (float) $p->price, 'stock' => $p->availableStock(),
                    'reorder_level' => (int) $p->reorder_level,
                ]),
            'categories' => ServiceCategory::query()->orderBy('sort')->get(['id', 'name']),
            'services' => Service::query()->with(['options' => fn ($q) => $q->where('active', true), 'category:id,name'])
                ->where('active', true)->orderBy('name')->get()
                ->map(fn (Service $s) => [
                    'id' => $s->id, 'name' => $s->name, 'code' => $s->code, 'category_id' => $s->service_category_id,
                    'category' => $s->category?->name, 'pricing_model' => $s->pricing_model,
                    'base_price' => (float) $s->base_price, 'min_charge' => (float) $s->min_charge,
                    'tiers' => collect($s->tiers ?? [])->map(fn ($t) => ['min_qty' => (float) $t['min_qty'], 'price' => (float) $t['price']])->values(),
                    'unit_label' => $s->unit_label, 'is_job' => $s->is_job, 'lead_time_hours' => $s->lead_time_hours,
                    'options' => $s->options->map(fn ($o) => ['id' => $o->id, 'name' => $o->name, 'price_type' => $o->price_type, 'price' => (float) $o->price])->values(),
                ]),
        ];
    }
}
