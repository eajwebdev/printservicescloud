import { Link } from '@inertiajs/react';
import { animate, useInView, useMotionValue, useTransform, motion } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { money, peso } from '@/lib/format';
import { cn, prefersReducedMotion } from '@/lib/utils';
import type { PaginationLink } from '@/types';

/** Printing-vernacular empty state: halftone field, crop marks, one line of shop voice, one action. */
export function EmptyState({ title, body, action, className, compact }: { title: string; body?: ReactNode; action?: ReactNode; className?: string; compact?: boolean }) {
    return (
        <div className={cn('halftone flex items-center justify-center px-6', compact ? 'py-10' : 'py-16', className)}>
            <div className="crop-marks max-w-sm bg-surface px-6 py-5 text-center">
                <span className="crop-b" />
                <p className="font-display text-lg font-semibold text-fg">{title}</p>
                {body && <p className="mt-1 text-base text-muted">{body}</p>}
                {action && <div className="mt-4 flex justify-center">{action}</div>}
            </div>
        </div>
    );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <kbd className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-line-strong bg-sunken px-1 font-mono text-2xs text-muted', className)}>
            {children}
        </kbd>
    );
}

export function Skeleton({ className }: { className?: string }) {
    return <div className={cn('skeleton', className)} aria-hidden />;
}

/** Figures that animate to their new value when they change (totals, drawer). */
export function AnimatedMoney({ value, className, prefix = true }: { value: number; className?: string; prefix?: boolean }) {
    const mv = useMotionValue(value);
    const text = useTransform(mv, (v) => (prefix ? peso(v) : money(v)));
    const first = useRef(true);

    useEffect(() => {
        if (first.current || prefersReducedMotion()) {
            first.current = false;
            mv.set(value);
            return;
        }
        const controls = animate(mv, value, { duration: 0.35, ease: [0.2, 0.8, 0.2, 1] });
        return () => controls.stop();
    }, [value, mv]);

    return <motion.span className={cn('num', className)}>{text}</motion.span>;
}

/** Dashboard count-up: runs once when the tile first scrolls into view. */
export function CountUp({ value, format, className, delay = 0 }: { value: number; format: (n: number) => string; className?: string; delay?: number }) {
    const ref = useRef<HTMLSpanElement>(null);
    const inView = useInView(ref, { once: true });
    const mv = useMotionValue(0);
    const text = useTransform(mv, format);

    useEffect(() => {
        if (!inView) return;
        if (prefersReducedMotion()) {
            mv.set(value);
            return;
        }
        const c = animate(mv, value, { duration: 1.1, delay, ease: [0.16, 1, 0.3, 1] });
        return () => c.stop();
    }, [inView, value, mv, delay]);

    return (
        <motion.span ref={ref} className={cn('hud', className)}>
            {text}
        </motion.span>
    );
}

export function Pagination({ links, from, to, total }: { links: PaginationLink[]; from: number | null; to: number | null; total: number }) {
    if (links.length <= 3) {
        return total ? <p className="px-5 py-3 text-sm text-faint">{total === 1 ? '1 record' : `${total} records`}</p> : null;
    }
    return (
        <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3" aria-label="Pagination">
            <p className="num text-sm text-faint">
                {from}–{to} of {total}
            </p>
            <div className="flex flex-wrap gap-1">
                {links.map((l, i) => {
                    const label = l.label.replace('&laquo; Previous', '‹').replace('Next &raquo;', '›');
                    return l.url ? (
                        <Link
                            key={i}
                            href={l.url}
                            preserveScroll
                            preserveState
                            className={cn(
                                'num grid h-7 min-w-7 place-items-center rounded-xs border px-2 text-sm',
                                l.active ? 'border-accent bg-selected text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg',
                            )}
                            aria-current={l.active ? 'page' : undefined}
                        >
                            {label}
                        </Link>
                    ) : (
                        <span key={i} className="num grid h-7 min-w-7 place-items-center px-2 text-sm text-ghost">
                            {label}
                        </span>
                    );
                })}
            </div>
        </nav>
    );
}

/** A labelled figure in the page header strip. */
export function Stat({ label, value, tone, sub }: { label: string; value: ReactNode; tone?: 'red' | 'ok' | 'warn'; sub?: ReactNode }) {
    return (
        <div className="min-w-0 px-5 py-3">
            <p className="text-sm text-faint">{label}</p>
            <p
                className={cn(
                    'hud mt-0.5 truncate text-xl font-semibold',
                    tone === 'red' && 'text-accent-text',
                    tone === 'ok' && 'text-ok-text',
                    tone === 'warn' && 'text-warn-text',
                )}
            >
                {value}
            </p>
            {sub && <p className="mt-0.5 text-xs text-faint">{sub}</p>}
        </div>
    );
}

export function Panel({ title, actions, children, className, bodyClass }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
    return (
        <section className={cn('border border-line bg-surface', className)}>
            {(title || actions) && (
                <header className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-2">
                    {title && <h2 className="text-base font-semibold">{title}</h2>}
                    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
                </header>
            )}
            <div className={bodyClass}>{children}</div>
        </section>
    );
}
