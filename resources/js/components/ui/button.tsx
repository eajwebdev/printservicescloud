import { Link, type InertiaLinkProps } from '@inertiajs/react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const base =
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xs font-medium select-none ' +
    'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ' +
    'disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0';

const variants: Record<Variant, string> = {
    primary:
        'bg-accent text-white hover:bg-accent-hover active:bg-accent-press active:translate-y-px ' +
        'focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--brand)_22%,transparent),0_8px_24px_-6px_color-mix(in_srgb,var(--brand)_55%,transparent)]',
    secondary: 'border border-line-strong bg-raised text-fg hover:border-muted active:translate-y-px',
    ghost: 'text-muted hover:bg-raised hover:text-fg',
    danger: 'border border-line-strong text-accent-text hover:border-accent hover:bg-selected',
    quiet: 'border border-line text-muted hover:border-line-strong hover:text-fg',
};

const sizes: Record<Size, string> = {
    xs: 'h-7 px-2 text-xs [&_svg]:size-3.5',
    sm: 'h-8 px-3 text-sm',
    md: 'h-9 px-3.5 text-base',
    lg: 'h-11 px-5 text-base',
    xl: 'h-14 px-6 text-lg font-semibold',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    icon?: ReactNode;
    loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = 'secondary', size = 'md', icon, loading, className, children, disabled, type = 'button', ...rest },
    ref,
) {
    return (
        <button ref={ref} type={type} disabled={disabled || loading} className={cn(base, variants[variant], sizes[size], className)} {...rest}>
            {loading ? <Spinner /> : icon}
            {children}
        </button>
    );
});

export function ButtonLink({
    variant = 'secondary',
    size = 'md',
    icon,
    className,
    children,
    ...rest
}: Omit<InertiaLinkProps, "size"> & { variant?: Variant; size?: Size; icon?: ReactNode }) {
    return (
        <Link className={cn(base, variants[variant], sizes[size], className)} {...rest}>
            {icon}
            {children}
        </Link>
    );
}

export const IconButton = forwardRef<HTMLButtonElement, ButtonProps & { label: string }>(function IconButton(
    { label, className, size = 'sm', variant = 'ghost', ...rest },
    ref,
) {
    const square: Record<Size, string> = { xs: 'w-7 px-0', sm: 'w-8 px-0', md: 'w-9 px-0', lg: 'w-11 px-0', xl: 'w-14 px-0' };
    return <Button ref={ref} aria-label={label} title={label} variant={variant} size={size} className={cn(square[size], className)} {...rest} />;
});

export function Spinner({ className }: { className?: string }) {
    return (
        <svg className={cn('size-4 animate-spin', className)} viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
            <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
        </svg>
    );
}
