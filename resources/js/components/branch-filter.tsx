import { Layers, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BranchFilterProps } from '@/types';

/**
 * Pick which branches a dashboard or report covers: all of them, or any mix.
 * Hidden for branch staff, whose figures are always their own branch.
 */
export function BranchFilter({ value, onChange, className }: { value: BranchFilterProps; onChange: (ids: number[]) => void; className?: string }) {
    if (value.locked) {
        return (
            <span className={cn('flex h-8 items-center gap-1.5 rounded-xs border border-line px-2.5 text-sm text-muted', className)}>
                <MapPin className="size-3.5 text-faint" />
                {value.label}
            </span>
        );
    }
    if (value.options.length < 2) return null;

    const selected = new Set(value.selected);
    const all = selected.size === 0;
    const toggle = (id: number) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        // Ticking every branch is the same as "All branches".
        onChange(next.size === value.options.length ? [] : [...next]);
    };

    return (
        <div className={cn('flex flex-wrap items-center gap-1', className)} role="group" aria-label="Branches">
            <button
                type="button"
                aria-pressed={all}
                onClick={() => onChange([])}
                className={cn('flex h-8 items-center gap-1.5 rounded-xs border px-2.5 text-sm whitespace-nowrap', all ? 'border-accent bg-selected text-fg' : 'border-line text-muted hover:text-fg')}
            >
                <Layers className="size-3.5" />
                All branches
            </button>
            {value.options.map((b) => {
                const on = selected.has(b.id);
                return (
                    <button
                        key={b.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(b.id)}
                        title={on ? `Remove ${b.name}` : `Add ${b.name}`}
                        className={cn('flex h-8 items-center gap-1.5 rounded-xs border px-2.5 text-sm whitespace-nowrap', on ? 'border-accent bg-selected text-fg' : 'border-line text-muted hover:text-fg')}
                    >
                        <span className={cn('size-2 rounded-[1px] border', on ? 'border-accent bg-accent' : 'border-line-strong')} aria-hidden />
                        {b.name}
                        <span className="font-mono text-2xs text-faint">{b.code}</span>
                    </button>
                );
            })}
        </div>
    );
}
