import { Head, useForm } from '@inertiajs/react';
import { Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button, IconButton } from '@/components/ui/button';
import { ErrorText, Field, Input, MoneyInput, Select, Textarea } from '@/components/ui/field';
import { Panel } from '@/components/ui/misc';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { peso, qty } from '@/lib/format';

interface Stockable {
    key: string;
    item_type: 'product' | 'inventory';
    item_id: number;
    name: string;
    unit: string;
    cost: number;
    stock: number;
    supplier_id: number | null;
}

interface Line {
    item_type: 'product' | 'inventory';
    item_id: number;
    qty_ordered: number | string;
    unit_cost: number | string;
}

interface Props {
    purchase: { id: number; po_no: string; status: string; supplier_id: number; expected_at: string | null; notes: string | null; items: Line[] } | null;
    prefill: { supplier_id: number | null; items: Line[] | null };
    suppliers: { id: number; name: string; terms: string | null }[];
    stockables: Stockable[];
}

export default function PurchaseForm({ purchase, prefill, suppliers, stockables }: Props) {
    const form = useForm({
        supplier_id: String(purchase?.supplier_id ?? prefill.supplier_id ?? suppliers[0]?.id ?? ''),
        expected_at: purchase?.expected_at ?? '',
        notes: purchase?.notes ?? '',
        submit: false,
        items: (purchase?.items ?? prefill.items ?? []) as Line[],
    });
    const d = form.data;
    const total = d.items.reduce((s, l) => s + (Number(l.qty_ordered) || 0) * (Number(l.unit_cost) || 0), 0);
    const supplierId = Number(d.supplier_id);
    const sorted = [...stockables].sort((a, b) => Number(b.supplier_id === supplierId) - Number(a.supplier_id === supplierId));

    const save = (submit: boolean) => {
        form.transform((x) => ({ ...x, submit, expected_at: x.expected_at || null }));
        if (purchase) form.put(route('purchases.update', purchase.id));
        else form.post(route('purchases.store'));
    };

    const addLine = () => {
        const first = sorted.find((s) => !d.items.some((l) => l.item_type === s.item_type && l.item_id === s.item_id));
        if (!first) return;
        form.setData('items', [...d.items, { item_type: first.item_type, item_id: first.item_id, qty_ordered: '', unit_cost: first.cost }]);
    };

    return (
        <>
            <Head title={purchase ? `Edit ${purchase.po_no}` : 'New purchase order'} />
            <PageHeader
                back={{ href: purchase ? route('purchases.show', purchase.id) : route('purchases.index'), label: purchase ? purchase.po_no : 'Purchases' }}
                title={purchase ? `Edit ${purchase.po_no}` : 'New purchase order'}
                actions={
                    <>
                        <Button onClick={() => save(false)} loading={form.processing} disabled={!d.items.length}>
                            Save draft
                        </Button>
                        {(!purchase || purchase.status === 'draft') && (
                            <Button variant="primary" onClick={() => save(true)} loading={form.processing} disabled={!d.items.length}>
                                Save and mark ordered
                            </Button>
                        )}
                    </>
                }
            />
            <div className="grid gap-5 p-5 lg:p-6 xl:grid-cols-[1fr_320px]">
                <Panel
                    title="Items to order"
                    className="min-w-0"
                    actions={
                        <Button size="sm" variant="quiet" icon={<Plus />} onClick={addLine}>
                            Add item
                        </Button>
                    }
                >
                    {d.items.length ? (
                        <Table minWidth={720}>
                            <THead>
                                <tr>
                                    <Th>Item</Th>
                                    <Th align="right">On hand</Th>
                                    <Th align="right">Quantity</Th>
                                    <Th align="right">Unit cost</Th>
                                    <Th align="right">Line total</Th>
                                    <Th />
                                </tr>
                            </THead>
                            <tbody>
                                {d.items.map((l, i) => {
                                    const s = stockables.find((x) => x.item_type === l.item_type && x.item_id === l.item_id);
                                    return (
                                        <Tr key={i}>
                                            <Td>
                                                <Select
                                                    aria-label="Item"
                                                    value={`${l.item_type}:${l.item_id}`}
                                                    onChange={(e) => {
                                                        const pick = stockables.find((x) => x.key === e.target.value);
                                                        if (pick) form.setData('items', d.items.map((x, j) => (j === i ? { ...x, item_type: pick.item_type, item_id: pick.item_id, unit_cost: pick.cost } : x)));
                                                    }}
                                                >
                                                    {sorted.map((x) => (
                                                        <option key={x.key} value={x.key}>
                                                            {x.name} {x.item_type === 'product' ? '(product)' : ''}
                                                        </option>
                                                    ))}
                                                </Select>
                                            </Td>
                                            <Td numeric muted>
                                                {s ? `${qty(s.stock)} ${s.unit}` : ''}
                                            </Td>
                                            <Td align="right">
                                                <Input type="number" min={0} step="any" aria-label="Quantity" className="num ml-auto w-28 text-right" suffix={s?.unit} value={l.qty_ordered} onChange={(e) => form.setData('items', d.items.map((x, j) => (j === i ? { ...x, qty_ordered: e.target.value } : x)))} />
                                            </Td>
                                            <Td align="right">
                                                <MoneyInput aria-label="Unit cost" step="0.0001" className="ml-auto w-32" value={l.unit_cost} onChange={(e) => form.setData('items', d.items.map((x, j) => (j === i ? { ...x, unit_cost: e.target.value } : x)))} />
                                            </Td>
                                            <Td numeric>{peso((Number(l.qty_ordered) || 0) * (Number(l.unit_cost) || 0))}</Td>
                                            <Td>
                                                <IconButton label="Remove line" onClick={() => form.setData('items', d.items.filter((_, j) => j !== i))}>
                                                    <Trash2 />
                                                </IconButton>
                                            </Td>
                                        </Tr>
                                    );
                                })}
                            </tbody>
                        </Table>
                    ) : (
                        <div className="halftone px-6 py-12 text-center">
                            <p className="text-base text-muted">No items yet. Add what you're ordering; this supplier's items are listed first.</p>
                            <Button className="mt-4" icon={<Plus />} onClick={addLine}>
                                Add item
                            </Button>
                        </div>
                    )}
                    <div className="flex justify-end border-t border-line px-5 py-3">
                        <p className="text-base text-muted">
                            PO total <span className="hud ml-3 text-2xl font-semibold text-fg">{peso(total)}</span>
                        </p>
                    </div>
                    <ErrorText>{form.errors.items ?? Object.entries(form.errors).find(([k]) => k.startsWith('items.'))?.[1]}</ErrorText>
                </Panel>
                <aside className="space-y-5">
                    <Panel title="Order details" bodyClass="space-y-4 p-5">
                        <Field label="Supplier" error={form.errors.supplier_id} hint={suppliers.find((s) => s.id === supplierId)?.terms ?? undefined}>
                            {(id, e) => (
                                <Select id={id} aria-describedby={e} value={d.supplier_id} onChange={(ev) => form.setData('supplier_id', ev.target.value)}>
                                    {suppliers.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}
                                        </option>
                                    ))}
                                </Select>
                            )}
                        </Field>
                        <Field label="Expected delivery" error={form.errors.expected_at}>
                            {(id) => <Input id={id} type="date" value={d.expected_at} onChange={(e) => form.setData('expected_at', e.target.value)} />}
                        </Field>
                        <Field label="Notes">{(id) => <Textarea id={id} value={d.notes} onChange={(e) => form.setData('notes', e.target.value)} />}</Field>
                    </Panel>
                </aside>
            </div>
        </>
    );
}
