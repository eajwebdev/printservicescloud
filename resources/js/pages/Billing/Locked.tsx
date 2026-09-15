import { Head, router } from '@inertiajs/react';
import { CreditCard, Lock, LogOut, MapPin } from 'lucide-react';
import { useState } from 'react';
import { BillList, payBills } from '@/components/billing-notice';
import { switchBranch } from '@/components/branch-switcher';
import { ToastProvider } from '@/components/toaster';
import { Button } from '@/components/ui/button';
import { date, peso } from '@/lib/format';
import { useAppPage } from '@/lib/utils';
import type { BillingState } from '@/types';

interface Props {
    branch: { id: number; name: string; code: string };
    state: BillingState;
    canSwitch: boolean;
    onlineReady: boolean;
    provider: string;
}

const REASON: Record<string, { title: string; body: (p: Props) => string }> = {
    overdue: {
        title: 'is on hold for unpaid bills',
        body: (p) =>
            `${p.state.overdue_count} monthly bills are past due (${peso(p.state.overdue_total)}). Pay the bill below and the branch opens again right away. Your sales, stock and customers are safe.`,
    },
    suspended: {
        title: 'is suspended',
        body: () => 'The system provider paused this branch. Pay any open bill below, or contact them to switch it back on.',
    },
    cancelled: {
        title: 'is closed',
        body: () => 'This branch’s subscription was cancelled. Contact the system provider to reopen it.',
    },
};

/** Shown on every page while a branch is locked: the bill, and one button to pay it. */
export default function Locked(props: Props) {
    const { branch, state, canSwitch, onlineReady, provider } = props;
    const { props: page } = useAppPage();
    const [paying, setPaying] = useState(false);
    const reason = REASON[state.lock_reason ?? 'overdue'] ?? REASON.overdue;
    const others = (page.branch?.list ?? []).filter((b) => b.id !== branch.id);

    return (
        <ToastProvider>
            <Head title="Bill due" />
            <div className="halftone relative flex min-h-dvh items-start justify-center overflow-y-auto bg-bg px-4 py-10 sm:items-center">
                <div className="w-full max-w-xl" role="alertdialog" aria-labelledby="lock-title" aria-describedby="lock-body">
                    <div className="mb-6 flex items-center justify-between gap-3">
                        <img src={page.shop.logo} alt={page.shop.name} className="h-14 w-auto object-contain" />
                        <span className="flex items-center gap-1.5 rounded-xs border border-line bg-surface px-2.5 py-1 text-sm text-muted">
                            <MapPin className="size-3.5" />
                            {branch.name}
                        </span>
                    </div>

                    <div className="crop-marks border border-line bg-surface shadow-[var(--shadow-float)]">
                        <span className="crop-b" />
                        <div className="flex items-start gap-3 border-b border-line px-6 py-5">
                            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xs bg-selected text-accent-text">
                                <Lock className="size-4" />
                            </span>
                            <div>
                                <h1 id="lock-title" className="text-xl leading-tight font-semibold">
                                    {branch.name} {reason.title}
                                </h1>
                                <p id="lock-body" className="mt-1 text-base text-muted">
                                    {reason.body(props)}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4 px-6 py-5">
                            {state.invoices.length > 0 ? (
                                <BillList invoices={state.invoices} />
                            ) : (
                                <p className="text-base text-muted">There are no open bills on this branch.</p>
                            )}

                            {state.invoices.length > 0 &&
                                (onlineReady ? (
                                    <Button
                                        variant="primary"
                                        size="xl"
                                        className="w-full"
                                        icon={<CreditCard />}
                                        loading={paying}
                                        onClick={() => {
                                            setPaying(true);
                                            payBills(branch.id, undefined, () => setPaying(false));
                                        }}
                                        data-autofocus
                                    >
                                        Pay {peso(state.due_total)} now
                                    </Button>
                                ) : (
                                    <p className="border border-line bg-sunken px-3 py-2.5 text-sm text-muted">
                                        Online payment is not available yet. Pay {provider} by bank transfer or cash and they will reopen the branch.
                                    </p>
                                ))}
                            {onlineReady && state.invoices.length > 0 && (
                                <p className="text-center text-xs text-faint">Secure checkout by PayMongo: GCash, Maya, cards and more. You come back here when it is done.</p>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-bg px-6 py-3 text-sm">
                            <span className="text-faint">
                                Monthly plan {peso(state.monthly_fee)}
                                {state.next_bill_on && `, next bill ${date(state.next_bill_on)}`}
                            </span>
                            <span className="flex items-center gap-1">
                                {canSwitch && others.length > 0 && (
                                    <Button size="sm" variant="ghost" onClick={() => switchBranch(null, route('dashboard'))}>
                                        All branches
                                    </Button>
                                )}
                                <Button size="sm" variant="ghost" icon={<LogOut />} onClick={() => router.post(route('logout'))}>
                                    Sign out
                                </Button>
                            </span>
                        </div>
                    </div>

                    {canSwitch && others.length > 0 && (
                        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
                            Work in another branch:
                            {others.map((b) => (
                                <button key={b.id} type="button" className="rounded-xs border border-line px-2 py-1 hover:border-line-strong hover:text-fg" onClick={() => switchBranch(b.id, route('dashboard'))}>
                                    {b.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </ToastProvider>
    );
}

Locked.layout = null;
