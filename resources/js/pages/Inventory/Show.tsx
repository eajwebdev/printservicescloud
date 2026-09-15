import { Head, Link } from '@inertiajs/react';
import { Pencil, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { StockAdjustModal } from '@/components/stock-adjust';
import { StockLedger } from '@/components/stock-ledger';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Panel, Stat } from '@/components/ui/misc';
import { money, peso, qty } from '@/lib/format';
import { useCan } from '@/lib/utils';
import type { Option, Paginated, StockMovementRow } from '@/types';
import { ItemDrawer, type ItemRow } from './Index';

interface Props {
    item: ItemRow;
    ledger: Paginated<StockMovementRow>;
    usage30: number;
    usedBy: { service_id: number; service: string | null; qty_per_unit: number; basis: string }[];
    reasons: Record<string, string>;
    suppliers: Option[];
    units: string[];
}

export default function InventoryShow({ item, ledger, usage30, usedBy, reasons, suppliers, units }: Props) {
    const can = useCan();
    const [adjusting, setAdjusting] = useState(false);
    const [editing, setEditing] = useState(false);
    const daysLeft = usage30 > 0 ? Math.floor(item.stock / (usage30 / 30)) : null;

    return (
        <>
            <Head title={item.name} />
            <PageHeader
                back={{ href: route('inventory.index'), label: 'Inventory' }}
                title={item.name}
                meta={item.low && <Chip tone={item.stock <= 0 ? 'red' : 'warn'}>{item.stock <= 0 ? 'Out of stock' : 'Low stock'}</Chip>}
                description={[item.sku, item.category, item.supplier ? `Supplied by ${item.supplier}` : null].filter(Boolean).join(', ')}
                actions={
                    <>
                        {can('inventory.edit') && (
                            <Button icon={<Pencil />} onClick={() => setEditing(true)}>
                                Edit
                            </Button>
                        )}
                        {can('inventory.adjust') && (
                            <Button variant="primary" icon={<SlidersHorizontal />} onClick={() => setAdjusting(true)}>
                                Adjust stock
                            </Button>
                        )}
                    </>
                }
            />
            <section className="grid grid-cols-2 divide-x divide-line border-b border-line bg-surface md:grid-cols-4">
                <Stat label="On hand" value={`${qty(item.stock)} ${item.unit}`} tone={item.low ? 'warn' : undefined} sub={`Reorder at ${qty(item.reorder_level)}`} />
                <Stat label="Used, last 30 days" value={`${qty(usage30)} ${item.unit}`} sub={daysLeft !== null ? `About ${daysLeft} days left at this pace` : 'No usage yet'} />
                <Stat label="Moving-average cost" value={`₱${money(item.cost)}`} sub={`per ${item.unit}`} />
                <Stat label="Stock value" value={peso(item.value)} />
            </section>
            <div className="grid gap-5 p-5 lg:p-6 xl:grid-cols-[1fr_320px]">
                <Panel title="Movement ledger" className="min-w-0">
                    <StockLedger ledger={ledger} unit={item.unit} />
                </Panel>
                <Panel title="Used by services">
                    {usedBy.length ? (
                        <ul className="divide-y divide-line">
                            {usedBy.map((u) => (
                                <li key={u.service_id} className="flex justify-between gap-3 px-5 py-2.5">
                                    {can('services.edit') ? (
                                        <Link href={route('services.edit', u.service_id)} className="text-base hover:underline">
                                            {u.service}
                                        </Link>
                                    ) : (
                                        <span>{u.service}</span>
                                    )}
                                    <span className="num text-sm text-muted">
                                        {qty(u.qty_per_unit)} {item.unit} / {u.basis === 'per_sqft' ? 'sqft' : 'pc'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="px-5 py-4 text-base text-muted">Not in any recipe yet. Selling services won't deduct it.</p>
                    )}
                </Panel>
            </div>
            <StockAdjustModal open={adjusting} onClose={() => setAdjusting(false)} item={{ type: 'inventory', id: item.id, name: item.name, unit: item.unit, stock: item.stock }} reasons={reasons} />
            <ItemDrawer open={editing} onClose={() => setEditing(false)} item={item} suppliers={suppliers} units={units} categories={[]} />
        </>
    );
}
