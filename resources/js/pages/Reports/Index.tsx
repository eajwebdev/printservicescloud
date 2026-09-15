import { Head, Link, router } from '@inertiajs/react';
import { Download, FileDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BranchFilter } from '@/components/branch-filter';
import { axisProps, ChartTooltipBox, gridProps, Legend } from '@/components/charts';
import { DateRangeFilter, type DateRangeValue } from '@/components/date-range-filter';
import { FilterBar, PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Menu, MenuItem, MenuLabel } from '@/components/ui/menu';
import { EmptyState, Panel } from '@/components/ui/misc';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { compactPeso, date, dateTime, METHOD_LABEL, peso, qty, shortDate } from '@/lib/format';
import { cn, useCan } from '@/lib/utils';
import type { BranchFilterProps, SessionRow } from '@/types';
import { VarianceText } from '../Session/parts';

interface Props {
    range: DateRangeValue;
    branchFilter: BranchFilterProps;
    csvTypes: Record<string, string>;
    summary: {
        sales: number; orders: number; avg_order: number; jobs: number; instant: number; cost: number; gross_profit: number; expenses: number; net: number;
        margin: number | null; discounts: number; senior_pwd: number; tax: number; voided: number; voided_total: number; refunds: number; collected: number;
        settlements: number; credit_sales: number; receivables: number;
    };
    daily: { date: string; sales: number; cost: number; orders: number; expenses: number }[];
    byMethod: { method: string; total: number }[];
    byCategory: { category: string; revenue: number; cost: number; orders: number }[];
    byHour: { hour: number; orders: number; sales: number }[];
    byWeekday: { day: string; orders: number; sales: number }[];
    byBranch: { id: number; name: string; code: string; orders: number; sales: number; average: number; cost: number; gross_profit: number; expenses: number; net: number; margin: number | null; collected: number; discounts: number; voided: number; receivables: number; share: number }[];
    staff: { id: number; name: string; branches: string; orders: number; sales: number; average: number; discounts: number; voids: number; cash: number; variance: number; drawers: number }[];
    topCustomers: { id: number; name: string; phone: string | null; branch: string | null; orders: number; sales: number; paid: number; balance: number; last_order_at: string | null }[];
    production: { taken: number; taken_value: number; rush: number; released: number; avg_turnaround_hours: number | null; on_time_rate: number | null; open_now: number; overdue_now: number; ready_uncollected: number; by_status: Record<string, number> };
    topItems: { item_type: string; name: string; category: string | null; qty: number; revenue: number; cost: number; orders: number }[];
    materials: { name: string; unit: string; used: number; cost: number }[];
    wastage: { name: string; unit: string | null; qty: number; cost: number }[];
    expenseCategories: { category: string; total: number; count: number }[];
    expenseSources: Record<string, number>;
    voids: { kind: string; order_id: number; order_no: string; branch: string | null; customer: string; user: string | null; amount: number; reason: string | null; at: string }[];
    aging: { buckets: { bucket: string; total: number }[]; rows: { branch: string | null; customer: string | null; customer_id: number; order_no: string | null; order_id: number | null; opened: string; due: string | null; days: number; outstanding: number }[]; total: number };
    sessions: (SessionRow & { branch: string | null })[];
}

const hourLabel = (h: number) => (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`);
const pct = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(0)}%` : '');

export default function Reports(props: Props) {
    const { range, branchFilter, csvTypes, summary, daily, byMethod, byCategory, byHour, byWeekday, byBranch, staff, topCustomers, production, topItems, materials, wastage, expenseCategories, expenseSources, voids, aging, sessions } = props;
    const can = useCan();
    const multi = !branchFilter.locked && byBranch.length > 1;
    const load = (r: DateRangeValue, ids: number[]) => router.get(route('reports.index'), { from: r.from, to: r.to, ...(ids.length ? { branches: ids } : {}) }, { preserveScroll: true, preserveState: false });
    const query = (extra: Record<string, string> = {}) => {
        const q = new URLSearchParams({ from: range.from, to: range.to, ...extra });
        branchFilter.selected.forEach((id) => q.append('branches[]', String(id)));
        return q.toString();
    };
    const csv = (type: string) => `${route('reports.csv')}?${query({ type })}`;
    const exportLink = (type: string) =>
        can('reports.export') ? (
            <a href={csv(type)} className="flex items-center gap-1 text-sm text-muted hover:text-fg">
                <Download className="size-3.5" /> CSV
            </a>
        ) : null;

    const methodMax = Math.max(1, ...byMethod.map((m) => m.total));
    const catMax = Math.max(1, ...byCategory.map((c) => c.revenue));
    const agingMax = Math.max(1, ...aging.buckets.map((b) => b.total));
    const busiest = [...byHour].sort((a, b) => b.sales - a.sales)[0];
    const last = daily[daily.length - 1];

    return (
        <>
            <Head title="Reports" />
            <PageHeader
                title="Reports"
                description={`${branchFilter.label}, ${date(range.from + 'T00:00:00')} to ${date(range.to + 'T00:00:00')}. Profit, cash, staff, customers, production and money owed.`}
                actions={
                    can('reports.export') && (
                        <>
                            <Menu trigger={<Button icon={<Download />}>Export CSV</Button>}>
                                <MenuLabel>
                                    {branchFilter.label}, {shortDate(range.from + 'T00:00:00')} to {shortDate(range.to + 'T00:00:00')}
                                </MenuLabel>
                                {Object.entries(csvTypes).map(([type, label]) => (
                                    <MenuItem key={type} onSelect={() => window.location.assign(csv(type))}>
                                        {label}
                                    </MenuItem>
                                ))}
                            </Menu>
                            <a href={`${route('reports.pdf')}?${query()}`} target="_blank" rel="noreferrer">
                                <Button variant="primary" icon={<FileDown />}>
                                    PDF report
                                </Button>
                            </a>
                        </>
                    )
                }
            />
            {!branchFilter.locked && branchFilter.options.length > 1 && (
                <FilterBar className="bg-bg">
                    <span className="text-sm text-faint">Branches</span>
                    <BranchFilter value={branchFilter} onChange={(ids) => load(range, ids)} />
                </FilterBar>
            )}
            <FilterBar>
                <DateRangeFilter value={range} presets={['today', '7d', '30d', 'month', 'last_month', 'year']} onApply={(r) => load(r, branchFilter.selected)} />
            </FilterBar>

            <section aria-label="Profit summary" className="grid grid-cols-2 border-b border-line bg-surface md:grid-cols-4 xl:grid-cols-8">
                {[
                    { label: 'Sales', value: peso(summary.sales), sub: `${summary.orders} orders, avg ${peso(summary.avg_order)}` },
                    { label: 'Materials and goods', value: peso(summary.cost), sub: `${pct(summary.cost, summary.sales)} of sales` },
                    { label: 'Gross profit', value: peso(summary.gross_profit), sub: `${pct(summary.gross_profit, summary.sales)} of sales` },
                    { label: 'Expenses', value: peso(summary.expenses), sub: 'rent, wages, bills' },
                    { label: 'Net profit', value: peso(summary.net), sub: summary.margin !== null ? `${summary.margin}% net margin` : '', tone: summary.net < 0 ? 'text-accent-text' : 'text-ok-text' },
                    { label: 'Money collected', value: peso(summary.collected), sub: `${peso(summary.settlements)} were old balances` },
                    { label: 'Customers owe', value: peso(summary.receivables), sub: `${peso(summary.credit_sales)} sold on credit`, tone: summary.receivables > 0 ? 'text-warn-text' : undefined },
                    { label: 'Discounts and voids', value: peso(summary.discounts), sub: `${summary.voided} voided (${peso(summary.voided_total)})` },
                ].map((s) => (
                    <div key={s.label} className="border-r border-b border-line px-5 py-4 xl:border-b-0">
                        <p className="text-sm text-faint">{s.label}</p>
                        <p className={cn('hud mt-0.5 text-xl font-semibold', s.tone)}>{s.value}</p>
                        <p className="mt-0.5 truncate text-xs text-faint">{s.sub}</p>
                    </div>
                ))}
            </section>

            <div className="space-y-5 p-5 lg:p-6">
                {multi && (
                    <Panel title="Branch comparison" actions={exportLink('branches')}>
                        <Table minWidth={1100}>
                            <THead>
                                <tr>
                                    <Th>Branch</Th>
                                    <Th align="right">Sales</Th>
                                    <Th align="right">Share</Th>
                                    <Th align="right">Orders</Th>
                                    <Th align="right">Avg order</Th>
                                    <Th align="right">Gross profit</Th>
                                    <Th align="right">Expenses</Th>
                                    <Th align="right">Net</Th>
                                    <Th align="right">Collected</Th>
                                    <Th align="right">Discounts</Th>
                                    <Th align="right">Voids</Th>
                                    <Th align="right">Owed now</Th>
                                </tr>
                            </THead>
                            <tbody>
                                {byBranch.map((b) => (
                                    <Tr key={b.id}>
                                        <Td>
                                            <span className="font-medium">{b.name}</span> <span className="font-mono text-2xs text-faint">{b.code}</span>
                                        </Td>
                                        <Td numeric>{peso(b.sales)}</Td>
                                        <Td numeric className="w-36">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="h-1.5 w-16 bg-sunken">
                                                    <div className="h-full bg-accent" style={{ width: `${b.share}%` }} />
                                                </div>
                                                <span className="text-muted">{b.share}%</span>
                                            </div>
                                        </Td>
                                        <Td numeric muted>{b.orders}</Td>
                                        <Td numeric muted>{peso(b.average)}</Td>
                                        <Td numeric>{peso(b.gross_profit)}</Td>
                                        <Td numeric muted>{peso(b.expenses)}</Td>
                                        <Td numeric className={b.net < 0 ? 'text-accent-text' : 'text-ok-text'}>
                                            {peso(b.net)}
                                            {b.margin !== null && <span className="block text-2xs text-faint">{b.margin}%</span>}
                                        </Td>
                                        <Td numeric muted>{peso(b.collected)}</Td>
                                        <Td numeric muted>{peso(b.discounts)}</Td>
                                        <Td numeric className={b.voided ? 'text-warn-text' : 'text-faint'}>{b.voided}</Td>
                                        <Td numeric className={b.receivables > 0 ? 'text-warn-text' : 'text-faint'}>{peso(b.receivables)}</Td>
                                    </Tr>
                                ))}
                                <Tr className="bg-bg font-medium">
                                    <Td>All selected branches</Td>
                                    <Td numeric>{peso(summary.sales)}</Td>
                                    <Td numeric muted>100%</Td>
                                    <Td numeric>{summary.orders}</Td>
                                    <Td numeric>{peso(summary.avg_order)}</Td>
                                    <Td numeric>{peso(summary.gross_profit)}</Td>
                                    <Td numeric>{peso(summary.expenses)}</Td>
                                    <Td numeric className={summary.net < 0 ? 'text-accent-text' : 'text-ok-text'}>{peso(summary.net)}</Td>
                                    <Td numeric>{peso(summary.collected)}</Td>
                                    <Td numeric>{peso(summary.discounts)}</Td>
                                    <Td numeric>{summary.voided}</Td>
                                    <Td numeric>{peso(summary.receivables)}</Td>
                                </Tr>
                            </tbody>
                        </Table>
                    </Panel>
                )}

                <Panel
                    title="Sales and expenses by day"
                    actions={
                        <>
                            <Legend items={[{ label: 'Sales', color: 'var(--chart-1)' }, { label: 'Expenses', color: 'var(--chart-2)' }]} />
                            {exportLink('sales')}
                        </>
                    }
                    bodyClass="px-3 pt-4 pb-3"
                >
                    {summary.orders || summary.expenses ? (
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={daily} margin={{ top: 8, right: 64, bottom: 0, left: 4 }}>
                                    <CartesianGrid {...gridProps} />
                                    <XAxis dataKey="date" {...axisProps} tickFormatter={(d: string) => shortDate(d + 'T00:00:00')} minTickGap={24} />
                                    <YAxis {...axisProps} width={52} tickFormatter={(v: number) => compactPeso(v)} />
                                    <Tooltip
                                        cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }}
                                        isAnimationActive={false}
                                        content={({ active, payload }) =>
                                            active && payload?.length ? (
                                                <ChartTooltipBox
                                                    title={shortDate(String(payload[0].payload.date) + 'T00:00:00')}
                                                    rows={[
                                                        { label: 'Sales', value: peso(payload[0].payload.sales), color: 'var(--chart-1)' },
                                                        { label: 'Expenses', value: peso(payload[0].payload.expenses), color: 'var(--chart-2)' },
                                                        { label: 'Net', value: peso(payload[0].payload.sales - payload[0].payload.cost - payload[0].payload.expenses) },
                                                        { label: 'Orders', value: String(payload[0].payload.orders) },
                                                    ]}
                                                />
                                            ) : null
                                        }
                                    />
                                    <Line type="linear" dataKey="sales" stroke="var(--chart-1)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false} />
                                    <Line type="linear" dataKey="expenses" stroke="var(--chart-2)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <EmptyState compact title="No sales in this range" body="Pick a wider range or more branches." />
                    )}
                    {last && <p className="sr-only">Last day: sales {peso(last.sales)}, expenses {peso(last.expenses)}.</p>}
                </Panel>

                <div className="grid gap-5 xl:grid-cols-2">
                    <Panel title="Money in by payment method" bodyClass="space-y-3.5 px-5 py-4" actions={exportLink('payments')}>
                        {byMethod.map((m) => (
                            <HBar key={m.method} label={METHOD_LABEL[m.method]} value={m.total} max={methodMax} note={m.method === 'credit' ? 'sold on account' : undefined} muted={m.method === 'credit'} />
                        ))}
                        <p className="text-xs text-faint">
                            Includes balance collections; refunds ({peso(summary.refunds)}) are subtracted. VAT collected {peso(summary.tax)}; senior/PWD discounts {peso(summary.senior_pwd)}.
                        </p>
                    </Panel>
                    <Panel title="Sales by category" bodyClass="space-y-3.5 px-5 py-4">
                        {byCategory.length ? (
                            byCategory.slice(0, 10).map((c) => <HBar key={c.category} label={c.category} value={c.revenue} max={catMax} note={`${c.orders} orders, ${pct(c.revenue - c.cost, c.revenue)} margin`} />)
                        ) : (
                            <p className="text-base text-muted">No sales yet.</p>
                        )}
                    </Panel>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                    <Panel title="Busiest hours" bodyClass="px-3 pt-4 pb-2" actions={busiest && busiest.sales > 0 && <span className="text-sm text-muted">Peak {hourLabel(busiest.hour)}</span>}>
                        <MiniBars data={byHour.map((h) => ({ key: hourLabel(h.hour), sales: h.sales, orders: h.orders }))} />
                    </Panel>
                    <Panel title="Sales by day of the week" bodyClass="px-3 pt-4 pb-2">
                        <MiniBars data={byWeekday.map((d) => ({ key: d.day, sales: d.sales, orders: d.orders }))} />
                    </Panel>
                </div>

                <Panel title="Staff performance" actions={exportLink('staff')}>
                    {staff.length ? (
                        <Table minWidth={900}>
                            <THead>
                                <tr>
                                    <Th>Staff</Th>
                                    {multi && <Th>Branch</Th>}
                                    <Th align="right">Orders</Th>
                                    <Th align="right">Sales</Th>
                                    <Th align="right">Avg order</Th>
                                    <Th align="right">Discounts given</Th>
                                    <Th align="right">Voids</Th>
                                    <Th align="right">Cash taken</Th>
                                    <Th align="right">Drawer over / short</Th>
                                </tr>
                            </THead>
                            <tbody>
                                {staff.map((s) => (
                                    <Tr key={s.id}>
                                        <Td className="font-medium">{s.name}</Td>
                                        {multi && <Td muted className="text-sm">{s.branches}</Td>}
                                        <Td numeric muted>{s.orders}</Td>
                                        <Td numeric>{peso(s.sales)}</Td>
                                        <Td numeric muted>{peso(s.average)}</Td>
                                        <Td numeric className={s.sales > 0 && s.discounts / s.sales > 0.1 ? 'text-warn-text' : 'text-muted'}>{peso(s.discounts)}</Td>
                                        <Td numeric className={s.voids > 0 ? 'text-warn-text' : 'text-faint'}>{s.voids}</Td>
                                        <Td numeric muted>{peso(s.cash)}</Td>
                                        <Td numeric>
                                            {s.drawers ? <VarianceText value={s.variance} /> : <span className="text-faint">No drawers</span>}
                                            {s.drawers > 0 && <span className="block text-2xs text-faint">{s.drawers} closed</span>}
                                        </Td>
                                    </Tr>
                                ))}
                            </tbody>
                        </Table>
                    ) : (
                        <EmptyState compact title="No sales by staff in this range" />
                    )}
                </Panel>

                <Panel title="Production (job orders)">
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                        <Kpi label="Jobs taken" value={String(production.taken)} sub={`${peso(production.taken_value)}, ${production.rush} rush`} />
                        <Kpi label="Released to customers" value={String(production.released)} />
                        <Kpi label="Average turnaround" value={production.avg_turnaround_hours !== null ? `${production.avg_turnaround_hours} h` : '—'} sub="taken to released" />
                        <Kpi label="On time" value={production.on_time_rate !== null ? `${production.on_time_rate}%` : '—'} sub="released by the due time" tone={production.on_time_rate !== null && production.on_time_rate < 80 ? 'text-warn-text' : undefined} />
                        <Kpi label="Open now" value={String(production.open_now)} sub={`${production.by_status.pending ?? 0} pending, ${production.by_status.in_production ?? 0} printing, ${production.by_status.ready ?? 0} ready`} />
                        <Kpi label="Late now" value={String(production.overdue_now)} sub={`${peso(production.ready_uncollected)} to collect on ready jobs`} tone={production.overdue_now > 0 ? 'text-accent-text' : undefined} />
                    </div>
                </Panel>

                <div className="grid gap-5 xl:grid-cols-2">
                    <Panel title="Top services and products" actions={exportLink('items')}>
                        {topItems.length ? (
                            <Table minWidth={560}>
                                <THead>
                                    <tr>
                                        <Th>Item</Th>
                                        <Th align="right">Qty</Th>
                                        <Th align="right">Orders</Th>
                                        <Th align="right">Revenue</Th>
                                        <Th align="right">Margin</Th>
                                    </tr>
                                </THead>
                                <tbody>
                                    {topItems.map((i) => (
                                        <Tr key={i.item_type + i.name}>
                                            <Td>
                                                {i.name}
                                                <span className="block text-xs text-faint">{i.category}</span>
                                            </Td>
                                            <Td numeric muted>{qty(i.qty)}</Td>
                                            <Td numeric muted>{i.orders}</Td>
                                            <Td numeric>{peso(i.revenue)}</Td>
                                            <Td numeric className={i.revenue > 0 && (i.revenue - i.cost) / i.revenue < 0.3 ? 'text-warn-text' : 'text-muted'}>
                                                {pct(i.revenue - i.cost, i.revenue)}
                                            </Td>
                                        </Tr>
                                    ))}
                                </tbody>
                            </Table>
                        ) : (
                            <EmptyState compact title="Nothing sold in this range" />
                        )}
                    </Panel>
                    <Panel title="Top customers" actions={exportLink('customers')}>
                        {topCustomers.length ? (
                            <Table minWidth={560}>
                                <THead>
                                    <tr>
                                        <Th>Customer</Th>
                                        <Th align="right">Orders</Th>
                                        <Th align="right">Sales</Th>
                                        <Th align="right">Owes now</Th>
                                    </tr>
                                </THead>
                                <tbody>
                                    {topCustomers.map((c) => (
                                        <Tr key={c.id}>
                                            <Td>
                                                {branchFilter.locked ? (
                                                    <Link href={route('customers.show', c.id)} className="hover:underline">
                                                        {c.name}
                                                    </Link>
                                                ) : (
                                                    c.name
                                                )}
                                                <span className="block text-xs text-faint">
                                                    {[multi ? c.branch : null, c.phone, c.last_order_at ? `last ${shortDate(c.last_order_at)}` : null].filter(Boolean).join(', ')}
                                                </span>
                                            </Td>
                                            <Td numeric muted>{c.orders}</Td>
                                            <Td numeric>{peso(c.sales)}</Td>
                                            <Td numeric className={c.balance > 0 ? 'text-warn-text' : 'text-faint'}>{c.balance > 0 ? peso(c.balance) : 'Paid up'}</Td>
                                        </Tr>
                                    ))}
                                </tbody>
                            </Table>
                        ) : (
                            <EmptyState compact title="No named customers in this range" body="Walk-in sales are not listed here." />
                        )}
                    </Panel>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                    <Panel title="Material usage">
                        {materials.length ? (
                            <Table minWidth={420}>
                                <THead>
                                    <tr>
                                        <Th>Material</Th>
                                        <Th align="right">Used</Th>
                                        <Th align="right">Cost</Th>
                                    </tr>
                                </THead>
                                <tbody>
                                    {materials.map((m) => (
                                        <Tr key={m.name + m.unit}>
                                            <Td>{m.name}</Td>
                                            <Td numeric muted>
                                                {qty(m.used, 1)} {m.unit}
                                            </Td>
                                            <Td numeric>{peso(m.cost)}</Td>
                                        </Tr>
                                    ))}
                                </tbody>
                            </Table>
                        ) : (
                            <EmptyState compact title="No materials used" body="Services with a recipe deduct materials when sold." />
                        )}
                    </Panel>
                    <Panel title="Wastage (damaged, misprints, test prints)">
                        {wastage.length ? (
                            <Table minWidth={420}>
                                <THead>
                                    <tr>
                                        <Th>Material</Th>
                                        <Th align="right">Wasted</Th>
                                        <Th align="right">Cost</Th>
                                    </tr>
                                </THead>
                                <tbody>
                                    {wastage.map((w) => (
                                        <Tr key={w.name}>
                                            <Td>{w.name}</Td>
                                            <Td numeric muted>
                                                {qty(w.qty, 1)} {w.unit}
                                            </Td>
                                            <Td numeric className="text-warn-text">{peso(w.cost)}</Td>
                                        </Tr>
                                    ))}
                                </tbody>
                            </Table>
                        ) : (
                            <EmptyState compact title="No wastage recorded" body="Stock adjustments marked damaged, misprint or test print show here." />
                        )}
                    </Panel>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                    <Panel title="Expenses by category" bodyClass="px-3 pt-3 pb-2" actions={exportLink('expenses')}>
                        {expenseCategories.length ? (
                            <>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={expenseCategories} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }} barCategoryGap={6}>
                                            <CartesianGrid {...gridProps} horizontal={false} vertical />
                                            <XAxis type="number" {...axisProps} tickFormatter={(v: number) => compactPeso(v)} />
                                            <YAxis type="category" dataKey="category" {...axisProps} width={120} />
                                            <Tooltip
                                                cursor={{ fill: 'var(--selected)' }}
                                                isAnimationActive={false}
                                                content={({ active, payload }) => (active && payload?.length ? <ChartTooltipBox title={String(payload[0].payload.category)} rows={[{ label: 'Spent', value: peso(Number(payload[0].value)) }, { label: 'Entries', value: String(payload[0].payload.count) }]} /> : null)}
                                            />
                                            <Bar dataKey="total" fill="var(--chart-neutral)" fillOpacity={0.75} radius={[0, 3, 3, 0]} isAnimationActive={false} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <p className="flex flex-wrap gap-x-4 px-2 pt-1 text-xs text-faint">
                                    {Object.entries(expenseSources).map(([source, total]) => (
                                        <span key={source}>
                                            {source === 'drawer' ? 'From drawers' : source === 'petty' ? 'Petty cash' : 'Bank'} {peso(total)}
                                        </span>
                                    ))}
                                </p>
                            </>
                        ) : (
                            <EmptyState compact title="No expenses in this range" />
                        )}
                    </Panel>

                    <Panel title={`Receivables aging, ${peso(aging.total)} owed`} actions={exportLink('receivables')}>
                        <div className="grid grid-cols-4 border-b border-line">
                            {aging.buckets.map((b, i) => (
                                <div key={b.bucket} className="border-r border-line px-4 py-3 last:border-r-0">
                                    <p className="text-xs text-faint">{b.bucket} days</p>
                                    <p className={cn('num text-base font-medium', i === 3 && b.total > 0 && 'text-accent-text')}>{peso(b.total)}</p>
                                    <div className="mt-2 h-1 bg-sunken">
                                        <div className="h-full bg-[var(--chart-neutral)]" style={{ width: `${(b.total / agingMax) * 100}%`, opacity: 0.45 + i * 0.18 }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        {aging.rows.length ? (
                            <ul className="max-h-64 divide-y divide-line overflow-y-auto">
                                {aging.rows.map((r, i) => (
                                    <li key={i} className="flex items-center justify-between gap-3 px-5 py-2">
                                        <div className="min-w-0">
                                            {branchFilter.locked ? (
                                                <Link href={route('customers.show', r.customer_id)} className="truncate text-base hover:underline">
                                                    {r.customer}
                                                </Link>
                                            ) : (
                                                <span className="truncate text-base">{r.customer}</span>
                                            )}
                                            <p className="text-xs text-faint">{[multi ? r.branch : null, r.order_no, `${r.days} days`, r.due ? `due ${shortDate(r.due + 'T00:00:00')}` : null].filter(Boolean).join(', ')}</p>
                                        </div>
                                        <span className={cn('num text-base', r.days > 60 ? 'text-accent-text' : 'text-warn-text')}>{peso(r.outstanding)}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="px-5 py-4 text-base text-muted">Every account is settled.</p>
                        )}
                    </Panel>
                </div>

                <Panel title={`Voids and refunds, ${voids.length}`} actions={exportLink('voids')}>
                    {voids.length ? (
                        <Table minWidth={900}>
                            <THead>
                                <tr>
                                    <Th>When</Th>
                                    {multi && <Th>Branch</Th>}
                                    <Th>Order</Th>
                                    <Th>What</Th>
                                    <Th>Customer</Th>
                                    <Th>By</Th>
                                    <Th>Reason</Th>
                                    <Th align="right">Amount</Th>
                                </tr>
                            </THead>
                            <tbody>
                                {voids.map((v, i) => (
                                    <Tr key={i}>
                                        <Td muted className="text-sm whitespace-nowrap">{dateTime(v.at)}</Td>
                                        {multi && <Td muted className="text-sm">{v.branch}</Td>}
                                        <Td>
                                            <Link href={route('orders.show', v.order_id)} className="font-mono text-sm hover:underline">
                                                {v.order_no}
                                            </Link>
                                        </Td>
                                        <Td>
                                            <Chip tone={v.kind === 'Void' ? 'red' : 'warn'}>{v.kind}</Chip>
                                        </Td>
                                        <Td className="max-w-40 truncate">{v.customer}</Td>
                                        <Td muted>{v.user}</Td>
                                        <Td muted className="max-w-64 truncate text-sm" title={v.reason ?? undefined}>{v.reason}</Td>
                                        <Td numeric>{peso(v.amount)}</Td>
                                    </Tr>
                                ))}
                            </tbody>
                        </Table>
                    ) : (
                        <EmptyState compact title="No voids or refunds" body="Nothing was cancelled or returned in this range." />
                    )}
                </Panel>

                <Panel title="Drawer sessions (X/Z reads)" actions={exportLink('sessions')}>
                    {sessions.length ? (
                        <Table>
                            <THead>
                                <tr>
                                    <Th>Session</Th>
                                    {multi && <Th>Branch</Th>}
                                    <Th>Cashier</Th>
                                    <Th>Opened</Th>
                                    <Th align="right">Float</Th>
                                    <Th align="right">Expected</Th>
                                    <Th align="right">Counted</Th>
                                    <Th align="right">Over / short</Th>
                                </tr>
                            </THead>
                            <tbody>
                                {sessions.map((s) => (
                                    <Tr key={s.id}>
                                        <Td>
                                            <Link href={route('session.show', s.id)} className="font-mono text-sm hover:underline">
                                                #{s.id}
                                            </Link>
                                        </Td>
                                        {multi && <Td muted className="text-sm">{s.branch}</Td>}
                                        <Td>{s.cashier}</Td>
                                        <Td muted className="text-sm">{dateTime(s.opened_at)}</Td>
                                        <Td numeric>{peso(s.opening_float)}</Td>
                                        <Td numeric>{s.expected_cash !== null ? peso(s.expected_cash) : 'Open'}</Td>
                                        <Td numeric>{s.closing_counted !== null ? peso(s.closing_counted) : ''}</Td>
                                        <Td numeric>{s.variance !== null && <VarianceText value={s.variance} />}</Td>
                                    </Tr>
                                ))}
                            </tbody>
                        </Table>
                    ) : (
                        <EmptyState compact title="No drawers opened in this range" />
                    )}
                </Panel>
            </div>
        </>
    );
}

function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
    return (
        <div className="border-r border-b border-line px-5 py-4 last:border-r-0 xl:border-b-0">
            <p className="text-sm text-faint">{label}</p>
            <p className={cn('hud mt-0.5 text-xl font-semibold', tone)}>{value}</p>
            {sub && <p className="mt-0.5 text-xs text-faint">{sub}</p>}
        </div>
    );
}

function MiniBars({ data }: { data: { key: string; sales: number; orders: number }[] }) {
    if (!data.some((d) => d.sales > 0)) return <EmptyState compact title="No sales in this range" />;
    const max = Math.max(...data.map((d) => d.sales));
    return (
        <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }} barCategoryGap="18%">
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="key" {...axisProps} interval={0} tick={{ ...axisProps.tick, fontSize: 10 }} />
                    <YAxis {...axisProps} width={48} tickFormatter={(v: number) => compactPeso(v)} />
                    <Tooltip
                        cursor={{ fill: 'var(--selected)' }}
                        isAnimationActive={false}
                        content={({ active, payload }) =>
                            active && payload?.length ? (
                                <ChartTooltipBox title={String(payload[0].payload.key)} rows={[{ label: 'Sales', value: peso(Number(payload[0].payload.sales)) }, { label: 'Orders', value: String(payload[0].payload.orders) }]} />
                            ) : null
                        }
                    />
                    <Bar dataKey="sales" radius={[3, 3, 0, 0]} isAnimationActive={false} fill="var(--chart-neutral)" fillOpacity={0.8} shape={(p: { x?: number; y?: number; width?: number; height?: number; payload?: { sales: number } }) => <rect x={p.x} y={p.y} width={p.width} height={p.height} rx={2} fill={p.payload?.sales === max ? 'var(--accent)' : 'var(--chart-neutral)'} fillOpacity={p.payload?.sales === max ? 1 : 0.7} />} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

function HBar({ label, value, max, note, muted }: { label: string; value: number; max: number; note?: string; muted?: boolean }) {
    return (
        <div>
            <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="truncate text-base text-muted">
                    {label} {note && <span className="text-xs text-faint">{note}</span>}
                </span>
                <span className="num text-base">{peso(value)}</span>
            </div>
            <div className="h-2 bg-sunken">
                <div className="h-full bg-[var(--chart-neutral)]" style={{ width: `${(Math.max(0, value) / max) * 100}%`, opacity: muted ? 0.4 : 0.75 }} />
            </div>
        </div>
    );
}
