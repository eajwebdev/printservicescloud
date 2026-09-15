import type { ReactNode } from 'react';

export const axisProps = {
    stroke: 'var(--line)',
    tick: { fill: 'var(--fg-faint)', fontSize: 11, fontFamily: 'var(--font-sans)' },
    tickLine: false,
    axisLine: false,
} as const;

export const gridProps = {
    stroke: 'var(--chart-grid)',
    strokeDasharray: '0',
    vertical: false,
} as const;

interface TooltipRow {
    label: string;
    value: string;
    color?: string;
}

/** Recharts tooltip body in the app's raised-surface style; values in text ink, color only on the swatch. */
export function ChartTooltipBox({ title, rows }: { title: ReactNode; rows: TooltipRow[] }) {
    return (
        <div className="min-w-40 rounded-md border border-line bg-raised px-3 py-2 shadow-[var(--shadow-float)]">
            <p className="mb-1 text-xs text-faint">{title}</p>
            {rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-4 text-sm">
                    <span className="flex items-center gap-1.5 text-muted">
                        {r.color && <span className="size-2 rounded-[1px]" style={{ background: r.color }} />}
                        {r.label}
                    </span>
                    <span className="num text-fg">{r.value}</span>
                </div>
            ))}
        </div>
    );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
    return (
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
            {items.map((i) => (
                <span key={i.label} className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-[1px]" style={{ background: i.color }} />
                    {i.label}
                </span>
            ))}
        </div>
    );
}
