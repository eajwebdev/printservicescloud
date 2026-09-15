import { Head, router, useForm } from '@inertiajs/react';
import { Ban, Banknote, Printer } from 'lucide-react';
import { useState } from 'react';
import { InvoiceStatusChip } from '@/components/billing-notice';
import { ListPage, SummaryStrip, ToolbarSearch } from '@/components/list-page';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ConfirmDialog, Modal } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { EmptyState, Pagination } from '@/components/ui/misc';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/toggle';
import { useFilters } from '@/hooks/use-filters';
import { date, dateTime, peso } from '@/lib/format';
import type { BranchLite, InvoiceRow, Paginated } from '@/types';

interface Props {
    invoices: Paginated<InvoiceRow>;
    filters: { branch?: string; status?: string; month?: string; q?: string };
    branches: BranchLite[];
    totals: { billed: number; paid: number; unpaid: number; overdue: number; count: number };
    payments: { id: number; branch: string | null; amount: number; channel: string; status: string; method: string | null; reference: string | null; user: string | null; at: string; notes: string | null }[];
}

const open = (i: InvoiceRow) => i.status === 'unpaid' || i.status === 'overdue';

/** Superadmin: all branch bills. Tick unpaid bills to record a cash or bank payment. */
export default function PlatformInvoices({ invoices, filters: initial, branches, totals, payments }: Props) {
    const { filters, set } = useFilters(route('platform.invoices.index'), { branch: initial.branch ?? '', status: initial.status ?? '', month: initial.month ?? '', q: initial.q ?? '' });
    const [picked, setPicked] = useState<number[]>([]);
    const [recording, setRecording] = useState(false);
    const [voiding, setVoiding] = useState<InvoiceRow | null>(null);
    const pickedRows = invoices.data.filter((i) => picked.includes(i.id));
    const pickedBranches = new Set(pickedRows.map((i) => i.branch_id));
    const toggle = (id: number, on: boolean) => setPicked((p) => (on ? [...p, id] : p.filter((x) => x !== id)));

    return (
        <>
            <Head title="Branch bills" />
            <ListPage
                title="Branch bills"
                description="Every subscription bill across branches. Tick unpaid bills to record a payment made by cash or bank transfer; online payments mark themselves paid."
                footer={invoices.data.length > 0 && <Pagination links={invoices.links} from={invoices.from} to={invoices.to} total={invoices.total} />}
                actions={
                    picked.length > 0 && (
                        <Button variant="primary" icon={<Banknote />} disabled={pickedBranches.size !== 1} onClick={() => setRecording(true)} title={pickedBranches.size !== 1 ? 'Pick bills from one branch at a time' : undefined}>
                            Record payment, {peso(pickedRows.reduce((s, i) => s + i.amount, 0))}
                        </Button>
                    )
                }
                toolbar={
                    <>
                        <ToolbarSearch value={filters.q ?? ''} onChange={(v) => set('q', v)} placeholder="Bill number" />
                        <Select selectSize="sm" className="w-44" value={filters.branch} onChange={(e) => set('branch', e.target.value)} aria-label="Branch">
                            <option value="">All branches</option>
                            {branches.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </Select>
                        <Select selectSize="sm" className="w-36" value={filters.status} onChange={(e) => set('status', e.target.value)} aria-label="Status">
                            <option value="">Any status</option>
                            <option value="unpaid">Unpaid</option>
                            <option value="overdue">Overdue</option>
                            <option value="paid">Paid</option>
                            <option value="void">Voided</option>
                        </Select>
                        <Input type="month" inputSize="sm" className="w-40" value={filters.month} onChange={(e) => set('month', e.target.value)} aria-label="Issued in month" />
                    </>
                }
                summary={
                    <SummaryStrip
                        items={[
                            { label: 'Billed', value: peso(totals.billed), sub: `${totals.count} bills` },
                            { label: 'Paid', value: peso(totals.paid), tone: 'ok' },
                            { label: 'Unpaid', value: peso(totals.unpaid), tone: totals.unpaid > 0 ? 'warn' : undefined },
                            { label: 'Overdue', value: peso(totals.overdue), tone: totals.overdue > 0 ? 'red' : undefined },
                        ]}
                    />
                }
                aside={
                    <div>
                        <h2 className="border-b border-line px-5 py-3 text-base font-semibold">Latest payments</h2>
                        <ul className="divide-y divide-line">
                            {payments.map((p) => (
                                <li key={p.id} className="px-5 py-3">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className="num">{peso(p.amount)}</span>
                                        <Chip tone={p.status === 'paid' ? 'ok' : p.status === 'pending' ? 'warn' : 'neutral'}>{p.status}</Chip>
                                    </div>
                                    <p className="text-sm text-muted">
                                        {p.branch}, {p.channel === 'paymongo' ? 'PayMongo' : 'recorded'}
                                        {p.method && ` (${p.method})`}
                                    </p>
                                    <p className="truncate text-xs text-faint">
                                        {dateTime(p.at)}
                                        {p.reference && `, ${p.reference}`}
                                    </p>
                                    {p.notes && <p className="text-xs text-warn-text">{p.notes}</p>}
                                </li>
                            ))}
                            {!payments.length && <li className="px-5 py-4 text-sm text-muted">No payments yet.</li>}
                        </ul>
                    </div>
                }
            >
                {invoices.data.length ? (
                    <Table flush minWidth={960}>
                        <THead>
                            <tr>
                                <Th className="w-10" />
                                <Th>Bill</Th>
                                <Th>Branch</Th>
                                <Th>Period</Th>
                                <Th>Issued</Th>
                                <Th>Due</Th>
                                <Th>Status</Th>
                                <Th align="right">Amount</Th>
                                <Th />
                            </tr>
                        </THead>
                        <tbody>
                            {invoices.data.map((i) => (
                                <Tr key={i.id} selected={picked.includes(i.id)} className={i.status === 'void' ? 'opacity-55' : undefined}>
                                    <Td>{open(i) && <Checkbox checked={picked.includes(i.id)} onChange={(v) => toggle(i.id, v)} ariaLabel={`Select ${i.number}`} />}</Td>
                                    <Td className="font-mono text-sm whitespace-nowrap">{i.number}</Td>
                                    <Td>{i.branch}</Td>
                                    <Td muted className="text-sm">{i.period}</Td>
                                    <Td muted className="text-sm whitespace-nowrap">{date(i.issued_on)}</Td>
                                    <Td className={i.status === 'overdue' ? 'text-sm whitespace-nowrap text-accent-text' : 'text-sm whitespace-nowrap text-muted'}>{date(i.due_on)}</Td>
                                    <Td>
                                        <InvoiceStatusChip invoice={i} />
                                    </Td>
                                    <Td numeric>{peso(i.amount)}</Td>
                                    <Td align="right">
                                        <span className="flex justify-end gap-1">
                                            <a href={route('billing.invoices.print', i.id)} target="_blank" rel="noreferrer" className="grid size-7 place-items-center rounded-xs text-muted hover:bg-raised hover:text-fg" aria-label={`Print ${i.number}`}>
                                                <Printer className="size-3.5" />
                                            </a>
                                            {open(i) && (
                                                <Button size="xs" variant="ghost" icon={<Ban />} onClick={() => setVoiding(i)}>
                                                    Void
                                                </Button>
                                            )}
                                        </span>
                                    </Td>
                                </Tr>
                            ))}
                        </tbody>
                    </Table>
                ) : (
                    <EmptyState className="h-full" title="No bills for these filters" />
                )}
            </ListPage>

            <RecordPayment open={recording} rows={pickedRows} onClose={() => setRecording(false)} onDone={() => setPicked([])} />
            <ConfirmDialog
                open={!!voiding}
                onOpenChange={(o) => !o && setVoiding(null)}
                title={`Void ${voiding?.number}?`}
                body="A voided bill no longer counts as owed and never locks the branch. Use this for bills issued by mistake or waived."
                confirmLabel="Void bill"
                requireReason="Why is this bill voided?"
                onConfirm={(reason) => voiding && router.post(route('platform.invoices.void', voiding.id), { reason }, { preserveScroll: true, onFinish: () => setVoiding(null) })}
            />
        </>
    );
}

function RecordPayment({ open: isOpen, rows, onClose, onDone }: { open: boolean; rows: InvoiceRow[]; onClose: () => void; onDone: () => void }) {
    const form = useForm({ invoice_ids: [] as number[], method: 'bank', reference: '', notes: '' });
    const total = rows.reduce((s, i) => s + i.amount, 0);

    return (
        <Modal
            open={isOpen}
            onOpenChange={(o) => !o && onClose()}
            title={`Record ${peso(total)} from ${rows[0]?.branch ?? ''}`}
            description={rows.map((r) => r.number).join(', ')}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        loading={form.processing}
                        onClick={() => {
                            form.transform((d) => ({ ...d, invoice_ids: rows.map((r) => r.id) }));
                            form.post(route('platform.invoices.pay'), {
                                preserveScroll: true,
                                onSuccess: () => {
                                    form.reset();
                                    onDone();
                                    onClose();
                                },
                            });
                        }}
                    >
                        Mark as paid
                    </Button>
                </>
            }
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Paid by" error={form.errors.method}>
                    {(id) => (
                        <Select id={id} value={form.data.method} onChange={(e) => form.setData('method', e.target.value)}>
                            <option value="bank">Bank transfer</option>
                            <option value="gcash">GCash (sent directly)</option>
                            <option value="cash">Cash</option>
                            <option value="check">Check</option>
                            <option value="other">Other</option>
                        </Select>
                    )}
                </Field>
                <Field label="Reference" hint="Deposit slip, OR or transaction no." error={form.errors.reference}>
                    {(id, d) => <Input id={id} aria-describedby={d} value={form.data.reference} onChange={(e) => form.setData('reference', e.target.value)} />}
                </Field>
                <Field label="Notes" className="sm:col-span-2" error={form.errors.notes || form.errors.invoice_ids}>
                    {(id, d) => <Textarea id={id} aria-describedby={d} className="min-h-16" value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} />}
                </Field>
            </div>
        </Modal>
    );
}
