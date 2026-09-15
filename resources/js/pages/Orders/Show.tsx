import { Head, Link, router, useForm } from '@inertiajs/react';
import { Ban, Check, FileDown, MoreHorizontal, PencilLine, Printer, ReceiptText } from 'lucide-react';
import { OrderFiles, ProofChip } from '@/components/orders/order-files';
import { printReceipt } from '@/lib/print';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button, IconButton } from '@/components/ui/button';
import { Chip, LiveDot, MethodChip, PaymentChip, StatusChip } from '@/components/ui/chip';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Combobox } from '@/components/ui/combobox';
import { Field, Input, MoneyInput, Textarea } from '@/components/ui/field';
import { Menu, MenuItem } from '@/components/ui/menu';
import { Panel } from '@/components/ui/misc';
import { Switch } from '@/components/ui/toggle';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { dateTime, dayTime, isPast, METHOD_LABEL, money, peso, qty, relative, STATUS_LABEL, toLocalInput } from '@/lib/format';
import { cn, useCan } from '@/lib/utils';
import type { BoardStatus, Option, OrderDetail } from '@/types';

interface Props {
    order: OrderDetail;
    timeline: { id: number; description: string; causer: string | null; at: string }[];
    staff: Option[];
}

const STEPS: BoardStatus[] = ['pending', 'in_production', 'ready', 'released'];

export default function OrderShow({ order, timeline, staff }: Props) {
    const can = useCan();
    const [voiding, setVoiding] = useState(false);
    const [voidError, setVoidError] = useState<string>();
    const [processing, setProcessing] = useState(false);
    const [printing, setPrinting] = useState(false);
    const voided = order.status === 'voided';
    const isJob = order.type === 'job';
    const margin = order.total > 0 ? ((order.total - order.cost_total) / order.total) * 100 : 0;

    const details = useForm({
        assigned_to: order.assigned_to ? String(order.assigned_to) : '',
        due_at: order.due_at ? toLocalInput(new Date(order.due_at)) : '',
        rush: order.rush,
        notes: order.notes ?? '',
    });
    const collect = useForm({ amount: order.balance.toFixed(2), method: 'cash', reference: '' });

    const moveTo = (status: BoardStatus) => router.patch(route('orders.status', order.id), { status }, { preserveScroll: true });

    return (
        <>
            <Head title={order.order_no} />
            <PageHeader
                back={{ href: route('orders.index', { view: isJob && order.status !== 'released' ? 'board' : 'today', highlight: order.id }), label: isJob ? 'Production board' : 'Orders' }}
                title={<span className="font-mono tracking-tight">{order.order_no}</span>}
                meta={
                    <>
                        <StatusChip status={order.status} />
                        {!voided && <PaymentChip status={order.payment_status} balance={order.balance} />}
                        {order.rush && <Chip tone="red">Rush</Chip>}
                        <ProofChip status={order.proof_status} />
                    </>
                }
                description={`${isJob ? 'Job order' : 'Instant sale'} for ${order.customer}, rung up ${dateTime(order.created_at)} by ${order.cashier ?? 'staff'}.`}
                actions={
                    <>
                        <Button
                            icon={<Printer />}
                            loading={printing}
                            onClick={() => {
                                setPrinting(true);
                                printReceipt(order.id).finally(() => {
                                    setPrinting(false);
                                    router.reload({ only: ['order', 'timeline'] });
                                });
                            }}
                        >
                            {order.print_count ? `Reprint (printed ${order.print_count}×)` : 'Print receipt'}
                        </Button>
                        {can('orders.edit') && !voided && (
                            <Link href={route('orders.change', order.id)}>
                                <Button icon={<PencilLine />}>Change items</Button>
                            </Link>
                        )}
                        {isJob && (
                            <a href={route('orders.ticket', order.id)} target="_blank" rel="noreferrer">
                                <Button icon={<ReceiptText />}>Job ticket and claim stub</Button>
                            </a>
                        )}
                        {can('orders.void') && !voided && (
                            <Menu
                                trigger={
                                    <IconButton label="More actions" size="md" variant="quiet">
                                        <MoreHorizontal />
                                    </IconButton>
                                }
                            >
                                <MenuItem icon={<FileDown />} onSelect={() => window.open(route('orders.receipt', order.id), '_blank')}>
                                    Receipt as PDF
                                </MenuItem>
                                <MenuItem danger icon={<Ban />} onSelect={() => setVoiding(true)}>
                                    Void this order
                                </MenuItem>
                            </Menu>
                        )}
                    </>
                }
            />

            {voided && (
                <div className="border-b border-line bg-selected px-6 py-3 text-base text-accent-text">
                    Voided: {order.void_reason}. Stock went back on the shelf and money taken was refunded.
                </div>
            )}

            <div className="grid gap-5 p-5 lg:p-6 xl:grid-cols-[1fr_380px]">
                <div className="min-w-0 space-y-5">
                    {isJob && !voided && (
                        <section aria-label="Production progress" className="grid grid-cols-4 border border-line bg-surface">
                            {STEPS.map((s, i) => {
                                const reached = STEPS.indexOf(order.status as BoardStatus) >= i;
                                const current = order.status === s;
                                return (
                                    <button
                                        key={s}
                                        type="button"
                                        disabled={!can('orders.edit') || current}
                                        onClick={() => moveTo(s)}
                                        className={cn(
                                            'relative border-r border-line px-4 py-3 text-left transition-colors last:border-r-0 enabled:hover:bg-raised',
                                            current && 'bg-raised',
                                        )}
                                    >
                                        <span className={cn('absolute inset-x-0 top-0 h-[2px]', reached ? 'bg-accent' : 'bg-transparent')} />
                                        <span className="flex items-center gap-2 font-mono text-xs text-faint">
                                            0{i + 1}
                                            {reached && !current && <Check className="size-3 text-ok-text" />}
                                            {current && s === 'in_production' && <LiveDot />}
                                        </span>
                                        <span className={cn('mt-0.5 block text-base', current ? 'font-semibold text-fg' : reached ? 'text-muted' : 'text-faint')}>{STATUS_LABEL[s]}</span>
                                    </button>
                                );
                            })}
                        </section>
                    )}

                    <Panel title="Items">
                        <Table minWidth={620}>
                            <THead>
                                <tr>
                                    <Th>Item</Th>
                                    <Th align="right">Qty</Th>
                                    <Th align="right">Unit</Th>
                                    <Th align="right">Discount</Th>
                                    <Th align="right">Amount</Th>
                                </tr>
                            </THead>
                            <tbody>
                                {order.lines.map((l) => (
                                    <Tr key={l.id}>
                                        <Td>
                                            <p className="text-base">{l.name}</p>
                                            <p className="text-sm text-muted">
                                                {[
                                                    l.spec?.width ? `${qty(l.spec.width)}×${qty(l.spec.height)} ${l.spec.unit}, ${qty(l.spec.sqft, 2)} sqft each` : null,
                                                    l.spec?.options?.length ? l.spec.options.map((o) => o.name).join(', ') : null,
                                                    l.spec?.rush ? 'Rush' : null,
                                                    l.note,
                                                ]
                                                    .filter(Boolean)
                                                    .join('; ')}
                                            </p>
                                        </Td>
                                        <Td numeric>{qty(l.qty)}</Td>
                                        <Td numeric muted>{money(l.unit_price)}</Td>
                                        <Td numeric muted>{l.discount_amount > 0 ? `−${money(l.discount_amount)}` : ''}</Td>
                                        <Td numeric>{money(l.line_total)}</Td>
                                    </Tr>
                                ))}
                            </tbody>
                        </Table>
                        <dl className="ml-auto max-w-sm space-y-1 border-t border-line px-5 py-4 text-base">
                            <Row label="Subtotal" value={peso(order.subtotal)} />
                            {order.discount_total - order.senior_pwd_discount > 0 && <Row label="Order discount" value={`−${peso(order.discount_total - order.senior_pwd_discount)}`} />}
                            {order.senior_pwd && <Row label="Senior / PWD" value={`−${peso(order.senior_pwd_discount)}`} />}
                            {order.tax_total > 0 && <Row label="VAT" value={peso(order.tax_total)} />}
                            <div className="flex justify-between border-t border-line-strong pt-2 font-display text-xl font-semibold">
                                <dt>Total</dt>
                                <dd className="num">{peso(order.total)}</dd>
                            </div>
                            <Row label="Paid" value={peso(order.paid)} />
                            {order.balance > 0 && <Row label="Balance" value={peso(order.balance)} tone="warn" />}
                            {can('reports.view') && <Row label="Cost of materials and goods" value={`${peso(order.cost_total)}, ${margin.toFixed(0)}% margin`} muted />}
                        </dl>
                    </Panel>

                    <Panel title={`Files${order.files.length ? ` (${order.files.length})` : ''}`} bodyClass="p-5">
                        <OrderFiles orderId={order.id} files={order.files} proofStatus={order.proof_status} isJob={isJob && !voided} onChanged={() => router.reload({ only: ['order', 'timeline'] })} />
                    </Panel>

                    {order.revisions.length > 0 && (
                        <Panel title="Changes after checkout">
                            <ul className="divide-y divide-line">
                                {order.revisions.map((r) => (
                                    <li key={r.id} className="px-5 py-3">
                                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                                            <p className="text-base">{r.reason}</p>
                                            <p className="num text-base">
                                                {peso(r.old_total)} <span className="text-faint">to</span> {peso(r.new_total)}
                                            </p>
                                        </div>
                                        <p className="text-sm text-faint">
                                            {r.user}, {dateTime(r.at)}
                                            {r.collected > 0 && `, collected ${peso(r.collected)}`}
                                            {r.refunded > 0 && `, refunded ${peso(r.refunded)}`}
                                        </p>
                                        <p className="mt-1 text-sm text-muted">
                                            Before: {r.old_lines.map((l) => `${qty(l.qty)}× ${l.name}`).join('; ')}
                                            <br />
                                            After: {r.new_lines.map((l) => `${qty(l.qty)}× ${l.name}`).join('; ')}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                    )}

                    <Panel title="Payments">
                        {order.payments.length ? (
                            <Table minWidth={560}>
                                <THead>
                                    <tr>
                                        <Th>When</Th>
                                        <Th>Method</Th>
                                        <Th>Reference</Th>
                                        <Th>Taken by</Th>
                                        <Th align="right">Amount</Th>
                                    </tr>
                                </THead>
                                <tbody>
                                    {order.payments.map((p) => (
                                        <Tr key={p.id}>
                                            <Td muted className="text-sm whitespace-nowrap">{dateTime(p.at)}</Td>
                                            <Td>
                                                <span className="flex items-center gap-2">
                                                    <MethodChip method={p.method} />
                                                    {p.kind !== 'sale' && <span className="text-sm text-faint">{p.kind === 'settlement' ? 'Balance' : 'Refund'}</span>}
                                                </span>
                                            </Td>
                                            <Td muted className="font-mono text-sm">{p.reference}</Td>
                                            <Td muted className="text-sm">{p.user}</Td>
                                            <Td numeric className={p.amount < 0 ? 'text-accent-text' : ''}>
                                                {peso(p.amount)}
                                                {p.tendered && p.tendered > p.amount && <span className="block text-xs text-faint">received {peso(p.tendered)}</span>}
                                            </Td>
                                        </Tr>
                                    ))}
                                </tbody>
                            </Table>
                        ) : (
                            <p className="px-5 py-6 text-base text-muted">No payment yet. The full amount is on the customer's account.</p>
                        )}
                    </Panel>

                    <Panel title="Activity">
                        <ol className="relative px-5 py-4">
                            {timeline.map((t) => (
                                <li key={t.id} className="relative border-l border-line pb-4 pl-5 last:pb-0">
                                    <span className="absolute top-1.5 -left-[3.5px] size-1.5 bg-line-strong" />
                                    <p className="text-base">{t.description}</p>
                                    <p className="text-sm text-faint">
                                        {t.causer ?? 'System'}, {dateTime(t.at)}
                                    </p>
                                </li>
                            ))}
                        </ol>
                    </Panel>
                </div>

                <aside className="space-y-5">
                    <Panel title="Customer">
                        <div className="px-5 py-4">
                            {order.customer_id ? (
                                <Link href={route('customers.show', order.customer_id)} className="text-lg font-medium hover:underline">
                                    {order.customer}
                                </Link>
                            ) : (
                                <p className="text-lg">Walk-in</p>
                            )}
                            {order.customer_phone && <p className="num text-base text-muted">{order.customer_phone}</p>}
                            {order.customer_balance > 0 && <p className="mt-2 text-sm text-warn-text">Account owes {peso(order.customer_balance)} in total</p>}
                        </div>
                    </Panel>

                    {order.balance > 0 && !voided && can('customers.settle') && (
                        <Panel title={`Collect balance, ${peso(order.balance)}`}>
                            <form
                                className="space-y-3 p-5"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    collect.post(route('orders.collect', order.id), { preserveScroll: true });
                                }}
                            >
                                <div className="flex gap-1">
                                    {['cash', 'gcash', 'bank'].map((m) => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => collect.setData('method', m)}
                                            aria-pressed={collect.data.method === m}
                                            className={cn('h-9 flex-1 rounded-xs border text-base', collect.data.method === m ? 'border-accent bg-selected text-fg' : 'border-line text-muted hover:text-fg')}
                                        >
                                            {METHOD_LABEL[m]}
                                        </button>
                                    ))}
                                </div>
                                <Field label="Amount" error={collect.errors.amount}>
                                    {(id, d) => <MoneyInput id={id} aria-describedby={d} inputSize="lg" value={collect.data.amount} onChange={(e) => collect.setData('amount', e.target.value)} />}
                                </Field>
                                {collect.data.method !== 'cash' && (
                                    <Field label="Reference no." error={collect.errors.reference}>
                                        {(id, d) => <Input id={id} aria-describedby={d} className="font-mono" value={collect.data.reference} onChange={(e) => collect.setData('reference', e.target.value)} />}
                                    </Field>
                                )}
                                <Button type="submit" variant="primary" className="w-full" loading={collect.processing}>
                                    Record payment
                                </Button>
                                {collect.data.method === 'cash' && <p className="text-xs text-faint">Cash posts to your open drawer.</p>}
                            </form>
                        </Panel>
                    )}

                    {isJob && !voided && (
                        <Panel title="Job details">
                            <form
                                className="space-y-3 p-5"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    details.transform((d) => ({ ...d, assigned_to: d.assigned_to || null, due_at: d.due_at ? d.due_at.replace('T', ' ') + ':00' : null }));
                                    details.patch(route('orders.update', order.id), { preserveScroll: true });
                                }}
                            >
                                <div className={cn('flex items-center justify-between border px-3 py-2 text-sm', isPast(order.due_at) && order.status !== 'released' ? 'border-accent text-accent-text' : 'border-line text-muted')}>
                                    <span>{order.due_at ? `Due ${dayTime(order.due_at)}` : 'No due date'}</span>
                                    <span>{relative(order.due_at)}</span>
                                </div>
                                <Field label="Due">
                                    {(id) => <Input id={id} type="datetime-local" value={details.data.due_at} onChange={(e) => details.setData('due_at', e.target.value)} disabled={!can('orders.edit')} />}
                                </Field>
                                <Field label="Assigned to">
                                    {(id) => (
                                        <Combobox
                                            id={id}
                                            ariaLabel="Assigned to"
                                            placeholder="Unassigned"
                                            searchPlaceholder="Find staff"
                                            value={details.data.assigned_to}
                                            onChange={(v) => details.setData('assigned_to', v)}
                                            disabled={!can('orders.edit')}
                                            options={staff.map((s) => ({ value: String(s.id), label: s.name }))}
                                        />
                                    )}
                                </Field>
                                <Switch checked={details.data.rush} onChange={(v) => details.setData('rush', v)} label="Rush" disabled={!can('orders.edit')} />
                                <Field label="Production notes">
                                    {(id) => <Textarea id={id} value={details.data.notes} onChange={(e) => details.setData('notes', e.target.value)} disabled={!can('orders.edit')} />}
                                </Field>
                                {can('orders.edit') && (
                                    <Button type="submit" loading={details.processing} disabled={!details.isDirty}>
                                        Save details
                                    </Button>
                                )}
                            </form>
                        </Panel>
                    )}
                </aside>
            </div>

            <ConfirmDialog
                open={voiding}
                onOpenChange={setVoiding}
                title={`Void ${order.order_no}?`}
                body={
                    <>
                        Stock and materials go back into inventory.{' '}
                        {order.payments.some((p) => p.method === 'cash' && p.amount > 0) ? 'Cash taken is refunded out of your open drawer. ' : ''}
                        Any balance is cancelled. This can not be undone.
                    </>
                }
                confirmLabel="Void order"
                requireReason="Reason"
                danger
                processing={processing}
                error={voidError}
                onConfirm={(reason) => {
                    setProcessing(true);
                    router.post(
                        route('orders.void', order.id),
                        { reason },
                        {
                            preserveScroll: true,
                            onSuccess: () => setVoiding(false),
                            onError: (e) => setVoidError(e.reason ?? Object.values(e)[0]),
                            onFinish: () => setProcessing(false),
                        },
                    );
                }}
            />
        </>
    );
}

function Row({ label, value, tone, muted }: { label: string; value: string; tone?: 'warn'; muted?: boolean }) {
    return (
        <div className={cn('flex justify-between gap-4', muted ? 'text-sm text-faint' : 'text-muted')}>
            <dt>{label}</dt>
            <dd className={cn('num', tone === 'warn' && 'text-warn-text', !muted && !tone && 'text-fg')}>{value}</dd>
        </div>
    );
}
