import { Head, router, useForm } from '@inertiajs/react';
import { ClipboardCheck, Diff, Pencil, Plus, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ListPage, SummaryStrip, ToolbarSearch } from '@/components/list-page';
import { catalogTabs } from '@/components/module-tabs';
import { StockAdjustModal } from '@/components/stock-adjust';
import { Button, ButtonLink, IconButton } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Drawer } from '@/components/ui/dialog';
import { Field, Input, MoneyInput, Select, Textarea } from '@/components/ui/field';
import { ChipGroup } from '@/components/ui/filter-chip';
import { EmptyState, Pagination } from '@/components/ui/misc';
import { Switch } from '@/components/ui/toggle';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { useFilters } from '@/hooks/use-filters';
import { money, peso, qty, time } from '@/lib/format';
import { cn, useCan } from '@/lib/utils';
import type { Option, Paginated, StockMovementRow } from '@/types';

export interface ItemRow {
    id: number;
    name: string;
    sku: string | null;
    category: string | null;
    unit: string;
    stock: number;
    cost: number;
    reorder_level: number;
    supplier_id: number | null;
    supplier: string | null;
    active: boolean;
    notes: string | null;
    value: number;
    low: boolean;
}

interface Props {
    items: Paginated<ItemRow>;
    filters: Record<string, string | undefined>;
    categories: string[];
    suppliers: Option[];
    units: string[];
    reasons: Record<string, string>;
    recent: StockMovementRow[];
    stockValue: number;
    counts: { all: number; low: number; out: number };
}

export default function InventoryIndex({ items, filters: initial, categories, suppliers, units, reasons, recent, stockValue, counts }: Props) {
    const can = useCan();
    const [editing, setEditing] = useState<ItemRow | null>(null);
    const [open, setOpen] = useState(false);
    const [adjusting, setAdjusting] = useState<ItemRow | null>(null);
    const { filters, set, setFilters } = useFilters(route('inventory.index'), { q: initial.q ?? '', category: initial.category ?? '', stock: initial.stock ?? '' });
    const lowSuppliers = [...new Map(items.data.filter((i) => i.low && i.supplier_id).map((i) => [i.supplier_id as number, i.supplier as string])).entries()];

    return (
        <>
            <Head title="Inventory" />
            <ListPage
                title="Catalog and stock"
                description="Rolls, sheets, ink and consumables that services use up. Click a row for its full movement history."
                tabs={catalogTabs('inventory')}
                actions={
                    <>
                        {can('inventory.adjust') && (
                            <ButtonLink href={route('inventory.count')} icon={<ClipboardCheck />}>
                                Stock count
                            </ButtonLink>
                        )}
                        {can('inventory.create') && (
                            <Button
                                variant="primary"
                                icon={<Plus />}
                                onClick={() => {
                                    setEditing(null);
                                    setOpen(true);
                                }}
                            >
                                New material
                            </Button>
                        )}
                    </>
                }
                toolbar={
                    <>
                        <ToolbarSearch autoFocus value={filters.q ?? ''} onChange={(v) => set('q', v)} placeholder="Material name or SKU" />
                        <ChipGroup
                            label="Stock level"
                            value={(filters.stock ?? '') as 'low' | 'out' | ''}
                            onChange={(v) => set('stock', v)}
                            options={[
                                { value: 'low', label: 'Running low', count: counts.low, tone: 'warn' },
                                { value: 'out', label: 'Out', count: counts.out, tone: 'red' },
                            ]}
                        />
                        <Select selectSize="sm" className="w-44" aria-label="Category" value={filters.category} onChange={(e) => set('category', e.target.value)}>
                            <option value="">All categories</option>
                            {categories.map((c) => (
                                <option key={c}>{c}</option>
                            ))}
                        </Select>
                    </>
                }
                summary={
                    <SummaryStrip
                        items={[
                            { label: 'Materials tracked', value: counts.all },
                            { label: 'Need reordering', value: counts.low + counts.out, tone: counts.low + counts.out ? 'warn' : undefined },
                            { label: 'Worth on the shelves', value: peso(stockValue) },
                        ]}
                    />
                }
                footer={items.data.length > 0 && <Pagination links={items.links} from={items.from} to={items.to} total={items.total} />}
                aside={
                    <div>
                        {lowSuppliers.length > 0 && can('purchases.create') && (
                            <div className="border-b border-line p-4">
                                <p className="text-base font-medium">Reorder what's low</p>
                                <p className="mt-0.5 text-sm text-muted">Opens a purchase order filled with that supplier's low items.</p>
                                <div className="mt-3 flex flex-col gap-1.5">
                                    {lowSuppliers.map(([id, name]) => (
                                        <ButtonLink key={id} size="sm" icon={<Truck />} href={route('purchases.create', { supplier: id })} className="justify-start">
                                            {name}
                                        </ButtonLink>
                                    ))}
                                </div>
                            </div>
                        )}
                        <p className="px-4 pt-3 pb-1 text-sm font-medium">Latest movements</p>
                        <ul className="divide-y divide-line">
                            {recent.map((m) => (
                                <li key={m.id} className="flex items-start justify-between gap-3 px-4 py-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm">{m.item}</p>
                                        <p className="truncate text-xs text-faint">
                                            {time(m.at)}, {m.ref ?? m.type}
                                        </p>
                                    </div>
                                    <span className={cn('num shrink-0 text-sm', m.qty < 0 ? 'text-accent-text' : 'text-ok-text')}>
                                        {m.qty > 0 ? '+' : ''}
                                        {qty(m.qty, 2)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                }
            >
                {items.data.length ? (
                    <Table flush minWidth={760}>
                        <THead>
                            <tr>
                                <Th>Material</Th>
                                <Th align="right">On hand</Th>
                                <Th align="right">Reorder at</Th>
                                <Th align="right">Unit cost</Th>
                                <Th align="right">Value</Th>
                                <Th align="right">Actions</Th>
                            </tr>
                        </THead>
                        <tbody>
                            {items.data.map((i) => {
                                const pct = i.reorder_level > 0 ? Math.min(1, Math.max(0, i.stock / (i.reorder_level * 3))) : 1;
                                return (
                                    <Tr key={i.id} interactive onClick={() => router.visit(route('inventory.show', i.id))} className={cn(!i.active && 'opacity-55')}>
                                        <Td>
                                            <span className="block">{i.name}</span>
                                            <span className="block text-xs text-faint">{[i.sku, i.category, i.supplier].filter(Boolean).join(', ')}</span>
                                        </Td>
                                        <Td numeric>
                                            <span className="flex items-center justify-end gap-2">
                                                {i.low && <Chip tone={i.stock <= 0 ? 'red' : 'warn'}>{i.stock <= 0 ? 'Out' : 'Low'}</Chip>}
                                                <span className={cn('text-base', i.stock <= 0 ? 'text-accent-text' : i.low ? 'text-warn-text' : 'text-fg')}>
                                                    {qty(i.stock)} <span className="text-sm text-faint">{i.unit}</span>
                                                </span>
                                            </span>
                                            <span className="mt-1 ml-auto block h-1 w-24 bg-sunken">
                                                <span className={cn('block h-full', i.low ? 'bg-warn' : 'bg-line-strong')} style={{ width: `${pct * 100}%` }} />
                                            </span>
                                        </Td>
                                        <Td numeric muted>{qty(i.reorder_level)}</Td>
                                        <Td numeric muted>{money(i.cost)}</Td>
                                        <Td numeric>{peso(i.value)}</Td>
                                        <Td align="right" onClick={(e) => e.stopPropagation()}>
                                            <span className="flex justify-end gap-1">
                                                {can('inventory.adjust') && (
                                                    <IconButton label={`Adjust stock of ${i.name}`} size="xs" variant="quiet" onClick={() => setAdjusting(i)}>
                                                        <Diff />
                                                    </IconButton>
                                                )}
                                                {can('inventory.edit') && (
                                                    <IconButton
                                                        label={`Edit ${i.name}`}
                                                        size="xs"
                                                        variant="quiet"
                                                        onClick={() => {
                                                            setEditing(i);
                                                            setOpen(true);
                                                        }}
                                                    >
                                                        <Pencil />
                                                    </IconButton>
                                                )}
                                            </span>
                                        </Td>
                                    </Tr>
                                );
                            })}
                        </tbody>
                    </Table>
                ) : (
                    <EmptyState
                        className="h-full"
                        title={filters.stock === 'low' ? 'Nothing is running low' : 'No materials match'}
                        body={filters.stock ? 'Every item in this filter is above its reorder level.' : 'Add tarpaulin rolls, ink and paper so service recipes can deduct them.'}
                        action={
                            (filters.q || filters.stock || filters.category) && (
                                <button type="button" className="text-sm text-fg underline" onClick={() => setFilters({ q: '', stock: '', category: '' })}>
                                    Clear filters
                                </button>
                            )
                        }
                    />
                )}
            </ListPage>

            <ItemDrawer open={open} onClose={() => setOpen(false)} item={editing} suppliers={suppliers} units={units} categories={categories} />
            <StockAdjustModal open={!!adjusting} onClose={() => setAdjusting(null)} item={adjusting ? { type: 'inventory', id: adjusting.id, name: adjusting.name, unit: adjusting.unit, stock: adjusting.stock } : null} reasons={reasons} />
        </>
    );
}

export function ItemDrawer({ open, onClose, item, suppliers, units, categories }: { open: boolean; onClose: () => void; item: ItemRow | null; suppliers: Option[]; units: string[]; categories: string[] }) {
    const form = useForm({ name: '', sku: '', category: '', unit: 'pc', cost: '', opening_stock: '', reorder_level: '', supplier_id: '', active: true, notes: '' });

    useEffect(() => {
        if (!open) return;
        form.clearErrors();
        form.setData({
            name: item?.name ?? '',
            sku: item?.sku ?? '',
            category: item?.category ?? '',
            unit: item?.unit ?? 'sqft',
            cost: item ? String(item.cost) : '',
            opening_stock: '',
            reorder_level: item ? String(item.reorder_level) : '',
            supplier_id: item?.supplier_id ? String(item.supplier_id) : '',
            active: item?.active ?? true,
            notes: item?.notes ?? '',
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, item]);

    const submit = () => {
        form.transform((d) => ({ ...d, sku: d.sku || null, supplier_id: d.supplier_id || null, cost: d.cost || 0, reorder_level: d.reorder_level || 0, opening_stock: d.opening_stock || 0 }));
        const opts = { preserveScroll: true, onSuccess: onClose };
        if (item) form.put(route('inventory.update', item.id), opts);
        else form.post(route('inventory.store'), opts);
    };

    return (
        <Drawer
            open={open}
            onOpenChange={(o) => !o && onClose()}
            title={item ? `Edit ${item.name}` : 'New inventory item'}
            description="Stock changes only through sales, purchases and logged adjustments."
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" loading={form.processing} onClick={submit}>
                        {item ? 'Save item' : 'Add item'}
                    </Button>
                </>
            }
        >
            <form
                className="space-y-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                }}
            >
                <Field label="Name" error={form.errors.name}>
                    {(id, d) => <Input id={id} aria-describedby={d} autoFocus value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} placeholder="e.g. Tarpaulin 13oz (Korean)" />}
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="SKU" hint="Optional" error={form.errors.sku}>
                        {(id, d) => <Input id={id} aria-describedby={d} className="font-mono uppercase" value={form.data.sku} onChange={(e) => form.setData('sku', e.target.value.toUpperCase())} />}
                    </Field>
                    <Field label="Category">
                        {(id) => (
                            <>
                                <Input id={id} list="inv-categories" value={form.data.category} onChange={(e) => form.setData('category', e.target.value)} />
                                <datalist id="inv-categories">
                                    {categories.map((c) => (
                                        <option key={c} value={c} />
                                    ))}
                                </datalist>
                            </>
                        )}
                    </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Unit" error={form.errors.unit}>
                        {(id) => (
                            <Select id={id} value={form.data.unit} onChange={(e) => form.setData('unit', e.target.value)} disabled={!!item}>
                                {units.map((u) => (
                                    <option key={u}>{u}</option>
                                ))}
                            </Select>
                        )}
                    </Field>
                    <Field label={`Cost per ${form.data.unit}`} error={form.errors.cost}>
                        {(id, d) => <MoneyInput id={id} aria-describedby={d} step="0.0001" value={form.data.cost} onChange={(e) => form.setData('cost', e.target.value)} />}
                    </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    {!item && (
                        <Field label="Opening stock" error={form.errors.opening_stock}>
                            {(id, d) => <Input id={id} aria-describedby={d} type="number" min={0} step="any" className="num" suffix={form.data.unit} value={form.data.opening_stock} onChange={(e) => form.setData('opening_stock', e.target.value)} />}
                        </Field>
                    )}
                    <Field label="Reorder at" error={form.errors.reorder_level}>
                        {(id, d) => <Input id={id} aria-describedby={d} type="number" min={0} step="any" className="num" suffix={form.data.unit} value={form.data.reorder_level} onChange={(e) => form.setData('reorder_level', e.target.value)} />}
                    </Field>
                </div>
                <Field label="Supplier">
                    {(id) => (
                        <Select id={id} value={form.data.supplier_id} onChange={(e) => form.setData('supplier_id', e.target.value)}>
                            <option value="">None</option>
                            {suppliers.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </Select>
                    )}
                </Field>
                <Field label="Notes">{(id) => <Textarea id={id} value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} />}</Field>
                <Switch checked={form.data.active} onChange={(v) => form.setData('active', v)} label="Active" description="Inactive items drop off recipes pickers and counts" className="border border-line px-3 py-2.5" />
                <button type="submit" hidden />
            </form>
        </Drawer>
    );
}
