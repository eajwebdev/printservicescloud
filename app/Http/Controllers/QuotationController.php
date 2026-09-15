<?php

namespace App\Http\Controllers;

use App\Http\Requests\QuotationRequest;
use App\Http\Requests\QuotationStatusRequest;
use App\Models\Customer;
use App\Models\Quotation;
use App\Models\Setting;
use App\Services\CartBuilder;
use App\Services\Sequence;
use App\Support\Shop;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class QuotationController extends Controller
{
    public function __construct(private CartBuilder $cart) {}

    public function index(Request $request): Response
    {
        $filters = $request->only(['q', 'status']);
        $quotes = Quotation::query()->with('customer:id,name')
            ->when($filters['q'] ?? null, fn ($q, $t) => $q->where(fn ($w) => $w->where('quote_no', 'like', "%{$t}%")->orWhere('customer_name', 'like', "%{$t}%")->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$t}%"))))
            ->when($filters['status'] ?? null, function ($q, $s) {
                if ($s === 'expired') {
                    return $q->where(fn ($w) => $w->where('status', 'expired')->orWhere(fn ($x) => $x->whereIn('status', ['draft', 'sent'])->whereDate('valid_until', '<', today())));
                }

                return $q->where('status', $s)->when(in_array($s, ['draft', 'sent'], true), fn ($w) => $w->where(fn ($x) => $x->whereNull('valid_until')->orWhereDate('valid_until', '>=', today())));
            })
            ->latest()->paginate(50)->withQueryString()
            ->through(fn (Quotation $q) => [
                'id' => $q->id, 'quote_no' => $q->quote_no, 'customer' => $q->displayCustomer(), 'status' => $this->effectiveStatus($q),
                'total' => (float) $q->total, 'valid_until' => $q->valid_until?->toDateString(), 'created_at' => $q->created_at->toIso8601String(),
                'order_id' => $q->order_id,
            ]);

        $open = fn ($q) => $q->where(fn ($w) => $w->whereNull('valid_until')->orWhereDate('valid_until', '>=', today()));

        return Inertia::render('Quotations/Index', [
            'quotations' => $quotes,
            'filters' => $filters,
            'counts' => [
                'draft' => Quotation::query()->where('status', 'draft')->where($open)->count(),
                'sent' => Quotation::query()->where('status', 'sent')->where($open)->count(),
                'accepted' => Quotation::query()->where('status', 'accepted')->count(),
                'converted' => Quotation::query()->where('status', 'converted')->count(),
                'expired' => Quotation::query()->where(fn ($q) => $q->where('status', 'expired')->orWhere(fn ($w) => $w->whereIn('status', ['draft', 'sent'])->whereDate('valid_until', '<', today())))->count(),
            ],
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Quotations/Form', [
            'quotation' => null,
            'catalog' => PosController::catalog(),
            'defaultValidUntil' => now()->addDays((int) Setting::get('quotation_valid_days', 15))->toDateString(),
        ]);
    }

    public function store(QuotationRequest $request): RedirectResponse
    {
        $quote = $this->persist(new Quotation(['quote_no' => Sequence::next('quotation'), 'user_id' => $request->user()->id]), $request->validated());

        return redirect()->route('quotations.show', $quote)->with('success', "Quotation {$quote->quote_no} saved.");
    }

    public function show(Quotation $quotation): Response
    {
        $quotation->load(['items', 'customer', 'user:id,name', 'order:id,order_no']);

        return Inertia::render('Quotations/Show', ['quotation' => $this->payload($quotation), 'business' => array_diff_key(Shop::profile(), ['logo_path' => 1])]);
    }

    public function edit(Quotation $quotation): Response|RedirectResponse
    {
        if ($quotation->status === 'converted') {
            return redirect()->route('quotations.show', $quotation)->with('error', 'This quote is already an order and can not be edited.');
        }
        $quotation->load(['items', 'customer']);

        return Inertia::render('Quotations/Form', [
            'quotation' => $this->payload($quotation),
            'catalog' => PosController::catalog(),
            'defaultValidUntil' => $quotation->valid_until?->toDateString(),
        ]);
    }

    public function update(QuotationRequest $request, Quotation $quotation): RedirectResponse
    {
        if ($quotation->status === 'converted') {
            return back()->with('error', 'This quote is already an order and can not be edited.');
        }
        $this->persist($quotation, $request->validated());

        return redirect()->route('quotations.show', $quotation)->with('success', 'Quotation updated.');
    }

    public function status(QuotationStatusRequest $request, Quotation $quotation): RedirectResponse
    {
        abort_if($quotation->status === 'converted', 422, 'Converted quotes are closed.');
        $quotation->update(['status' => $request->validated('status')]);

        return back()->with('success', 'Marked as '.$request->validated('status').'.');
    }

    public function destroy(Quotation $quotation): RedirectResponse
    {
        if ($quotation->status === 'converted') {
            return back()->with('error', 'This quote became an order. Keep it for the paper trail.');
        }
        $quotation->delete();

        return redirect()->route('quotations.index')->with('success', 'Quotation deleted.');
    }

    public function pdf(Quotation $quotation)
    {
        $quotation->load(['items', 'customer', 'user:id,name']);

        return Pdf::loadView('pdf.quotation', ['q' => $quotation, 'shop' => Shop::profile()])
            ->setPaper('a4')
            ->stream("quotation-{$quotation->quote_no}.pdf");
    }

    /** One click: open the POS with this quote's lines loaded so payment and downpayment are taken properly. */
    public function convert(Quotation $quotation): RedirectResponse
    {
        if ($quotation->status === 'converted') {
            return redirect()->route('orders.show', $quotation->order_id)->with('error', 'This quote was already converted.');
        }
        if (! $quotation->customer_id && $quotation->customer_name) {
            $customer = Customer::query()->firstOrCreate(['name' => $quotation->customer_name]);
            $quotation->update(['customer_id' => $customer->id]);
        }
        $quotation->update(['status' => 'accepted']);

        return redirect()->route('pos.index', ['quotation' => $quotation->id])
            ->with('success', "Loaded {$quotation->quote_no} into the cart. Take the downpayment to create the order.");
    }

    private function persist(Quotation $quote, array $data): Quotation
    {
        return DB::transaction(function () use ($quote, $data) {
            $built = $this->cart->build($data['lines'], $data['discount_type'] ?? null, (float) ($data['discount_value'] ?? 0), false);
            $totals = $built['totals'];

            $quote->fill([
                'customer_id' => $data['customer_id'] ?? null,
                'customer_name' => ! empty($data['customer_id']) ? null : ($data['customer_name'] ?? null),
                'status' => $data['status'] ?? ($quote->status ?? 'draft'),
                'valid_until' => $data['valid_until'] ?? null,
                'subtotal' => $totals['subtotal'],
                'discount_type' => $totals['discount_amount'] > 0 ? $data['discount_type'] : null,
                'discount_value' => $totals['discount_amount'] > 0 ? (float) $data['discount_value'] : 0,
                'discount_total' => $totals['discount_total'],
                'tax_total' => $totals['tax_total'],
                'total' => $totals['total'],
                'notes' => $data['notes'] ?? null,
            ])->save();

            $quote->items()->delete();
            foreach ($built['lines'] as $line) {
                $quote->items()->create(CartBuilder::row($line, [
                    'item_type', 'item_id', 'name', 'spec', 'qty', 'unit_price', 'gross', 'discount_type', 'discount_value', 'discount_amount', 'line_total', 'note',
                ]));
            }

            return $quote;
        });
    }

    private function effectiveStatus(Quotation $q): string
    {
        return in_array($q->status, ['draft', 'sent'], true) && $q->valid_until && $q->valid_until->isPast() && ! $q->valid_until->isToday()
            ? 'expired'
            : $q->status;
    }

    private function payload(Quotation $q): array
    {
        return [
            'id' => $q->id, 'quote_no' => $q->quote_no, 'status' => $this->effectiveStatus($q),
            'customer_id' => $q->customer_id, 'customer_name' => $q->customer_name, 'customer' => $q->displayCustomer(),
            'customer_phone' => $q->customer?->phone,
            'valid_until' => $q->valid_until?->toDateString(), 'subtotal' => (float) $q->subtotal,
            'discount_type' => $q->discount_type, 'discount_value' => (float) $q->discount_value,
            'discount_total' => (float) $q->discount_total, 'tax_total' => (float) $q->tax_total, 'total' => (float) $q->total,
            'notes' => $q->notes, 'order_id' => $q->order_id, 'order_no' => $q->order?->order_no,
            'prepared_by' => $q->user?->name, 'created_at' => $q->created_at?->toIso8601String(),
            'lines' => $q->items->map(fn ($i) => [
                'id' => $i->id, 'item_type' => $i->item_type, 'item_id' => $i->item_id, 'name' => $i->name, 'spec' => $i->spec,
                'qty' => (float) $i->qty, 'unit_price' => (float) $i->unit_price, 'gross' => (float) $i->gross,
                'discount_type' => $i->discount_type, 'discount_value' => (float) $i->discount_value,
                'discount_amount' => (float) $i->discount_amount, 'line_total' => (float) $i->line_total, 'note' => $i->note,
            ]),
        ];
    }
}
