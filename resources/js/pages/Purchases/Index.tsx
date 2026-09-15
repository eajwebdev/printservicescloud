import { Head, router } from '@inertiajs/react';
import { PackageCheck, Plus } from 'lucide-react';
import { ListPage, SummaryStrip, ToolbarSearch } from '@/components/list-page';
import { purchaseTabs } from '@/components/module-tabs';
import { ButtonLink } from '@/components/ui/button';
import { Chip, type Tone } from '@/components/ui/chip';
import { Select } from '@/components/ui/field';
import { ChipGroup } from '@/components/ui/filter-chip';
import { EmptyState, Pagination } from '@/components/ui/misc';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { useFilters } from '@/hooks/use-filters';
import { date, isPast, peso } from '@/lib/format';
import { cn, useCan } from '@/lib/utils';
import type { Option, Paginated } from '@/types';

export const PO_TONE: Record<string, Tone> = { draft: 'outline', ordered: 'info', partial: 'warn', received: 'ok', cancelled: 'neutral' };
export const PO_LABEL: Record<string, string> = { draft: 'Draft', ordered: 'Ordered', partial: 'Partly received', received: 'Received', cancelled: 'Cancelled' };

interface Row {
    id: number;
    po_no: string;
    supplier: string | null;
    status: string;
    total: number;
    items_count: number;
    expected_at: string | null;
    ordered_at: string | null;
    received_at: string | null;
    created_at: string;
}

interface Props {
    purchases: Paginated<Row>;
    filters: Record<string, string | undefined>;
    suppliers: Option[];
    counts: Record<string, number>;
    outstanding: { count: number; value: number };
    trend: { name: string; points: { month: string; cost: number }[] }[];
}

export default function PurchasesIndex({ purchases, filters: initial, suppliers, counts, outstanding, trend }: Props) {
    const can = useCan();
    const { filters, set, setFilters } = useFilters(route('purchases.index'), { q: initial.q ?? '', status: initial.status ?? '', supplier: initial.supplier ?? '' });

    return (
        <>
            <Head title="Purchases" />
            <ListPage
                title="Purchases"
                description="Order from suppliers, then receive the delivery here. Received stock updates inventory and costs."
                tabs={purchaseTabs('purchases')}
                actions={
                    can('purchases.create') && (
                        <ButtonLink href={route('purchases.create')} variant="primary" icon={<Plus />}>
                            New purchase order
                        </ButtonLink>
                    )
                }
                toolbar={
                    <>
                        <ToolbarSearch value={filters.q ?? ''} onChange={(v) => set('q', v)} placeholder="PO number" />
                        <ChipGroup
                            label="Status"
                            value={(filters.status ?? '') as string}
                            onChange={(v) => set('status', v)}
                            options={[
                                { value: 'draft', label: 'Drafts', count: counts.draft ?? 0 },
                                { value: 'ordered', label: 'Waiting for delivery', count: counts.ordered ?? 0, tone: 'warn' },
                                { value: 'partial', label: 'Partly received', count: counts.partial ?? 0, tone: 'warn' },
                                { value: 'received', label: 'Received', count: counts.received ?? 0 },
                            ]}
                        />
                        <Select selectSize="sm" className="w-52" aria-label="Supplier" value={filters.supplier} onChange={(e) => set('supplier', e.target.value)}>
                            <option value="">All suppliers</option>
                            {suppliers.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </Select>
                    </>
                }
                summary={
                    <SummaryStrip
                        items={[
                            { label: 'Waiting for delivery', value: outstanding.count, tone: outstanding.count ? 'warn' : undefined },
                            { label: 'Value still to arrive', value: peso(outstanding.value) },
                        ]}
                    />
                }
                footer={purchases.data.length > 0 && <Pagination links={purchases.links} from={purchases.from} to={purchases.to} total={purchases.total} />}
                aside={
                    <div>
                        <p className="px-4 pt-3 pb-1 text-sm font-medium">Unit cost trend, 6 months</p>
                        {trend.length ? (
                            <ul className="divide-y divide-line">
                                {trend.map((t) => {
                                    const first = t.points[0]?.cost ?? 0;
                                    const last = t.points[t.points.length - 1]?.cost ?? 0;
                                    const change = first > 0 ? ((last - first) / first) * 100 : 0;
                                    return (
                                        <li key={t.name} className="px-4 py-2">
                                            <div className="flex justify-between gap-3">
                                                <span className="truncate text-sm">{t.name}</span>
                                                <span className="num text-sm">₱{last.toFixed(2)}</span>
                                            </div>
                                            <p className="num text-xs text-faint">
                                                {t.points.length > 1 ? (
                                                    <span className={change > 0 ? 'text-warn-text' : 'text-ok-text'}>
                                                        {change > 0 ? '+' : ''}
                                                        {change.toFixed(1)}% since {t.points[0].month}
                                                    </span>
                                                ) : (
                                                    `One delivery, ${t.points[0]?.month}`
                                                )}
                                            </p>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="px-4 py-2 text-sm text-muted">Costs show here after deliveries are received.</p>
                        )}
                    </div>
                }
            >
                {purchases.data.length ? (
                    <Table flush minWidth={760}>
                        <THead>
                            <tr>
                                <Th>PO</Th>
                                <Th>Supplier</Th>
                                <Th>Status</Th>
                                <Th>Delivery</Th>
                                <Th align="right">Total</Th>
                                <Th align="right">Next step</Th>
                            </tr>
                        </THead>
                        <tbody>
                            {purchases.data.map((p) => {
                                const late = (p.status === 'ordered' || p.status === 'partial') && isPast(p.expected_at ? `${p.expected_at}T23:59:59` : null);
                                return (
                                    <Tr key={p.id} interactive onClick={() => router.visit(route('purchases.show', p.id))} className={cn(p.status === 'cancelled' && 'opacity-55')}>
                                        <Td className="whitespace-nowrap">
                                            <span className="block font-mono text-sm">{p.po_no}</span>
                                            <span className="block text-xs text-faint">
                                                {date(p.created_at)}, {p.items_count} {p.items_count === 1 ? 'line' : 'lines'}
                                            </span>
                                        </Td>
                                        <Td>{p.supplier}</Td>
                                        <Td>
                                            <Chip tone={PO_TONE[p.status]}>{PO_LABEL[p.status]}</Chip>
                                        </Td>
                                        <Td className={cn('text-sm whitespace-nowrap', late ? 'text-accent-text' : 'text-muted')}>
                                            {p.received_at ? `Arrived ${date(p.received_at)}` : p.expected_at ? `${late ? 'Late, was due' : 'Due'} ${date(p.expected_at)}` : ''}
                                        </Td>
                                        <Td numeric>{peso(p.total)}</Td>
                                        <Td align="right" onClick={(e) => e.stopPropagation()}>
                                            {can('purchases.edit') && (p.status === 'ordered' || p.status === 'partial') && (
                                                <ButtonLink size="xs" variant="primary" icon={<PackageCheck />} href={route('purchases.show', p.id)}>
                                                    Receive
                                                </ButtonLink>
                                            )}
                                            {can('purchases.edit') && p.status === 'draft' && (
                                                <ButtonLink size="xs" href={route('purchases.edit', p.id)}>
                                                    Finish draft
                                                </ButtonLink>
                                            )}
                                        </Td>
                                    </Tr>
                                );
                            })}
                        </tbody>
                    </Table>
                ) : (
                    <EmptyState
                        className="h-full"
                        title={filters.q || filters.status || filters.supplier ? 'No purchase orders match' : 'No purchase orders'}
                        body={filters.q || filters.status || filters.supplier ? 'Clear a filter to see every PO.' : 'When tarp rolls or ink run low, order from a supplier here and receive the delivery against it.'}
                        action={
                            (filters.q || filters.status || filters.supplier) && (
                                <button type="button" className="text-sm text-fg underline" onClick={() => setFilters({ q: '', status: '', supplier: '' })}>
                                    Clear filters
                                </button>
                            )
                        }
                    />
                )}
            </ListPage>
        </>
    );
}
