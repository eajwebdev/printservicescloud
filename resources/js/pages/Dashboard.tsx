import { Head, Link, router } from '@inertiajs/react';
import { ArrowUpRight, ScanBarcode } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BranchFilter } from '@/components/branch-filter';
import { switchBranch } from '@/components/branch-switcher';
import { axisProps, ChartTooltipBox, gridProps } from '@/components/charts';
import { DateRangeFilter, datePresets, type DateRangeValue } from '@/components/date-range-filter';
import { FilterBar, PageHeader } from '@/components/page-header';
import { ButtonLink } from '@/components/ui/button';
import { Chip, LiveDot, StatusChip } from '@/components/ui/chip';
import { CountUp, EmptyState, Panel } from '@/components/ui/misc';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { compactPeso, date, dayTime, isPast, METHOD_LABEL, peso, qty, relative, shortDate } from '@/lib/format';
import { cn, useAppPage } from '@/lib/utils';
import type { BranchFilterProps, OrderStatus } from '@/types';

interface BranchRow {
    id: number;
    name: string;
    code: string;
    sales: number;
    orders: number;
    average: number;
    gross_profit: number;
    expenses: number;
    net: number;
    collected: number;
    receivables: number;
    open_jobs: number;
    overdue_jobs: number;
    low_stock: number;
    open_drawers: number;
    cash_on_hand: number;
    billing: { status: string; locked: boolean; overdue_count: number };
}

interface Props {
    range: DateRangeValue & { days: number };
    branchFilter: BranchFilterProps;
    branches: BranchRow[];
    stats: {
        sales: number;
        orders: number;
        average: number;
        prev_sales: number;
        prev_from: string;
        prev_to: string;
        gross_profit: number;
        expenses: number;
        net: number;
        in_production: number;
        pending_jobs: number;
        low_stock: number;
        receivables: number;
        cash_on_hand: number;
        petty_balance: number;
    };
    chart: { grain: 'day' | 'month'; points: { key: string; total: number; in_range: boolean }[] };
    byMethod: { method: string; total: number }[];
    lowStock: { id: number; type: 'inventory' | 'product'; name: string; unit: string; stock: number; reorder_level: number; branch: string | null }[];
    dueSoon: { id: number; order_no: string; customer: string; status: OrderStatus; due_at: string | null; balance: number; rush: boolean; total: number; branch: string | null }[];
}

const day = (iso: string) => date(iso + 'T00:00:00');
const monthLabel = (key: string) => new Intl.DateTimeFormat('en-PH', { month: 'short', year: '2-digit' }).format(new Date(key + '-01T00:00:00'));
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** "Today", "Last 7 days", or "Sep 1 to Sep 14, 2026" for a custom pick. */
function rangeName(range: DateRangeValue) {
    const preset = datePresets(['today', 'yesterday', '7d', '30d', 'month', 'last_month', 'year']).find((p) => p.from === range.from && p.to === range.to);
    if (preset) return preset.key === '7d' || preset.key === '30d' ? `Last ${preset.label}` : preset.label;
    return range.from === range.to ? day(range.from) : `${shortDate(range.from + 'T00:00:00')} to ${day(range.to)}`;
}

export default function Dashboard({ range, branchFilter, branches, stats, chart, byMethod, lowStock, dueSoon }: Props) {
    const { props } = useAppPage();
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const name = rangeName(range);
    const isPreset = !/\d{4}/.test(name);
    const single = range.from === range.to;
    const methodMax = Math.max(1, ...byMethod.map((m) => Math.abs(m.total)));
    const change = stats.prev_sales > 0 ? ((stats.sales - stats.prev_sales) / stats.prev_sales) * 100 : null;
    const prevName = single ? (name === 'Today' ? 'yesterday' : 'the day before') : `the ${range.days} days before`;
    const partial = chart.points.some((p) => !p.in_range);
    const chartTitle = chart.grain === 'month' ? `Sales by month, ${isPreset ? lower(name) : name}` : partial ? `Sales, 14 days to ${day(range.to)}` : `Daily sales, ${isPreset ? lower(name) : name}`;
    const scoped = !branchFilter.locked;
    const multi = scoped && branches.length > 1;
    const load = (r: DateRangeValue, ids: number[]) =>
        router.get(route('dashboard'), { from: r.from, to: r.to, ...(ids.length ? { branches: ids } : {}) }, { preserveScroll: true, preserveState: true, only: ['range', 'stats', 'chart', 'byMethod', 'branchFilter', 'branches', 'lowStock', 'dueSoon'] });
    const apply = (r: DateRangeValue) => load(r, branchFilter.selected);
    const reportParams = { from: range.from, to: range.to, ...(branchFilter.selected.length ? { branches: branchFilter.selected } : {}) };
    const canReport = !!props.auth?.pages.includes('reports');
    const branchMax = Math.max(1, ...branches.map((b) => b.sales));

    const tiles = [
        {
            label: `Sales, ${isPreset ? lower(name) : name}`,
            value: stats.sales,
            format: (n: number) => peso(n),
            sub: stats.orders ? `${stats.orders} order${stats.orders === 1 ? '' : 's'}, avg ${peso(stats.average)}` : 'No orders in these dates',
            href: canReport ? route('reports.index', reportParams) : route('orders.index', { view: 'today' }),
        },
        { label: 'Net profit', value: stats.net, format: (n: number) => peso(n), sub: `gross ${peso(stats.gross_profit)}, expenses ${peso(stats.expenses)}`, href: canReport ? route('reports.index', reportParams) : route('dashboard'), negative: stats.net < 0 },
        { label: 'In production', value: stats.in_production, format: (n: number) => Math.round(n).toString(), sub: `${stats.pending_jobs} waiting to start`, href: route('orders.index', { view: 'board' }), live: stats.in_production > 0 },
        { label: 'Low stock', value: stats.low_stock, format: (n: number) => Math.round(n).toString(), sub: stats.low_stock ? 'items at or under reorder level' : 'everything above reorder level', href: route('inventory.index', { stock: 'low' }), warn: stats.low_stock > 0 },
        { label: 'Receivables', value: stats.receivables, format: (n: number) => peso(n), sub: 'owed on credit and balances', href: route('customers.index', { owing: 1, sort: 'balance' }) },
        { label: 'Cash on hand', value: stats.cash_on_hand, format: (n: number) => peso(n), sub: `open drawers; petty cash ${peso(stats.petty_balance)}`, href: route('session.index') },
    ];

    return (
        <>
            <Head title="Dashboard" />
            <PageHeader
                title={`${greeting}, ${props.auth?.user.name.split(' ')[0]}`}
                description={`${new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}. ${branchFilter.label}. Sales and profit follow the dates you pick; production, stock, receivables and cash are live.`}
                actions={
                    props.auth?.pages.includes('pos') && props.branch?.current && (
                        <ButtonLink href={route('pos.index')} variant="primary" icon={<ScanBarcode />}>
                            New sale
                        </ButtonLink>
                    )
                }
            />

            {scoped && branchFilter.options.length > 1 && (
                <FilterBar className="bg-bg">
                    <span className="text-sm text-faint">Branches</span>
                    <BranchFilter value={branchFilter} onChange={(ids) => load(range, ids)} />
                </FilterBar>
            )}
            <FilterBar>
                <DateRangeFilter value={range} onApply={apply} />
            </FilterBar>

            <div className="space-y-5 p-5 lg:p-6">
                {/* The HUD strip: one band, divided by rules. */}
                <section aria-label="At a glance" className="grid grid-cols-2 border border-line bg-surface md:grid-cols-3 xl:grid-cols-6">
                    {tiles.map((t, i) => (
                        <Link
                            key={t.label}
                            href={t.href}
                            className={cn(
                                'group relative border-line px-5 py-4 transition-colors hover:bg-raised',
                                // Six tiles: 2 per row on phones, 3 on tablets, one row on desktops.
                                i < 4 && 'border-b',
                                i % 2 === 0 && 'border-r',
                                i < 3 ? 'md:border-b' : 'md:border-b-0',
                                i % 3 !== 2 ? 'md:border-r' : 'md:border-r-0',
                                'xl:border-b-0',
                                i < 5 ? 'xl:border-r' : 'xl:border-r-0',
                            )}
                        >
                            <p className="flex items-center gap-2 text-sm text-faint">
                                {t.live && <LiveDot />}
                                <span className="truncate">{t.label}</span>
                                {i > 1 && (
                                    <span className="hidden rounded-xs border border-line px-1 text-2xs tracking-wide text-faint uppercase xl:inline" title="Live figure; not affected by the dates">
                                        Now
                                    </span>
                                )}
                                <ArrowUpRight className="ml-auto size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                            </p>
                            <CountUp
                                value={t.value}
                                format={t.format}
                                delay={i * 0.06}
                                className={cn('mt-1 block text-2xl font-semibold xl:text-[1.6rem]', t.warn && 'text-warn-text', t.negative && 'text-accent-text')}
                            />
                            <p className="mt-1 truncate text-xs text-faint">
                                {t.sub}
                                {i === 0 && change !== null && (
                                    <span title={`${day(stats.prev_from)} to ${day(stats.prev_to)}: ${peso(stats.prev_sales)}`}>
                                        {', '}
                                        <span className={cn('num', change >= 0 ? 'text-ok-text' : 'text-accent-text')}>
                                            {change >= 0 ? '+' : ''}
                                            {change.toFixed(0)}%
                                        </span>{' '}
                                        vs {prevName}
                                    </span>
                                )}
                            </p>
                        </Link>
                    ))}
                </section>

                {multi && (
                    <Panel
                        title={`Branches side by side, ${isPreset ? lower(name) : name}`}
                        actions={
                            canReport && (
                                <Link href={route('reports.index', reportParams)} className="text-sm text-muted hover:text-fg">
                                    Branch report
                                </Link>
                            )
                        }
                    >
                        <Table minWidth={1040}>
                            <THead>
                                <tr>
                                    <Th>Branch</Th>
                                    <Th align="right">Sales</Th>
                                    <Th align="right">Orders</Th>
                                    <Th align="right">Net</Th>
                                    <Th align="right">Collected</Th>
                                    <Th align="right">Customers owe</Th>
                                    <Th align="right">Jobs open</Th>
                                    <Th align="right">Low stock</Th>
                                    <Th align="right">Cash in drawers</Th>
                                    <Th />
                                </tr>
                            </THead>
                            <tbody>
                                {branches.map((b) => (
                                    <Tr key={b.id}>
                                        <Td className="min-w-48">
                                            <p className="flex items-center gap-2">
                                                <span className="font-medium">{b.name}</span>
                                                <span className="font-mono text-2xs text-faint">{b.code}</span>
                                                {b.billing.locked ? <Chip tone="red">Locked</Chip> : b.billing.overdue_count > 0 ? <Chip tone="warn">Bill overdue</Chip> : b.billing.status === 'trial' ? <Chip tone="info">Trial</Chip> : null}
                                            </p>
                                            <div className="mt-1.5 h-1 bg-sunken" aria-hidden>
                                                <div className="h-full bg-accent" style={{ width: `${(Math.max(0, b.sales) / branchMax) * 100}%`, opacity: 0.8 }} />
                                            </div>
                                        </Td>
                                        <Td numeric>{peso(b.sales)}</Td>
                                        <Td numeric muted>
                                            {b.orders}
                                            <span className="block text-2xs text-faint">avg {peso(b.average)}</span>
                                        </Td>
                                        <Td numeric className={b.net < 0 ? 'text-accent-text' : 'text-ok-text'}>
                                            {peso(b.net)}
                                        </Td>
                                        <Td numeric muted>
                                            {peso(b.collected)}
                                        </Td>
                                        <Td numeric className={b.receivables > 0 ? 'text-warn-text' : 'text-faint'}>
                                            {peso(b.receivables)}
                                        </Td>
                                        <Td numeric muted>
                                            {b.open_jobs}
                                            {b.overdue_jobs > 0 && <span className="block text-2xs text-accent-text">{b.overdue_jobs} late</span>}
                                        </Td>
                                        <Td numeric className={b.low_stock > 0 ? 'text-warn-text' : 'text-faint'}>
                                            {b.low_stock}
                                        </Td>
                                        <Td numeric muted>
                                            {peso(b.cash_on_hand)}
                                            <span className="block text-2xs text-faint">{b.open_drawers} open</span>
                                        </Td>
                                        <Td align="right">
                                            <button type="button" className="text-sm whitespace-nowrap text-muted hover:text-fg" onClick={() => switchBranch(b.id, route('dashboard'))}>
                                                Work here
                                            </button>
                                        </Td>
                                    </Tr>
                                ))}
                            </tbody>
                        </Table>
                    </Panel>
                )}

                <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
                    <Panel
                        title={chartTitle}
                        actions={
                            canReport && (
                                <Link href={route('reports.index', reportParams)} className="text-sm text-muted hover:text-fg">
                                    Full report
                                </Link>
                            )
                        }
                        bodyClass="px-3 pt-4 pb-2"
                    >
                        <div className="h-64" role="img" aria-label={`${chartTitle}. Total for ${name}: ${peso(stats.sales)}.`}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chart.points} margin={{ top: 8, right: 8, bottom: 0, left: 4 }} barCategoryGap={chart.points.length > 45 ? '12%' : '22%'}>
                                    <CartesianGrid {...gridProps} />
                                    <XAxis dataKey="key" {...axisProps} tickFormatter={(k: string) => (chart.grain === 'month' ? monthLabel(k) : shortDate(k + 'T00:00:00'))} interval="preserveStartEnd" minTickGap={16} />
                                    <YAxis {...axisProps} width={52} tickFormatter={(v: number) => compactPeso(v)} />
                                    <Tooltip
                                        cursor={{ fill: 'var(--selected)' }}
                                        content={({ active, payload }) =>
                                            active && payload?.length ? (
                                                <ChartTooltipBox
                                                    title={chart.grain === 'month' ? monthLabel(String(payload[0].payload.key)) : day(String(payload[0].payload.key))}
                                                    rows={[{ label: 'Sales', value: peso(Number(payload[0].value)) }]}
                                                />
                                            ) : null
                                        }
                                    />
                                    <Bar dataKey="total" radius={[3, 3, 0, 0]} animationDuration={900} animationEasing="ease-out">
                                        {chart.points.map((p) => (
                                            <Cell key={p.key} fill={partial && p.in_range ? 'var(--accent)' : 'var(--chart-neutral)'} fillOpacity={partial ? (p.in_range ? 1 : 0.45) : 0.8} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="px-2 pt-1 text-xs text-faint">
                            {partial ? `${single ? 'The picked day is' : 'The picked days are'} in red; earlier days are shown for comparison.` : `${peso(stats.sales)} across ${chart.points.length} ${chart.grain === 'month' ? 'months' : 'days'}.`}
                        </p>
                    </Panel>

                    <Panel title={`Money in, ${isPreset ? lower(name) : name}`} bodyClass="px-5 py-4">
                        <ul className="space-y-4">
                            {byMethod.map((m) => (
                                <li key={m.method}>
                                    <div className="mb-1.5 flex items-baseline justify-between">
                                        <span className="text-base text-muted">{METHOD_LABEL[m.method]}</span>
                                        <span className="num text-base text-fg">{peso(m.total)}</span>
                                    </div>
                                    <div className="h-2 bg-sunken">
                                        <div
                                            className="h-full origin-left bg-[var(--chart-neutral)] transition-[width] duration-700"
                                            style={{ width: `${(Math.max(0, m.total) / methodMax) * 100}%`, opacity: m.method === 'credit' ? 0.45 : 0.8 }}
                                        />
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <p className="mt-4 text-xs text-faint">Sales and balance collections, less refunds. Credit is sold on account; no money changed hands.</p>
                    </Panel>
                </div>

                <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
                    <Panel
                        title="Due next on the production board"
                        actions={
                            <Link href={route('orders.index', { view: 'board' })} className="text-sm text-muted hover:text-fg">
                                Open board
                            </Link>
                        }
                    >
                        {dueSoon.length ? (
                            <Table minWidth={560}>
                                <THead>
                                    <tr>
                                        <Th>Order</Th>
                                        <Th>Customer</Th>
                                        <Th>Status</Th>
                                        <Th>Due</Th>
                                        <Th align="right">Balance</Th>
                                    </tr>
                                </THead>
                                <tbody>
                                    {dueSoon.map((o) => {
                                        const overdue = isPast(o.due_at) && o.status !== 'ready';
                                        return (
                                            <Tr key={o.id} interactive onClick={() => router.visit(route('orders.show', o.id))}>
                                                <Td className="whitespace-nowrap">
                                                    <Link href={route('orders.show', o.id)} className="font-mono text-sm text-fg hover:underline">
                                                        {o.order_no}
                                                    </Link>
                                                    {o.rush && <Chip tone="red" className="ml-2">Rush</Chip>}
                                                    {scoped && o.branch && <span className="ml-2 font-mono text-2xs text-faint">{o.branch}</span>}
                                                </Td>
                                                <Td className="max-w-44 truncate">{o.customer}</Td>
                                                <Td>
                                                    <StatusChip status={o.status} />
                                                </Td>
                                                <Td className={cn('text-sm whitespace-nowrap', overdue ? 'text-accent-text' : 'text-muted')}>
                                                    {o.due_at ? (
                                                        <>
                                                            {dayTime(o.due_at)} <span className="text-faint">({overdue ? 'overdue ' : ''}{relative(o.due_at)})</span>
                                                        </>
                                                    ) : (
                                                        'No date'
                                                    )}
                                                </Td>
                                                <Td numeric className={o.balance > 0 ? 'text-warn-text' : 'text-faint'}>
                                                    {o.balance > 0 ? peso(o.balance) : 'Paid'}
                                                </Td>
                                            </Tr>
                                        );
                                    })}
                                </tbody>
                            </Table>
                        ) : (
                            <EmptyState compact title="The board is clear" body="No job orders waiting. Tarps, stickers and signage you take will line up here." />
                        )}
                    </Panel>

                    <Panel
                        title="Running low"
                        actions={
                            <Link href={route('inventory.index', { stock: 'low' })} className="text-sm text-muted hover:text-fg">
                                All low stock
                            </Link>
                        }
                    >
                        {lowStock.length ? (
                            <ul className="divide-y divide-line">
                                {lowStock.map((i) => {
                                    const pct = i.reorder_level > 0 ? Math.max(0, Math.min(1, i.stock / i.reorder_level)) : 0;
                                    return (
                                        <li key={`${i.type}-${i.id}`}>
                                            <Link href={i.type === 'inventory' ? route('inventory.show', i.id) : route('products.show', i.id)} className="block px-5 py-2.5 hover:bg-raised">
                                                <div className="flex items-baseline justify-between gap-3">
                                                    <span className="truncate text-base">
                                                        {i.name}
                                                        {scoped && i.branch && <span className="ml-2 font-mono text-2xs text-faint">{i.branch}</span>}
                                                    </span>
                                                    <span className="num shrink-0 text-sm text-warn-text">
                                                        {qty(i.stock)} <span className="text-faint">/ {qty(i.reorder_level)} {i.unit}</span>
                                                    </span>
                                                </div>
                                                <div className="mt-1.5 h-1 bg-sunken">
                                                    <div className="h-full bg-warn" style={{ width: `${pct * 100}%` }} />
                                                </div>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <EmptyState compact title="Shelves are stocked" body="Nothing is under its reorder level." />
                        )}
                    </Panel>
                </div>
            </div>
        </>
    );
}
