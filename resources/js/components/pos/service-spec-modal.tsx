import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/dialog';
import { AnimatedMoney } from '@/components/ui/misc';
import { Checkbox, Segmented, Switch } from '@/components/ui/toggle';
import { money, qty as fmtQty } from '@/lib/format';
import { priceService } from '@/lib/pricing';
import type { CartLine, CatalogService, ShopProps, SizeUnit } from '@/types';

interface Props {
    service: CatalogService | null;
    editing?: CartLine | null;
    shop: ShopProps;
    onClose: () => void;
    onSave: (line: Omit<CartLine, 'key'> & { key?: string }) => void;
}

const UNIT_LABEL: Record<SizeUnit, string> = { ft: 'ft', in: 'in', cm: 'cm' };

/** Size, quantity and finishing for a print job, priced live as you type. */
export function ServiceSpecModal({ service, editing, shop, onClose, onSave }: Props) {
    const [width, setWidth] = useState('');
    const [height, setHeight] = useState('');
    const [unit, setUnit] = useState<SizeUnit>('ft');
    const [quantity, setQuantity] = useState('1');
    const [optionIds, setOptionIds] = useState<number[]>([]);
    const [rush, setRush] = useState(false);
    const [note, setNote] = useState('');

    useEffect(() => {
        if (!service) return;
        setWidth(editing?.spec.width ? String(editing.spec.width) : '');
        setHeight(editing?.spec.height ? String(editing.spec.height) : '');
        setUnit(editing?.spec.unit ?? 'ft');
        setQuantity(editing ? String(editing.qty) : '1');
        setOptionIds(editing?.spec.option_ids ?? []);
        setRush(!!editing?.spec.rush);
        setNote(editing?.note ?? '');
    }, [service, editing]);

    const draft: CartLine = useMemo(
        () => ({
            key: editing?.key ?? 'draft',
            item_type: 'service',
            item_id: service?.id ?? 0,
            qty: Number(quantity) || 0,
            spec: { width: Number(width) || null, height: Number(height) || null, unit, option_ids: optionIds, rush },
            discount_type: editing?.discount_type ?? null,
            discount_value: editing?.discount_value ?? 0,
            note,
        }),
        [service, quantity, width, height, unit, optionIds, rush, note, editing],
    );

    if (!service) return <Modal open={false} onOpenChange={onClose} title="" children={null} />;

    const isArea = service.pricing_model === 'per_sqft';
    const priced = priceService(service, draft.qty, draft, shop);
    const needsSize = isArea && !(Number(width) > 0 && Number(height) > 0);
    const valid = draft.qty > 0 && !needsSize;
    const activeTier = service.pricing_model === 'tiered' ? [...service.tiers].sort((a, b) => a.min_qty - b.min_qty).filter((t) => draft.qty >= t.min_qty).pop() : null;

    const save = () => {
        if (!valid) return;
        onSave({ ...draft, key: editing?.key, spec: { ...draft.spec, width: isArea ? draft.spec.width : null, height: isArea ? draft.spec.height : null, unit: isArea ? unit : null } });
        onClose();
    };

    return (
        <Modal
            open={!!service}
            onOpenChange={(o) => !o && onClose()}
            title={service.name}
            description={`${service.category ?? 'Service'}. ${isArea ? `₱${money(service.base_price)} per sq ft${service.min_charge ? `, minimum ₱${money(service.min_charge)} per piece` : ''}.` : ''}`}
            size="lg"
            footer={
                <>
                    <div className="mr-auto">
                        <p className="text-xs text-faint">{draft.qty > 0 ? `${fmtQty(draft.qty)} × ₱${money(priced.unitPrice)}` : 'Enter a quantity'}</p>
                        <AnimatedMoney value={priced.gross} className="hud text-2xl font-semibold" />
                    </div>
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" size="lg" onClick={save} disabled={!valid}>
                        {editing ? 'Update line' : 'Add to cart'}
                    </Button>
                </>
            }
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    save();
                }}
                className="space-y-5"
            >
                {isArea && (
                    <fieldset>
                        <legend className="mb-1.5 text-sm font-medium text-muted">Size of one piece</legend>
                        <div className="flex flex-wrap items-center gap-2">
                            <Input
                                aria-label="Width"
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.01"
                                autoFocus
                                inputSize="lg"
                                className="num w-28 text-xl"
                                placeholder="W"
                                value={width}
                                onChange={(e) => setWidth(e.target.value)}
                            />
                            <span className="text-xl text-faint" aria-hidden>
                                ×
                            </span>
                            <Input
                                aria-label="Height"
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.01"
                                inputSize="lg"
                                className="num w-28 text-xl"
                                placeholder="H"
                                value={height}
                                onChange={(e) => setHeight(e.target.value)}
                            />
                            <Segmented label="Unit" size="lg" value={unit} onChange={setUnit} options={(['ft', 'in', 'cm'] as SizeUnit[]).map((u) => ({ value: u, label: UNIT_LABEL[u] }))} />
                            <span className="num ml-auto text-base text-muted">
                                {priced.sqft > 0 ? (
                                    <>
                                        <span className="text-fg">{fmtQty(priced.sqft, 2)}</span> sq ft each
                                    </>
                                ) : (
                                    'Enter width and height'
                                )}
                            </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {[
                                [2, 3],
                                [3, 4],
                                [3, 5],
                                [4, 6],
                                [4, 8],
                            ].map(([w, h]) => (
                                <button
                                    key={`${w}x${h}`}
                                    type="button"
                                    onClick={() => {
                                        setWidth(String(w));
                                        setHeight(String(h));
                                        setUnit('ft');
                                    }}
                                    className="num h-7 rounded-xs border border-line px-2 text-sm text-muted hover:border-line-strong hover:text-fg"
                                >
                                    {w}×{h} ft
                                </button>
                            ))}
                        </div>
                    </fieldset>
                )}

                <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                    <Field label={`Quantity (${service.unit_label === 'sqft' ? 'pieces' : service.unit_label})`}>
                        {(id) => (
                            <Input
                                id={id}
                                type="number"
                                inputMode="numeric"
                                min="1"
                                step="1"
                                autoFocus={!isArea}
                                inputSize="lg"
                                className="num text-xl"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                            />
                        )}
                    </Field>
                    {service.pricing_model === 'tiered' && (
                        <div>
                            <p className="mb-1.5 text-sm font-medium text-muted">Quantity breaks</p>
                            <div className="flex flex-wrap gap-px bg-line">
                                {[...service.tiers]
                                    .sort((a, b) => a.min_qty - b.min_qty)
                                    .map((t) => (
                                        <div key={t.min_qty} className={activeTier?.min_qty === t.min_qty ? 'bg-selected px-3 py-1.5' : 'bg-surface px-3 py-1.5'}>
                                            <p className="num text-xs text-faint">{fmtQty(t.min_qty)}+</p>
                                            <p className="num text-base">₱{money(t.price)}</p>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>

                {service.options.length > 0 && (
                    <fieldset>
                        <legend className="mb-2 text-sm font-medium text-muted">Finishing</legend>
                        <div className="grid gap-px border border-line bg-line sm:grid-cols-2">
                            {service.options.map((o) => (
                                <div key={o.id} className="flex items-center justify-between gap-3 bg-surface px-3 py-2.5">
                                    <Checkbox
                                        checked={optionIds.includes(o.id)}
                                        onChange={(v) => setOptionIds((ids) => (v ? [...ids, o.id] : ids.filter((x) => x !== o.id)))}
                                        label={o.name}
                                    />
                                    <span className="num shrink-0 text-sm text-faint">
                                        {o.price_type === 'percent' ? `+${o.price}%` : `+₱${money(o.price)}${o.price_type === 'per_sqft' ? '/sqft' : o.price_type === 'per_piece' ? '/pc' : ''}`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </fieldset>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                    <Switch checked={rush} onChange={setRush} label="Rush job" description={`Adds ${shop.rush_fee_percent}% for same-day priority`} className="border border-line px-3 py-2.5" />
                    <Field label="Line note" hint="Prints on the job ticket">
                        {(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Use client's file, matte finish" />}
                    </Field>
                </div>

                {needsSize && Number(quantity) > 0 && <p className="text-sm text-warn-text">Enter both width and height to price this piece.</p>}
                <button type="submit" hidden aria-hidden tabIndex={-1} />
            </form>
        </Modal>
    );
}
