import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ComboOption {
    value: string;
    label: string;
    hint?: string;
    icon?: ReactNode;
    disabled?: boolean;
}

interface Props {
    value: string;
    onChange: (value: string) => void;
    options: ComboOption[];
    /** Label shown when nothing is picked, e.g. "Any payment". Picking it sends "". */
    placeholder: string;
    searchPlaceholder?: string;
    emptyText?: string;
    ariaLabel: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    disabled?: boolean;
    /** Show the placeholder as a selectable "clear" row at the top. Defaults to true. */
    clearable?: boolean;
    id?: string;
    invalid?: boolean;
}

/**
 * A select that can be searched: type to narrow, arrows to move, Enter to pick.
 * Used wherever a list could grow (staff, statuses, customers).
 */
export function Combobox({
    value,
    onChange,
    options,
    placeholder,
    searchPlaceholder = 'Type to search',
    emptyText = 'Nothing matches',
    ariaLabel,
    size = 'md',
    className,
    disabled,
    clearable = true,
    id,
    invalid,
}: Props) {
    const [open, setOpen] = useState(false);
    const selected = options.find((o) => o.value === value);
    const height = { sm: 'h-8 text-sm', md: 'h-9 text-base', lg: 'h-11 text-base' }[size];

    const pick = (v: string) => {
        onChange(v);
        setOpen(false);
    };

    return (
        <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger asChild disabled={disabled}>
                <button
                    id={id}
                    type="button"
                    role="combobox"
                    aria-expanded={open}
                    aria-label={ariaLabel}
                    aria-invalid={invalid || undefined}
                    className={cn(
                        'flex w-full min-w-0 items-center gap-2 rounded-xs border border-line bg-sunken px-3 text-left transition-colors',
                        'hover:border-line-strong focus-visible:border-red-400 disabled:opacity-50 aria-[invalid=true]:border-accent',
                        open && 'border-line-strong',
                        height,
                        className,
                    )}
                >
                    {selected?.icon}
                    <span className={cn('min-w-0 flex-1 truncate', selected ? 'text-fg' : 'text-muted')}>{selected ? selected.label : placeholder}</span>
                    {selected && clearable && !disabled ? (
                        <span
                            role="button"
                            tabIndex={-1}
                            aria-label={`Clear ${ariaLabel}`}
                            onPointerDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onChange('');
                            }}
                            className="-mr-1 grid size-5 place-items-center rounded-xs text-faint hover:bg-raised hover:text-fg"
                        >
                            <X className="size-3.5" />
                        </span>
                    ) : (
                        <ChevronDown className="size-4 shrink-0 text-faint" />
                    )}
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    align="start"
                    sideOffset={4}
                    collisionPadding={12}
                    className="z-[60] w-[var(--radix-popover-trigger-width)] min-w-56 overflow-hidden rounded-md border border-line bg-raised shadow-[var(--shadow-float)]"
                >
                    <Command loop label={ariaLabel}>
                        <div className="flex items-center gap-2 border-b border-line px-3">
                            <Search className="size-4 shrink-0 text-faint" />
                            <Command.Input autoFocus placeholder={searchPlaceholder} className="h-10 w-full bg-transparent text-base text-fg outline-none placeholder:text-ghost" />
                        </div>
                        <Command.List className="max-h-72 overflow-y-auto p-1">
                            <Command.Empty className="px-3 py-4 text-center text-sm text-muted">{emptyText}</Command.Empty>
                            {clearable && (
                                <Command.Item
                                    value={`__all ${placeholder}`}
                                    onSelect={() => pick('')}
                                    className="flex h-9 cursor-pointer items-center gap-2 rounded-xs px-2.5 text-base text-muted data-[selected=true]:bg-surface data-[selected=true]:text-fg"
                                >
                                    <Check className={cn('size-4 shrink-0', value === '' ? 'opacity-100' : 'opacity-0')} />
                                    {placeholder}
                                </Command.Item>
                            )}
                            {options.map((o) => (
                                <Command.Item
                                    key={o.value}
                                    disabled={o.disabled}
                                    value={`${o.label} ${o.hint ?? ''} ${o.value}`}
                                    onSelect={() => pick(o.value)}
                                    className="flex min-h-9 cursor-pointer items-center gap-2 rounded-xs px-2.5 py-1.5 text-base text-fg data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-40 data-[selected=true]:bg-surface"
                                >
                                    <Check className={cn('size-4 shrink-0', value === o.value ? 'text-fg opacity-100' : 'opacity-0')} />
                                    {o.icon}
                                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                                    {o.hint && <span className="shrink-0 text-xs text-faint">{o.hint}</span>}
                                </Command.Item>
                            ))}
                        </Command.List>
                    </Command>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
