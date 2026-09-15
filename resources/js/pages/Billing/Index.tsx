import { Head, router } from '@inertiajs/react';
import { CalendarClock, CreditCard, Printer, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { InvoiceStatusChip, payBills } from '@/components/billing-notice';
import { ListPage } from '@/components/list-page';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Select } from '@/components/ui/field';
import { EmptyState, Pagination } from '@/components/ui/misc';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { useFilters } from '@/hooks/use-filters';
import { date, dateTime, peso } from '@/lib/format';
import { SUBSCRIPTION_TONE } from '@/lib/status';
import { cn } from '@/lib/utils';
import type { BillingState, InvoiceRow, Paginated } from '@/types';

type Account = { id: number; name: string; code: string } & BillingState;

interface Props {
    accounts: Account[];
    invoices: Paginated<InvoiceRow>;
    payments: { id: number; branch: string | null; amount: number; channel: string; method: string | null; reference: string | null; paid_at: string | null; user: string | null; invoices: string[] }[];
    filters: { status?: string; branch?: string };
    onlineReady: boolean;
    methods: string[];
    canPay: boolean;
}


export default function BillingIndex({ accounts, invoices, payments, filters: initial, onlineReady, methods, canPay }: Props) {
    const { filters, set } = useFilters(route('billing.index'), { status: initial.status ?? '', branch: initial.branch ?? '' });
    const [paying, setPaying] = useState<number | null>(null);
    const due = accounts.reduce((s, a) => s + a.due_total, 0);

    const pay = (branchId: number, ids?: number[]) => {
        setPaying(ids?.[0] ?? branchId);
        payBills(branchId, ids, () => setPaying(null));
    };

    return (
        <>
            <Head title="Billing" />
            <ListPage
                title="Billing and subscription"
                description={`Each branch pays its own monthly subscription. ${onlineReady ? `Pay online with ${methods.join(', ')}.` : 'Online payment is not set up yet; pay the system provider directly.'}`}
                footer={invoices.data.length > 0 && <Pagination links={invoices.links} from={invoices.from} to={invoices.to} total={invoices.total} />}
                summary={
                    <div className="flex gap-px overflow-x-auto border-b border-line bg-line">
                        {accounts.map((a) => (
                            <div key={a.id} className={cn('w-[min(340px,100%)] shrink-0 grow bg-surface px-5 py-4', a.locked && 'bg-selected')}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="flex items-center gap-2 text-base font-semibold">
                                            <span className="truncate">{a.name}</span>
                                            <span className="font-mono text-2xs text-faint">{a.code}</span>
                                        </p>
                                        <p className="mt-1 flex flex-wrap items-center gap-1.5">
                                            <Chip tone={SUBSCRIPTION_TONE[a.status]}>{a.status_label}</Chip>
                                            {a.locked && <Chip tone="red">Locked</Chip>}
                                            {!a.locked && a.overdue_count > 0 && <Chip tone="red">{a.overdue_count} overdue</Chip>}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-faint">Due now</p>
                                        <p className={cn('hud text-xl font-semibold', a.due_total > 0 ? (a.overdue_count ? 'text-accent-text' : 'text-fg') : 'text-ok-text')}>{peso(a.due_total)}</p>
                                    </div>
                                </div>
                                <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
                                    <CalendarClock className="size-3.5 text-faint" />
                                    {a.status === 'trial'
                                        ? `Free until ${date(a.trial_ends_on)} (${a.trial_days_left} day${a.trial_days_left === 1 ? '' : 's'} left)`
                                        : a.next_bill_on
                                          ? `${peso(a.monthly_fee)} a month, next bill ${date(a.next_bill_on)}`
                                          : `${peso(a.monthly_fee)} a month`}
                                </p>
                                {a.overdue_count > 0 && !a.locked && (
                                    <p className="mt-1 text-xs text-warn-text">
                                        Locks at {a.lock_after} overdue bills ({a.lock_after - a.overdue_count} more).
                                    </p>
                                )}
                                {a.grace_until && <p className="mt-1 text-xs text-info-text">Kept open until {date(a.grace_until)} by the provider.</p>}
                                {a.due_total > 0 && canPay && onlineReady && (
                                    <Button className="mt-3 w-full" variant={a.overdue_count ? 'primary' : 'secondary'} icon={<CreditCard />} loading={paying === a.id} onClick={() => pay(a.id)}>
                                        Pay {peso(a.due_total)}
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                }
                toolbar={
                    <>
                        <Select selectSize="sm" className="w-40" value={filters.status} onChange={(e) => set('status', e.target.value)} aria-label="Status">
                            <option value="">Every bill</option>
                            <option value="unpaid">Unpaid</option>
                            <option value="overdue">Overdue</option>
                            <option value="paid">Paid</option>
                            <option value="void">Voided</option>
                        </Select>
                        {accounts.length > 1 && (
                            <Select selectSize="sm" className="w-44" value={filters.branch} onChange={(e) => set('branch', e.target.value)} aria-label="Branch">
                                <option value="">All branches</option>
                                {accounts.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.name}
                                    </option>
                                ))}
                            </Select>
                        )}
                        <span className="ml-auto text-sm text-muted">
                            {due > 0 ? (
                                <>
                                    <span className="num text-fg">{peso(due)}</span> due across {accounts.filter((a) => a.due_total > 0).length} branch{accounts.filter((a) => a.due_total > 0).length === 1 ? '' : 'es'}
                                </>
                            ) : (
                                <span className="flex items-center gap-1.5 text-ok-text">
                                    <ShieldCheck className="size-4" /> All paid up
                                </span>
                            )}
                        </span>
                    </>
                }
                aside={
                    <div>
                        <h2 className="border-b border-line px-5 py-3 text-base font-semibold">Payments received</h2>
                        {payments.length ? (
                            <ul className="divide-y divide-line">
                                {payments.map((p) => (
                                    <li key={p.id} className="px-5 py-3">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <span className="num text-base">{peso(p.amount)}</span>
                                            <span className="text-xs text-faint">{dateTime(p.paid_at)}</span>
                                        </div>
                                        <p className="mt-0.5 text-sm text-muted">
                                            {p.channel === 'paymongo' ? 'Online' : 'Recorded'}
                                            {p.method && `, ${p.method.replace('_', ' ')}`}
                                            {accounts.length > 1 && p.branch && `, ${p.branch}`}
                                        </p>
                                        <p className="truncate font-mono text-xs text-faint">{p.invoices.join(', ')}</p>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="px-5 py-4 text-sm text-muted">No payments yet.</p>
                        )}
                    </div>
                }
            >
                {invoices.data.length ? (
                    <Table flush minWidth={860}>
                        <THead>
                            <tr>
                                <Th>Bill</Th>
                                {accounts.length > 1 && <Th>Branch</Th>}
                                <Th>Period</Th>
                                <Th>Due</Th>
                                <Th>Status</Th>
                                <Th align="right">Amount</Th>
                                <Th />
                            </tr>
                        </THead>
                        <tbody>
                            {invoices.data.map((i) => (
                                <Tr key={i.id} className={i.status === 'void' ? 'opacity-55' : undefined}>
                                    <Td className="font-mono text-sm whitespace-nowrap">{i.number}</Td>
                                    {accounts.length > 1 && <Td>{i.branch}</Td>}
                                    <Td muted className="text-sm">{i.period}</Td>
                                    <Td className={cn('text-sm whitespace-nowrap', i.status === 'overdue' ? 'text-accent-text' : 'text-muted')}>{date(i.due_on)}</Td>
                                    <Td>
                                        <InvoiceStatusChip invoice={i} />
                                        {i.paid_at && <span className="ml-2 text-xs text-faint">{date(i.paid_at)}</span>}
                                    </Td>
                                    <Td numeric>{peso(i.amount)}</Td>
                                    <Td align="right">
                                        <span className="flex justify-end gap-1">
                                            <a href={route('billing.invoices.print', i.id)} target="_blank" rel="noreferrer" className="grid size-7 place-items-center rounded-xs text-muted hover:bg-raised hover:text-fg" title="Print bill" aria-label={`Print ${i.number}`}>
                                                <Printer className="size-3.5" />
                                            </a>
                                            {(i.status === 'unpaid' || i.status === 'overdue') && canPay && onlineReady && (
                                                <Button size="xs" variant="quiet" loading={paying === i.id} onClick={() => pay(i.branch_id, [i.id])}>
                                                    Pay
                                                </Button>
                                            )}
                                        </span>
                                    </Td>
                                </Tr>
                            ))}
                        </tbody>
                    </Table>
                ) : (
                    <EmptyState className="h-full" title="No bills here" body="Bills appear on each branch's billing day once its subscription starts." action={filters.status ? <Button size="sm" onClick={() => router.get(route('billing.index'))}>Clear filters</Button> : undefined} />
                )}
            </ListPage>
        </>
    );
}
