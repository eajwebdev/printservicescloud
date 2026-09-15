import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { Check, Minus } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CheckboxProps {
    checked: boolean | 'indeterminate';
    onChange: (checked: boolean) => void;
    label?: ReactNode;
    description?: ReactNode;
    disabled?: boolean;
    className?: string;
    ariaLabel?: string;
}

export function Checkbox({ checked, onChange, label, description, disabled, className, ariaLabel }: CheckboxProps) {
    const id = useId();
    return (
        <div className={cn('flex items-start gap-2.5', className)}>
            <CheckboxPrimitive.Root
                id={id}
                checked={checked}
                disabled={disabled}
                aria-label={ariaLabel}
                onCheckedChange={(v) => onChange(v === true)}
                className={cn(
                    'mt-0.5 grid size-4 shrink-0 place-items-center rounded-xs border border-line-strong bg-sunken transition-colors',
                    'hover:border-muted data-[state=checked]:border-fg data-[state=checked]:bg-fg',
                    'data-[state=indeterminate]:border-fg data-[state=indeterminate]:bg-fg disabled:opacity-40',
                )}
            >
                <CheckboxPrimitive.Indicator className="text-bg">
                    {checked === 'indeterminate' ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}
                </CheckboxPrimitive.Indicator>
            </CheckboxPrimitive.Root>
            {(label || description) && (
                <label htmlFor={id} className={cn('cursor-pointer select-none', disabled && 'cursor-default opacity-50')}>
                    {label && <span className="block text-base leading-5 text-fg">{label}</span>}
                    {description && <span className="block text-sm text-faint">{description}</span>}
                </label>
            )}
        </div>
    );
}

export function Switch({
    checked,
    onChange,
    label,
    description,
    disabled,
    className,
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label?: ReactNode;
    description?: ReactNode;
    disabled?: boolean;
    className?: string;
}) {
    const id = useId();
    return (
        <div className={cn('flex items-center justify-between gap-4', className)}>
            {(label || description) && (
                <label htmlFor={id} className="cursor-pointer select-none">
                    {label && <span className="block text-base text-fg">{label}</span>}
                    {description && <span className="block text-sm text-faint">{description}</span>}
                </label>
            )}
            <SwitchPrimitive.Root
                id={id}
                checked={checked}
                disabled={disabled}
                onCheckedChange={onChange}
                className="relative h-5 w-9 shrink-0 rounded-xs border border-line-strong bg-sunken transition-colors data-[state=checked]:border-fg data-[state=checked]:bg-fg disabled:opacity-40"
            >
                <SwitchPrimitive.Thumb className="block size-3.5 translate-x-0.5 rounded-[1px] bg-muted transition-transform duration-150 data-[state=checked]:translate-x-[17px] data-[state=checked]:bg-bg" />
            </SwitchPrimitive.Root>
        </div>
    );
}

/** A connected row of mutually exclusive buttons (Products | Services, Instant | Job). */
export function Segmented<T extends string>({
    value,
    onChange,
    options,
    size = 'md',
    className,
    label,
}: {
    value: T;
    onChange: (v: T) => void;
    options: { value: T; label: ReactNode; hint?: string }[];
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    label: string;
}) {
    return (
        <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-xs border border-line bg-sunken p-0.5', className)}>
            {options.map((o) => {
                const active = o.value === value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        title={o.hint}
                        onClick={() => onChange(o.value)}
                        className={cn(
                            'relative flex-1 rounded-[1px] px-3 font-medium whitespace-nowrap transition-colors',
                            size === 'sm' && 'h-7 text-sm',
                            size === 'md' && 'h-8 text-base',
                            size === 'lg' && 'h-10 text-base',
                            active ? 'bg-raised text-fg shadow-[inset_0_-2px_0_var(--accent)]' : 'text-muted hover:text-fg',
                        )}
                    >
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}
