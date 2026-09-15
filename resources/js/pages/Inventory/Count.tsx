import { Head, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { qty } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Row {
    item_type: 'product' | 'inventory';
    item_id: number;
    name: string;
    category: string;
    unit: string;
    system: number;
}

/** Walk the shelves with a tablet: type what you see, the difference is logged as a count correction. */
export default function InventoryCount({ items }: { items: Row[] }) {
    const [counts, setCounts] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [filter, setFilter] = useState('');
    const key = (r: Row) => `${r.item_type}:${r.item_id}`;

    const groups = useMemo(() => {
        const q = filter.toLowerCase();
        return items
            .filter((r) => !q || r.name.toLowerCase().includes(q))
            .reduce<Record<string, Row[]>>((acc, r) => {
                (acc[r.category] ??= []).push(r);
                return acc;
            }, {});
    }, [items, filter]);

    const entered = Object.values(counts).filter((v) => v !== '').length;
    const differences = items.filter((r) => counts[key(r)] !== undefined && counts[key(r)] !== '' && Math.abs(Number(counts[key(r)]) - r.system) > 0.0005).length;

    const save = () => {
        setSaving(true);
        router.post(
            route('inventory.count.store'),
            { counts: items.map((r) => ({ item_type: r.item_type, item_id: r.item_id, counted: counts[key(r)] === undefined || counts[key(r)] === '' ? null : Number(counts[key(r)]) })) },
            { onFinish: () => setSaving(false) },
        );
    };

    return (
        <>
            <Head title="Stock count" />
            <PageHeader
                back={{ href: route('inventory.index'), label: 'Inventory' }}
                title="Stock count"
                description="Enter what is physically on the shelf. Leave a row blank to skip it. Only differences are posted, each logged as a count correction."
                actions={
                    <Button variant="primary" onClick={save} loading={saving} disabled={!entered}>
                        Post count ({entered} counted, {differences} different)
                    </Button>
                }
            />
            <div className="border-b border-line bg-surface px-5 py-2.5">
                <Input className="max-w-72" placeholder="Find an item" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter items" />
            </div>
            <div className="bg-surface">
                <Table minWidth={640}>
                    <THead>
                        <tr>
                            <Th>Item</Th>
                            <Th align="right">System says</Th>
                            <Th align="right">Counted</Th>
                            <Th align="right">Difference</Th>
                        </tr>
                    </THead>
                    <tbody>
                        {Object.entries(groups).map(([group, rows]) => (
                            <GroupRows key={group} group={group} rows={rows} counts={counts} setCount={(k, v) => setCounts((c) => ({ ...c, [k]: v }))} keyOf={key} />
                        ))}
                    </tbody>
                </Table>
            </div>
        </>
    );
}

function GroupRows({ group, rows, counts, setCount, keyOf }: { group: string; rows: Row[]; counts: Record<string, string>; setCount: (k: string, v: string) => void; keyOf: (r: Row) => string }) {
    return (
        <>
            <tr className="bg-bg">
                <td colSpan={4} className="border-b border-line px-5 py-1.5 text-sm font-medium text-muted">
                    {group}
                </td>
            </tr>
            {rows.map((r) => {
                const k = keyOf(r);
                const v = counts[k];
                const diff = v === undefined || v === '' ? null : Number(v) - r.system;
                return (
                    <Tr key={k}>
                        <Td>{r.name}</Td>
                        <Td numeric muted>
                            {qty(r.system)} {r.unit}
                        </Td>
                        <Td align="right">
                            <Input type="number" min={0} step="any" inputMode="decimal" className="num ml-auto w-32 text-right" aria-label={`Counted ${r.name}`} value={v ?? ''} onChange={(e) => setCount(k, e.target.value)} />
                        </Td>
                        <Td numeric className={cn(diff === null ? 'text-ghost' : Math.abs(diff) < 0.0005 ? 'text-ok-text' : diff < 0 ? 'text-accent-text' : 'text-warn-text')}>
                            {diff === null ? '' : Math.abs(diff) < 0.0005 ? 'Matches' : `${diff > 0 ? '+' : ''}${qty(diff)} ${r.unit}`}
                        </Td>
                    </Tr>
                );
            })}
        </>
    );
}
