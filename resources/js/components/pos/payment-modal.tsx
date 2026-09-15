import { Banknote, CreditCard, Landmark, Plus, Smartphone, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button, IconButton } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { Combobox } from '@/components/ui/combobox';
import { ErrorText, Field, Input, MoneyInput, Textarea } from '@/components/ui/field';
import { AnimatedMoney, Kbd } from '@/components/ui/misc';
import { METHOD_LABEL, money, peso, round2, toLocalInput } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CustomerLite, Option, PaymentMethod } from '@/types';

export interface PaymentRow {
    id: number;
    method: PaymentMethod;
    amount: string;
    tendered: string;
    reference: string;
}

export interface CheckoutExtras {
    payments: { method: PaymentMethod; amount: number; tendered: number | null; reference: string | null }[];
    due_at: string | null;
    assigned_to: number | null;
    notes: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    total: number;
    type: 'instant' | 'job';
    customer: CustomerLite | null;
    staff: Option[];
    leadHours: number;
    payTo: { gcash: string; bank: string };
    notes: string;
    processing: boolean;
    errors: Record<string, string>;
    onSubmit: (extras: CheckoutExtras) => void;
}

const METHOD_ICON: Record<PaymentMethod, typeof Banknote> = { cash: Banknote, gcash: Smartphone, bank: Landmark, credit: CreditCard };
let rowSeq = 1;

function defaultDue(leadHours: number): string {
    const d = new Date(Date.now() + Math.max(leadHours, 4) * 3600 * 1000);
    if (d.getHours() >= 18 || d.getHours() < 8) {
        d.setDate(d.getDate() + (d.getHours() >= 18 ? 1 : 0));
        d.setHours(17, 0, 0, 0);
    } else {
        d.setMinutes(0, 0, 0);
    }
    return toLocalInput(d);
}

export function PaymentModal({ open, onClose, total, type, customer, staff, leadHours, payTo, notes: initialNotes, processing, errors, onSubmit }: Props) {
    const [rows, setRows] = useState<PaymentRow[]>([]);
    const [dueAt, setDueAt] = useState('');
    const [assigned, setAssigned] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (!open) return;
        setRows([{ id: rowSeq++, method: 'cash', amount: total.toFixed(2), tendered: '', reference: '' }]);
        setDueAt(defaultDue(leadHours));
        setNotes(initialNotes);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const applied = round2(rows.reduce((s, r) => s + (Number(r.amount) || 0), 0));
    const money_in = round2(rows.filter((r) => r.method !== 'credit').reduce((s, r) => s + (Number(r.amount) || 0), 0));
    const remaining = round2(total - applied);
    const balanceAfter = round2(total - money_in);
    const change = round2(rows.filter((r) => r.method === 'cash').reduce((s, r) => s + Math.max(0, (Number(r.tendered) || 0) - (Number(r.amount) || 0)), 0));
    const needsCustomer = balanceAfter > 0 && !customer;
    const overLimit = !!customer && customer.credit_limit !== null && balanceAfter > 0 && customer.credit_balance + balanceAfter > customer.credit_limit;
    const missingRef = rows.some((r) => (r.method === 'gcash' || r.method === 'bank') && Number(r.amount) > 0 && !r.reference.trim());
    const shortCash = rows.some((r) => r.method === 'cash' && r.tendered !== '' && Number(r.tendered) < Number(r.amount));

    const problem = useMemo(() => {
        if (remaining < -0.009) return `Payments are ${peso(-remaining)} more than the total. Lower an amount; change is worked out from cash received.`;
        if (type === 'instant' && remaining > 0.009) return `${peso(remaining)} still to collect. Add a payment, put it on credit, or make this a job order.`;
        if (needsCustomer) return 'Attach a customer before leaving a balance. Walk-ins pay in full.';
        if (overLimit) return `${customer?.name} would pass their ${peso(customer?.credit_limit)} credit limit.`;
        if (missingRef) return 'Enter the reference number for GCash and bank payments.';
        if (shortCash) return 'Cash received is less than the amount applied.';
        if (type === 'job' && !dueAt) return 'Set a pickup date for production.';
        return null;
    }, [remaining, type, needsCustomer, overLimit, missingRef, shortCash, dueAt, customer]);

    const update = (id: number, patch: Partial<PaymentRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

    const submit = (e?: FormEvent) => {
        e?.preventDefault();
        if (problem || processing) return;
        onSubmit({
            payments: rows
                .filter((r) => Number(r.amount) > 0)
                .map((r) => ({
                    method: r.method,
                    amount: round2(Number(r.amount)),
                    tendered: r.method === 'cash' ? round2(Number(r.tendered || r.amount)) : null,
                    reference: r.reference.trim() || null,
                })),
            due_at: type === 'job' ? dueAt.replace('T', ' ') + ':00' : null,
            assigned_to: assigned ? Number(assigned) : null,
            notes,
        });
    };

    const serverError = errors.payments || errors.customer_id || errors.lines || errors.session || errors.due_at || Object.entries(errors).find(([k]) => k.startsWith('payments.'))?.[1];

    return (
        <Modal
            open={open}
            onOpenChange={(o) => !o && onClose()}
            size="lg"
            title={type === 'job' ? 'Take payment and create the job order' : 'Take payment'}
            description={customer ? `For ${customer.name}` : 'Walk-in customer'}
            footer={
                <>
                    <p className={cn('mr-auto max-w-sm text-sm', problem ? 'text-warn-text' : 'text-faint')} role="status">
                        {problem ?? (
                            <>
                                Press <Kbd>Enter</Kbd> to confirm
                            </>
                        )}
                    </p>
                    <Button variant="ghost" onClick={onClose}>
                        Back to cart
                    </Button>
                    <Button variant="primary" size="lg" onClick={() => submit()} disabled={!!problem} loading={processing}>
                        {type === 'job' ? 'Create job order' : 'Complete sale'}
                    </Button>
                </>
            }
        >
            <form onSubmit={submit} className="space-y-5">
                <div className="grid grid-cols-3 border border-line">
                    <div className="border-r border-line px-4 py-3">
                        <p className="text-sm text-faint">Total</p>
                        <p className="hud text-2xl font-semibold">{peso(total)}</p>
                    </div>
                    <div className="border-r border-line px-4 py-3">
                        <p className="text-sm text-faint">{type === 'job' && remaining > 0 ? 'Balance on account' : 'Left to apply'}</p>
                        <AnimatedMoney value={Math.max(0, type === 'job' ? balanceAfter : remaining)} className={cn('hud text-2xl font-semibold', remaining > 0.009 ? 'text-warn-text' : 'text-muted')} />
                    </div>
                    <div className="bg-sunken px-4 py-3">
                        <p className="text-sm text-faint">Change</p>
                        <AnimatedMoney value={change} className={cn('hud text-2xl font-semibold', change > 0 ? 'text-ok-text' : 'text-ghost')} />
                    </div>
                </div>

                <ul className="space-y-2">
                    <AnimatePresence initial={false}>
                        {rows.map((r, i) => {
                            const others = round2(applied - (Number(r.amount) || 0));
                            const due = Math.max(0, round2(total - others));
                            return (
                                <motion.li
                                    key={r.id}
                                    layout
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="border border-line bg-surface p-3"
                                >
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div role="radiogroup" aria-label={`Payment ${i + 1} method`} className="flex flex-wrap gap-1">
                                            {(['cash', 'gcash', 'bank', 'credit'] as PaymentMethod[]).map((m) => {
                                                const Icon = METHOD_ICON[m];
                                                const active = r.method === m;
                                                return (
                                                    <button
                                                        key={m}
                                                        type="button"
                                                        role="radio"
                                                        aria-checked={active}
                                                        onClick={() => update(r.id, { method: m, reference: '', tendered: '' })}
                                                        className={cn(
                                                            'flex h-9 items-center gap-1.5 rounded-xs border px-3 text-base transition-colors [&_svg]:size-4',
                                                            active ? 'border-accent bg-selected text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg',
                                                        )}
                                                    >
                                                        <Icon />
                                                        {METHOD_LABEL[m]}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {rows.length > 1 && (
                                            <IconButton label="Remove this payment" className="ml-auto" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
                                                <Trash2 />
                                            </IconButton>
                                        )}
                                    </div>

                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                        <Field label={r.method === 'credit' ? 'Put on account' : 'Amount to apply'}>
                                            {(id) => (
                                                <div className="flex gap-1">
                                                    <MoneyInput id={id} inputSize="lg" className="flex-1 text-lg" value={r.amount} autoFocus={i === 0} onChange={(e) => update(r.id, { amount: e.target.value })} />
                                                    <Button size="lg" variant="quiet" onClick={() => update(r.id, { amount: due.toFixed(2) })} title="Apply the full remaining amount">
                                                        Full
                                                    </Button>
                                                    {type === 'job' && (
                                                        <Button size="lg" variant="quiet" onClick={() => update(r.id, { amount: round2(total / 2).toFixed(2) })} title="Half as downpayment">
                                                            50%
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </Field>

                                        {r.method === 'cash' && (
                                            <Field label="Cash received" hint={Number(r.tendered) > Number(r.amount) ? `Change ₱${money(Number(r.tendered) - Number(r.amount))}` : undefined}>
                                                {(id) => (
                                                    <div>
                                                        <MoneyInput id={id} inputSize="lg" className="text-lg" placeholder={r.amount} value={r.tendered} onChange={(e) => update(r.id, { tendered: e.target.value })} />
                                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                                            {[100, 200, 500, 1000].filter((b) => b >= Number(r.amount) * 0.2).map((b) => (
                                                                <button
                                                                    key={b}
                                                                    type="button"
                                                                    onClick={() => update(r.id, { tendered: String(b) })}
                                                                    className="num h-7 rounded-xs border border-line px-2 text-sm text-muted hover:border-line-strong hover:text-fg"
                                                                >
                                                                    ₱{b}
                                                                </button>
                                                            ))}
                                                            <button
                                                                type="button"
                                                                onClick={() => update(r.id, { tendered: r.amount })}
                                                                className="h-7 rounded-xs border border-line px-2 text-sm text-muted hover:border-line-strong hover:text-fg"
                                                            >
                                                                Exact
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </Field>
                                        )}

                                        {(r.method === 'gcash' || r.method === 'bank') && (
                                            <Field label="Reference no." hint={r.method === 'gcash' ? payTo.gcash : payTo.bank}>
                                                {(id) => (
                                                    <Input
                                                        id={id}
                                                        inputSize="lg"
                                                        className="font-mono"
                                                        placeholder={r.method === 'gcash' ? '13-digit GCash ref' : 'Transfer reference'}
                                                        value={r.reference}
                                                        invalid={Number(r.amount) > 0 && !r.reference.trim()}
                                                        onChange={(e) => update(r.id, { reference: e.target.value })}
                                                    />
                                                )}
                                            </Field>
                                        )}

                                        {r.method === 'credit' && (
                                            <div className={cn('self-end border px-3 py-2 text-sm', customer ? 'border-line text-muted' : 'border-accent text-accent-text')}>
                                                {customer
                                                    ? `Adds to ${customer.name}'s account. Current balance ${peso(customer.credit_balance)}${customer.credit_limit !== null ? ` of ${peso(customer.credit_limit)} limit` : ''}.`
                                                    : 'Credit needs a customer. Attach one in the cart first.'}
                                            </div>
                                        )}
                                    </div>
                                </motion.li>
                            );
                        })}
                    </AnimatePresence>
                </ul>

                {rows.length < 4 && (
                    <Button
                        variant="quiet"
                        size="sm"
                        icon={<Plus />}
                        onClick={() => setRows((rs) => [...rs, { id: rowSeq++, method: 'gcash', amount: Math.max(0, remaining).toFixed(2), tendered: '', reference: '' }])}
                    >
                        Split payment
                    </Button>
                )}

                {type === 'job' && (
                    <div className="grid gap-3 border-t border-line pt-5 sm:grid-cols-2">
                        <Field label="Pickup / due" error={errors.due_at}>
                            {(id, d) => <Input id={id} aria-describedby={d} type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />}
                        </Field>
                        <Field label="Assign to">
                            {(id) => (
                                <Combobox
                                    id={id}
                                    ariaLabel="Assign to"
                                    placeholder="Unassigned"
                                    searchPlaceholder="Find staff"
                                    value={assigned}
                                    onChange={setAssigned}
                                    options={staff.map((s) => ({ value: String(s.id), label: s.name }))}
                                />
                            )}
                        </Field>
                        <Field label="Production notes" className="sm:col-span-2">
                            {(id) => <Textarea id={id} className="min-h-14" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="File source, colors, delivery instructions" />}
                        </Field>
                    </div>
                )}

                <ErrorText>{serverError}</ErrorText>
                <button type="submit" hidden aria-hidden tabIndex={-1} />
            </form>
        </Modal>
    );
}
