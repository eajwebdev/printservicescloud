import { Head, router, useForm } from '@inertiajs/react';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button, IconButton } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { ErrorText, Field, Input, MoneyInput, Select, Textarea } from '@/components/ui/field';
import { Panel } from '@/components/ui/misc';
import { Segmented, Switch } from '@/components/ui/toggle';
import { money, peso, PRICING_LABEL, qty } from '@/lib/format';
import { priceService } from '@/lib/pricing';
import { useAppPage, useCan } from '@/lib/utils';
import type { CatalogService, Option, OptionPriceType, PricingModel } from '@/types';

interface Material {
    id: number;
    name: string;
    unit: string;
    cost: number;
    stock: number;
}

interface ServiceData {
    id: number;
    service_category_id: number;
    name: string;
    code: string | null;
    pricing_model: PricingModel;
    base_price: number;
    cost: number;
    min_charge: number;
    unit_label: string;
    is_job: boolean;
    lead_time_hours: number;
    active: boolean;
    description: string | null;
    tiers: { min_qty: number; price: number }[];
    options: { id?: number; name: string; price_type: OptionPriceType; price: number; active: boolean }[];
    materials: { inventory_item_id: number; qty_per_unit: number; basis: 'per_sqft' | 'per_piece' }[];
}

export default function ServiceForm({ service, categories, materials }: { service: ServiceData | null; categories: Option[]; materials: Material[] }) {
    const can = useCan();
    const { props } = useAppPage();
    const [deleting, setDeleting] = useState(false);
    const form = useForm({
        service_category_id: service?.service_category_id ?? categories[0]?.id ?? '',
        name: service?.name ?? '',
        code: service?.code ?? '',
        pricing_model: (service?.pricing_model ?? 'per_piece') as PricingModel,
        base_price: service ? String(service.base_price) : '',
        cost: service ? String(service.cost) : '',
        min_charge: service ? String(service.min_charge) : '',
        unit_label: service?.unit_label ?? 'pc',
        is_job: service?.is_job ?? false,
        lead_time_hours: service ? String(service.lead_time_hours) : '0',
        active: service?.active ?? true,
        description: service?.description ?? '',
        tiers: (service?.tiers ?? []).map((t) => ({ min_qty: String(t.min_qty), price: String(t.price) })),
        options: (service?.options ?? []).map((o) => ({ ...o, price: String(o.price) })),
        materials: (service?.materials ?? []).map((m) => ({ ...m, qty_per_unit: String(m.qty_per_unit) })),
    });
    const d = form.data;
    const isArea = d.pricing_model === 'per_sqft';

    // Preview: one typical piece priced through the same engine the POS uses.
    const [preview, setPreview] = useState({ width: '3', height: '5', qty: '1' });
    const previewService: CatalogService = {
        id: 0,
        name: d.name,
        code: null,
        category_id: Number(d.service_category_id),
        category: null,
        pricing_model: d.pricing_model,
        base_price: Number(d.base_price) || 0,
        min_charge: Number(d.min_charge) || 0,
        tiers: d.tiers.map((t) => ({ min_qty: Number(t.min_qty) || 0, price: Number(t.price) || 0 })),
        unit_label: d.unit_label,
        is_job: d.is_job,
        lead_time_hours: 0,
        options: [],
    };
    const priced = priceService(previewService, Number(preview.qty) || 0, { key: 'p', item_type: 'service', item_id: 0, qty: Number(preview.qty), spec: { width: Number(preview.width), height: Number(preview.height), unit: 'ft' }, discount_type: null, discount_value: 0, note: '' }, props.shop);
    const materialCost = d.materials.reduce((s, m) => {
        const item = materials.find((x) => x.id === Number(m.inventory_item_id));
        const per = Number(m.qty_per_unit) || 0;
        const use = m.basis === 'per_sqft' ? per * priced.sqft * (Number(preview.qty) || 0) : per * (Number(preview.qty) || 0);
        return s + use * (item?.cost ?? 0);
    }, 0);
    const cost = d.materials.length ? materialCost : (Number(d.cost) || 0) * (isArea ? priced.sqft : 1) * (Number(preview.qty) || 0);

    const submit = () => {
        form.transform((x) => ({
            ...x,
            code: x.code || null,
            cost: x.cost || 0,
            min_charge: x.min_charge || 0,
            lead_time_hours: x.lead_time_hours || 0,
            tiers: x.pricing_model === 'tiered' ? x.tiers : [],
        }));
        if (service) form.put(route('services.update', service.id));
        else form.post(route('services.store'));
    };

    const errorFor = (prefix: string) => Object.entries(form.errors).find(([k]) => k.startsWith(prefix))?.[1];

    return (
        <>
            <Head title={service ? `Edit ${service.name}` : 'New service'} />
            <PageHeader
                back={{ href: route('services.index'), label: 'Services' }}
                title={service ? service.name : 'New service'}
                actions={
                    <>
                        {service && can('services.delete') && (
                            <Button variant="danger" onClick={() => setDeleting(true)}>
                                Delete
                            </Button>
                        )}
                        <Button variant="primary" onClick={submit} loading={form.processing}>
                            {service ? 'Save service' : 'Add service'}
                        </Button>
                    </>
                }
            />
            <form
                className="grid gap-5 p-5 lg:p-6 xl:grid-cols-[1fr_360px]"
                onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                }}
            >
                <div className="min-w-0 space-y-5">
                    <Panel title="Basics" bodyClass="grid gap-4 p-5 sm:grid-cols-2">
                        <Field label="Name" error={form.errors.name} className="sm:col-span-2">
                            {(id, e) => <Input id={id} aria-describedby={e} value={d.name} onChange={(ev) => form.setData('name', ev.target.value)} />}
                        </Field>
                        <Field label="Category" error={form.errors.service_category_id}>
                            {(id) => (
                                <Select id={id} value={d.service_category_id} onChange={(e) => form.setData('service_category_id', Number(e.target.value))}>
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </Select>
                            )}
                        </Field>
                        <Field label="Short code" hint="Optional" error={form.errors.code}>
                            {(id, e) => <Input id={id} aria-describedby={e} className="font-mono uppercase" value={d.code} onChange={(ev) => form.setData('code', ev.target.value.toUpperCase())} />}
                        </Field>
                        <Field label="Description" hint="Optional" className="sm:col-span-2">
                            {(id) => <Textarea id={id} className="min-h-16" value={d.description} onChange={(e) => form.setData('description', e.target.value)} />}
                        </Field>
                    </Panel>

                    <Panel title="Pricing" bodyClass="space-y-4 p-5">
                        <Segmented
                            label="Pricing model"
                            value={d.pricing_model}
                            onChange={(v) => {
                                form.setData((x) => ({ ...x, pricing_model: v, unit_label: v === 'per_sqft' ? 'sqft' : v === 'fixed' ? 'job' : x.unit_label === 'sqft' ? 'pc' : x.unit_label, tiers: v === 'tiered' && !x.tiers.length ? [{ min_qty: '1', price: x.base_price }] : x.tiers }));
                            }}
                            options={(['per_sqft', 'per_piece', 'tiered', 'fixed'] as PricingModel[]).map((m) => ({ value: m, label: PRICING_LABEL[m] }))}
                            className="flex w-full flex-wrap"
                        />
                        <p className="text-sm text-muted">
                            {
                                {
                                    per_sqft: 'Width × height in square feet × rate, with a minimum per piece. Tarpaulins, stickers, signage.',
                                    per_piece: 'A fixed price for each piece or page. Print-outs, lamination, IDs.',
                                    tiered: 'The price per piece drops at quantity breaks. Photocopy, invitations, mugs.',
                                    fixed: 'One price for the whole line no matter the quantity. Layout and design fees.',
                                }[d.pricing_model]
                            }
                        </p>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <Field label={isArea ? 'Rate per sq ft' : d.pricing_model === 'fixed' ? 'Price' : 'Base price per piece'} error={form.errors.base_price}>
                                {(id, e) => <MoneyInput id={id} aria-describedby={e} value={d.base_price} onChange={(ev) => form.setData('base_price', ev.target.value)} />}
                            </Field>
                            {isArea && (
                                <Field label="Minimum per piece" error={form.errors.min_charge}>
                                    {(id, e) => <MoneyInput id={id} aria-describedby={e} value={d.min_charge} onChange={(ev) => form.setData('min_charge', ev.target.value)} />}
                                </Field>
                            )}
                            {!isArea && d.pricing_model !== 'fixed' && (
                                <Field label="Unit label" hint="pc, page, set, box">
                                    {(id) => <Input id={id} value={d.unit_label} onChange={(e) => form.setData('unit_label', e.target.value)} />}
                                </Field>
                            )}
                            <Field label={isArea ? 'Cost per sq ft' : 'Cost per piece'} hint={d.materials.length ? 'Recipe overrides this' : 'Without a recipe'} error={form.errors.cost}>
                                {(id, e) => <MoneyInput id={id} aria-describedby={e} value={d.cost} disabled={d.materials.length > 0} onChange={(ev) => form.setData('cost', ev.target.value)} />}
                            </Field>
                        </div>

                        {d.pricing_model === 'tiered' && (
                            <div>
                                <p className="mb-2 text-sm font-medium text-muted">Quantity breaks</p>
                                <div className="space-y-2">
                                    {d.tiers.map((t, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <Input type="number" min={1} aria-label="From quantity" className="num w-28" value={t.min_qty} onChange={(e) => form.setData('tiers', d.tiers.map((x, j) => (j === i ? { ...x, min_qty: e.target.value } : x)))} />
                                            <span className="text-sm text-faint">pcs and up at</span>
                                            <MoneyInput aria-label="Price each" className="w-32" value={t.price} onChange={(e) => form.setData('tiers', d.tiers.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
                                            <IconButton label="Remove break" onClick={() => form.setData('tiers', d.tiers.filter((_, j) => j !== i))}>
                                                <Trash2 />
                                            </IconButton>
                                        </div>
                                    ))}
                                    <Button size="sm" variant="quiet" icon={<Plus />} onClick={() => form.setData('tiers', [...d.tiers, { min_qty: '', price: '' }])}>
                                        Add break
                                    </Button>
                                    <ErrorText>{form.errors.tiers ?? errorFor('tiers.')}</ErrorText>
                                </div>
                            </div>
                        )}
                    </Panel>

                    <Panel
                        title="Finishing and add-ons"
                        actions={
                            <Button size="sm" variant="quiet" icon={<Plus />} onClick={() => form.setData('options', [...d.options, { name: '', price_type: isArea ? 'per_sqft' : 'per_piece', price: '', active: true }])}>
                                Add option
                            </Button>
                        }
                    >
                        {d.options.length ? (
                            <div className="divide-y divide-line">
                                {d.options.map((o, i) => (
                                    <div key={i} className="grid items-center gap-2 px-5 py-2.5 sm:grid-cols-[1fr_150px_120px_auto_auto]">
                                        <Input aria-label="Option name" placeholder="e.g. Eyelets (4 corners)" value={o.name} onChange={(e) => form.setData('options', d.options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                                        <Select aria-label="Charged" value={o.price_type} onChange={(e) => form.setData('options', d.options.map((x, j) => (j === i ? { ...x, price_type: e.target.value as OptionPriceType } : x)))}>
                                            <option value="per_piece">per piece</option>
                                            <option value="per_sqft">per sq ft</option>
                                            <option value="flat">once per line</option>
                                            <option value="percent">% of base</option>
                                        </Select>
                                        <Input type="number" min={0} step="0.01" aria-label="Price" className="num" prefix={o.price_type === 'percent' ? undefined : '₱'} suffix={o.price_type === 'percent' ? '%' : undefined} value={o.price} onChange={(e) => form.setData('options', d.options.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
                                        <Switch checked={o.active} onChange={(v) => form.setData('options', d.options.map((x, j) => (j === i ? { ...x, active: v } : x)))} />
                                        <IconButton label="Remove option" onClick={() => form.setData('options', d.options.filter((_, j) => j !== i))}>
                                            <Trash2 />
                                        </IconButton>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="px-5 py-5 text-base text-muted">No add-ons. Rush is always available at the POS ({props.shop.rush_fee_percent}%).</p>
                        )}
                        <ErrorText>{errorFor('options.')}</ErrorText>
                    </Panel>

                    <Panel
                        title="Material recipe"
                        actions={
                            <Button size="sm" variant="quiet" icon={<Plus />} onClick={() => form.setData('materials', [...d.materials, { inventory_item_id: materials[0]?.id ?? 0, qty_per_unit: '', basis: isArea ? 'per_sqft' : 'per_piece' }])}>
                                Add material
                            </Button>
                        }
                    >
                        {d.materials.length ? (
                            <div className="divide-y divide-line">
                                {d.materials.map((m, i) => {
                                    const item = materials.find((x) => x.id === Number(m.inventory_item_id));
                                    return (
                                        <div key={i} className="grid items-center gap-2 px-5 py-2.5 sm:grid-cols-[1fr_120px_160px_auto]">
                                            <Select aria-label="Material" value={m.inventory_item_id} onChange={(e) => form.setData('materials', d.materials.map((x, j) => (j === i ? { ...x, inventory_item_id: Number(e.target.value) } : x)))}>
                                                {materials.map((x) => (
                                                    <option key={x.id} value={x.id}>
                                                        {x.name} ({qty(x.stock)} {x.unit} on hand)
                                                    </option>
                                                ))}
                                            </Select>
                                            <Input type="number" min={0} step="any" aria-label="Quantity used" className="num" suffix={item?.unit} value={m.qty_per_unit} onChange={(e) => form.setData('materials', d.materials.map((x, j) => (j === i ? { ...x, qty_per_unit: e.target.value } : x)))} />
                                            <Select aria-label="Per" value={m.basis} onChange={(e) => form.setData('materials', d.materials.map((x, j) => (j === i ? { ...x, basis: e.target.value as 'per_sqft' | 'per_piece' } : x)))}>
                                                <option value="per_sqft">per sq ft printed</option>
                                                <option value="per_piece">per piece</option>
                                            </Select>
                                            <IconButton label="Remove material" onClick={() => form.setData('materials', d.materials.filter((_, j) => j !== i))}>
                                                <Trash2 />
                                            </IconButton>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="px-5 py-5 text-base text-muted">No recipe yet. Without one, selling this service won't deduct anything from inventory.</p>
                        )}
                        <ErrorText>{errorFor('materials.')}</ErrorText>
                    </Panel>
                </div>

                <aside className="space-y-5 xl:sticky xl:top-20 xl:self-start">
                    <Panel title="Price check" bodyClass="space-y-4 p-5">
                        <div className="grid grid-cols-3 gap-2">
                            {isArea && (
                                <>
                                    <Field label="W ft">{(id) => <Input id={id} type="number" className="num" value={preview.width} onChange={(e) => setPreview({ ...preview, width: e.target.value })} />}</Field>
                                    <Field label="H ft">{(id) => <Input id={id} type="number" className="num" value={preview.height} onChange={(e) => setPreview({ ...preview, height: e.target.value })} />}</Field>
                                </>
                            )}
                            <Field label="Qty">{(id) => <Input id={id} type="number" className="num" value={preview.qty} onChange={(e) => setPreview({ ...preview, qty: e.target.value })} />}</Field>
                        </div>
                        <dl className="space-y-1.5 text-base">
                            {isArea && (
                                <div className="flex justify-between text-muted">
                                    <dt>Area each</dt>
                                    <dd className="num">{qty(priced.sqft, 2)} sq ft</dd>
                                </div>
                            )}
                            <div className="flex justify-between text-muted">
                                <dt>Customer pays</dt>
                                <dd className="num text-fg">{peso(priced.gross)}</dd>
                            </div>
                            <div className="flex justify-between text-muted">
                                <dt>Materials cost</dt>
                                <dd className="num">{peso(cost)}</dd>
                            </div>
                            <div className="flex justify-between border-t border-line pt-2 font-medium">
                                <dt>Gross margin</dt>
                                <dd className={`num ${priced.gross > 0 && (priced.gross - cost) / priced.gross < 0.3 ? 'text-warn-text' : 'text-ok-text'}`}>
                                    {peso(priced.gross - cost)} {priced.gross > 0 ? `(${(((priced.gross - cost) / priced.gross) * 100).toFixed(0)}%)` : ''}
                                </dd>
                            </div>
                        </dl>
                        <p className="text-xs text-faint">Unit price ₱{money(priced.unitPrice)}. Finishing and rush are added at the POS.</p>
                    </Panel>
                    <Panel title="At the counter" bodyClass="space-y-4 p-5">
                        <Switch checked={d.is_job} onChange={(v) => form.setData('is_job', v)} label="Produced job" description="Suggest a job order with a pickup date" />
                        <Field label="Usual lead time" hint="hours">
                            {(id) => <Input id={id} type="number" min={0} className="num" value={d.lead_time_hours} onChange={(e) => form.setData('lead_time_hours', e.target.value)} />}
                        </Field>
                        <Switch checked={d.active} onChange={(v) => form.setData('active', v)} label="Show on the POS" />
                    </Panel>
                </aside>
                <button type="submit" hidden />
            </form>
            {service && (
                <ConfirmDialog
                    open={deleting}
                    onOpenChange={setDeleting}
                    title={`Delete ${service.name}?`}
                    body="It is removed from the catalog. Past orders keep their lines. To hide it for a while, switch it off instead."
                    confirmLabel="Delete service"
                    onConfirm={() => router.delete(route('services.destroy', service.id))}
                />
            )}
        </>
    );
}
