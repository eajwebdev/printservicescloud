import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { cn } from '@/lib/utils';

export interface DateRangeValue {
    from: string;
    to: string;
}

export function isoDate(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type PresetKey = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'last_month' | 'year';

/** Quick ranges, worked out fresh so a tab left open past midnight still means "today". */
export function datePresets(keys: PresetKey[] = ['today', 'yesterday', '7d', '30d', 'month', 'last_month']) {
    const t = new Date();
    const ago = (n: number) => new Date(t.getFullYear(), t.getMonth(), t.getDate() - n);
    const all: Record<PresetKey, { label: string } & DateRangeValue> = {
        today: { label: 'Today', from: isoDate(t), to: isoDate(t) },
        yesterday: { label: 'Yesterday', from: isoDate(ago(1)), to: isoDate(ago(1)) },
        '7d': { label: '7 days', from: isoDate(ago(6)), to: isoDate(t) },
        '30d': { label: '30 days', from: isoDate(ago(29)), to: isoDate(t) },
        month: { label: 'This month', from: isoDate(new Date(t.getFullYear(), t.getMonth(), 1)), to: isoDate(t) },
        last_month: { label: 'Last month', from: isoDate(new Date(t.getFullYear(), t.getMonth() - 1, 1)), to: isoDate(new Date(t.getFullYear(), t.getMonth(), 0)) },
        year: { label: 'This year', from: isoDate(new Date(t.getFullYear(), 0, 1)), to: isoDate(t) },
    };
    return keys.map((k) => ({ key: k, ...all[k] }));
}

/** Preset chips plus a custom from/to. Calls onApply with ISO dates (YYYY-MM-DD). */
export function DateRangeFilter({ value, onApply, presets, className }: { value: DateRangeValue; onApply: (range: DateRangeValue) => void; presets?: PresetKey[]; className?: string }) {
    const [from, setFrom] = useState(value.from);
    const [to, setTo] = useState(value.to);
    useEffect(() => {
        setFrom(value.from);
        setTo(value.to);
    }, [value.from, value.to]);

    const options = datePresets(presets);
    const custom = !options.some((p) => p.from === value.from && p.to === value.to);
    const dirty = from !== value.from || to !== value.to;

    return (
        <div className={cn('flex w-full flex-wrap items-center gap-2', className)}>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Quick date ranges">
                {options.map((p) => {
                    const active = p.from === value.from && p.to === value.to;
                    return (
                        <button
                            key={p.key}
                            type="button"
                            aria-pressed={active}
                            onClick={() => onApply({ from: p.from, to: p.to })}
                            className={cn('h-8 rounded-xs border px-2.5 text-sm whitespace-nowrap', active ? 'border-accent bg-selected text-fg' : 'border-line text-muted hover:text-fg')}
                        >
                            {p.label}
                        </button>
                    );
                })}
            </div>
            <form
                className="flex flex-wrap items-center gap-2 sm:ml-auto"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (from && to) onApply(from <= to ? { from, to } : { from: to, to: from });
                }}
            >
                <Input type="date" className={cn('w-38', custom && 'border-accent')} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
                <span className="text-faint">to</span>
                <Input type="date" className={cn('w-38', custom && 'border-accent')} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
                <Button type="submit" size="md" variant={dirty ? 'primary' : 'secondary'} disabled={!from || !to}>
                    Apply
                </Button>
            </form>
        </div>
    );
}
