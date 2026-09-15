<?php

namespace App\Http\Controllers;

use App\Http\Requests\ServiceRequest;
use App\Models\InventoryItem;
use App\Models\Service;
use App\Models\ServiceCategory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ServiceController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->only(['q', 'category', 'status']);

        $services = Service::query()->with(['category:id,name', 'materials.inventoryItem:id,name,unit,cost'])->withCount('options')
            ->when($filters['q'] ?? null, fn ($q, $t) => $q->where('name', 'like', "%{$t}%"))
            ->when($filters['category'] ?? null, fn ($q, $c) => $q->where('service_category_id', $c))
            ->when(($filters['status'] ?? null) === 'inactive', fn ($q) => $q->where('active', false))
            ->when(($filters['status'] ?? null) === 'active', fn ($q) => $q->where('active', true))
            ->get()
            ->sortBy(fn ($s) => [$s->category?->name, $s->name])
            ->values()
            ->map(fn (Service $s) => [
                'id' => $s->id, 'name' => $s->name, 'code' => $s->code, 'category' => $s->category?->name,
                'pricing_model' => $s->pricing_model, 'base_price' => (float) $s->base_price, 'min_charge' => (float) $s->min_charge,
                'unit_label' => $s->unit_label, 'active' => $s->active, 'is_job' => $s->is_job,
                'options_count' => $s->options_count, 'materials_count' => $s->materials->count(),
                'unit_cost' => round($this->unitCost($s), 2),
                'margin' => (float) $s->base_price > 0 ? round(((float) $s->base_price - $this->unitCost($s)) / (float) $s->base_price * 100, 1) : null,
            ]);

        return Inertia::render('Services/Index', [
            'services' => $services,
            'filters' => $filters,
            'categories' => ServiceCategory::query()->withCount('services')->orderBy('sort')->get(['id', 'name'])
                ->map(fn ($c) => ['id' => $c->id, 'name' => $c->name, 'count' => $c->services_count]),
            'counts' => ['all' => Service::query()->count(), 'active' => Service::query()->where('active', true)->count(), 'inactive' => Service::query()->where('active', false)->count()],
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Services/Form', $this->formProps(null));
    }

    public function edit(Service $service): Response
    {
        return Inertia::render('Services/Form', $this->formProps($service));
    }

    public function store(ServiceRequest $request): RedirectResponse
    {
        $service = $this->persist(new Service, $request->validated());

        return redirect()->route('services.index')->with('success', "Added {$service->name}.");
    }

    public function update(ServiceRequest $request, Service $service): RedirectResponse
    {
        $this->persist($service, $request->validated());

        return redirect()->route('services.index')->with('success', "Saved {$service->name}.");
    }

    public function toggle(Service $service): RedirectResponse
    {
        $service->update(['active' => ! $service->active]);

        return back()->with('success', $service->active ? "{$service->name} is back on the POS." : "{$service->name} is hidden from the POS.");
    }

    public function destroy(Service $service): RedirectResponse
    {
        $service->delete();

        return redirect()->route('services.index')->with('success', "{$service->name} deleted. Past orders keep their lines.");
    }

    private function persist(Service $service, array $data): Service
    {
        return DB::transaction(function () use ($service, $data) {
            $service->fill(collect($data)->except(['options', 'materials', 'tiers'])->all());
            $service->tiers = $data['pricing_model'] === 'tiered'
                ? collect($data['tiers'] ?? [])->sortBy('min_qty')->values()->map(fn ($t) => ['min_qty' => (float) $t['min_qty'], 'price' => (float) $t['price']])->all()
                : null;
            $service->save();

            $keep = [];
            foreach (array_values($data['options'] ?? []) as $i => $opt) {
                $row = $service->options()->updateOrCreate(
                    ['id' => $opt['id'] ?? null],
                    ['name' => $opt['name'], 'price_type' => $opt['price_type'], 'price' => $opt['price'], 'active' => $opt['active'] ?? true, 'sort' => $i],
                );
                $keep[] = $row->id;
            }
            $service->options()->whereNotIn('id', $keep)->delete();

            $service->materials()->delete();
            foreach ($data['materials'] ?? [] as $m) {
                $service->materials()->create($m);
            }

            return $service;
        });
    }

    private function formProps(?Service $service): array
    {
        $service?->load(['options', 'materials']);

        return [
            'service' => $service ? [
                'id' => $service->id, 'service_category_id' => $service->service_category_id, 'name' => $service->name,
                'code' => $service->code, 'pricing_model' => $service->pricing_model, 'base_price' => (float) $service->base_price,
                'cost' => (float) $service->cost, 'min_charge' => (float) $service->min_charge, 'unit_label' => $service->unit_label,
                'is_job' => $service->is_job, 'lead_time_hours' => $service->lead_time_hours, 'active' => $service->active,
                'description' => $service->description,
                'tiers' => collect($service->tiers ?? [])->map(fn ($t) => ['min_qty' => (float) $t['min_qty'], 'price' => (float) $t['price']])->values(),
                'options' => $service->options->map(fn ($o) => ['id' => $o->id, 'name' => $o->name, 'price_type' => $o->price_type, 'price' => (float) $o->price, 'active' => $o->active])->values(),
                'materials' => $service->materials->map(fn ($m) => ['inventory_item_id' => $m->inventory_item_id, 'qty_per_unit' => (float) $m->qty_per_unit, 'basis' => $m->basis])->values(),
            ] : null,
            'categories' => ServiceCategory::query()->orderBy('sort')->get(['id', 'name']),
            'materials' => InventoryItem::query()->where('active', true)->orderBy('name')->get(['id', 'name', 'unit', 'cost', 'stock'])
                ->map(fn ($i) => ['id' => $i->id, 'name' => $i->name, 'unit' => $i->unit, 'cost' => (float) $i->cost, 'stock' => (float) $i->stock]),
        ];
    }

    private function unitCost(Service $s): float
    {
        if ($s->materials->isEmpty()) {
            return (float) $s->cost;
        }

        // Cost per billing unit: per sqft for area-priced services, per piece otherwise.
        return (float) $s->materials->sum(fn ($m) => (float) $m->qty_per_unit * (float) ($m->inventoryItem?->cost ?? 0));
    }
}
