import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { CartLines } from '@/components/pos/cart-lines';
import { CatalogPicker } from '@/components/pos/catalog-picker';
import { ServiceSpecModal } from '@/components/pos/service-spec-modal';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { ErrorText, Field, Input, MoneyInput, Select, Textarea } from '@/components/ui/field';
import { AnimatedMoney } from '@/components/ui/misc';
import { emptyCart, useCart } from '@/hooks/use-cart';
import { peso } from '@/lib/format';
import { newLineKey, serializeLines } from '@/lib/pricing';
import { useAppPage } from '@/lib/utils';
import type { CartLine, Catalog, CatalogService, DiscountType } from '@/types';

interface QuoteLine extends Omit<CartLine, 'key' | 'note'> {
    note: string | null;
}

interface Props {
    quotation: {
        id: number;
        quote_no: string;
        customer_id: number | null;
        customer_name: string | null;
        customer: string;
        valid_until: string | null;
        discount_type: DiscountType;
        discount_value: number;
        notes: string | null;
        lines: QuoteLine[];
    } | null;
    catalog: Catalog;
    defaultValidUntil: string | null;
}

export default function QuotationForm({ quotation, catalog, defaultValidUntil }: Props) {
    const { props } = useAppPage();
    const shop = props.shop;
    const { cart, priced, totals, addProduct, upsertService, updateLine, removeLine, patch } = useCart(
        catalog,
        shop,
        {
            ...emptyCart(),
            discount_type: quotation?.discount_type ?? null,
            discount_value: quotation?.discount_value ?? 0,
            lines: (quotation?.lines ?? []).map((l) => ({ ...l, key: newLineKey(), spec: l.spec ?? {}, note: l.note ?? '' })),
        },
        true,
    );
    const [customerMode, setCustomerMode] = useState<'name' | 'account'>(quotation?.customer_id ? 'account' : 'name');
    const [customerName, setCustomerName] = useState(quotation?.customer_name ?? (quotation?.customer_id ? '' : ''));
    const [customerId, setCustomerId] = useState<string>(quotation?.customer_id ? String(quotation.customer_id) : '');
    const [customerOptions, setCustomerOptions] = useState<{ id: number; name: string }[]>(quotation?.customer_id ? [{ id: quotation.customer_id, name: quotation.customer }] : []);
    const [validUntil, setValidUntil] = useState(quotation?.valid_until ?? defaultValidUntil ?? '');
    const [notes, setNotes] = useState(quotation?.notes ?? '');
    const [specFor, setSpecFor] = useState<{ service: CatalogService; line: CartLine | null } | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const lookup = (q: string) =>
        fetch(`${route('pos.customers.search')}?q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
            .then((r) => (r.ok ? r.json() : { customers: [] }))
            .then((d: { customers: { id: number; name: string }[] }) => setCustomerOptions(d.customers))
            .catch(() => {});

    const save = (status: 'draft' | 'sent') => {
        setSaving(true);
        const data = {
            customer_id: customerMode === 'account' && customerId ? Number(customerId) : null,
            customer_name: customerMode === 'name' ? customerName : null,
            valid_until: validUntil || null,
            lines: serializeLines(cart.lines),
            discount_type: cart.discount_type,
            discount_value: cart.discount_value,
            notes,
            status,
        };
        const opts = { onError: (e: Record<string, string>) => setErrors(e), onFinish: () => setSaving(false) };
        if (quotation) router.put(route('quotations.update', quotation.id), data, opts);
        else router.post(route('quotations.store'), data, opts);
    };

    const onService = (s: CatalogService) => {
        if (s.pricing_model !== 'per_sqft' && s.options.length === 0) {
            upsertService({ item_type: 'service', item_id: s.id, qty: 1, spec: {}, discount_type: null, discount_value: 0, note: '' });
        } else setSpecFor({ service: s, line: null });
    };

    return (
        <>
            <Head title={quotation ? `Edit ${quotation.quote_no}` : 'New quotation'} />
            <PageHeader
                back={{ href: quotation ? route('quotations.show', quotation.id) : route('quotations.index'), label: quotation ? quotation.quote_no : 'Quotations' }}
                title={quotation ? `Edit ${quotation.quote_no}` : 'New quotation'}
                description="Build it like an order. Prices use today's catalog; stock isn't touched."
                actions={
                    <>
                        <Button onClick={() => save('draft')} loading={saving} disabled={!cart.lines.length}>
                            Save draft
                        </Button>
                        <Button variant="primary" onClick={() => save('sent')} loading={saving} disabled={!cart.lines.length}>
                            Save as sent
                        </Button>
                    </>
                }
            />
            <div className="grid min-h-[calc(100dvh-10rem)] grid-cols-1 lg:grid-cols-[1fr_440px]">
                <section className="h-[calc(100dvh-10rem)] min-w-0 border-r border-line bg-surface max-lg:h-[60vh]">
                    <CatalogPicker catalog={catalog} onProduct={(p) => addProduct(p)} onService={onService} />
                </section>
                <section className="flex min-w-0 flex-col">
                    <div className="space-y-3 border-b border-line bg-surface p-4">
                        <div className="flex gap-1">
                            {(['name', 'account'] as const).map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setCustomerMode(m)}
                                    className={m === customerMode ? 'h-7 rounded-xs border border-accent bg-selected px-2.5 text-sm text-fg' : 'h-7 rounded-xs border border-line px-2.5 text-sm text-muted'}
                                >
                                    {m === 'name' ? 'Prospect name' : 'Existing customer'}
                                </button>
                            ))}
                        </div>
                        {customerMode === 'name' ? (
                            <Field label="Prepared for" error={errors.customer_name}>
                                {(id, d) => <Input id={id} aria-describedby={d} placeholder="e.g. Hacienda Luisa Resort" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />}
                            </Field>
                        ) : (
                            <Field label="Customer" error={errors.customer_id}>
                                {(id, d) => (
                                    <div className="flex gap-2">
                                        <Input aria-label="Find customer" placeholder="Search" className="w-36" onChange={(e) => lookup(e.target.value)} onFocus={(e) => lookup(e.target.value)} />
                                        <Select id={id} aria-describedby={d} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                                            <option value="">Pick a customer</option>
                                            {customerOptions.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name}
                                                </option>
                                            ))}
                                        </Select>
                                    </div>
                                )}
                            </Field>
                        )}
                        <Field label="Valid until">{(id) => <Input id={id} type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />}</Field>
                    </div>
                    <div className="min-h-48 flex-1 overflow-y-auto bg-surface">
                        <CartLines
                            lines={priced}
                            canDiscount
                            onUpdate={updateLine}
                            onRemove={removeLine}
                            onEditService={(line) => {
                                const s = catalog.services.find((x) => x.id === line.item_id);
                                if (s) setSpecFor({ service: s, line });
                            }}
                            emptyText="Pick services and products on the left to price this quote."
                        />
                    </div>
                    <div className="space-y-3 border-t border-line bg-surface p-4">
                        <div className="grid grid-cols-[130px_1fr] gap-2">
                            <Select
                                aria-label="Quote discount type"
                                value={cart.discount_type ?? ''}
                                onChange={(e) => patch({ discount_type: (e.target.value || null) as DiscountType, discount_value: e.target.value ? cart.discount_value : 0 })}
                            >
                                <option value="">No discount</option>
                                <option value="percent">Percent off</option>
                                <option value="amount">Peso off</option>
                            </Select>
                            {cart.discount_type && (
                                cart.discount_type === 'percent' ? (
                                    <Input type="number" min={0} max={100} suffix="%" aria-label="Discount percent" value={cart.discount_value || ''} onChange={(e) => patch({ discount_value: Number(e.target.value) })} />
                                ) : (
                                    <MoneyInput aria-label="Discount amount" value={cart.discount_value || ''} onChange={(e) => patch({ discount_value: Number(e.target.value) })} />
                                )
                            )}
                        </div>
                        <Field label="Notes on the quote">{(id) => <Textarea id={id} className="min-h-16" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Delivery, file source, inclusions" />}</Field>
                        <div className="flex items-end justify-between border-t border-line pt-3">
                            <div className="text-sm text-muted">
                                Subtotal {peso(totals.subtotal)}
                                {totals.discountTotal > 0 && <span className="block">Discount −{peso(totals.discountTotal)}</span>}
                            </div>
                            <AnimatedMoney value={totals.total} className="hud text-3xl font-semibold" />
                        </div>
                        <ErrorText>{errors.lines}</ErrorText>
                    </div>
                </section>
            </div>
            <ServiceSpecModal service={specFor?.service ?? null} editing={specFor?.line} shop={shop} onClose={() => setSpecFor(null)} onSave={upsertService} />
        </>
    );
}
