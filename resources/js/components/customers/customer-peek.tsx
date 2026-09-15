import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Link, router } from '@inertiajs/react';
import { ExternalLink, FileDown, MessageSquare, Pencil, Phone, ScanBarcode, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Chip, PaymentChip, StatusChip } from '@/components/ui/chip';
import { Input, MoneyInput } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/misc';
import { date, METHOD_LABEL, peso } from '@/lib/format';
import { cn, useAppPage, useCan } from '@/lib/utils';
import type { OrderCard } from '@/types';

export interface CustomerDetail {
    id: number;
    name: string;
    business_name: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
    credit_balance: number;
    credit_limit: number | null;
    is_senior_pwd: boolean;
    lifetime_value: number;
    orders_count: number;
}

interface Payload {
    customer: CustomerDetail;
    orders: OrderCard[];
    openReceivables: { id: number; order_id: number | null; order_no: string | null; outstanding: number; days: number }[];
}

/** Customer at a glance: call them, start a sale for them, or collect what they owe. */
export function CustomerPeek({ customerId, onClose, onEdit, onChanged }: { customerId: number | null; onClose: () => void; onEdit: (c: CustomerDetail) => void; onChanged: () => void }) {
    const can = useCan();
    const { props } = useAppPage();
    const [data, setData] = useState<Payload | null>(null);
    const [failed, setFailed] = useState(false);
    const [pay, setPay] = useState({ amount: '', method: 'cash', reference: '' });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);

    const load = useCallback(() => {
        if (!customerId) return;
        setFailed(false);
        fetch(route('customers.peek', customerId), { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
            .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
            .then((d: Payload) => {
                setData(d);
                setPay({ amount: d.customer.credit_balance > 0 ? d.customer.credit_balance.toFixed(2) : '', method: 'cash', reference: '' });
            })
            .catch(() => setFailed(true));
    }, [customerId]);

    useEffect(() => {
        setData(null);
        setErrors({});
        load();
    }, [load]);

    const collect = () => {
        if (!data) return;
        setBusy(true);
        router.post(
            route('customers.settle', data.customer.id),
            { amount: Number(pay.amount), method: pay.method, reference: pay.reference || null },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    setErrors({});
                    load();
                    onChanged();
                },
                onError: setErrors,
                onFinish: () => setBusy(false),
            },
        );
    };

    const c = data?.customer;
    const open = customerId !== null;
    const digits = c?.phone?.replace(/[^\d+]/g, '');

    return (
        <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
            <AnimatePresence>
                {open && (
                    <DialogPrimitive.Portal forceMount>
                        <DialogPrimitive.Overlay asChild forceMount>
                            <motion.div className="fixed inset-0 z-50 bg-[rgba(6,7,9,0.45)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} />
                        </DialogPrimitive.Overlay>
                        <DialogPrimitive.Content asChild forceMount onOpenAutoFocus={(e) => e.preventDefault()}>
                            <motion.aside
                                className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-raised outline-none focus-visible:outline-none shadow-[var(--shadow-float)] sm:w-[420px]"
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%', transition: { duration: 0.15, ease: 'easeIn' } }}
                                transition={{ type: 'spring', stiffness: 440, damping: 42 }}
                            >
                                <header className="flex items-start gap-3 border-b border-line px-5 py-4">
                                    <div className="min-w-0 flex-1">
                                        <DialogPrimitive.Title className="truncate text-lg font-semibold">{c?.name ?? 'Loading customer'}</DialogPrimitive.Title>
                                        <DialogPrimitive.Description className="truncate text-sm text-muted">{c ? [c.business_name, c.address].filter(Boolean).join(', ') || 'Customer' : 'Fetching details'}</DialogPrimitive.Description>
                                        {c?.is_senior_pwd && <Chip tone="info" className="mt-1.5">Senior/PWD</Chip>}
                                    </div>
                                    <DialogPrimitive.Close className="-mr-1 grid size-8 place-items-center rounded-xs text-muted hover:bg-surface hover:text-fg" aria-label="Close">
                                        <X className="size-4" />
                                    </DialogPrimitive.Close>
                                </header>

                                <div className="min-h-0 flex-1 overflow-y-auto">
                                    {failed && (
                                        <p className="p-5 text-base text-muted">
                                            Couldn't load this customer.{' '}
                                            <button type="button" className="text-fg underline" onClick={load}>
                                                Try again
                                            </button>
                                        </p>
                                    )}
                                    {!data && !failed && (
                                        <div className="space-y-3 p-5">
                                            <Skeleton className="h-10 w-full" />
                                            <Skeleton className="h-20 w-full" />
                                        </div>
                                    )}
                                    {c && data && (
                                        <>
                                            <section className="grid grid-cols-2 gap-2 border-b border-line p-5">
                                                {props.auth?.pages.includes('pos') && (
                                                    <ButtonLink href={route('pos.index', { customer: c.id })} variant="primary" icon={<ScanBarcode />} className="col-span-2">
                                                        New sale for {c.name.split(' ')[0]}
                                                    </ButtonLink>
                                                )}
                                                {digits ? (
                                                    <>
                                                        <a href={`tel:${digits}`}>
                                                            <Button className="w-full" icon={<Phone />}>
                                                                Call
                                                            </Button>
                                                        </a>
                                                        <a href={`sms:${digits}`}>
                                                            <Button className="w-full" icon={<MessageSquare />}>
                                                                Text
                                                            </Button>
                                                        </a>
                                                    </>
                                                ) : (
                                                    <p className="col-span-2 text-sm text-faint">No phone on file. Add one so pickup texts reach them.</p>
                                                )}
                                            </section>

                                            <dl className="grid grid-cols-3 border-b border-line text-center">
                                                <div className="border-r border-line px-2 py-3">
                                                    <dt className="text-xs text-faint">Owes</dt>
                                                    <dd className={cn('num text-lg font-semibold', c.credit_balance > 0 ? 'text-warn-text' : 'text-faint')}>{peso(c.credit_balance)}</dd>
                                                </div>
                                                <div className="border-r border-line px-2 py-3">
                                                    <dt className="text-xs text-faint">Orders</dt>
                                                    <dd className="num text-lg">{c.orders_count}</dd>
                                                </div>
                                                <div className="px-2 py-3">
                                                    <dt className="text-xs text-faint">Lifetime</dt>
                                                    <dd className="num text-lg">{peso(c.lifetime_value)}</dd>
                                                </div>
                                            </dl>

                                            {c.credit_balance > 0 && can('customers.settle') && (
                                                <section className="space-y-3 border-b border-line p-5">
                                                    <div className="flex items-baseline justify-between">
                                                        <p className="text-base font-medium">Collect a payment</p>
                                                        {c.credit_limit !== null && <p className="text-xs text-faint">Limit {peso(c.credit_limit)}</p>}
                                                    </div>
                                                    {data.openReceivables.length > 0 && (
                                                        <ul className="space-y-1 text-sm">
                                                            {data.openReceivables.map((r) => (
                                                                <li key={r.id} className="flex justify-between gap-2">
                                                                    <span className="font-mono text-muted">{r.order_no ?? 'Charge'}</span>
                                                                    <span className={cn('text-xs', r.days > 30 ? 'text-accent-text' : 'text-faint')}>{r.days} days</span>
                                                                    <span className="num ml-auto text-warn-text">{peso(r.outstanding)}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                    <div className="grid grid-cols-3 gap-1">
                                                        {['cash', 'gcash', 'bank'].map((m) => (
                                                            <button
                                                                key={m}
                                                                type="button"
                                                                aria-pressed={pay.method === m}
                                                                onClick={() => setPay({ ...pay, method: m })}
                                                                className={cn('h-9 rounded-xs border text-base', pay.method === m ? 'border-fg bg-surface text-fg' : 'border-line text-muted hover:text-fg')}
                                                            >
                                                                {METHOD_LABEL[m]}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <MoneyInput aria-label="Amount" className="flex-1" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
                                                        <Button onClick={collect} loading={busy} disabled={!(Number(pay.amount) > 0)}>
                                                            Record
                                                        </Button>
                                                    </div>
                                                    {pay.method !== 'cash' && <Input aria-label="Reference number" placeholder="Reference no." className="font-mono" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} />}
                                                    {(errors.amount || errors.reference) && <p className="text-sm text-accent-text">{errors.amount ?? errors.reference}</p>}
                                                    <p className="text-xs text-faint">Applied to the oldest balance first.</p>
                                                </section>
                                            )}

                                            <section className="border-b border-line px-5 py-3 text-sm">
                                                <dl className="space-y-1.5">
                                                    {[
                                                        ['Phone', c.phone],
                                                        ['Email', c.email],
                                                        ['Address', c.address],
                                                    ].map(([k, v]) => (
                                                        <div key={k} className="flex gap-3">
                                                            <dt className="w-16 shrink-0 text-faint">{k}</dt>
                                                            <dd className={v ? 'text-fg' : 'text-ghost'}>{v || 'Not set'}</dd>
                                                        </div>
                                                    ))}
                                                </dl>
                                                {c.notes && <p className="mt-2 border-l-2 border-line-strong pl-3 text-muted">{c.notes}</p>}
                                            </section>

                                            <section className="py-2">
                                                <p className="px-5 pb-1 text-sm text-faint">Latest orders</p>
                                                {data.orders.length ? (
                                                    <ul>
                                                        {data.orders.map((o) => (
                                                            <li key={o.id}>
                                                                <Link href={route('orders.index', { view: 'list', q: o.order_no, highlight: o.id })} className="flex items-center gap-2 px-5 py-2 hover:bg-surface">
                                                                    <span className="min-w-0 flex-1">
                                                                        <span className="block font-mono text-sm">{o.order_no}</span>
                                                                        <span className="block truncate text-xs text-faint">
                                                                            {date(o.created_at)}, {o.summary}
                                                                        </span>
                                                                    </span>
                                                                    <span className="flex flex-col items-end gap-1">
                                                                        <span className="num text-sm">{peso(o.total)}</span>
                                                                        {o.balance > 0 && o.status !== 'voided' ? <PaymentChip status={o.payment_status} balance={o.balance} /> : <StatusChip status={o.status} />}
                                                                    </span>
                                                                </Link>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <p className="px-5 py-2 text-sm text-muted">No orders yet.</p>
                                                )}
                                            </section>
                                        </>
                                    )}
                                </div>

                                {c && (
                                    <footer className="flex flex-wrap gap-2 border-t border-line bg-surface px-5 py-3">
                                        {can('customers.edit') && (
                                            <Button size="sm" icon={<Pencil />} onClick={() => onEdit(c)}>
                                                Edit
                                            </Button>
                                        )}
                                        <a href={route('customers.statement', c.id)} target="_blank" rel="noreferrer">
                                            <Button size="sm" icon={<FileDown />}>
                                                Statement
                                            </Button>
                                        </a>
                                        <Link href={route('customers.show', c.id)} className="ml-auto">
                                            <Button size="sm" variant="ghost" icon={<ExternalLink />}>
                                                Full profile
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
    );
}
