import { useCallback, useMemo, useState } from 'react';
import { cartTotals, newLineKey, priceLine } from '@/lib/pricing';
import type { CartLine, Catalog, CatalogProduct, CustomerLite, DiscountType, ShopProps } from '@/types';

export interface CartState {
    lines: CartLine[];
    customer: CustomerLite | null;
    type: 'instant' | 'job';
    discount_type: DiscountType;
    discount_value: number;
    senior_pwd: boolean;
    notes: string;
    quotation_id: number | null;
}

export const emptyCart = (): CartState => ({
    lines: [],
    customer: null,
    type: 'instant',
    discount_type: null,
    discount_value: 0,
    senior_pwd: false,
    notes: '',
    quotation_id: null,
});

export function useCart(catalog: Catalog, shop: ShopProps, initial: CartState, allowDiscounts: boolean) {
    const [cart, setCart] = useState<CartState>(initial);

    const priced = useMemo(() => cart.lines.map((l) => priceLine(l, catalog, shop, allowDiscounts)), [cart.lines, catalog, shop, allowDiscounts]);
    const totals = useMemo(
        () => cartTotals(priced, cart.discount_type, cart.discount_value, cart.senior_pwd, shop, allowDiscounts),
        [priced, cart.discount_type, cart.discount_value, cart.senior_pwd, shop, allowDiscounts],
    );

    const addProduct = useCallback((p: CatalogProduct, qty = 1) => {
        setCart((c) => {
            const existing = c.lines.find((l) => l.item_type === 'product' && l.item_id === p.id);
            if (existing) {
                return { ...c, lines: c.lines.map((l) => (l.key === existing.key ? { ...l, qty: Number(l.qty) + qty } : l)) };
            }
            return {
                ...c,
                lines: [...c.lines, { key: newLineKey(), item_type: 'product', item_id: p.id, qty, spec: {}, discount_type: null, discount_value: 0, note: '' }],
            };
        });
    }, []);

    /** Add a configured service line; identical simple services (no size, no options) stack. */
    const upsertService = useCallback((line: Omit<CartLine, 'key'> & { key?: string }) => {
        setCart((c) => {
            if (line.key) {
                return { ...c, lines: c.lines.map((l) => (l.key === line.key ? ({ ...l, ...line } as CartLine) : l)) };
            }
            const simple = !line.spec.width && !(line.spec.option_ids ?? []).length && !line.spec.rush;
            const twin = simple && c.lines.find((l) => l.item_type === 'service' && l.item_id === line.item_id && !l.spec.width && !(l.spec.option_ids ?? []).length && !l.spec.rush);
            if (twin) {
                return { ...c, lines: c.lines.map((l) => (l.key === twin.key ? { ...l, qty: Number(l.qty) + Number(line.qty) } : l)) };
            }
            return { ...c, lines: [...c.lines, { ...line, key: newLineKey() } as CartLine] };
        });
    }, []);

    const updateLine = useCallback((key: string, patch: Partial<CartLine>) => {
        setCart((c) => ({ ...c, lines: c.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
    }, []);

    const removeLine = useCallback((key: string) => setCart((c) => ({ ...c, lines: c.lines.filter((l) => l.key !== key) })), []);

    const patch = useCallback((p: Partial<CartState>) => setCart((c) => ({ ...c, ...p })), []);

    return { cart, setCart, priced, totals, addProduct, upsertService, updateLine, removeLine, patch };
}
