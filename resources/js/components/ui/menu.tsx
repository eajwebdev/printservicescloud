import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Menu({ trigger, children, align = 'end' }: { trigger: ReactNode; children: ReactNode; align?: 'start' | 'end' }) {
    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    align={align}
                    sideOffset={6}
                    className="z-50 min-w-48 rounded-md border border-line bg-raised p-1 shadow-[var(--shadow-float)] data-[state=open]:animate-in"
                >
                    {children}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}

export function MenuItem({ children, onSelect, danger, icon, disabled, className }: { children: ReactNode; onSelect: () => void; danger?: boolean; icon?: ReactNode; disabled?: boolean; className?: string }) {
    return (
        <DropdownMenu.Item
            disabled={disabled}
            onSelect={onSelect}
            className={cn(
                'flex h-8 cursor-pointer items-center gap-2 rounded-xs px-2 text-base outline-none select-none [&_svg]:size-4',
                'data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface',
                danger ? 'text-accent-text' : 'text-fg',
                className,
            )}
        >
            {icon && <span className="text-muted">{icon}</span>}
            {children}
        </DropdownMenu.Item>
    );
}

export function MenuLabel({ children }: { children: ReactNode }) {
    return <DropdownMenu.Label className="px-2 pt-1.5 pb-1 text-xs text-faint">{children}</DropdownMenu.Label>;
}

export function MenuSeparator() {
    return <DropdownMenu.Separator className="my-1 h-px bg-line" />;
}
