import { Head } from '@inertiajs/react';
import { ArrowRight, Layers, Lock, MapPin } from 'lucide-react';
import { switchBranch } from '@/components/branch-switcher';
import { PageHeader } from '@/components/page-header';
import { Chip } from '@/components/ui/chip';
import { peso } from '@/lib/format';
import { cn } from '@/lib/utils';
import { SUBSCRIPTION_TONE } from '../Billing/Index';

interface BranchCard {
    id: number;
    name: string;
    code: string;
    address: string | null;
    active: boolean;
    billing: { status: string; status_label: string; locked: boolean; lock_reason: string | null; overdue_count: number; due_total: number; trial_days_left: number | null };
}

/** An admin on "All branches" opened a page that belongs to one branch. */
export default function Pick({ branches, intended }: { branches: BranchCard[]; intended: string | null }) {
    const go = (id: number | null) => switchBranch(id, id ? (intended ?? route('dashboard')) : route('dashboard'));

    return (
        <>
            <Head title="Pick a branch" />
            <PageHeader title="Which branch are you working in?" description="Selling, the cash drawer, stock and settings belong to one branch. Pick it here; you can switch any time from the top bar." />
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:p-6 xl:grid-cols-3">
                {branches.map((b) => (
                    <button
                        key={b.id}
                        type="button"
                        onClick={() => go(b.id)}
                        disabled={!b.active}
                        className={cn(
                            'group flex flex-col items-start gap-3 border border-line bg-surface p-5 text-left transition-colors hover:border-line-strong hover:bg-raised disabled:opacity-50',
                            b.billing.locked && 'border-[color-mix(in_srgb,var(--accent)_40%,transparent)]',
                        )}
                    >
                        <div className="flex w-full items-start justify-between gap-3">
                            <span className="grid size-10 place-items-center rounded-xs bg-raised font-mono text-sm font-semibold">{b.code}</span>
                            <ArrowRight className="size-4 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
                        </div>
                        <div>
                            <p className="text-lg font-semibold">{b.name}</p>
                            {b.address && (
                                <p className="mt-0.5 flex items-start gap-1.5 text-sm text-muted">
                                    <MapPin className="mt-0.5 size-3.5 shrink-0" />
                                    {b.address}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            <Chip tone={SUBSCRIPTION_TONE[b.billing.status]}>{b.billing.status_label}</Chip>
                            {b.billing.locked && (
                                <Chip tone="red" icon={<Lock />}>
                                    Locked, {peso(b.billing.due_total)} due
                                </Chip>
                            )}
                            {!b.billing.locked && b.billing.overdue_count > 0 && <Chip tone="warn">{b.billing.overdue_count} overdue bill{b.billing.overdue_count === 1 ? '' : 's'}</Chip>}
                            {b.billing.status === 'trial' && b.billing.trial_days_left !== null && <Chip tone="outline">{b.billing.trial_days_left} trial days left</Chip>}
                            {!b.active && <Chip>Switched off</Chip>}
                        </div>
                    </button>
                ))}
                <button type="button" onClick={() => go(null)} className="group flex flex-col items-start justify-between gap-3 border border-dashed border-line-strong p-5 text-left hover:bg-raised">
                    <span className="grid size-10 place-items-center rounded-xs bg-raised text-info-text">
                        <Layers className="size-4" />
                    </span>
                    <div>
                        <p className="text-lg font-semibold">Stay on all branches</p>
                        <p className="mt-0.5 text-sm text-muted">Dashboard, reports, users and billing for every branch together.</p>
                    </div>
                </button>
            </div>
        </>
    );
}
