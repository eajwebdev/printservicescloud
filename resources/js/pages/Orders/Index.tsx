import { Head, router } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { OrderPeek } from '@/components/orders/order-peek';
import { FilterChip, OrdersShell, type OrdersView } from '@/components/orders/orders-shell';
import { ButtonLink } from '@/components/ui/button';
import { Chip, MethodChip, PaymentChip, StatusChip } from '@/components/ui/chip';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/field';
import { EmptyState, Pagination } from '@/components/ui/misc';
import { useFilters } from '@/hooks/use-filters';
import { date, peso, time, todayISO } from '@/lib/format';
import { cn, useAppPage } from '@/lib/utils';
import type { Option, OrderCard, OrderCounts, Paginated } from '@/types';

interface Props {
    view: Exclude<OrdersView, 'board'>;
    orders: Paginated<OrderCard>;
    counts: OrderCounts;
    totals: { count: number; voided: number; total: number; paid: number; balance: number };
    filters: Record<string, string | undefined>;
    staff: Option[];
    highlight: number | null;
}

function shiftDays(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const TYPE_OPTIONS = [
    { value: 'instant', label: 'Instant sales' },
    { value: 'job', label: 'Job orders' },
];

const PAYMENT_OPTIONS = [
    { value: 'owing', label: 'Has a balance' },
    { value: 'paid', label: 'Fully paid' },
    { value: 'partial', label: 'Downpayment only' },
    { value: 'credit', label: 'On credit' },
];

const STATUS_OPTIONS = [
    { value: 'completed', label: 'Completed (instant)' },
    { value: 'pending', label: 'Pending' },
    { value: 'in_production', label: 'In production' },
    { value: 'ready', label: 'Ready for pickup' },
    { value: 'released', label: 'Released' },
    { value: 'voided', label: 'Voided' },
];

export default function OrdersIndex({ view, orders, counts, totals, filters: initial, staff, highlight }: Props) {
    const { props } = useAppPage();
    const isToday = view === 'today';
    const [peek, setPeek] = useState<number | null>(null);
    const [flash, setFlash] = useState<number | null>(highlight);
    const { filters, set, setFilters } = useFilters(
        route('orders.index'),
        {
            q: initial.q ?? '',
            type: initial.type ?? '',
            payment: initial.payment ?? '',
            status: initial.status ?? '',
            from: initial.from ?? '',
            to: initial.to ?? '',
            mine: initial.mine ?? '',
        },
        { view },
    );

    useEffect(() => {
        if (!highlight) return;
        setFlash(highlight);
        window.setTimeout(() => document.querySelector(`[data-order="${highlight}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 200);
        const t = window.setTimeout(() => setFlash(null), 3000);
        return () => window.clearTimeout(t);
    }, [highlight]);

    const refresh = () => router.reload({ only: ['orders', 'counts', 'totals'] });
    const presets = [
        { label: 'Yesterday', from: shiftDays(-1), to: shiftDays(-1) },
        { label: 'Last 7 days', from: shiftDays(-6), to: todayISO() },
        { label: 'Last 30 days', from: shiftDays(-29), to: todayISO() },
    ];

    const toolbar = (
        <>
            <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
                <Input
                    className="pl-9"
                    inputSize="sm"
                    autoFocus={!isToday}
                    placeholder="Order no., customer name or phone"
                    value={filters.q}
                    onChange={(e) => set('q', e.target.value)}
                    aria-label="Search orders"
                />
            </div>
            <Combobox size="sm" className="w-36" ariaLabel="Order type" placeholder="All types" value={filters.type ?? ''} onChange={(v) => set('type', v)} options={TYPE_OPTIONS} />
            <Combobox size="sm" className="w-40" ariaLabel="Payment" placeholder="Any payment" value={filters.payment ?? ''} onChange={(v) => set('payment', v)} options={PAYMENT_OPTIONS} />
            {isToday ? (
                <FilterChip active={filters.mine === '1'} onClick={() => set('mine', filters.mine === '1' ? '' : '1')}>
                    Only my sales
                </FilterChip>
            ) : (
                <>
                    <Combobox size="sm" className="w-44" ariaLabel="Status" placeholder="Any status" value={filters.status ?? ''} onChange={(v) => set('status', v)} options={STATUS_OPTIONS} />
                    <div className="flex gap-1.5 overflow-x-auto">
                        {presets.map((p) => (
                            <FilterChip key={p.label} active={filters.from === p.from && filters.to === p.to} onClick={() => setFilters((f) => (f.from === p.from && f.to === p.to ? { ...f, from: '', to: '' } : { ...f, from: p.from, to: p.to }))}>
                                {p.label}
                            </FilterChip>
                        ))}
                    </div>
                    <span className="flex items-center gap-1.5">
                        <Input type="date" inputSize="sm" className="w-36" value={filters.from} onChange={(e) => set('from', e.target.value)} aria-label="From date" />
                        <span className="text-faint">to</span>
                        <Input type="date" inputSize="sm" className="w-36" value={filters.to} onChange={(e) => set('to', e.target.value)} aria-label="To date" />
                    </span>
                </>
            )}
        </>
    );

    const hasFilters = Object.entries(filters).some(([, v]) => v);

    return (
        <>
            <Head title={isToday ? 'Sales today' : 'All orders'} />
            <OrdersShell view={view} counts={counts} toolbar={toolbar}>
                <div className="flex h-full flex-col">
                    <div className="grid grid-cols-2 border-b border-line bg-bg sm:grid-cols-4">
                        {[
                            {
                                label: isToday ? (filters.mine ? 'My orders today' : 'Orders today') : hasFilters ? 'Matching orders' : 'All orders',
                                value: totals.count.toLocaleString('en-PH'),
                                sub: totals.voided ? `${totals.voided} voided, not counted` : undefined,
                            },
                            { label: 'Sales', value: peso(totals.total), sub: 'total of these orders' },
                            { label: 'Collected', value: peso(totals.paid), sub: 'money received', ok: totals.paid > 0 },
                            {
                                label: 'To collect',
                                value: peso(totals.balance),
                                sub: totals.balance > 0 ? 'balances still owed' : 'nothing owed',
                                warn: totals.balance > 0,
                                onClick: totals.balance > 0 && filters.payment !== 'owing' ? () => set('payment', 'owing') : undefined,
                            },
                        ].map((s) => {
                            const body = (
                                <>
                                    <p className="text-xs text-faint">{s.label}</p>
                                    <p className={cn('hud text-lg font-semibold', s.warn && 'text-warn-text')}>{s.value}</p>
                                    {s.sub && <p className="truncate text-2xs text-faint">{s.sub}</p>}
                                </>
                            );
                            const cls = 'border-r border-b border-line px-4 py-2 text-left even:border-r-0 sm:border-b-0 sm:even:border-r sm:last:border-r-0 lg:px-6';
                            return s.onClick ? (
                                <button key={s.label} type="button" onClick={s.onClick} className={cn(cls, 'transition-colors hover:bg-raised')} title="Show only orders with a balance">
                                    {body}
                                </button>
                            ) : (
                                <div key={s.label} className={cls}>
                                    {body}
                                </div>
                            );
                        })}
                    </div>

                    {orders.data.length ? (
                        <>
                            <div className="min-h-0 flex-1 overflow-auto bg-surface">
                                <table className="w-full min-w-[640px] border-collapse text-left text-base">
                                    <thead className="sticky top-0 z-[1] bg-surface">
                                        <tr className="border-b border-line text-sm text-faint">
                                            <th className="h-9 w-24 px-3 pl-4 font-medium lg:pl-6">{isToday ? 'Time' : 'Date'}</th>
                                            <th className="px-3 font-medium">Order</th>
                                            <th className="px-3 font-medium">Customer</th>
                                            <th className="hidden px-3 font-medium xl:table-cell">Items</th>
                                            <th className="px-3 font-medium">Status</th>
                                            <th className="hidden px-3 font-medium lg:table-cell">Paid by</th>
                                            <th className="px-3 text-right font-medium">Total</th>
                                            <th className="px-3 pr-4 text-right font-medium lg:pr-6">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orders.data.map((o) => (
                                            <tr
                                                key={o.id}
                                                data-order={o.id}
                                                tabIndex={0}
                                                onClick={() => setPeek(o.id)}
                                                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setPeek(o.id))}
                                                className={cn(
                                                    'cursor-pointer border-b border-line transition-colors hover:bg-raised focus-visible:bg-raised',
                                                    peek === o.id && 'bg-raised',
                                                    flash === o.id && 'bg-selected shadow-[inset_2px_0_0_var(--red-400)]',
                                                    o.status === 'voided' && 'opacity-55',
                                                )}
                                            >
                                                <td className="h-11 px-3 pl-4 whitespace-nowrap lg:pl-6">
                                                    <span className="num text-sm text-muted">{isToday ? time(o.created_at) : date(o.created_at)}</span>
                                                    {!isToday && <span className="num block text-xs text-faint">{time(o.created_at)}</span>}
                                                </td>
                                                <td className="px-3 whitespace-nowrap">
                                                    <span className="font-mono text-sm">{o.order_no}</span>
                                                    {o.type === 'job' && <Chip className="ml-2">Job</Chip>}
                                                    {o.cashier && <span className="block text-xs text-faint">by {o.cashier}</span>}
                                                </td>
                                                <td className="max-w-44 truncate px-3">{o.customer}</td>
                                                <td className="hidden max-w-72 truncate px-3 text-sm text-muted xl:table-cell" title={o.summary ?? undefined}>
                                                    {o.summary}
                                                </td>
                                                <td className="px-3">
                                                    <StatusChip status={o.status} />
                                                </td>
                                                <td className="hidden px-3 lg:table-cell">
                                                    <span className="flex flex-wrap gap-1">
                                                        {o.methods.length ? o.methods.map((m) => <MethodChip key={m} method={m} />) : <span className="text-sm text-faint">None yet</span>}
                                                    </span>
                                                </td>
                                                <td className={cn('num px-3 text-right whitespace-nowrap', o.status === 'voided' && 'line-through')}>{peso(o.total)}</td>
                                                <td className="px-3 pr-4 text-right whitespace-nowrap lg:pr-6">
                                                    {o.status !== 'voided' && (o.balance > 0 ? <PaymentChip status={o.payment_status} balance={o.balance} /> : <span className="text-sm text-ok-text">Paid</span>)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="bg-surface">
                                <Pagination links={orders.links} from={orders.from} to={orders.to} total={orders.total} />
                            </div>
                        </>
                    ) : (
                        <EmptyState
                            className="h-full"
                            title={hasFilters ? 'No orders match these filters' : isToday ? 'No sales yet today' : 'No orders yet'}
                            body={
                                hasFilters
                                    ? 'Clear a filter, or look in All orders for older dates.'
                                    : isToday
                                      ? 'Orders you ring up at the POS appear here right away, newest at the top.'
                                      : 'Every sale and job order will be listed here.'
                            }
                            action={
                                hasFilters ? (
                                    <button type="button" className="text-sm text-fg underline" onClick={() => setFilters({ q: '', type: '', payment: '', status: '', from: '', to: '', mine: '' })}>
                                        Clear filters
                                    </button>
                                ) : (
                                    props.auth?.pages.includes('pos') && (
                                        <ButtonLink href={route('pos.index')} variant="primary">
                                            Ring up a sale
                                        </ButtonLink>
                                    )
                                )
                            }
                        />
                    )}
                </div>
            </OrdersShell>

            <OrderPeek orderId={peek} staff={staff} onClose={() => setPeek(null)} onChanged={refresh} />
        </>
    );
}
