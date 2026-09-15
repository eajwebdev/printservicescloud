import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Link, router } from '@inertiajs/react';
import { Check, ExternalLink, PencilLine, Printer, ReceiptText, X } from 'lucide-react';
import { printReceipt } from '@/lib/print';
import { OrderFiles, ProofChip } from './order-files';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Chip, LiveDot, MethodChip, PaymentChip, StatusChip } from '@/components/ui/chip';
import { Combobox } from '@/components/ui/combobox';
import { Field, Input, MoneyInput } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/misc';
import { dateTime, dayTime, isPast, METHOD_LABEL, money, peso, qty, relative, STATUS_LABEL } from '@/lib/format';
import { cn, useCan } from '@/lib/utils';
import type { BoardStatus, Option, OrderDetail } from '@/types';
import { BOARD_STEPS, NEXT_STEP, patchStatus, ReleaseDialog } from './order-actions';

interface Props {
    orderId: number | null;
    staff: Option[];
    onClose: () => void;
    /** Called after anything changes so the list behind can refresh. */
    onChanged: () => void;
}

/** A side panel with everything needed to act on an order without leaving the list. */
export function OrderPeek({ orderId, staff, onClose, onChanged }: Props) {
    const can = useCan();
    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [failed, setFailed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [releasing, setReleasing] = useState(false);
    const [collect, setCollect] = useState({ amount: '', method: 'cash', reference: '' });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const load = useCallback(() => {
        if (!orderId) return;
        setFailed(false);
        fetch(route('orders.peek', orderId), { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
            .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
            .then((d: { order: OrderDetail }) => {
                setOrder(d.order);
                setCollect({ amount: d.order.balance > 0 ? d.order.balance.toFixed(2) : '', method: 'cash', reference: '' });
            })
            .catch(() => setFailed(true));
    }, [orderId]);

    useEffect(() => {
        setOrder(null);
        setErrors({});
        load();
    }, [load]);

    const changed = () => {
        load();
        onChanged();
    };

    const move = (status: BoardStatus) => {
        if (!order) return;
        if (status === 'released' && order.balance > 0) {
            setReleasing(true);
            return;
        }
        patchStatus(order, status, { onStart: () => setBusy(true), onSuccess: changed, onError: (m) => setErrors({ status: m }), onFinish: () => setBusy(false) });
    };

    const assign = (value: string) => {
        if (!order) return;
        router.patch(route('orders.update', order.id), { assigned_to: value ? Number(value) : null }, { preserveScroll: true, preserveState: true, onSuccess: changed });
    };

    const takePayment = () => {
        if (!order) return;
        setBusy(true);
        router.post(
            route('orders.collect', order.id),
            { amount: Number(collect.amount), method: collect.method, reference: collect.reference || null },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    setErrors({});
                    changed();
                },
                onError: setErrors,
                onFinish: () => setBusy(false),
            },
        );
    };

    const [printing, setPrinting] = useState(false);
    const print = () => {
        if (!order) return;
        setPrinting(true);
        printReceipt(order.id).finally(() => {
            setPrinting(false);
            load();
        });
    };

    const open = orderId !== null;
    const isJob = order?.type === 'job';
    const voided = order?.status === 'voided';
    const next = order && !voided ? NEXT_STEP[order.status] : undefined;
    const overdue = order && isJob && isPast(order.due_at) && (order.status === 'pending' || order.status === 'in_production');

    return (
        <>
            <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
                <AnimatePresence>
                    {open && (
                        <DialogPrimitive.Portal forceMount>
                            <DialogPrimitive.Overlay asChild forceMount>
                                <motion.div className="fixed inset-0 z-50 bg-[rgba(6,7,9,0.45)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} />
                            </DialogPrimitive.Overlay>
                            <DialogPrimitive.Content asChild forceMount onOpenAutoFocus={(e) => e.preventDefault()}>
                                <motion.aside
                                    className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-raised outline-none focus-visible:outline-none shadow-[var(--shadow-float)] sm:w-[440px]"
                                    initial={{ x: '100%' }}
                                    animate={{ x: 0 }}
                                    exit={{ x: '100%', transition: { duration: 0.15, ease: 'easeIn' } }}
                                    transition={{ type: 'spring', stiffness: 440, damping: 42 }}
                                >
                                    <header className="flex items-start gap-3 border-b border-line px-5 py-4">
                                        <div className="min-w-0 flex-1">
                                            <DialogPrimitive.Title className="font-mono text-lg font-semibold">{order?.order_no ?? 'Loading order'}</DialogPrimitive.Title>
                                            <DialogPrimitive.Description className="mt-0.5 truncate text-sm text-muted">
                                                {order ? `${order.customer}, ${isJob ? 'job order' : 'instant sale'}, ${dateTime(order.created_at)}` : 'Fetching details'}
                                            </DialogPrimitive.Description>
                                            {order && (
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    <StatusChip status={order.status} />
                                                    {!voided && <PaymentChip status={order.payment_status} balance={order.balance} />}
                                                    {order.rush && <Chip tone="red">Rush</Chip>}
                                                    <ProofChip status={order.proof_status} />
                                                </div>
                                            )}
                                        </div>
                                        <DialogPrimitive.Close className="-mr-1 grid size-8 place-items-center rounded-xs text-muted hover:bg-surface hover:text-fg" aria-label="Close">
                                            <X className="size-4" />
                                        </DialogPrimitive.Close>
                                    </header>

                                    <div className="min-h-0 flex-1 overflow-y-auto">
                                        {failed && (
                                            <div className="p-5 text-base text-muted">
                                                Couldn't load this order.{' '}
                                                <button type="button" className="text-fg underline" onClick={load}>
                                                    Try again
                                                </button>
                                            </div>
                                        )}
                                        {!order && !failed && (
                                            <div className="space-y-3 p-5">
                                                <Skeleton className="h-10 w-full" />
                                                <Skeleton className="h-24 w-full" />
                                                <Skeleton className="h-16 w-full" />
                                            </div>
                                        )}

                                        {order && (
                                            <>
                                                {isJob && !voided && (
                                                    <section className="border-b border-line p-5">
                                                        <div className="grid grid-cols-4 gap-px bg-line" role="group" aria-label="Production step">
                                                            {BOARD_STEPS.map((s, i) => {
                                                                const reached = BOARD_STEPS.indexOf(order.status as BoardStatus) >= i;
                                                                const current = order.status === s;
                                                                return (
                                                                    <button
                                                                        key={s}
                                                                        type="button"
                                                                        disabled={!can('orders.edit') || current || busy}
                                                                        onClick={() => move(s)}
                                                                        className={cn('relative bg-surface px-2 py-2 text-left enabled:hover:bg-bg', current && 'bg-bg')}
                                                                        aria-current={current ? 'step' : undefined}
                                                                    >
                                                                        <span className={cn('absolute inset-x-0 top-0 h-[2px]', reached ? 'bg-accent' : 'bg-transparent')} />
                                                                        <span className="flex items-center gap-1 font-mono text-2xs text-faint">
                                                                            0{i + 1}
                                                                            {reached && !current && <Check className="size-3 text-ok-text" />}
                                                                            {current && s === 'in_production' && <LiveDot className="size-1.5" />}
                                                                        </span>
                                                                        <span className={cn('block truncate text-xs', current ? 'font-semibold text-fg' : 'text-muted')}>{STATUS_LABEL[s]}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                        {next && can('orders.edit') && (
                                                            <Button variant="primary" size="lg" className="mt-3 w-full" loading={busy} onClick={() => move(next.to)}>
                                                                {next.label}
                                                                {next.to === 'released' && order.balance > 0 ? `, collect ${peso(order.balance)}` : ''}
                                                            </Button>
                                                        )}
                                                        {errors.status && <p className="mt-2 text-sm text-accent-text">{errors.status}</p>}

                                                        <div className="mt-4 grid grid-cols-2 gap-3">
                                                            <div>
                                                                <p className="mb-1.5 text-sm text-muted">Due</p>
                                                                <p className={cn('text-base', overdue ? 'text-accent-text' : 'text-fg')}>{order.due_at ? dayTime(order.due_at) : 'No date'}</p>
                                                                {order.due_at && <p className={cn('text-xs', overdue ? 'text-accent-text' : 'text-faint')}>{overdue ? 'Overdue, ' : ''}{relative(order.due_at)}</p>}
                                                            </div>
                                                            <Field label="Assigned to">
                                                                {(id) => (
                                                                    <Combobox
                                                                        id={id}
                                                                        ariaLabel="Assigned to"
                                                                        placeholder="Unassigned"
                                                                        searchPlaceholder="Find staff"
                                                                        value={order.assigned_to ? String(order.assigned_to) : ''}
                                                                        onChange={assign}
                                                                        disabled={!can('orders.edit')}
                                                                        options={staff.map((s) => ({ value: String(s.id), label: s.name }))}
                                                                    />
                                                                )}
                                                            </Field>
                                                        </div>
                                                        {order.notes && <p className="mt-3 border-l-2 border-line-strong pl-3 text-sm text-muted">{order.notes}</p>}
                                                    </section>
                                                )}

                                                <section className="border-b border-line">
                                                    <ul className="divide-y divide-line">
                                                        {order.lines.map((l) => (
                                                            <li key={l.id} className="flex gap-3 px-5 py-2.5">
                                                                <span className="num w-8 shrink-0 text-base text-muted">{qty(l.qty)}×</span>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-base">{l.name}</p>
                                                                    <p className="text-xs text-faint">
                                                                        {[
                                                                            l.spec?.width ? `${qty(l.spec.width)}×${qty(l.spec.height)} ${l.spec.unit}` : null,
                                                                            l.spec?.options?.length ? l.spec.options.map((o) => o.name).join(', ') : null,
                                                                            l.spec?.rush ? 'Rush' : null,
                                                                            l.note,
                                                                        ]
                                                                            .filter(Boolean)
                                                                            .join('; ')}
                                                                    </p>
                                                                </div>
                                                                <span className="num shrink-0 text-base">{money(l.line_total)}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                    <dl className="grid grid-cols-3 border-t border-line text-center">
                                                        <div className="border-r border-line px-3 py-2.5">
                                                            <dt className="text-xs text-faint">Total</dt>
                                                            <dd className="num text-lg font-semibold">{peso(order.total)}</dd>
                                                        </div>
                                                        <div className="border-r border-line px-3 py-2.5">
                                                            <dt className="text-xs text-faint">Paid</dt>
                                                            <dd className="num text-lg">{peso(order.paid)}</dd>
                                                        </div>
                                                        <div className="px-3 py-2.5">
                                                            <dt className="text-xs text-faint">Balance</dt>
                                                            <dd className={cn('num text-lg', order.balance > 0 ? 'text-warn-text' : 'text-faint')}>{peso(order.balance)}</dd>
                                                        </div>
                                                    </dl>
                                                </section>

                                                {order.balance > 0 && !voided && can('customers.settle') && (
                                                    <section className="space-y-3 border-b border-line p-5">
                                                        <p className="text-base font-medium">Take a payment</p>
                                                        <div className="grid grid-cols-3 gap-1">
                                                            {['cash', 'gcash', 'bank'].map((m) => (
                                                                <button
                                                                    key={m}
                                                                    type="button"
                                                                    aria-pressed={collect.method === m}
                                                                    onClick={() => setCollect({ ...collect, method: m })}
                                                                    className={cn('h-9 rounded-xs border text-base', collect.method === m ? 'border-fg bg-surface text-fg' : 'border-line text-muted hover:text-fg')}
                                                                >
                                                                    {METHOD_LABEL[m]}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <MoneyInput aria-label="Amount" className="flex-1" value={collect.amount} onChange={(e) => setCollect({ ...collect, amount: e.target.value })} />
                                                            <Button onClick={takePayment} loading={busy} disabled={!(Number(collect.amount) > 0)}>
                                                                Record
                                                            </Button>
                                                        </div>
                                                        {collect.method !== 'cash' && (
                                                            <Input aria-label="Reference number" placeholder="Reference no." className="font-mono" value={collect.reference} onChange={(e) => setCollect({ ...collect, reference: e.target.value })} />
                                                        )}
                                                        {(errors.amount || errors.reference) && <p className="text-sm text-accent-text">{errors.amount ?? errors.reference}</p>}
                                                    </section>
                                                )}

                                                <section className="border-b border-line p-5">
                                                    <p className="mb-2 text-base font-medium">
                                                        Files{order.files.length ? <span className="num ml-1.5 text-sm text-faint">{order.files.length}</span> : null}
                                                    </p>
                                                    <OrderFiles compact orderId={order.id} files={order.files} proofStatus={order.proof_status} isJob={!!isJob && !voided} onChanged={changed} />
                                                </section>

                                                {order.revisions.length > 0 && (
                                                    <section className="border-b border-line px-5 py-3">
                                                        <p className="mb-1 text-sm text-faint">Changes after checkout</p>
                                                        <ul className="space-y-1.5 text-sm">
                                                            {order.revisions.map((r) => (
                                                                <li key={r.id}>
                                                                    <span className="num text-fg">
                                                                        {peso(r.old_total)} to {peso(r.new_total)}
                                                                    </span>
                                                                    <span className="text-faint">
                                                                        {' '}
                                                                        {r.reason}, {r.user}, {dateTime(r.at)}
                                                                    </span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </section>
                                                )}

                                                {order.payments.length > 0 && (
                                                    <section className="px-5 py-3">
                                                        <p className="mb-1 text-sm text-faint">Payments</p>
                                                        <ul className="space-y-1.5">
                                                            {order.payments.map((p) => (
                                                                <li key={p.id} className="flex items-center gap-2 text-sm">
                                                                    <MethodChip method={p.method} />
                                                                    <span className="min-w-0 flex-1 truncate text-faint">
                                                                        {p.kind === 'settlement' ? 'Balance, ' : p.kind === 'refund' ? 'Refund, ' : ''}
                                                                        {dateTime(p.at)}
                                                                    </span>
                                                                    <span className={cn('num', p.amount < 0 ? 'text-accent-text' : 'text-fg')}>{peso(p.amount)}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </section>
                                                )}
                                                {voided && <p className="px-5 py-3 text-sm text-accent-text">Voided: {order.void_reason}</p>}
                                            </>
                                        )}
                                    </div>

                                    {order && (
                                        <footer className="flex flex-wrap gap-2 border-t border-line bg-surface px-5 py-3">
                                            <Button size="sm" icon={<Printer />} loading={printing} onClick={print} title={order.print_count ? `Printed ${order.print_count} time(s); the next copy says REPRINT` : undefined}>
                                                {order.print_count ? 'Reprint' : 'Print receipt'}
                                            </Button>
                                            {can('orders.edit') && !voided && (
                                                <Link href={route('orders.change', order.id)}>
                                                    <Button size="sm" icon={<PencilLine />}>
                                                        Change items
                                                    </Button>
                                                </Link>
                                            )}
                                            {isJob && (
                                                <a href={route('orders.ticket', order.id)} target="_blank" rel="noreferrer">
                                                    <Button size="sm" icon={<ReceiptText />}>
                                                        Job ticket
                                                    </Button>
                                                </a>
                                            )}
                                            <Link href={route('orders.show', order.id)} className="ml-auto">
                                                <Button size="sm" variant="ghost" icon={<ExternalLink />}>
                                                    Full details
                                                </Button>
                                            </Link>
                                        </footer>
                                    )}
                                </motion.aside>
                            </DialogPrimitive.Content>
                        </DialogPrimitive.Portal>
                    )}
                </AnimatePresence>
            </DialogPrimitive.Root>
            <ReleaseDialog order={releasing ? order : null} onClose={() => setReleasing(false)} onReleased={changed} />
        </>
    );
}
