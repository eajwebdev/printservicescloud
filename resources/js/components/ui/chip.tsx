import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { METHOD_LABEL, peso, STATUS_LABEL } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { OrderStatus, PaymentStatus } from '@/types';

export type Tone = 'neutral' | 'red' | 'ok' | 'warn' | 'info' | 'outline';

const tones: Record<Tone, string> = {
    neutral: 'bg-raised text-muted border-line',
    red: 'bg-selected text-accent-text border-[color-mix(in_srgb,var(--accent)_35%,transparent)]',
    ok: 'bg-[color-mix(in_srgb,var(--ok)_12%,transparent)] text-ok-text border-[color-mix(in_srgb,var(--ok)_30%,transparent)]',
    warn: 'bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] text-warn-text border-[color-mix(in_srgb,var(--warn)_30%,transparent)]',
    info: 'bg-[color-mix(in_srgb,var(--info)_12%,transparent)] text-info-text border-[color-mix(in_srgb,var(--info)_30%,transparent)]',
    outline: 'bg-transparent text-muted border-line-strong',
};

export function Chip({ tone = 'neutral', children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
    return (
        <span
            className={cn(
                'inline-flex h-5 items-center gap-1 rounded-xs border px-1.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3',
                tones[tone],
                className,
            )}
        >
            {icon}
            {children}
        </span>
    );
}

/** Pulsing red dot: only for work that is physically running right now. */
export function LiveDot({ className, label = 'In production now' }: { className?: string; label?: string }) {
    return (
        <span className={cn('relative inline-flex size-2 shrink-0', className)} role="img" aria-label={label}>
            <span className="absolute inset-0 animate-live rounded-full bg-accent" />
        </span>
    );
}

const STATUS_TONE: Record<OrderStatus, Tone> = {
    completed: 'neutral',
    pending: 'outline',
    in_production: 'red',
    ready: 'ok',
    released: 'neutral',
    voided: 'neutral',
};

export function StatusChip({ status }: { status: OrderStatus }) {
    return (
        <motion.span layout="position" className="inline-flex">
            <Chip tone={STATUS_TONE[status]} className={status === 'voided' ? 'line-through' : undefined}>
                {status === 'in_production' && <LiveDot className="mr-0.5 size-1.5" />}
                {STATUS_LABEL[status]}
            </Chip>
        </motion.span>
    );
}

export function PaymentChip({ status, balance }: { status: PaymentStatus; balance: number }) {
    if (status === 'paid') return <Chip tone="ok">Paid</Chip>;
    if (status === 'credit') return <Chip tone="warn">Credit {peso(balance)}</Chip>;
    if (status === 'unpaid') return <Chip tone="red">Unpaid {peso(balance)}</Chip>;
    return <Chip tone="warn">Balance {peso(balance)}</Chip>;
}

export function MethodChip({ method }: { method: string }) {
    return <Chip tone={method === 'credit' ? 'warn' : 'outline'}>{METHOD_LABEL[method] ?? method}</Chip>;
}
