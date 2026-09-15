import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Dense data table: sticky header, 40px rows, figures right-aligned in tabular numerals. */
export function Table({ children, className, minWidth = 720, flush }: { children: ReactNode; className?: string; minWidth?: number; flush?: boolean }) {
    // flush: the page already scrolls this area, so let the sticky header pin to it.
    if (flush) {
        return (
            <table className={cn('w-full border-collapse text-left text-base', className)} style={{ minWidth }}>
                {children}
            </table>
        );
    }
    return (
        <div className={cn('overflow-x-auto', className)}>
            <table className="w-full border-collapse text-left text-base" style={{ minWidth }}>
                {children}
            </table>
        </div>
    );
}

export function THead({ children }: { children: ReactNode }) {
    return <thead className="sticky top-0 z-[1] bg-surface">{children}</thead>;
}

export function Th({ className, align, children, ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'right' | 'center' }) {
    return (
        <th
            scope="col"
            className={cn(
                'h-9 border-b border-line px-3 text-sm font-medium whitespace-nowrap text-faint first:pl-5 last:pr-5',
                align === 'right' && 'text-right',
                align === 'center' && 'text-center',
                className,
            )}
            {...rest}
        >
            {children}
        </th>
    );
}

export function Tr({ className, interactive, selected, ...rest }: HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean; selected?: boolean }) {
    return (
        <tr
            className={cn(
                'border-b border-line last:border-b-0',
                interactive && 'cursor-pointer transition-colors hover:bg-raised',
                selected && 'bg-selected',
                className,
            )}
            {...rest}
        />
    );
}

export function Td({ className, align, numeric, muted, ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { align?: 'right' | 'center'; numeric?: boolean; muted?: boolean }) {
    return (
        <td
            className={cn(
                'h-10 px-3 py-2 align-middle first:pl-5 last:pr-5',
                (align === 'right' || numeric) && 'text-right',
                align === 'center' && 'text-center',
                numeric && 'num whitespace-nowrap',
                muted && 'text-muted',
                className,
            )}
            {...rest}
        />
    );
}
