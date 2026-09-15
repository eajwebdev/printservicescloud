<?php

namespace App\Services;

use App\Models\Product;
use App\Models\Service;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Turns raw cart lines from the POS or the quotation builder into priced lines
 * and order totals. It never touches stock or money.
 */
class CartBuilder
{
    public function __construct(private Pricing $pricing) {}

    /**
     * @param  array<int, array<string, mixed>>  $lines
     * @return array{lines: Collection<int, array<string, mixed>>, totals: array<string, float>, cost_total: float}
     */
    public function build(array $lines, ?string $discountType, float $discountValue, bool $seniorPwd, bool $allowDiscounts = true): array
    {
        $productIds = collect($lines)->where('item_type', 'product')->pluck('item_id')->all();
        $serviceIds = collect($lines)->where('item_type', 'service')->pluck('item_id')->all();
        $products = Product::query()->with('inventoryItem')->whereIn('id', $productIds)->get()->keyBy('id');
        $services = Service::query()->with(['category', 'options', 'materials.inventoryItem'])->whereIn('id', $serviceIds)->get()->keyBy('id');

        $priced = collect($lines)->values()->map(function (array $line, int $i) use ($products, $services, $allowDiscounts) {
            $qty = (float) $line['qty'];
            $type = $line['item_type'];

            if ($type === 'product') {
                $product = $products->get($line['item_id']);
                if (! $product || ! $product->active) {
                    throw ValidationException::withMessages(["lines.$i.item_id" => 'That product is no longer sold. Remove it from the cart.']);
                }
                $result = $this->pricing->product($product, $qty);
                $name = $product->name;
                $category = $product->category;
                $model = $product;
            } else {
                $service = $services->get($line['item_id']);
                if (! $service || ! $service->active) {
                    throw ValidationException::withMessages(["lines.$i.item_id" => 'That service is switched off. Remove it from the cart.']);
                }
                if ($service->pricing_model === 'per_sqft' && (float) ($line['spec']['width'] ?? 0) <= 0) {
                    throw ValidationException::withMessages(["lines.$i.spec" => "Enter a width and height for {$service->name}."]);
                }
                $result = $this->pricing->service($service, $qty, $line['spec'] ?? []);
                $name = $service->name;
                $category = $service->category?->name;
                $model = $service;
            }

            $discountType = $allowDiscounts ? ($line['discount_type'] ?? null) : null;
            $discountValue = $allowDiscounts ? (float) ($line['discount_value'] ?? 0) : 0;
            $discount = Pricing::discountAmount($result['gross'], $discountType, $discountValue);

            return [
                'item_type' => $type,
                'item_id' => (int) $line['item_id'],
                'model' => $model,
                'name' => $name,
                'category' => $category,
                'spec' => $result['spec'],
                'qty' => $qty,
                'unit_price' => $result['unit_price'],
                'gross' => $result['gross'],
                'discount_type' => $discount > 0 ? $discountType : null,
                'discount_value' => $discount > 0 ? $discountValue : 0,
                'discount_amount' => $discount,
                'line_total' => round($result['gross'] - $discount, 2),
                'cost_total' => $result['cost'],
                'note' => $line['note'] ?? null,
            ];
        });

        $totals = $this->pricing->totals(
            (float) $priced->sum('line_total'),
            $allowDiscounts ? $discountType : null,
            $allowDiscounts ? $discountValue : 0,
            $seniorPwd,
        );

        return ['lines' => $priced, 'totals' => $totals, 'cost_total' => round((float) $priced->sum('cost_total'), 2)];
    }

    /** Strip the model before persisting a priced line. */
    public static function row(array $line, array $only = []): array
    {
        unset($line['model']);

        return $only ? array_intersect_key($line, array_flip($only)) : $line;
    }
}
