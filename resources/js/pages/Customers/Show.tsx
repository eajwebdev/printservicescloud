import { Head, Link, router, useForm } from '@inertiajs/react';
import { FileDown, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Chip, PaymentChip, StatusChip } from '@/components/ui/chip';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Field, Input, MoneyInput } from '@/components/ui/field';
import { EmptyState, Panel, Stat } from '@/components/ui/misc';
import { Segmented } from '@/components/ui/toggle';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { date, METHOD_LABEL, peso } from '@/lib/format';
import { cn, useCan } from '@/lib/utils';
import type { OrderCard } from '@/types';
import { CustomerDrawer, type CustomerFormValue } from './form';

interface Props {
    customer: CustomerFormValue & { id: number; credit_balance: number; lifetime_value: number; orders_count: number; created_at: string };
    orders: OrderCard[];
    statement: { date: string; ref: string; description: string; charge: number; payment: number; balance: number }[];
    openReceivables: { id: number; order_id: number | null; order_no: string | null; amount: number; settled: number; outstanding: number; due_date: string | null; created_at: string; days: number }[];
}

export default function CustomerShow({ customer, orders, statement, openReceivables }: Props) {
    const can = useCan();
    const [tab, setTab] = useState<'orders' | 'statement'>(customer.credit_balance > 0 ? 'statement' : 'orders');
    const [editOpen, setEditOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const settle = useForm({ amount: customer.credit_balance.toFixed(2), method: 'cash', reference: '', order_id: '' as string | number });

    return (
        <>
            <Head title={customer.name} />
            <PageHeader
                back={{ href: route('customers.index'), label: 'Customers' }}
                title={customer.name}
                meta={customer.is_senior_pwd && <Chip tone="info">Senior/PWD</Chip>}
                description={[customer.business_name, customer.phone, customer.email, customer.address].filter(Boolean).join(', ') || 'No contact details yet.'}
                actions={
                    <>
                        <a href={route('customers.statement', customer.id)} target="_blank" rel="noreferrer">
                            <Button icon={<FileDown />}>Statement PDF</Button>
                        </a>
                        {can('customers.edit') && (
                            <Button icon={<Pencil />} onClick={() => setEditOpen(true)}>
                                Edit
                            </Button>
                        )}
                        {can('customers.delete') && (
                            <Button variant="danger" icon={<Trash2 />} onClick={() => setDeleting(true)} aria-label="Remove customer" />
                        )}
                    </>
                }
            />

            <section className="grid grid-cols-2 divide-x divide-line border-b border-line bg-surface md:grid-cols-4">
                <Stat label="Owes now" value={peso(customer.credit_balance)} tone={customer.credit_balance > 0 ? 'warn' : undefined} sub={customer.credit_limit !== null ? `Limit ${peso(customer.credit_limit)}` : 'No credit limit'} />
                <Stat label="Lifetime value" value={peso(customer.lifetime_value)} />
                <Stat label="Orders" value={customer.orders_count} />
                <Stat label="Customer since" value={date(customer.created_at)} />
            </section>

            <div className="grid gap-5 p-5 lg:p-6 xl:grid-cols-[1fr_360px]">
                <div className="min-w-0">
                    <Segmented
                        label="View"
                        value={tab}
                        onChange={setTab}
                        className="mb-3"
                        options={[
                            { value: 'orders', label: 'Order history' },
                            { value: 'statement', label: 'Statement of account' },
                        ]}
                    />
                    {tab === 'orders' ? (
                        <Panel>
                            {orders.length ? (
                                <Table minWidth={640}>
                                    <THead>
                                        <tr>
                                            <Th>Order</Th>
                                            <Th>Date</Th>
                                            <Th>Items</Th>
                                            <Th>Status</Th>
                                            <Th align="right">Total</Th>
                                        </tr>
                                    </THead>
                                    <tbody>
                                        {orders.map((o) => (
                                            <Tr key={o.id} interactive onClick={() => router.visit(route('orders.show', o.id))}>
                                                <Td className="font-mono text-sm whitespace-nowrap">{o.order_no}</Td>
                                                <Td muted className="text-sm whitespace-nowrap">{date(o.created_at)}</Td>
                                                <Td muted className="max-w-72 truncate text-sm">{o.summary}</Td>
                                                <Td>
                                                    <span className="flex gap-1.5">
                                                        <StatusChip status={o.status} />
                                                        {o.balance > 0 && o.status !== 'voided' && <PaymentChip status={o.payment_status} balance={o.balance} />}
                                                    </span>
                                                </Td>
                                                <Td numeric>{peso(o.total)}</Td>
                                            </Tr>
                                        ))}
                                    </tbody>
                                </Table>
                            ) : (
                                <EmptyState compact title="No orders yet" body="Orders rung up for this customer show here." />
                            )}
                        </Panel>
                    ) : (
                        <Panel>
                            {statement.length ? (
                                <Table minWidth={640}>
                                    <THead>
                                        <tr>
                                            <Th>Date</Th>
                                            <Th>Reference</Th>
                                            <Th>Description</Th>
                                            <Th align="right">Charge</Th>
                                            <Th align="right">Payment</Th>
                                            <Th align="right">Balance</Th>
                                        </tr>
                                    </THead>
                                    <tbody>
                                        {statement.map((l, i) => (
                                            <Tr key={i}>
                                                <Td muted className="text-sm whitespace-nowrap">{date(l.date)}</Td>
                                                <Td className="font-mono text-sm">{l.ref}</Td>
                                                <Td muted>{l.description}</Td>
                                                <Td numeric>{l.charge ? peso(l.charge) : ''}</Td>
                                                <Td numeric className="text-ok-text">{l.payment ? peso(l.payment) : ''}</Td>
                                                <Td numeric className="font-medium">{peso(l.balance)}</Td>
                                            </Tr>
                                        ))}
                                    </tbody>
                                </Table>
                            ) : (
                                <EmptyState compact title="Nothing on account" body="Credit sales and unpaid balances appear here with a running total." />
                            )}
                        </Panel>
                    )}
                </div>

                <aside className="space-y-5">
                    {openReceivables.length > 0 && (
                        <Panel title="Open balances">
                            <ul className="divide-y divide-line">
                                {openReceivables.map((r) => (
                                    <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                                        <div>
                                            {r.order_id ? (
                                                <Link href={route('orders.show', r.order_id)} className="font-mono text-sm hover:underline">
                                                    {r.order_no}
                                                </Link>
                                            ) : (
                                                <span className="text-sm">Charge</span>
                                            )}
                                            <p className={cn('text-xs', r.days > 30 ? 'text-accent-text' : 'text-faint')}>
                                                {r.days} days old{r.due_date ? `, due ${date(r.due_date)}` : ''}
                                            </p>
                                        </div>
                                        <span className="num text-base text-warn-text">{peso(r.outstanding)}</span>
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                    )}

                    {customer.credit_balance > 0 && can('customers.settle') && (
                        <Panel title="Collect a payment">
                            <form
                                className="space-y-3 p-5"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    settle.transform((d) => ({ ...d, order_id: d.order_id || null }));
                                    settle.post(route('customers.settle', customer.id), { preserveScroll: true, onSuccess: () => settle.reset('reference') });
                                }}
                            >
                                <div className="flex gap-1">
                                    {['cash', 'gcash', 'bank'].map((m) => (
                                        <button
                                            key={m}
                                            type="button"
                                            aria-pressed={settle.data.method === m}
                                            onClick={() => settle.setData('method', m)}
                                            className={cn('h-9 flex-1 rounded-xs border text-base', settle.data.method === m ? 'border-accent bg-selected text-fg' : 'border-line text-muted hover:text-fg')}
                                        >
                                            {METHOD_LABEL[m]}
                                        </button>
                                    ))}
                                </div>
                                <Field label="Amount" hint={`Owes ${peso(customer.credit_balance)}`} error={settle.errors.amount}>
                                    {(id, d) => <MoneyInput id={id} aria-describedby={d} inputSize="lg" value={settle.data.amount} onChange={(e) => settle.setData('amount', e.target.value)} />}
                                </Field>
                                {settle.data.method !== 'cash' && (
                                    <Field label="Reference no." error={settle.errors.reference}>
                                        {(id, d) => <Input id={id} aria-describedby={d} className="font-mono" value={settle.data.reference} onChange={(e) => settle.setData('reference', e.target.value)} />}
                                    </Field>
                                )}
                                <p className="text-xs text-faint">Applied to the oldest balance first{settle.data.method === 'cash' ? '; cash posts to your open drawer' : ''}.</p>
                                <Button type="submit" variant="primary" className="w-full" loading={settle.processing}>
                                    Record payment
                                </Button>
                            </form>
                        </Panel>
                    )}

                    {customer.notes && (
                        <Panel title="Notes">
                            <p className="px-5 py-4 text-base whitespace-pre-line text-muted">{customer.notes}</p>
                        </Panel>
                    )}
                </aside>
            </div>

            <CustomerDrawer open={editOpen} onClose={() => setEditOpen(false)} customer={customer} />
            <ConfirmDialog
                open={deleting}
                onOpenChange={setDeleting}
                title={`Remove ${customer.name}?`}
                body="Their past orders stay on record with the name. Accounts with a balance can't be removed."
                confirmLabel="Remove customer"
                onConfirm={() => router.delete(route('customers.destroy', customer.id), { onFinish: () => setDeleting(false) })}
            />
        </>
    );
}
