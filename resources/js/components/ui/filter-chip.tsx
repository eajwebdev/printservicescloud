import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Toggle chip for one-tap filters (Owes money, Low stock, Overdue). An optional count sits at the end. */
export function FilterChip({ active, onClick, children, tone, count }: { active: boolean; onClick: () => void; children: ReactNode; tone?: 'red' | 'warn'; count?: number }) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={cn(
                'flex h-8 shrink-0 items-center gap-1.5 rounded-xs border px-2.5 text-sm whitespace-nowrap transition-colors',
                active
                    ? 'border-fg bg-fg text-bg'
                    : tone === 'red'
                      ? 'border-[color-mix(in_srgb,var(--accent)_45%,transparent)] text-accent-text hover:bg-selected'
                      : tone === 'warn'
                        ? 'border-[color-mix(in_srgb,var(--warn)_40%,transparent)] text-warn-text hover:bg-raised'
                        : 'border-line text-muted hover:border-line-strong hover:text-fg',
            )}
        >
            {children}
            {count !== undefined && <span className={cn('num', active ? 'opacity-80' : 'opacity-70')}>{count}</span>}
        </button>
    );
}

/** A row of mutually exclusive chips ("All 42", "Owes money 7"...). Picking the active one again clears it. */
export function ChipGroup<T extends string>({
    value,
    onChange,
    options,
    label,
}: {
    value: T | '';
    onChange: (v: T | '') => void;
    options: { value: T; label: ReactNode; count?: number; tone?: 'red' | 'warn' }[];
    label: string;
}) {
    return (
        <div role="group" aria-label={label} className="flex max-w-full gap-1.5 overflow-x-auto">
            {options.map((o) => (
                <FilterChip key={o.value} active={value === o.value} count={o.count} tone={o.count ? o.tone : undefined} onClick={() => onChange(value === o.value ? '' : o.value)}>
                    {o.label}
                </FilterChip>
            ))}
        </div>
    );
}
