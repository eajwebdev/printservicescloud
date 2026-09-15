import { Search } from 'lucide-react';
import { forwardRef, useMemo, useState, type KeyboardEvent } from 'react';
import { Segmented } from '@/components/ui/toggle';
import { Kbd } from '@/components/ui/misc';
import { money, qty } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Catalog, CatalogProduct, CatalogService } from '@/types';

export function servicePriceHint(s: CatalogService): string {
    switch (s.pricing_model) {
        case 'per_sqft':
            return `₱${money(s.base_price)} / sqft`;
        case 'tiered': {
            const low = Math.min(s.base_price, ...s.tiers.map((t) => t.price));
            return `from ₱${money(low)} / ${s.unit_label}`;
        }
        case 'fixed':
            return `₱${money(s.base_price)} flat`;
        default:
            return `₱${money(s.base_price)} / ${s.unit_label}`;
    }
}

interface Props {
    catalog: Catalog;
    onProduct: (p: CatalogProduct) => void;
    onService: (s: CatalogService) => void;
    onScanMiss?: (code: string) => void;
    compact?: boolean;
}

/** One search box, one tabbed picker. Enter on an exact SKU or barcode adds the product (scanner friendly). */
export const CatalogPicker = forwardRef<HTMLInputElement, Props>(function CatalogPicker({ catalog, onProduct, onService, onScanMiss, compact }, ref) {
    const [tab, setTab] = useState<'services' | 'products'>('services');
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<string>('all');

    const q = query.trim().toLowerCase();

    const services = useMemo(
        () =>
            catalog.services.filter(
                (s) =>
                    (category === 'all' || String(s.category_id) === category) &&
                    (!q || s.name.toLowerCase().includes(q) || (s.code ?? '').toLowerCase().includes(q) || (s.category ?? '').toLowerCase().includes(q)),
            ),
        [catalog.services, category, q],
    );

    const productCategories = useMemo(() => [...new Set(catalog.products.map((p) => p.category).filter(Boolean))] as string[], [catalog.products]);

    const products = useMemo(
        () =>
            catalog.products.filter(
                (p) =>
                    (category === 'all' || p.category === category) &&
                    (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode ?? '').includes(q)),
            ),
        [catalog.products, category, q],
    );

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter' || !q) return;
        e.preventDefault();
        const exact = catalog.products.find((p) => p.barcode === query.trim() || p.sku.toLowerCase() === q);
        if (exact) {
            onProduct(exact);
            setQuery('');
            return;
        }
        const list = tab === 'services' ? services : products;
        if (list.length === 1) {
            if (tab === 'services') onService(list[0] as CatalogService);
            else onProduct(list[0] as CatalogProduct);
            setQuery('');
            return;
        }
        // Nothing on this tab: try the other before giving up.
        if (tab === 'services' && services.length === 0 && products.length > 0) setTab('products');
        else if (tab === 'products' && products.length === 0 && services.length > 0) setTab('services');
        else if (!list.length) onScanMiss?.(query.trim());
    };

    const categories =
        tab === 'services'
            ? catalog.categories.filter((c) => catalog.services.some((s) => s.category_id === c.id)).map((c) => ({ value: String(c.id), label: c.name }))
            : productCategories.map((c) => ({ value: c, label: c }));

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="space-y-3 border-b border-line p-3">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-52 flex-1">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
                        <input
                            ref={ref}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={onKeyDown}
                            placeholder="Search or scan a barcode"
                            aria-label="Search services and products, or scan a barcode"
                            className="h-10 w-full rounded-xs border border-line bg-sunken pr-10 pl-9 text-base text-fg placeholder:text-ghost focus-visible:border-red-400 focus-visible:shadow-[0_0_0_1px_var(--red-400)]"
                        />
                        <Kbd className="absolute top-1/2 right-2 -translate-y-1/2">/</Kbd>
                    </div>
                    <Segmented
                        label="Catalog"
                        value={tab}
                        onChange={(v) => {
                            setTab(v);
                            setCategory('all');
                        }}
                        size="lg"
                        options={[
                            { value: 'services', label: `Services ${catalog.services.length}` },
                            { value: 'products', label: `Products ${catalog.products.length}` },
                        ]}
                    />
                </div>
                <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5" role="tablist" aria-label="Categories">
                    {[{ value: 'all', label: 'All' }, ...categories].map((c) => (
                        <button
                            key={c.value}
                            type="button"
                            role="tab"
                            aria-selected={category === c.value}
                            onClick={() => setCategory(c.value)}
                            className={cn(
                                'h-7 shrink-0 rounded-xs border px-2.5 text-sm whitespace-nowrap transition-colors',
                                category === c.value ? 'border-fg bg-fg text-bg' : 'border-line text-muted hover:border-line-strong hover:text-fg',
                            )}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="@container min-h-0 flex-1 overflow-y-auto">
                {tab === 'services' ? (
                    services.length ? (
                        <ul className={cn('grid gap-px bg-line', compact ? 'grid-cols-1 @sm:grid-cols-2' : 'grid-cols-2 @3xl:grid-cols-3 @6xl:grid-cols-4')}>
                            {services.map((s) => (
                                <li key={s.id} className="bg-surface">
                                    <button
                                        type="button"
                                        onClick={() => onService(s)}
                                        className="group flex h-full min-h-[84px] w-full flex-col justify-between gap-2 px-3.5 py-3 text-left transition-colors hover:bg-raised focus-visible:bg-raised"
                                    >
                                        <span className="text-base leading-snug text-fg">{s.name}</span>
                                        <span className="flex items-end justify-between gap-2">
                                            <span className="num text-sm text-muted">{servicePriceHint(s)}</span>
                                            <span className="text-2xs text-faint">{s.category}</span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="halftone px-6 py-14 text-center text-base text-muted">No service called “{query}”. Check the spelling or look under Products.</p>
                    )
                ) : products.length ? (
                    <ul className={cn('grid gap-px bg-line', compact ? 'grid-cols-1 @sm:grid-cols-2' : 'grid-cols-2 @3xl:grid-cols-3 @6xl:grid-cols-4')}>
                        {products.map((p) => {
                            const out = p.stock <= 0;
                            const low = !out && p.stock <= p.reorder_level;
                            return (
                                <li key={p.id} className="bg-surface">
                                    <button
                                        type="button"
                                        onClick={() => onProduct(p)}
                                        disabled={out}
                                        className="flex h-full min-h-[84px] w-full flex-col justify-between gap-2 px-3.5 py-3 text-left transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <span className="text-base leading-snug text-fg">{p.name}</span>
                                        <span className="flex items-end justify-between gap-2">
                                            <span className="num text-sm text-muted">₱{money(p.price)}</span>
                                            <span className={cn('num text-2xs', out ? 'text-accent-text' : low ? 'text-warn-text' : 'text-faint')}>
                                                {out ? 'Out of stock' : `${qty(p.stock)} left`}
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p className="halftone px-6 py-14 text-center text-base text-muted">No product matches “{query}”. Scan again or search by name.</p>
                )}
            </div>
        </div>
    );
});
