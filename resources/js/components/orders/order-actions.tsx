import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { ErrorText, Field, Input, MoneyInput } from '@/components/ui/field';
import { METHOD_LABEL, peso } from '@/lib/format';
import { cn, useCan } from '@/lib/utils';
import type { BoardStatus, OrderCard, OrderStatus } from '@/types';

export const BOARD_STEPS: BoardStatus[] = ['pending', 'in_production', 'ready', 'released'];

/** The one obvious next thing to do with a job, in shop words. */
export const NEXT_STEP: Partial<Record<OrderStatus, { to: BoardStatus; label: string }>> = {
    pending: { to: 'in_production', label: 'Start' },
    in_production: { to: 'ready', label: 'Mark ready' },
    ready: { to: 'released', label: 'Release' },
};

interface MoveOptions {
    onStart?: () => void;
    onSuccess?: () => void;
    onError?: (message: string) => void;
    onFinish?: () => void;
}

export function patchStatus(order: Pick<OrderCard, 'id'>, status: BoardStatus, opts: MoveOptions = {}) {
    opts.onStart?.();
    router.patch(
        route('orders.status', order.id),
        { status },
        {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => opts.onSuccess?.(),
            onError: (errs) => opts.onError?.(Object.values(errs)[0] ?? 'Could not update that order. Try again.'),
            onFinish: () => opts.onFinish?.(),
        },
    );
}

/**
 * Releasing a job that still owes money is the moment balances slip through.
 * This asks once: collect it now, or knowingly leave it on the customer's account.
 */
export function ReleaseDialog({
    order,
    onClose,
    onReleased,
}: {
    order: Pick<OrderCard, 'id' | 'order_no' | 'customer' | 'balance'> | null;
    onClose: () => void;
    onReleased: () => void;
}) {
    const can = useCan();
    const [method, setMethod] = useState('cash');
    const [amount, setAmount] = useState('');
    const [reference, setReference] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (order) {
            setMethod('cash');
            setAmount(order.balance.toFixed(2));
            setReference('');
            setErrors({});
        }
    }, [order]);

    if (!order) return null;

    const release = () =>
        patchStatus(order, 'released', {
            onStart: () => setBusy(true),
            onSuccess: () => {
                onReleased();
                onClose();
            },
            onError: (m) => setErrors({ amount: m }),
            onFinish: () => setBusy(false),
        });

    const collectAndRelease = () => {
        setBusy(true);
        router.post(
            route('orders.collect', order.id),
            { amount: Number(amount), method, reference: reference || null },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: (page) => {
                    const pageErrors = (page.props as { errors?: Record<string, string> }).errors ?? {};
                    if (Object.keys(pageErrors).length) {
                        setErrors(pageErrors);
                        setBusy(false);
                        return;
                    }
                    release();
                },
                onError: (e) => {
                    setErrors(e);
                    setBusy(false);
                },
            },
        );
    };

    const canCollect = can('customers.settle');

    return (
        <Modal
            open={!!order}
            onOpenChange={(o) => !o && onClose()}
            size="sm"
            title={`Release ${order.order_no}?`}
            description={`${order.customer} still owes ${peso(order.balance)} on this job.`}
            footer={
                <>
                    <Button variant="ghost" onClick={release} loading={busy} className="mr-auto">
                        Release, keep balance on account
                    </Button>
                    {canCollect && (
                        <Button variant="primary" onClick={collectAndRelease} loading={busy} disabled={!(Number(amount) > 0)} data-autofocus>
                            Collect and release
                        </Button>
                    )}
                </>
            }
        >
            {canCollect ? (
                <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-1">
                        {['cash', 'gcash', 'bank'].map((m) => (
                            <button
                                key={m}
                                type="button"
                                aria-pressed={method === m}
                                onClick={() => setMethod(m)}
                                className={cn('h-10 rounded-xs border text-base', method === m ? 'border-fg bg-raised text-fg' : 'border-line text-muted hover:text-fg')}
                            >
                                {METHOD_LABEL[m]}
                            </button>
                        ))}
                    </div>
                    <Field label="Amount received" error={errors.amount}>
                        {(id, d) => <MoneyInput id={id} aria-describedby={d} inputSize="lg" value={amount} onChange={(e) => setAmount(e.target.value)} />}
                    </Field>
                    {method !== 'cash' && (
                        <Field label="Reference no." error={errors.reference}>
                            {(id, d) => <Input id={id} aria-describedby={d} className="font-mono" value={reference} onChange={(e) => setReference(e.target.value)} />}
                        </Field>
                    )}
                    <p className="text-xs text-faint">{method === 'cash' ? 'Cash goes into your open drawer.' : 'Recorded against the order, not the drawer.'}</p>
                </div>
            ) : (
                <>
                    <p className="text-base text-muted">Your account can't take payments. Ask the cashier to collect first, or release it and the balance stays on the customer's account.</p>
                    <ErrorText>{errors.amount}</ErrorText>
                </>
            )}
        </Modal>
    );
}
