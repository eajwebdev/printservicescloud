import { Link, router } from '@inertiajs/react';
import { CalendarClock, CreditCard, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Modal } from '@/components/ui/dialog';
import { date, peso } from '@/lib/format';
import { useAppPage } from '@/lib/utils';
import type { InvoiceRow } from '@/types';

export function payBills(branchId: number, invoiceIds?: number[], onFinish?: () => void) {
    // The server answers with the PayMongo checkout address; Inertia follows it out of the app.
    router.post(route('billing.pay'), { branch_id: branchId, invoice_ids: invoiceIds ?? null }, { preserveScroll: true, onFinish });
}

export function InvoiceStatusChip({ invoice }: { invoice: Pick<InvoiceRow, 'status' | 'days_overdue'> }) {
    if (invoice.status === 'paid') return <Chip tone="ok">Paid</Chip>;
    if (invoice.status === 'void') return <Chip className="line-through">Void</Chip>;
    if (invoice.status === 'overdue') return <Chip tone="red">Overdue {invoice.days_overdue}d</Chip>;
    return <Chip tone="warn">Unpaid</Chip>;
}

/**
 * The bill reminder: a slim strip above every page while something is due or a trial is ending,
 * and a popup once per sign-in when a bill is overdue. A locked branch gets the full bill screen instead.
 */
export function BillingNotice() {
    const { props } = useAppPage();
    const billing = props.billing;
    const [open, setOpen] = useState(false);
    const [paying, setPaying] = useState(false);

    const key = billing?.scope === 'branch' ? `eaj-bill-${billing.branch.id}-${billing.overdue_count}-${billing.next_due_on}` : '';
    useEffect(() => {
        if (billing?.scope !== 'branch' || billing.locked || billing.overdue_count === 0) return;
        try {
            if (sessionStorage.getItem(key)) return;
            sessionStorage.setItem(key, '1');
        } catch {
            /* private mode: show it anyway */
        }
        setOpen(true);
    }, [key, billing]);

    if (!billing) return null;

    if (billing.scope === 'all') {
        if (!billing.branches.length) return null;
        const locked = billing.branches.filter((b) => b.locked).length;
        return (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_9%,transparent)] px-4 py-2 text-sm lg:px-6">
                <TriangleAlert className="size-4 text-warn-text" />
                <span className="text-fg">
                    {billing.branches.length === 1 ? `${billing.branches[0].name} is behind on its bill` : `${billing.branches.length} branches are behind on their bills`}
                    {locked > 0 && <span className="text-accent-text">, {locked} locked</span>}.
                </span>
                <span className="text-muted">{peso(billing.branches.reduce((s, b) => s + b.due_total, 0))} due in total.</span>
                <Link href={route('billing.index')} className="ml-auto font-medium text-fg underline underline-offset-2">
                    See bills
                </Link>
            </div>
        );
    }

    if (billing.locked) return null;

    const overdue = billing.overdue_count > 0;
    const trialEnding = billing.status === 'trial' && billing.trial_days_left !== null && billing.trial_days_left <= 7;
    if (!billing.warning && !trialEnding) return null;

    const pay = (ids?: number[]) => {
        setPaying(true);
        payBills(billing.branch.id, ids, () => setPaying(false));
    };

    return (
        <>
            <div
                className={
                    overdue
                        ? 'flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-selected px-4 py-2 text-sm lg:px-6'
                        : 'flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-surface px-4 py-2 text-sm lg:px-6'
                }
                role="status"
            >
                {overdue ? <TriangleAlert className="size-4 text-accent-text" /> : <CalendarClock className="size-4 text-faint" />}
                {billing.warning ? (
                    <span className="text-fg">
                        {overdue ? (
                            <>
                                {billing.overdue_count} overdue bill{billing.overdue_count === 1 ? '' : 's'} for {billing.branch.name}.{' '}
                                <span className="text-muted">
                                    The branch locks at {billing.lock_after} overdue bill{billing.lock_after === 1 ? '' : 's'}.
                                </span>
                            </>
                        ) : (
                            <>
                                Subscription bill of {peso(billing.due_total)} is due {date(billing.next_due_on)}.
                            </>
                        )}
                    </span>
                ) : (
                    <span className="text-fg">
                        Free trial: {billing.trial_days_left === 0 ? 'last day today' : `${billing.trial_days_left} day${billing.trial_days_left === 1 ? '' : 's'} left`}.{' '}
                        <span className="text-muted">Billing starts after {date(billing.trial_ends_on)}.</span>
                    </span>
                )}
                {billing.warning && (
                    <span className="ml-auto flex items-center gap-2">
                        {billing.can_view && (
                            <Link href={route('billing.index')} className="text-muted hover:text-fg">
                                View bills
                            </Link>
                        )}
                        {billing.can_pay && (
                            <Button size="xs" variant={overdue ? 'primary' : 'secondary'} icon={<CreditCard />} loading={paying} onClick={() => pay()}>
                                Pay {peso(billing.due_total)}
                            </Button>
                        )}
                    </span>
                )}
            </div>

            <Modal
                open={open}
                onOpenChange={setOpen}
                title={`${billing.branch.name} has ${billing.overdue_count} overdue bill${billing.overdue_count === 1 ? '' : 's'}`}
                description={`Pay now to keep the branch open. After ${billing.lock_after} overdue bills, staff can still sign in but can't use the system until the bill is paid.`}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setOpen(false)}>
                            Remind me later
                        </Button>
                        {billing.can_pay ? (
                            <Button variant="primary" icon={<CreditCard />} loading={paying} onClick={() => pay()} data-autofocus>
                                Pay {peso(billing.due_total)} now
                            </Button>
                        ) : (
                            <span className="text-sm text-muted">Ask your manager to pay the bill.</span>
                        )}
                    </>
                }
            >
                <BillList invoices={billing.invoices} />
            </Modal>
        </>
    );
}

export function BillList({ invoices }: { invoices: InvoiceRow[] }) {
    const total = invoices.reduce((s, i) => s + i.amount, 0);
    return (
        <div className="border border-line">
            <ul className="divide-y divide-line">
                {invoices.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                            <p className="font-mono text-sm text-fg">{i.number}</p>
                            <p className="truncate text-xs text-faint">
                                {i.period}, due {date(i.due_on)}
                            </p>
                        </div>
                        <InvoiceStatusChip invoice={i} />
                        <span className="num w-24 text-right text-base">{peso(i.amount)}</span>
                    </li>
                ))}
            </ul>
            <div className="flex items-baseline justify-between border-t border-line bg-surface px-3 py-2.5">
                <span className="text-sm text-muted">Total due</span>
                <span className="hud text-xl font-semibold">{peso(total)}</span>
            </div>
        </div>
    );
}
