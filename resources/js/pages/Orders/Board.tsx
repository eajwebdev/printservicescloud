import { Head, router } from '@inertiajs/react';
import { Clock, MoreHorizontal, Paperclip, RefreshCw, Search, UserRound } from 'lucide-react';
import { LayoutGroup, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BOARD_STEPS, NEXT_STEP, patchStatus, ReleaseDialog } from '@/components/orders/order-actions';
import { ProofChip } from '@/components/orders/order-files';
import { OrderPeek } from '@/components/orders/order-peek';
import { FilterChip, OrdersShell } from '@/components/orders/orders-shell';
import { useToast } from '@/components/toaster';
import { Button, IconButton } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Chip, LiveDot, PaymentChip } from '@/components/ui/chip';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/field';
import { Menu, MenuItem, MenuLabel } from '@/components/ui/menu';
import { useFilters } from '@/hooks/use-filters';
import { dayTime, isPast, peso, relative, STATUS_LABEL } from '@/lib/format';
import { cn, initials, useCan } from '@/lib/utils';
import type { BoardStatus, Option, OrderCard, OrderCounts } from '@/types';

const HINT: Record<BoardStatus, string> = {
    pending: 'Taken, not started',
    in_production: 'On the printer now',
    ready: 'Waiting for pickup',
    released: 'Picked up, last 2 days',
};

const EMPTY: Record<BoardStatus, string> = {
    pending: 'New job orders from the POS land here.',
    in_production: 'Nothing on the printer. Press Start on a pending job.',
    ready: 'No finished jobs waiting.',
    released: 'Nothing released in the last 2 days.',
};

interface Props {
    cards: OrderCard[];
    counts: OrderCounts;
    filters: { q?: string; payment?: string; assigned?: string; due?: string; rush?: string };
    staff: Option[];
    highlight: number | null;
}

export default function Board({ cards: initial, counts, filters: initialFilters, staff, highlight }: Props) {
    const [cards, setCards] = useState(initial);
    const [pending, setPending] = useState<Set<number>>(new Set());
    const [hover, setHover] = useState<BoardStatus | null>(null);
    const [peek, setPeek] = useState<number | null>(null);
    const [releasing, setReleasing] = useState<OrderCard | null>(null);
    const [unproofed, setUnproofed] = useState<OrderCard | null>(null);
    const [mobileColumn, setMobileColumn] = useState<BoardStatus>('pending');
    const [refreshedAt, setRefreshedAt] = useState(() => Date.now());
    const [, tick] = useState(0);
    const dragging = useRef(false);
    const columnRefs = useRef<Record<string, HTMLElement | null>>({});
    const toast = useToast();
    const can = useCan();
    const canMove = can('orders.edit');
    const { filters, set } = useFilters(
        route('orders.index'),
        { q: initialFilters.q ?? '', payment: initialFilters.payment ?? '', assigned: initialFilters.assigned ?? '', due: initialFilters.due ?? '', rush: initialFilters.rush ?? '' },
        { view: 'board' },
    );

    useEffect(() => {
        setCards(initial);
        setRefreshedAt(Date.now());
    }, [initial]);

    // Other staff move jobs too. Refresh quietly every 20 seconds while nobody is mid-action here.
    const refresh = useCallback(() => {
        router.reload({ only: ['cards', 'counts'] });
    }, []);
    useEffect(() => {
        const id = window.setInterval(() => {
            tick((n) => n + 1);
            if (document.hidden || dragging.current || pending.size || peek !== null || releasing) return;
            refresh();
        }, 20000);
        return () => window.clearInterval(id);
    }, [pending.size, peek, releasing, refresh]);

    // Arriving from a receipt: jump to that job and flash it.
    useEffect(() => {
        if (!highlight) return;
        const card = initial.find((c) => c.id === highlight);
        if (card && BOARD_STEPS.includes(card.status as BoardStatus)) setMobileColumn(card.status as BoardStatus);
        window.setTimeout(() => document.querySelector(`[data-order="${highlight}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlight]);

    const columnAt = (x: number, y: number): BoardStatus | null => {
        for (const s of BOARD_STEPS) {
            const r = columnRefs.current[s]?.getBoundingClientRect();
            if (r && r.width > 0 && x >= r.left && x <= r.right && y >= r.top - 40 && y <= r.bottom + 40) return s;
        }
        return null;
    };

    const move = (card: OrderCard, status: BoardStatus, confirmed = false) => {
        if (card.status === status || pending.has(card.id)) return;
        if (status === 'in_production' && card.proof_status === 'waiting' && !confirmed) {
            setUnproofed(card);
            return;
        }
        if (status === 'released' && card.balance > 0) {
            setReleasing(card);
            return;
        }
        const before = cards;
        setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, status, status_changed_at: new Date().toISOString() } : c)));
        patchStatus(card, status, {
            onStart: () => setPending((p) => new Set(p).add(card.id)),
            onSuccess: () => {
                if (status === 'ready') toast('success', `${card.order_no} is ready for pickup.`);
                if (status === 'released') toast('success', `${card.order_no} released to ${card.customer}.`);
            },
            onError: (message) => {
                setCards(before);
                toast('error', message);
            },
            onFinish: () =>
                setPending((p) => {
                    const n = new Set(p);
                    n.delete(card.id);
                    return n;
                }),
        });
    };

    const toggle = (key: 'due' | 'rush', value: string) => set(key, filters[key] === value ? '' : value);
    const secondsAgo = Math.round((Date.now() - refreshedAt) / 1000);

    const toolbar = (
        <>
            <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
                <Input className="pl-9" inputSize="sm" placeholder="Order no., customer, phone" value={filters.q} onChange={(e) => set('q', e.target.value)} aria-label="Search jobs" />
            </div>
            <Combobox
                size="sm"
                className="w-44"
                ariaLabel="Assigned to"
                placeholder="Anyone"
                searchPlaceholder="Find staff"
                value={filters.assigned ?? ''}
                onChange={(v) => set('assigned', v)}
                options={[{ value: 'none', label: 'Unassigned' }, ...staff.map((s) => ({ value: String(s.id), label: s.name }))]}
            />
            <Combobox
                size="sm"
                className="w-40"
                ariaLabel="Payment"
                placeholder="Any payment"
                value={filters.payment ?? ''}
                onChange={(v) => set('payment', v)}
                options={[
                    { value: 'owing', label: 'Has a balance' },
                    { value: 'paid', label: 'Fully paid' },
                    { value: 'partial', label: 'Downpayment only' },
                    { value: 'credit', label: 'On credit' },
                ]}
            />
            <div className="flex gap-1.5 overflow-x-auto">
                <FilterChip active={filters.due === 'overdue'} onClick={() => toggle('due', 'overdue')} tone={counts.overdue ? 'red' : undefined}>
                    Overdue <span className="num">{counts.overdue}</span>
                </FilterChip>
                <FilterChip active={filters.due === 'today'} onClick={() => toggle('due', 'today')}>
                    Due today <span className="num">{counts.due_today}</span>
                </FilterChip>
                <FilterChip active={filters.rush === '1'} onClick={() => toggle('rush', '1')}>
                    Rush <span className="num">{counts.rush}</span>
                </FilterChip>
            </div>
            <button type="button" onClick={refresh} className="ml-auto flex items-center gap-1.5 text-xs text-faint hover:text-fg" title="Refresh now">
                <RefreshCw className="size-3.5" />
                {secondsAgo < 10 ? 'Up to date' : `Updated ${secondsAgo < 60 ? `${secondsAgo}s` : `${Math.round(secondsAgo / 60)}m`} ago`}
            </button>
        </>
    );

    return (
        <>
            <Head title="Production board" />
            <OrdersShell view="board" counts={counts} toolbar={toolbar}>
                <div className="flex h-full flex-col">
                    {/* Phones and small tablets: one column at a time. */}
                    <div className="flex border-b border-line bg-surface md:hidden" role="tablist" aria-label="Board columns">
                        {BOARD_STEPS.map((s) => (
                            <button
                                key={s}
                                type="button"
                                role="tab"
                                aria-selected={mobileColumn === s}
                                onClick={() => setMobileColumn(s)}
                                className={cn('flex-1 border-b-2 px-2 py-2 text-sm', mobileColumn === s ? 'border-accent text-fg' : 'border-transparent text-muted')}
                            >
                                {STATUS_LABEL[s].replace(' for pickup', '')} <span className="num text-faint">{cards.filter((c) => c.status === s).length}</span>
                            </button>
                        ))}
                    </div>

                    <LayoutGroup>
                        <div className="flex min-h-0 flex-1 snap-x gap-px overflow-x-auto bg-line">
                            {BOARD_STEPS.map((status, idx) => {
                                const list = cards.filter((c) => c.status === status);
                                const owed = list.reduce((s, c) => s + c.balance, 0);
                                return (
                                    <section
                                        key={status}
                                        ref={(el) => {
                                            columnRefs.current[status] = el;
                                        }}
                                        aria-label={STATUS_LABEL[status]}
                                        className={cn('min-h-0 w-full shrink-0 snap-start flex-col bg-bg transition-colors md:flex md:w-auto', status === 'released' ? 'md:min-w-[230px] md:flex-[0.8]' : 'md:min-w-[290px] md:flex-1', mobileColumn === status ? 'flex' : 'hidden', hover === status && 'bg-selected')}
                                    >
                                        <header className="hidden border-b border-line bg-surface px-3 py-2 md:block">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs text-faint">0{idx + 1}</span>
                                                <h2 className="text-base font-semibold">{STATUS_LABEL[status]}</h2>
                                                {status === 'in_production' && list.length > 0 && <LiveDot />}
                                                <span className="num ml-auto rounded-xs bg-raised px-1.5 text-sm">{list.length}</span>
                                            </div>
                                            <p className="flex justify-between gap-2 text-xs text-faint">
                                                <span className="truncate">{HINT[status]}</span>
                                                {owed > 0 && status !== 'released' && <span className="num shrink-0 text-warn-text">{peso(owed)} to collect</span>}
                                            </p>
                                        </header>
                                        <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
                                            {list.map((card) => (
                                                <JobCard
                                                    key={card.id}
                                                    card={card}
                                                    highlighted={card.id === highlight}
                                                    saving={pending.has(card.id)}
                                                    draggable={canMove}
                                                    onOpen={() => setPeek(card.id)}
                                                    onDragState={(d) => (dragging.current = d)}
                                                    onHover={(x, y) => setHover(columnAt(x, y))}
                                                    onDrop={(x, y) => {
                                                        setHover(null);
                                                        const target = columnAt(x, y);
                                                        if (target) move(card, target);
                                                    }}
                                                    onMove={(s) => move(card, s)}
                                                />
                                            ))}
                                            {!list.length && <li className="halftone grid min-h-20 place-items-center border border-dashed border-line px-4 py-6 text-center text-sm text-faint">{EMPTY[status]}</li>}
                                        </ul>
                                    </section>
                                );
                            })}
                        </div>
                    </LayoutGroup>
                </div>
            </OrdersShell>

            <OrderPeek orderId={peek} staff={staff} onClose={() => setPeek(null)} onChanged={refresh} />
            <ReleaseDialog order={releasing} onClose={() => setReleasing(null)} onReleased={refresh} />
            <ConfirmDialog
                open={!!unproofed}
                onOpenChange={(o) => !o && setUnproofed(null)}
                title={`Start ${unproofed?.order_no} before the proof is approved?`}
                body={`${unproofed?.customer ?? 'The customer'} hasn't approved the proof yet. Printing now risks a reprint at the shop's cost. Mark the proof approved in the order first if they already said yes.`}
                confirmLabel="Start anyway"
                onConfirm={() => {
                    if (unproofed) move(unproofed, 'in_production', true);
                    setUnproofed(null);
                }}
            />
        </>
    );
}

function JobCard({
    card,
    highlighted,
    saving,
    draggable,
    onOpen,
    onDragState,
    onHover,
    onDrop,
    onMove,
}: {
    card: OrderCard;
    highlighted: boolean;
    saving: boolean;
    draggable: boolean;
    onOpen: () => void;
    onDragState: (dragging: boolean) => void;
    onHover: (x: number, y: number) => void;
    onDrop: (x: number, y: number) => void;
    onMove: (s: BoardStatus) => void;
}) {
    const dragged = useRef(false);
    const released = card.status === 'released';
    const overdue = isPast(card.due_at) && (card.status === 'pending' || card.status === 'in_production');
    const next = NEXT_STEP[card.status];
    const [flash, setFlash] = useState(highlighted);

    useEffect(() => {
        if (!highlighted) return;
        setFlash(true);
        const t = window.setTimeout(() => setFlash(false), 2600);
        return () => window.clearTimeout(t);
    }, [highlighted]);

    return (
        <motion.li
            layout
            layoutId={`job-${card.id}`}
            data-order={card.id}
            drag={draggable && !saving}
            dragSnapToOrigin
            dragElastic={0.15}
            dragMomentum={false}
            whileDrag={{ scale: 1.03, rotate: -1, zIndex: 40, boxShadow: '0 24px 50px -12px rgba(0,0,0,0.7)', cursor: 'grabbing' }}
            transition={{ type: 'spring', stiffness: 480, damping: 36 }}
            onDragStart={() => {
                dragged.current = true;
                onDragState(true);
            }}
            onDrag={(e) => onHover((e as PointerEvent).clientX, (e as PointerEvent).clientY)}
            onDragEnd={(e) => {
                onDrop((e as PointerEvent).clientX, (e as PointerEvent).clientY);
                onDragState(false);
                window.setTimeout(() => (dragged.current = false), 60);
            }}
            className={cn(
                'relative touch-pan-y border bg-surface select-none',
                overdue ? 'border-[color-mix(in_srgb,var(--accent)_55%,transparent)]' : 'border-line hover:border-line-strong',
                released && 'opacity-60',
                saving && 'opacity-70',
                flash && 'shadow-[0_0_0_2px_var(--red-400)]',
            )}
        >
            {card.status === 'in_production' && <span className="absolute inset-y-0 left-0 w-[2px] bg-accent" aria-hidden />}
            <button
                type="button"
                onClick={() => !dragged.current && onOpen()}
                className="block w-full px-3 pt-2 pb-1.5 text-left"
                aria-label={`Open ${card.order_no} for ${card.customer}`}
            >
                <span className="flex items-center gap-1.5">
                    <span className="font-mono text-sm whitespace-nowrap text-fg">{card.order_no}</span>
                    {card.rush && <Chip tone="red">Rush</Chip>}
                    {!released && <ProofChip status={card.proof_status} />}
                    {card.files_count > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-faint" title={`${card.files_count} file${card.files_count === 1 ? '' : 's'} attached`}>
                            <Paperclip className="size-3" />
                            <span className="num">{card.files_count}</span>
                        </span>
                    )}
                    <span className={cn('ml-auto flex items-center gap-1 text-xs whitespace-nowrap', overdue ? 'text-accent-text' : 'text-faint')} title={card.due_at ? dayTime(card.due_at) : undefined}>
                        <Clock className="size-3" />
                        {released ? `Out ${relative(card.released_at)}` : card.status === 'ready' ? (card.status_changed_at && !isPast(card.status_changed_at) ? 'Ready now' : `Ready ${relative(card.status_changed_at).replace(' ago', '')}`) : card.due_at ? (overdue ? `Late ${relative(card.due_at).replace(' ago', '')}` : `Due ${relative(card.due_at)}`) : 'No date'}
                    </span>
                </span>
                <span className="mt-0.5 flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-base font-medium">{card.customer}</span>
                    {!released && <PaymentChip status={card.payment_status} balance={card.balance} />}
                </span>
                {card.summary && <span className="mt-0.5 block truncate text-sm text-muted">{card.summary}</span>}
            </button>
            {!released && (
                <div className="flex items-center gap-1.5 border-t border-line px-2 py-1.5">
                    <span className="flex items-center gap-1 px-1 text-xs text-faint" title={card.assignee ?? 'Unassigned'}>
                        {card.assignee ? (
                            <span className="grid size-5 place-items-center rounded-xs bg-ink-700 font-display text-[10px] text-[#ECEEF2]">{initials(card.assignee)}</span>
                        ) : (
                            <UserRound className="size-3.5" />
                        )}
                        <span className="max-w-20 truncate">{card.assignee?.split(' ')[0] ?? 'Unassigned'}</span>
                    </span>
                    {next && draggable && (
                        <Button size="xs" variant={card.status === 'ready' ? 'primary' : 'secondary'} className="ml-auto" loading={saving} onPointerDown={(e) => e.stopPropagation()} onClick={() => onMove(next.to)}>
                            {next.label}
                        </Button>
                    )}
                    <Menu
                        trigger={
                            <IconButton label={`More for ${card.order_no}`} size="xs" className={cn(!(next && draggable) && 'ml-auto')} onPointerDown={(e) => e.stopPropagation()}>
                                <MoreHorizontal />
                            </IconButton>
                        }
                    >
                        <MenuItem onSelect={onOpen}>Open details</MenuItem>
                        <MenuLabel>Move to</MenuLabel>
                        {BOARD_STEPS.filter((s) => s !== card.status).map((s) => (
                            <MenuItem key={s} onSelect={() => onMove(s)} disabled={!draggable}>
                                {STATUS_LABEL[s]}
                            </MenuItem>
                        ))}
                    </Menu>
                </div>
            )}
        </motion.li>
    );
}
