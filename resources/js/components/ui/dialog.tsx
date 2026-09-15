import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Field, Textarea } from './field';

interface ModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: ReactNode;
    description?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

const spring = { type: 'spring', stiffness: 520, damping: 38, mass: 0.8 } as const;

export function Modal({ open, onOpenChange, title, description, children, footer, size = 'md', className }: ModalProps) {
    const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <AnimatePresence>
                {open && (
                    <DialogPrimitive.Portal forceMount>
                        <DialogPrimitive.Overlay asChild forceMount>
                            <motion.div
                                className="fixed inset-0 z-50 bg-[rgba(6,7,9,0.72)]"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                            />
                        </DialogPrimitive.Overlay>
                        <DialogPrimitive.Content
                            asChild
                            forceMount
                            onOpenAutoFocus={(e) => {
                                // Let a primary action claim focus (e.g. "Next customer") instead of the close button.
                                const root = e.currentTarget as HTMLElement | null;
                                const target =
                                    root?.querySelector<HTMLElement>('[data-autofocus]') ??
                                    root?.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled])');
                                if (target) {
                                    e.preventDefault();
                                    target.focus();
                                }
                            }}
                        >
                            <motion.div
                                className={cn(
                                    'fixed top-[8vh] left-1/2 z-50 flex max-h-[84vh] w-[calc(100vw-2rem)] flex-col rounded-md border border-line bg-raised shadow-[var(--shadow-float)]',
                                    width,
                                    className,
                                )}
                                initial={{ opacity: 0, x: '-50%', y: 12, scale: 0.985 }}
                                animate={{ opacity: 1, x: '-50%', y: 0, scale: 1 }}
                                exit={{ opacity: 0, x: '-50%', y: 8, scale: 0.99, transition: { duration: 0.12 } }}
                                transition={spring}
                            >
                                <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
                                    <div>
                                        <DialogPrimitive.Title className="font-display text-lg font-semibold text-fg">{title}</DialogPrimitive.Title>
                                        {description ? (
                                            <DialogPrimitive.Description className="mt-0.5 text-sm text-muted">{description}</DialogPrimitive.Description>
                                        ) : (
                                            <DialogPrimitive.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</DialogPrimitive.Description>
                                        )}
                                    </div>
                                    <DialogPrimitive.Close className="-mr-1 grid size-8 place-items-center rounded-xs text-muted hover:bg-surface hover:text-fg" aria-label="Close">
                                        <X className="size-4" />
                                    </DialogPrimitive.Close>
                                </div>
                                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
                                {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface px-5 py-3">{footer}</div>}
                            </motion.div>
                        </DialogPrimitive.Content>
                    </DialogPrimitive.Portal>
                )}
            </AnimatePresence>
        </DialogPrimitive.Root>
    );
}

/** Right-edge sheet for create/edit forms so the table stays in view. */
export function Drawer({ open, onOpenChange, title, description, children, footer, size = 'md' }: ModalProps) {
    const width = { sm: 'sm:w-[380px]', md: 'sm:w-[460px]', lg: 'sm:w-[620px]', xl: 'sm:w-[820px]' }[size];
    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <AnimatePresence>
                {open && (
                    <DialogPrimitive.Portal forceMount>
                        <DialogPrimitive.Overlay asChild forceMount>
                            <motion.div className="fixed inset-0 z-50 bg-[rgba(6,7,9,0.6)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} />
                        </DialogPrimitive.Overlay>
                        <DialogPrimitive.Content asChild forceMount>
                            <motion.div
                                className={cn('fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-raised shadow-[var(--shadow-float)]', width)}
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%', transition: { duration: 0.16, ease: 'easeIn' } }}
                                transition={{ type: 'spring', stiffness: 420, damping: 42 }}
                            >
                                <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
                                    <div>
                                        <DialogPrimitive.Title className="font-display text-lg font-semibold">{title}</DialogPrimitive.Title>
                                        <DialogPrimitive.Description className={description ? 'mt-0.5 text-sm text-muted' : 'sr-only'}>
                                            {description ?? (typeof title === 'string' ? title : 'Panel')}
                                        </DialogPrimitive.Description>
                                    </div>
                                    <DialogPrimitive.Close className="-mr-1 grid size-8 place-items-center rounded-xs text-muted hover:bg-surface hover:text-fg" aria-label="Close">
                                        <X className="size-4" />
                                    </DialogPrimitive.Close>
                                </div>
                                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
                                {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-surface px-5 py-3">{footer}</div>}
                            </motion.div>
                        </DialogPrimitive.Content>
                    </DialogPrimitive.Portal>
                )}
            </AnimatePresence>
        </DialogPrimitive.Root>
    );
}

interface ConfirmProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    body: ReactNode;
    confirmLabel: string;
    onConfirm: (reason: string) => void;
    danger?: boolean;
    processing?: boolean;
    requireReason?: string;
    error?: string;
}

export function ConfirmDialog({ open, onOpenChange, title, body, confirmLabel, onConfirm, danger, processing, requireReason, error }: ConfirmProps) {
    const [reason, setReason] = useState('');
    return (
        <Modal
            open={open}
            onOpenChange={(o) => {
                if (!o) setReason('');
                onOpenChange(o);
            }}
            title={title}
            size="sm"
            footer={
                <>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Keep it
                    </Button>
                    <Button
                        variant="primary"
                        loading={processing}
                        disabled={!!requireReason && reason.trim().length < 3}
                        onClick={() => onConfirm(reason)}
                    >
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            <div className="space-y-4 text-base text-muted">
                <div>{body}</div>
                {requireReason && (
                    <Field label={requireReason} error={error}>
                        {(id, d) => <Textarea id={id} aria-describedby={d} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus className="min-h-16" />}
                    </Field>
                )}
            </div>
        </Modal>
    );
}
