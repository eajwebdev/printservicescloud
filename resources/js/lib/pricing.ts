/**
 * Client mirror of app/Services/Pricing.php. Keep the two in lockstep:
 * the POS shows these numbers live, the server recomputes and saves its own.
 */
import type { CartLine, Catalog, CatalogProduct, CatalogService, DiscountType, ShopProps, SizeUnit } from '@/types';
import { round2 } from './format';

export function toSqft(width: number, height: number, unit: SizeUnit | null | undefined): number {
    const area = Math.max(0, width || 0) * Math.max(0, height || 0);
    if (unit === 'in') return area / 144;
    if (unit === 'cm') return area / 929.0304;
    return area;
}

export function discountAmount(gross: number, type: DiscountType, value: number): number {
    let amount = 0;
    if (type === 'percent') amount = (gross * Math.min(Math.max(value || 0, 0), 100)) / 100;
    if (type === 'amount') amount = Math.max(value || 0, 0);
    return round2(Math.min(amount, gross));
}

export interface PricedLine {
    line: CartLine;
    name: string;
    category: string | null;
    sqft: number;
    unitPrice: number;
    gross: number;
    discount: number;
    total: number;
    product?: CatalogProduct;
    service?: CatalogService;
    missing: boolean;
    needsSize: boolean;
}

function tierPrice(service: CatalogService, qty: number): number {
    let price = service.base_price;
    [...service.tiers].sort((a, b) => a.min_qty - b.min_qty).forEach((t) => {
        if (qty >= t.min_qty) price = t.price;
    });
    return price;
}

export function priceService(service: CatalogService, qty: number, line: CartLine, shop: Pick<ShopProps, 'rush_fee_percent'>) {
    const spec = line.spec;
    const q = Math.max(qty || 0, 0);
    const sqft = service.pricing_model === 'per_sqft' ? Math.round(toSqft(Number(spec.width), Number(spec.height), spec.unit ?? 'ft') * 10000) / 10000 : 0;

    const basePerPiece =
        service.pricing_model === 'per_sqft'
            ? Math.max(sqft * service.base_price, service.min_charge)
            : service.pricing_model === 'tiered'
              ? tierPrice(service, q)
              : service.base_price;

    let perPiece = 0;
    let flat = 0;
    const chosen = service.options.filter((o) => (spec.option_ids ?? []).includes(o.id));
    for (const o of chosen) {
        if (o.price_type === 'per_piece') perPiece += o.price;
        if (o.price_type === 'per_sqft') perPiece += o.price * sqft;
        if (o.price_type === 'percent') perPiece += (basePerPiece * o.price) / 100;
        if (o.price_type === 'flat') flat += o.price;
    }

    let gross = service.pricing_model === 'fixed' ? basePerPiece + perPiece * q + flat : (basePerPiece + perPiece) * q + flat;
    if (spec.rush) gross *= 1 + shop.rush_fee_percent / 100;
    gross = round2(gross);

    return { sqft, gross, unitPrice: q > 0 ? round2(gross / q) : 0, basePerPiece: round2(basePerPiece) };
}

export function priceLine(line: CartLine, catalog: Pick<Catalog, 'products' | 'services'>, shop: Pick<ShopProps, 'rush_fee_percent'>, allowDiscounts = true): PricedLine {
    const qty = Number(line.qty) || 0;
    let base = { sqft: 0, gross: 0, unitPrice: 0 };
    let name = 'Unavailable item';
    let category: string | null = null;
    let product: CatalogProduct | undefined;
    let service: CatalogService | undefined;
    let needsSize = false;

    if (line.item_type === 'product') {
        product = catalog.products.find((p) => p.id === line.item_id);
        if (product) {
            base = { sqft: 0, gross: round2(product.price * qty), unitPrice: product.price };
            name = product.name;
            category = product.category;
        }
    } else {
        service = catalog.services.find((s) => s.id === line.item_id);
        if (service) {
            base = priceService(service, qty, line, shop);
            name = service.name;
            category = service.category;
            needsSize = service.pricing_model === 'per_sqft' && !(Number(line.spec.width) > 0 && Number(line.spec.height) > 0);
        }
    }

    const discount = allowDiscounts ? discountAmount(base.gross, line.discount_type, Number(line.discount_value)) : 0;

    return {
        line,
        name,
        category,
        sqft: base.sqft,
        unitPrice: base.unitPrice,
        gross: base.gross,
        discount,
        total: round2(base.gross - discount),
        product,
        service,
        missing: !product && !service,
        needsSize,
    };
}

export interface CartTotals {
    subtotal: number;
    orderDiscount: number;
    seniorDiscount: number;
    discountTotal: number;
    tax: number;
    total: number;
    lineDiscounts: number;
}

export function cartTotals(
    lines: PricedLine[],
    discountType: DiscountType,
    discountValue: number,
    seniorPwd: boolean,
    shop: Pick<ShopProps, 'senior_pwd_percent' | 'tax_rate' | 'tax_mode'>,
    allowDiscounts = true,
): CartTotals {
    const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
    const orderDiscount = allowDiscounts ? discountAmount(subtotal, discountType, discountValue) : 0;
    const after = subtotal - orderDiscount;
    const seniorDiscount = seniorPwd ? round2((after * shop.senior_pwd_percent) / 100) : 0;
    const taxable = after - seniorDiscount;
    const tax =
        shop.tax_mode === 'exclusive'
            ? round2((taxable * shop.tax_rate) / 100)
            : shop.tax_mode === 'inclusive'
              ? round2(taxable - taxable / (1 + shop.tax_rate / 100))
              : 0;

    return {
        subtotal,
        orderDiscount,
        seniorDiscount,
        discountTotal: round2(orderDiscount + seniorDiscount),
        tax,
        total: round2(taxable + (shop.tax_mode === 'exclusive' ? tax : 0)),
        lineDiscounts: round2(lines.reduce((s, l) => s + l.discount, 0)),
    };
}

let seq = 0;
export function newLineKey(): string {
    seq += 1;
    return `l${Date.now().toString(36)}${seq}`;
}

/** Strip client-only fields before posting lines to Laravel. */
export function serializeLines(lines: CartLine[]) {
    return lines.map((l) => ({
        item_type: l.item_type,
        item_id: l.item_id,
        qty: Number(l.qty),
        spec:
            l.item_type === 'service'
                ? {
                      width: l.spec.width ?? null,
                      height: l.spec.height ?? null,
                      unit: l.spec.unit ?? null,
                      option_ids: l.spec.option_ids ?? [],
                      rush: !!l.spec.rush,
                  }
                : null,
        discount_type: l.discount_type,
        discount_value: Number(l.discount_value) || 0,
        note: l.note || null,
    }));
}
