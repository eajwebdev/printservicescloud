import { Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { IconButton } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input, Select } from '@/components/ui/field';
import { money, qty as fmtQty } from '@/lib/format';
import type { PricedLine } from '@/lib/pricing';
import { cn } from '@/lib/utils';
import type { CartLine, DiscountType } from '@/types';

interface Props {
    lines: PricedLine[];
    onUpdate: (key: string, patch: Partial<CartLine>) => void;
    onRemove: (key: string) => void;
    onEditService: (line: CartLine) => void;
    canDiscount: boolean;
    emptyText?: string;
}

export function specSummary(l: PricedLine): string | null {
    const parts: string[] = [];
    const s = l.line.spec;
    if (s.width && s.height) parts.push(`${fmtQty(s.width)}×${fmtQty(s.height)} ${s.unit}, ${fmtQty(l.sqft, 2)} sqft`);
    const optionNames = (l.service?.options ?? []).filter((o) => (s.option_ids ?? []).includes(o.id)).map((o) => o.name);
    if (optionNames.length) parts.push(optionNames.join(', '));
    return parts.length ? parts.join('; ') : null;
}

export function CartLines({ lines, onUpdate, onRemove, onEditService, canDiscount, emptyText }: Props) {
    const [expanded, setExpanded] = useState<string | null>(null);

    if (!lines.length) {
        return (
            <div className="halftone flex min-h-40 items-center justify-center p-6 text-center md:h-full">
                <p className="max-w-60 text-base text-muted">{emptyText ?? 'Tap a service or scan a product to start the order.'}</p>
            </div>
        );
    }

    return (
        <ul className="divide-y divide-line">
            <AnimatePresence initial={false}>
                {lines.map((l) => {
                    const summary = specSummary(l);
                    const open = expanded === l.line.key;
                    const overStock = l.product && Number(l.line.qty) > l.product.stock;
                    return (
                        <motion.li
                            key={l.line.key}
                            layout
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0, transition: { duration: 0.16 } }}
                            transition={{ type: 'spring', stiffness: 520, damping: 42 }}
                            className="overflow-hidden"
                        >
                            <div className={cn('px-4 py-3', open && 'bg-raised')}>
                                <div className="flex items-start gap-3">
                                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setExpanded(open ? null : l.line.key)} aria-expanded={open}>
                                        <span className="block text-base leading-snug text-fg">{l.name}</span>
                                        {summary && <span className="mt-0.5 block text-sm text-muted">{summary}</span>}
                                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                                            {l.line.spec.rush && <Chip tone="red">Rush</Chip>}
                                            {l.needsSize && <Chip tone="warn">Needs size</Chip>}
                                            {overStock && <Chip tone="red">Only {fmtQty(l.product?.stock)} in stock</Chip>}
                                            {l.discount > 0 && <Chip tone="info">Less ₱{money(l.discount)}</Chip>}
                                            {l.line.note && <span className="truncate text-xs text-faint italic">{l.line.note}</span>}
                                        </span>
                                    </button>
                                    <div className="text-right">
                                        <p className="num text-base text-fg">₱{money(l.total)}</p>
                                        <p className="num text-xs text-faint">
                                            {fmtQty(l.line.qty)} × {money(l.unitPrice)}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-2 flex items-center gap-1">
                                    <div className="flex items-center rounded-xs border border-line bg-sunken">
                                        <button
                                            type="button"
                                            className="grid size-8 place-items-center text-muted hover:text-fg disabled:opacity-30"
                                            aria-label={`One less ${l.name}`}
                                            disabled={Number(l.line.qty) <= 1}
                                            onClick={() => onUpdate(l.line.key, { qty: Math.max(1, Number(l.line.qty) - 1) })}
                                        >
                                            <Minus className="size-3.5" />
                                        </button>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            min={1}
                                            value={l.line.qty}
                                            onChange={(e) => onUpdate(l.line.key, { qty: e.target.value === '' ? ('' as unknown as number) : Number(e.target.value) })}
                                            onBlur={(e) => Number(e.target.value) <= 0 && onUpdate(l.line.key, { qty: 1 })}
                                            className="num h-8 w-14 border-x border-line bg-transparent text-center text-base text-fg focus-visible:outline-none"
                                            aria-label={`Quantity of ${l.name}`}
                                        />
                                        <button
                                            type="button"
                                            className="grid size-8 place-items-center text-muted hover:text-fg"
                                            aria-label={`One more ${l.name}`}
                                            onClick={() => onUpdate(l.line.key, { qty: Number(l.line.qty) + 1 })}
                                        >
                                            <Plus className="size-3.5" />
                                        </button>
                                    </div>
                                    {l.service && (
                                        <IconButton label="Edit size and finishing" onClick={() => onEditService(l.line)}>
                                            <Pencil />
                                        </IconButton>
                                    )}
                                    <IconButton label={`Remove ${l.name}`} className="ml-auto hover:text-accent-text" onClick={() => onRemove(l.line.key)}>
                                        <Trash2 />
                                    </IconButton>
                                </div>

                                {open && (
                                    <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-[auto_1fr]">
                                        {canDiscount && (
                                            <div className="flex items-center gap-1">
                                                <Select
                                                    selectSize="sm"
                                                    className="w-28"
                                                    aria-label="Line discount type"
                                                    value={l.line.discount_type ?? ''}
                                                    onChange={(e) => onUpdate(l.line.key, { discount_type: (e.target.value || null) as DiscountType, discount_value: e.target.value ? l.line.discount_value : 0 })}
                                                >
                                                    <option value="">No discount</option>
                                                    <option value="percent">Percent</option>
                                                    <option value="amount">Peso off</option>
                                                </Select>
                                                {l.line.discount_type && (
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        inputSize="sm"
                                                        className="num w-20"
                                                        aria-label="Discount value"
                                                        value={l.line.discount_value || ''}
                                                        onChange={(e) => onUpdate(l.line.key, { discount_value: Number(e.target.value) })}
                                                    />
                                                )}
                                            </div>
                                        )}
                                        <Input inputSize="sm" placeholder="Note for this line" value={l.line.note} onChange={(e) => onUpdate(l.line.key, { note: e.target.value })} aria-label="Line note" />
                                    </div>
                                )}
                            </div>
                        </motion.li>
                    );
                })}
            </AnimatePresence>
        </ul>
    );
}
