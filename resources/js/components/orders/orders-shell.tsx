import { Link } from '@inertiajs/react';
import { KanbanSquare, List, ReceiptText, ScanBarcode } from 'lucide-react';
import type { ReactNode } from 'react';
import { ButtonLink } from '@/components/ui/button';
import { cn, useAppPage } from '@/lib/utils';
import type { OrderCounts } from '@/types';

export type OrdersView = 'today' | 'board' | 'list';

/**
 * Every order lives here, in three tabs. The page fills the screen exactly;
 * only the list or the board columns scroll, never the whole page.
 */
export function OrdersShell({ view, counts, toolbar, children }: { view: OrdersView; counts: OrderCounts; toolbar: ReactNode; children: ReactNode }) {
    const { props } = useAppPage();
    const tabs = [
        { key: 'today' as const, label: 'Sales today', short: 'Today', icon: ReceiptText, count: counts.today, hint: 'Everything rung up today, newest first' },
        { key: 'board' as const, label: 'Production board', short: 'Board', icon: KanbanSquare, count: counts.board, alert: counts.overdue, hint: 'Job orders being made' },
        { key: 'list' as const, label: 'All orders', short: 'All', icon: List, hint: 'Search any past order' },
    ];

    return (
        <div className="flex h-[calc(100dvh-3.5rem)] min-h-[520px] flex-col">
            <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-bg px-4 pt-3 lg:px-6">
                <h1 className="hidden pb-3 text-xl font-semibold sm:block">Orders</h1>
                <nav className="-mb-px flex min-w-0 flex-1 gap-1 overflow-x-auto" aria-label="Order views">
                    {tabs.map((t) => {
                        const active = t.key === view;
                        const Icon = t.icon;
                        return (
                            <Link
                                key={t.key}
                                href={route('orders.index', { view: t.key })}
                                preserveScroll
                                title={t.hint}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                    'flex h-11 shrink-0 items-center gap-1.5 border-b-2 px-2 sm:gap-2 sm:px-3 text-base whitespace-nowrap transition-colors',
                                    active ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg',
                                )}
                            >
                                <Icon className="hidden size-4 sm:block" strokeWidth={1.75} />
                                <span className="sm:hidden">{t.short}</span>
                                <span className="hidden sm:inline">{t.label}</span>
                                {t.count !== undefined && <span className={cn('num rounded-xs px-1.5 text-xs leading-5', active ? 'bg-raised text-fg' : 'bg-surface text-muted')}>{t.count}</span>}
                                {!!t.alert && <span className="num rounded-xs bg-selected px-1.5 text-xs leading-5 text-accent-text">{t.alert} late</span>}
                            </Link>
                        );
                    })}
                </nav>
                {props.auth?.pages.includes('pos') && (
                    <ButtonLink href={route('pos.index')} variant="primary" size="sm" icon={<ScanBarcode />} className="mb-3 max-sm:hidden">
                        New sale
                    </ButtonLink>
                )}
            </header>
            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2 lg:px-6">{toolbar}</div>
            <div className="min-h-0 flex-1">{children}</div>
        </div>
    );
}

export { FilterChip } from '@/components/ui/filter-chip';
