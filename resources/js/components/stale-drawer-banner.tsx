import { Link } from '@inertiajs/react';
import { AlertTriangle } from 'lucide-react';
import { date } from '@/lib/format';
import { cn, useAppPage } from '@/lib/utils';

/**
 * A drawer left open overnight mixes two days of cash into one count.
 * Shown until the cashier counts and closes it.
 */
export function StaleDrawerBanner({ className, linkToDrawer = true }: { className?: string; linkToDrawer?: boolean }) {
    const { props } = useAppPage();
    const drawer = props.drawer;
    if (!drawer?.open || !drawer.stale) return null;

    return (
        <div role="alert" className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 border border-[color-mix(in_srgb,var(--warn)_55%,transparent)] bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] px-3 py-2 text-sm text-warn-text', className)}>
            <AlertTriangle className="size-4 shrink-0" />
            <span className="min-w-0 flex-1">
                This drawer was opened on <strong className="font-semibold">{date(drawer.opened_at)}</strong>. Count and close it, then open a new one for today so the days don't mix.
            </span>
            {linkToDrawer && (
                <Link href={route('session.index')} className="font-medium underline underline-offset-2">
                    Close drawer
                </Link>
            )}
        </div>
    );
}
