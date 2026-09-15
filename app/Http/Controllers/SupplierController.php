<?php

namespace App\Http\Controllers;

use App\Http\Requests\SupplierRequest;
use App\Models\Supplier;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SupplierController extends Controller
{
    public function index(Request $request): Response
    {
        $suppliers = Supplier::query()
            ->withCount(['purchases as open_pos' => fn ($q) => $q->whereIn('status', ['ordered', 'partial'])])
            ->withSum(['purchases as total_bought' => fn ($q) => $q->whereIn('status', ['partial', 'received'])], 'total')
            ->withMax('purchases as last_purchase_at', 'created_at')
            ->when($request->query('q'), fn ($q, $t) => $q->where('name', 'like', "%{$t}%"))
            ->orderBy('name')->get()
            ->map(fn (Supplier $s) => $s->only(['id', 'name', 'contact_person', 'phone', 'email', 'address', 'terms', 'notes']) + [
                'open_pos' => $s->open_pos,
                'total_bought' => round((float) $s->total_bought, 2),
                'last_purchase_at' => $s->last_purchase_at,
            ]);

        return Inertia::render('Purchases/Suppliers', ['suppliers' => $suppliers, 'filters' => $request->only('q')]);
    }

    public function store(SupplierRequest $request): RedirectResponse
    {
        $supplier = Supplier::query()->create($request->validated());

        return back()->with('success', "Added {$supplier->name}.");
    }

    public function update(SupplierRequest $request, Supplier $supplier): RedirectResponse
    {
        $supplier->update($request->validated());

        return back()->with('success', "Saved {$supplier->name}.");
    }

    public function destroy(Supplier $supplier): RedirectResponse
    {
        if ($supplier->purchases()->whereIn('status', ['draft', 'ordered', 'partial'])->exists()) {
            return back()->with('error', "{$supplier->name} has open purchase orders. Close or cancel them first.");
        }
        $supplier->delete();

        return back()->with('success', "{$supplier->name} removed.");
    }
}
