import {
    Children,
    forwardRef,
    isValidElement,
    useId,
    type ChangeEvent,
    type InputHTMLAttributes,
    type ReactElement,
    type ReactNode,
    type SelectHTMLAttributes,
    type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';
import { Combobox } from './combobox';

export const controlClass =
    'w-full rounded-xs border border-line bg-sunken px-3 text-base text-fg placeholder:text-ghost ' +
    'transition-colors hover:border-line-strong focus-visible:border-red-400 focus-visible:outline-none ' +
    'focus-visible:shadow-[0_0_0_1px_var(--red-400)] disabled:opacity-50 aria-[invalid=true]:border-accent';

export function Label({ htmlFor, children, hint, className }: { htmlFor?: string; children: ReactNode; hint?: ReactNode; className?: string }) {
    return (
        <div className={cn('mb-1.5 flex items-baseline justify-between gap-2', className)}>
            <label htmlFor={htmlFor} className="text-sm font-medium text-muted">
                {children}
            </label>
            {hint && <span className="text-xs text-faint">{hint}</span>}
        </div>
    );
}

export function ErrorText({ children, id }: { children?: ReactNode; id?: string }) {
    if (!children) return null;
    return (
        <p id={id} role="alert" className="mt-1.5 text-sm text-accent-text">
            {children}
        </p>
    );
}

interface FieldProps {
    label?: ReactNode;
    hint?: ReactNode;
    error?: string;
    className?: string;
    children: (id: string, describedBy: string | undefined) => ReactNode;
}

/** Label + control + error, wired for screen readers. */
export function Field({ label, hint, error, className, children }: FieldProps) {
    const id = useId();
    const errId = error ? `${id}-err` : undefined;
    return (
        <div className={className}>
            {label && (
                <Label htmlFor={id} hint={hint}>
                    {label}
                </Label>
            )}
            {children(id, errId)}
            <ErrorText id={errId}>{error}</ErrorText>
        </div>
    );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; prefix?: ReactNode; suffix?: ReactNode; inputSize?: 'sm' | 'md' | 'lg' };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, invalid, prefix, suffix, inputSize = 'md', ...rest }, ref) {
    const h = { sm: 'h-8 text-sm', md: 'h-9', lg: 'h-12 text-lg' }[inputSize];
    if (prefix || suffix) {
        return (
            <div className={cn('relative flex items-center', className)}>
                {prefix && <span className="pointer-events-none absolute left-3 text-muted">{prefix}</span>}
                <input ref={ref} aria-invalid={invalid || undefined} className={cn(controlClass, h, prefix && 'pl-8', suffix && 'pr-12')} {...rest} />
                {suffix && <span className="pointer-events-none absolute right-3 text-sm text-faint">{suffix}</span>}
            </div>
        );
    }
    return <input ref={ref} aria-invalid={invalid || undefined} className={cn(controlClass, h, className)} {...rest} />;
});

/** Peso amount input with tabular numerals. */
export const MoneyInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type' | 'prefix'>>(function MoneyInput({ className, ...rest }, ref) {
    return <Input ref={ref} type="number" inputMode="decimal" step="0.01" min="0" prefix="₱" className={cn('num', className)} {...rest} />;
});

type OptionProps = { value?: string | number; children?: ReactNode; disabled?: boolean };

function textOf(node: ReactNode): string {
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(textOf).join('');
    if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
    return '';
}

/**
 * Every select in the app is searchable. Pages keep writing plain <option> children and an
 * onChange that reads e.target.value; this turns them into a type-to-filter picker.
 */
export function Select({
    className,
    invalid,
    children,
    selectSize = 'md',
    value,
    onChange,
    disabled,
    id,
    'aria-label': ariaLabel,
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & { invalid?: boolean; selectSize?: 'sm' | 'md' }) {
    const options = Children.toArray(children)
        .filter((c): c is ReactElement<OptionProps> => isValidElement(c))
        .map((o) => {
            const label = textOf(o.props.children).trim();
            return { value: String(o.props.value ?? label), label, disabled: !!o.props.disabled };
        });
    const empty = options.find((o) => o.value === '');
    const current = String(value ?? '');

    return (
        <Combobox
            id={id}
            ariaLabel={ariaLabel ?? 'Choose an option'}
            size={selectSize}
            className={className}
            disabled={disabled}
            invalid={invalid}
            value={current}
            placeholder={empty?.label ?? 'Select'}
            clearable={!!empty}
            options={options.filter((o) => o.value !== '')}
            onChange={(v) => onChange?.({ target: { value: v }, currentTarget: { value: v } } as unknown as ChangeEvent<HTMLSelectElement>)}
        />
    );
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea(
    { className, invalid, ...rest },
    ref,
) {
    return <textarea ref={ref} aria-invalid={invalid || undefined} className={cn(controlClass, 'min-h-20 py-2 leading-relaxed', className)} {...rest} />;
});
