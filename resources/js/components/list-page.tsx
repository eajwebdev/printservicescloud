import { Link } from '@inertiajs/react';
import { ChevronLeft, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useHotkey } from '@/hooks/use-filters';
import { cn, useAppPage } from '@/lib/utils';

export interface ModuleTab {
    label: string;
    href: string;
    active: boolean;
    page?: string;
    count?: number;
    icon?: LucideIcon;
}

interface Props {
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    back?: { href: string; label: string };
    tabs?: ModuleTab[];
    /** Search and filters, one row. */
    toolbar?: ReactNode;
    /** Totals strip under the toolbar. */
    summary?: ReactNode;
    /** Pinned under the scroll area, e.g. pagination. */
    footer?: ReactNode;
    /** Content beside the list on wide screens. */
    aside?: ReactNode;
    children: ReactNode;
    bodyClassName?: string;
}

/**
 * Screen-filling list layout. Header, filters and pagination stay put;
 * only the list scrolls, so staff never lose the search box or the page buttons.
 */
export function ListPage({ title, description, actions, back, tabs, toolbar, summary, footer, aside, children, bodyClassName }: Props) {
    const { props } = useAppPage();

    // Press / anywhere on a list page to jump into its search box.
    useHotkey('/', (e) => {
        const target = e.target as HTMLElement;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
        const box = document.querySelector<HTMLInputElement>('[data-list-search]');
        if (!box) return;
        e.preventDefault();
        box.focus();
    });
    const pages = new Set(props.auth?.pages ?? []);
    const visibleTabs = (tabs ?? []).filter((t) => !t.page || pages.has(t.page));

    return (
        <div className="flex h-[calc(100dvh-3.5rem)] min-h-[520px] flex-col">
            <header className={cn('border-b border-line bg-bg px-4 pt-3 lg:px-6', visibleTabs.length < 2 && 'pb-3')}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1">
                        {back && (
                            <Link href={back.href} className="mb-0.5 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
                                <ChevronLeft className="size-3.5" />
                                {back.label}
                            </Link>
                        )}
                        <h1 className="truncate text-xl leading-tight font-semibold">{title}</h1>
                        {description && <p className="mt-0.5 hidden max-w-[80ch] truncate text-sm text-muted md:block">{description}</p>}
                    </div>
                    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
                </div>
                {visibleTabs.length > 1 && (
                    <nav className="-mb-px mt-2 flex gap-1 overflow-x-auto" aria-label="Sections">
                        {visibleTabs.map((t) => {
                            const Icon = t.icon;
                            return (
                                <Link
                                    key={t.href}
                                    href={t.href}
                                    aria-current={t.active ? 'page' : undefined}
                                    className={cn(
                                        'flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-base whitespace-nowrap transition-colors',
                                        t.active ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg',
                                    )}
                                >
                                    {Icon && <Icon className="size-4" strokeWidth={1.75} />}
                                    {t.label}
                                    {t.count !== undefined && <span className={cn('num rounded-xs px-1.5 text-xs leading-5', t.active ? 'bg-raised text-fg' : 'bg-surface text-muted')}>{t.count}</span>}
                                </Link>
                            );
                        })}
                    </nav>
                )}
            </header>
            {toolbar && <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2 lg:px-6">{toolbar}</div>}
            {summary}
            <div className="flex min-h-0 flex-1">
                <div className={cn('min-h-0 min-w-0 flex-1 overflow-auto bg-surface', bodyClassName)}>{children}</div>
                {aside && <aside className="hidden w-[320px] shrink-0 overflow-y-auto border-l border-line bg-bg xl:block">{aside}</aside>}
            </div>
            {footer && <div className="border-t border-line bg-surface">{footer}</div>}
        </div>
    );
}

/** Figures strip used under the toolbar. */
export function SummaryStrip({ items }: { items: { label: string; value: ReactNode; tone?: 'warn' | 'red' | 'ok'; sub?: ReactNode }[] }) {
    return (
        <div className="grid grid-cols-2 border-b border-line bg-bg sm:grid-flow-col sm:auto-cols-fr sm:grid-cols-none">
            {items.map((s) => (
                <div key={s.label} className="min-w-0 border-r border-b border-line px-4 py-2 last:border-r-0 sm:border-b-0 lg:px-6">
                    <p className="truncate text-xs text-faint">{s.label}</p>
                    <p className={cn('hud truncate text-lg font-semibold', s.tone === 'warn' && 'text-warn-text', s.tone === 'red' && 'text-accent-text', s.tone === 'ok' && 'text-ok-text')}>{s.value}</p>
                    {s.sub && <p className="truncate text-xs text-faint">{s.sub}</p>}
                </div>
            ))}
        </div>
    );
}

/** Search box sized for the toolbar. */
export function ToolbarSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean }) {
    return (
        <label className="relative w-full sm:w-72">
            <span className="sr-only">{placeholder}</span>
            <svg className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
            </svg>
            <input
                type="search"
                data-list-search
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="h-8 w-full rounded-xs border border-line bg-sunken pr-8 pl-9 text-sm text-fg placeholder:text-ghost hover:border-line-strong focus-visible:border-red-400 focus-visible:shadow-[0_0_0_1px_var(--red-400)] focus-visible:outline-none"
            />
            {!value && <kbd className="pointer-events-none absolute top-1/2 right-2 grid h-5 min-w-5 -translate-y-1/2 place-items-center rounded-xs border border-line-strong px-1 font-mono text-2xs text-faint">/</kbd>}
        </label>
    );
}
