<?php

namespace App\Services;

use App\Models\Product;
use App\Models\Service;
use App\Models\Setting;

/**
 * Server-side price engine. resources/js/lib/pricing.ts mirrors this exactly so
 * the POS can live-calculate; the server result is always the one that's saved.
 */
class Pricing
{
    public const SQ_IN_PER_SQFT = 144;

    public const SQ_CM_PER_SQFT = 929.0304;

    public static function toSqft(float $width, float $height, string $unit): float
    {
        $area = max(0, $width) * max(0, $height);

        return match ($unit) {
            'in' => $area / self::SQ_IN_PER_SQFT,
            'cm' => $area / self::SQ_CM_PER_SQFT,
            default => $area,
        };
    }

    /**
     * @param  array{width?: float|string|null, height?: float|string|null, unit?: string|null, option_ids?: array<int>, rush?: bool}  $spec
     * @return array{sqft: float, unit_price: float, gross: float, cost: float, spec: array}
     */
    public function service(Service $service, float $qty, array $spec): array
    {
        $service->loadMissing(['options', 'materials.inventoryItem']);
        $qty = max($qty, 0);
        $unit = in_array($spec['unit'] ?? null, ['ft', 'in', 'cm'], true) ? $spec['unit'] : 'ft';
        $width = (float) ($spec['width'] ?? 0);
        $height = (float) ($spec['height'] ?? 0);
        $sqft = $service->pricing_model === 'per_sqft' ? round(self::toSqft($width, $height, $unit), 4) : 0.0;

        $basePerPiece = match ($service->pricing_model) {
            'per_sqft' => max($sqft * (float) $service->base_price, (float) $service->min_charge),
            'tiered' => $this->tierPrice($service, $qty),
            default => (float) $service->base_price,
        };

        $optionIds = array_map('intval', $spec['option_ids'] ?? []);
        $chosen = $service->options->where('active', true)->whereIn('id', $optionIds);
        $perPieceOptions = 0.0;
        $flatOptions = 0.0;
        foreach ($chosen as $option) {
            $price = (float) $option->price;
            match ($option->price_type) {
                'per_piece' => $perPieceOptions += $price,
                'per_sqft' => $perPieceOptions += $price * $sqft,
                'percent' => $perPieceOptions += $basePerPiece * $price / 100,
                'flat' => $flatOptions += $price,
            };
        }

        $gross = $service->pricing_model === 'fixed'
            ? $basePerPiece + $perPieceOptions * $qty + $flatOptions
            : ($basePerPiece + $perPieceOptions) * $qty + $flatOptions;

        $rush = (bool) ($spec['rush'] ?? false);
        if ($rush) {
            $gross *= 1 + ((float) Setting::get('rush_fee_percent', 30)) / 100;
        }

        $gross = round($gross, 2);

        return [
            'sqft' => $sqft,
            'unit_price' => $qty > 0 ? round($gross / $qty, 2) : 0.0,
            'gross' => $gross,
            'cost' => round($this->serviceCost($service, $qty, $sqft), 2),
            'spec' => [
                'width' => $service->pricing_model === 'per_sqft' ? $width : null,
                'height' => $service->pricing_model === 'per_sqft' ? $height : null,
                'unit' => $service->pricing_model === 'per_sqft' ? $unit : null,
                'sqft' => $sqft,
                'rush' => $rush,
                'options' => $chosen->map(fn ($o) => ['id' => $o->id, 'name' => $o->name])->values()->all(),
                'option_ids' => $chosen->pluck('id')->values()->all(),
                'pricing_model' => $service->pricing_model,
            ],
        ];
    }

    public function product(Product $product, float $qty): array
    {
        $gross = round((float) $product->price * $qty, 2);

        return [
            'sqft' => 0.0,
            'unit_price' => (float) $product->price,
            'gross' => $gross,
            'cost' => round((float) $product->cost * $qty, 2),
            'spec' => null,
        ];
    }

    public static function discountAmount(float $gross, ?string $type, float $value): float
    {
        $amount = match ($type) {
            'percent' => $gross * min(max($value, 0), 100) / 100,
            'amount' => max($value, 0),
            default => 0,
        };

        return round(min($amount, $gross), 2);
    }

    /**
     * Order-level totals from line totals.
     *
     * @return array{subtotal: float, discount_amount: float, senior_pwd_discount: float, discount_total: float, tax_total: float, total: float}
     */
    public function totals(float $subtotal, ?string $discountType, float $discountValue, bool $seniorPwd): array
    {
        $subtotal = round($subtotal, 2);
        $orderDiscount = self::discountAmount($subtotal, $discountType, $discountValue);
        $afterDiscount = $subtotal - $orderDiscount;
        $seniorDiscount = $seniorPwd ? round($afterDiscount * ((float) Setting::get('senior_pwd_percent', 20)) / 100, 2) : 0.0;
        $taxable = $afterDiscount - $seniorDiscount;

        $taxRate = (float) Setting::get('tax_rate', 0);
        $taxMode = Setting::get('tax_mode', 'none');
        $tax = match ($taxMode) {
            'exclusive' => round($taxable * $taxRate / 100, 2),
            'inclusive' => round($taxable - $taxable / (1 + $taxRate / 100), 2),
            default => 0.0,
        };

        return [
            'subtotal' => $subtotal,
            'discount_amount' => $orderDiscount,
            'senior_pwd_discount' => $seniorDiscount,
            'discount_total' => round($orderDiscount + $seniorDiscount, 2),
            'tax_total' => $tax,
            'total' => round($taxable + ($taxMode === 'exclusive' ? $tax : 0), 2),
        ];
    }

    private function tierPrice(Service $service, float $qty): float
    {
        $price = (float) $service->base_price;
        $tiers = collect($service->tiers ?? [])->sortBy('min_qty');
        foreach ($tiers as $tier) {
            if ($qty >= (float) $tier['min_qty']) {
                $price = (float) $tier['price'];
            }
        }

        return $price;
    }

    private function serviceCost(Service $service, float $qty, float $sqft): float
    {
        if ($service->materials->isNotEmpty()) {
            return $service->materials->sum(function ($m) use ($qty, $sqft) {
                return self::materialQty($m->basis, (float) $m->qty_per_unit, $qty, $sqft) * (float) ($m->inventoryItem?->cost ?? 0);
            });
        }

        return (float) $service->cost * ($service->pricing_model === 'per_sqft' ? $sqft * $qty : $qty);
    }

    public static function materialQty(string $basis, float $perUnit, float $qty, float $sqft): float
    {
        return round($basis === 'per_sqft' ? $perUnit * $sqft * $qty : $perUnit * $qty, 3);
    }
}
