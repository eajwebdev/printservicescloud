import { Link } from '@inertiajs/react';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageHeader({
    title,
    description,
    actions,
    back,
    meta,
    className,
}: {
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    back?: { href: string; label: string };
    meta?: ReactNode;
    className?: string;
}) {
    return (
        <header className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-line px-5 pt-5 pb-4 lg:px-6', className)}>
            <div className="min-w-0">
                {back && (
                    <Link href={back.href} className="mb-1.5 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
                        <ChevronLeft className="size-3.5" />
                        {back.label}
                    </Link>
                )}
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl leading-tight font-semibold">{title}</h1>
                    {meta}
                </div>
                {description && <p className="mt-1 max-w-[72ch] text-base text-muted">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
    );
}

/** One row of filters above a table. */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn('flex flex-wrap items-center gap-2 border-b border-line bg-surface px-5 py-2.5', className)}>{children}</div>;
}
