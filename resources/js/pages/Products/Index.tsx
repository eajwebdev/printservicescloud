import { Head, router, useForm } from '@inertiajs/react';
import { Diff, History, PackagePlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ListPage, ToolbarSearch } from '@/components/list-page';
import { catalogTabs } from '@/components/module-tabs';
import { StockAdjustModal } from '@/components/stock-adjust';
import { Button, IconButton } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ConfirmDialog, Drawer } from '@/components/ui/dialog';
import { Field, Input, MoneyInput, Select } from '@/components/ui/field';
import { ChipGroup } from '@/components/ui/filter-chip';
import { EmptyState, Pagination } from '@/components/ui/misc';
import { Switch } from '@/components/ui/toggle';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { useFilters } from '@/hooks/use-filters';
import { peso, qty } from '@/lib/format';
import { cn, useCan } from '@/lib/utils';
import type { Option, Paginated } from '@/types';

export interface ProductRow {
    id: number;
    name: string;
    sku: string;
    barcode: string | null;
    category: string | null;
    price: number;
    cost: number;
    stock: number;
    reorder_level: number;
    supplier_id: number | null;
    supplier: string | null;
    inventory_item_id: number | null;
    inventory_item: string | null;
    active: boolean;
    margin: number | null;
    low: boolean;
}

interface Props {
    products: Paginated<ProductRow>;
    filters: Record<string, string | undefined>;
    categories: string[];
    suppliers: Option[];
    materials: (Option & { unit: string })[];
    reasons: Record<string, string>;
    counts: { active: number; low: number; out: number; inactive: number };
}

export default function ProductsIndex({ products, filters: initial, categories, suppliers, materials, reasons, counts }: Props) {
    const can = useCan();
    const [editing, setEditing] = useState<ProductRow | null>(null);
    const [open, setOpen] = useState(false);
    const [adjusting, setAdjusting] = useState<ProductRow | null>(null);
    const { filters, set, setFilters } = useFilters(route('products.index'), { q: initial.q ?? '', category: initial.category ?? '', stock: initial.stock ?? '', status: initial.status ?? '' });
    const quick = filters.status === 'inactive' ? 'inactive' : filters.stock;

    return (
        <>
            <Head title="Products" />
            <ListPage
                title="Catalog and stock"
                description="Finished goods sold as they are. Click a row to edit; use the plus-minus button to fix stock."
                tabs={catalogTabs('products')}
                actions={
                    can('products.create') && (
                        <Button
                            variant="primary"
                            icon={<PackagePlus />}
                            onClick={() => {
                                setEditing(null);
                                setOpen(true);
                            }}
                        >
                            New product
                        </Button>
                    )
                }
                toolbar={
                    <>
                        <ToolbarSearch autoFocus value={filters.q ?? ''} onChange={(v) => set('q', v)} placeholder="Name, SKU or scan a barcode" />
                        <ChipGroup
                            label="Stock"
                            value={(quick ?? '') as 'low' | 'out' | 'inactive' | ''}
                            onChange={(v) => setFilters((f) => ({ ...f, stock: v === 'low' || v === 'out' ? v : '', status: v === 'inactive' ? 'inactive' : '' }))}
                            options={[
                                { value: 'low', label: 'Low stock', count: counts.low, tone: 'warn' },
                                { value: 'out', label: 'Out of stock', count: counts.out, tone: 'red' },
                                { value: 'inactive', label: 'Not sold', count: counts.inactive },
                            ]}
                        />
                        <Select selectSize="sm" className="w-48" aria-label="Category" value={filters.category} onChange={(e) => set('category', e.target.value)}>
                            <option value="">All categories</option>
                            {categories.map((c) => (
                                <option key={c}>{c}</option>
                            ))}
                        </Select>
                    </>
                }
                footer={products.data.length > 0 && <Pagination links={products.links} from={products.from} to={products.to} total={products.total} />}
            >
                {products.data.length ? (
                    <Table flush minWidth={820}>
                        <THead>
                            <tr>
                                <Th>Product</Th>
                                <Th>Category</Th>
                                <Th align="right">Price</Th>
                                <Th align="right">Margin</Th>
                                <Th align="right">On hand</Th>
                                <Th align="right">Actions</Th>
                            </tr>
                        </THead>
                        <tbody>
                            {products.data.map((p) => (
                                <Tr
                                    key={p.id}
                                    interactive={can('products.edit')}
                                    className={cn(!p.active && 'opacity-55')}
                                    onClick={() => {
                                        if (!can('products.edit')) return router.visit(route('products.show', p.id));
                                        setEditing(p);
                                        setOpen(true);
                                    }}
                                >
                                    <Td>
                                        <span className="block">{p.name}</span>
                                        <span className="block font-mono text-xs text-faint">
                                            {p.sku}
                                            {p.barcode ? `, ${p.barcode}` : ''}
                                        </span>
                                    </Td>
                                    <Td muted>{p.category}</Td>
                                    <Td numeric>{peso(p.price)}</Td>
                                    <Td numeric className={p.margin !== null && p.margin < 25 ? 'text-warn-text' : 'text-muted'}>
                                        {p.margin !== null ? `${p.margin}%` : ''}
                                    </Td>
                                    <Td numeric>
                                        <span className="flex items-center justify-end gap-2">
                                            {p.inventory_item ? (
                                                <span className="text-xs text-faint" title={`Stock comes from ${p.inventory_item}`}>
                                                    shared
                                                </span>
                                            ) : (
                                                p.low && <Chip tone={p.stock <= 0 ? 'red' : 'warn'}>{p.stock <= 0 ? 'Out' : 'Low'}</Chip>
                                            )}
                                            <span className={cn('text-base', p.stock <= 0 ? 'text-accent-text' : p.low ? 'text-warn-text' : 'text-fg')}>{qty(p.stock)}</span>
                                        </span>
                                    </Td>
                                    <Td align="right" onClick={(e) => e.stopPropagation()}>
                                        <span className="flex justify-end gap-1">
                                            {can('inventory.adjust') && !p.inventory_item_id && (
                                                <IconButton label={`Adjust stock of ${p.name}`} size="xs" variant="quiet" onClick={() => setAdjusting(p)}>
                                                    <Diff />
                                                </IconButton>
                                            )}
                                            <IconButton label={`Stock history of ${p.name}`} size="xs" variant="quiet" onClick={() => router.visit(route('products.show', p.id))}>
                                                <History />
                                            </IconButton>
                                        </span>
                                    </Td>
                                </Tr>
                            ))}
                        </tbody>
                    </Table>
                ) : (
                    <EmptyState
                        className="h-full"
                        title={filters.q || quick || filters.category ? 'No products match' : 'No products yet'}
                        body={filters.q || quick || filters.category ? 'Clear a filter or search by SKU.' : 'Add the items you sell over the counter. Scan their barcodes at the POS.'}
                        action={
                            filters.q || quick || filters.category ? (
                                <button type="button" className="text-sm text-fg underline" onClick={() => setFilters({ q: '', category: '', stock: '', status: '' })}>
                                    Clear filters
                                </button>
                            ) : (
                                can('products.create') && (
                                    <Button variant="primary" onClick={() => setOpen(true)}>
                                        Add a product
                                    </Button>
                                )
                            )
                        }
                    />
                )}
            </ListPage>

            <ProductDrawer open={open} onClose={() => setOpen(false)} product={editing} categories={categories} suppliers={suppliers} materials={materials} />
            <StockAdjustModal open={!!adjusting} onClose={() => setAdjusting(null)} item={adjusting ? { type: 'product', id: adjusting.id, name: adjusting.name, unit: 'pc', stock: adjusting.stock } : null} reasons={reasons} />
        </>
    );
}

export function ProductDrawer({ open, onClose, product, categories, suppliers, materials }: { open: boolean; onClose: () => void; product: ProductRow | null; categories: string[]; suppliers: Option[]; materials: (Option & { unit: string })[] }) {
    const can = useCan();
    const [confirmDelete, setConfirmDelete] = useState(false);
    const form = useForm({ name: '', sku: '', barcode: '', category: '', price: '', cost: '', opening_stock: '', reorder_level: '', supplier_id: '', inventory_item_id: '', active: true });

    useEffect(() => {
        if (!open) return;
        form.clearErrors();
        form.setData({
            name: product?.name ?? '',
            sku: product?.sku ?? '',
            barcode: product?.barcode ?? '',
            category: product?.category ?? '',
            price: product ? String(product.price) : '',
            cost: product ? String(product.cost) : '',
            opening_stock: '',
            reorder_level: product ? String(product.reorder_level) : '',
            supplier_id: product?.supplier_id ? String(product.supplier_id) : '',
            inventory_item_id: product?.inventory_item_id ? String(product.inventory_item_id) : '',
            active: product?.active ?? true,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, product]);

    const submit = () => {
        form.transform((d) => ({
            ...d,
            barcode: d.barcode || null,
            supplier_id: d.supplier_id || null,
            inventory_item_id: d.inventory_item_id || null,
            cost: d.cost || 0,
            reorder_level: d.reorder_level || 0,
            opening_stock: d.opening_stock || 0,
        }));
        const opts = { preserveScroll: true, onSuccess: onClose };
        if (product) form.put(route('products.update', product.id), opts);
        else form.post(route('products.store'), opts);
    };

    const price = Number(form.data.price) || 0;
    const cost = Number(form.data.cost) || 0;

    return (
        <>
            <Drawer
                open={open}
                onOpenChange={(o) => !o && onClose()}
                title={product ? `Edit ${product.name}` : 'New product'}
                footer={
                    <>
                        {product && can('products.delete') && (
                            <Button variant="danger" className="mr-auto" onClick={() => setConfirmDelete(true)}>
                                Remove
                            </Button>
                        )}
                        <Button variant="ghost" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button variant="primary" loading={form.processing} onClick={submit}>
                            {product ? 'Save product' : 'Add product'}
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
                        {(id, d) => <Input id={id} aria-describedby={d} autoFocus value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />}
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="SKU" error={form.errors.sku}>
                            {(id, d) => <Input id={id} aria-describedby={d} className="font-mono uppercase" value={form.data.sku} onChange={(e) => form.setData('sku', e.target.value.toUpperCase())} />}
                        </Field>
                        <Field label="Barcode" hint="Scan into this box" error={form.errors.barcode}>
                            {(id, d) => <Input id={id} aria-describedby={d} className="font-mono" value={form.data.barcode} onChange={(e) => form.setData('barcode', e.target.value)} />}
                        </Field>
                    </div>
                    <Field label="Category" error={form.errors.category}>
                        {(id, d) => (
                            <>
                                <Input id={id} aria-describedby={d} list="product-categories" value={form.data.category} onChange={(e) => form.setData('category', e.target.value)} />
                                <datalist id="product-categories">
                                    {categories.map((c) => (
                                        <option key={c} value={c} />
                                    ))}
                                </datalist>
                            </>
                        )}
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Selling price" error={form.errors.price}>
                            {(id, d) => <MoneyInput id={id} aria-describedby={d} value={form.data.price} onChange={(e) => form.setData('price', e.target.value)} />}
                        </Field>
                        <Field label="Cost" hint={price > 0 ? `${(((price - cost) / price) * 100).toFixed(0)}% margin` : undefined} error={form.errors.cost}>
                            {(id, d) => <MoneyInput id={id} aria-describedby={d} value={form.data.cost} onChange={(e) => form.setData('cost', e.target.value)} />}
                        </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {!product && !form.data.inventory_item_id && (
                            <Field label="Opening stock" error={form.errors.opening_stock}>
                                {(id, d) => <Input id={id} aria-describedby={d} type="number" min={0} className="num" value={form.data.opening_stock} onChange={(e) => form.setData('opening_stock', e.target.value)} />}
                            </Field>
                        )}
                        <Field label="Reorder at" hint="Alert when stock drops to this" error={form.errors.reorder_level}>
                            {(id, d) => <Input id={id} aria-describedby={d} type="number" min={0} className="num" value={form.data.reorder_level} onChange={(e) => form.setData('reorder_level', e.target.value)} />}
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
                    <Field label="Also a raw material" hint="Optional" error={form.errors.inventory_item_id}>
                        {(id, d) => (
                            <Select id={id} aria-describedby={d} value={form.data.inventory_item_id} onChange={(e) => form.setData('inventory_item_id', e.target.value)}>
                                <option value="">No, it has its own stock</option>
                                {materials.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        Sell from {m.name} ({m.unit})
                                    </option>
                                ))}
                            </Select>
                        )}
                    </Field>
                    <Switch checked={form.data.active} onChange={(v) => form.setData('active', v)} label="Sold at the POS" className="border border-line px-3 py-2.5" />
                    <button type="submit" hidden />
                </form>
            </Drawer>
            {product && (
                <ConfirmDialog
                    open={confirmDelete}
                    onOpenChange={setConfirmDelete}
                    title={`Remove ${product.name}?`}
                    body="It disappears from the POS and catalog. Past sales keep their record."
                    confirmLabel="Remove product"
                    onConfirm={() => router.delete(route('products.destroy', product.id), { onSuccess: onClose, onFinish: () => setConfirmDelete(false) })}
                />
            )}
        </>
    );
}
