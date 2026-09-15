import { router, usePage } from '@inertiajs/react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { PageProps } from '@/types';

interface Toast {
    id: number;
    tone: 'success' | 'error';
    message: string;
}

const ToastContext = createContext<(tone: Toast['tone'], message: string) => void>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const nextId = useRef(1);
    const { props } = usePage<PageProps>();

    const push = useCallback((tone: Toast['tone'], message: string) => {
        const id = nextId.current++;
        setToasts((t) => [...t.slice(-3), { id, tone, message }]);
        window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 7000 : 4200);
    }, []);

    // Flash messages from Laravel arrive on every Inertia response.
    useEffect(() => {
        if (props.flash?.success) push('success', props.flash.success);
        if (props.flash?.error) push('error', props.flash.error);
        return router.on('success', (event) => {
            const flash = (event.detail.page.props as unknown as PageProps).flash;
            if (flash?.success) push('success', flash.success);
            if (flash?.error) push('error', flash.error);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <ToastContext.Provider value={push}>
            {children}
            <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite" role="status">
                <AnimatePresence initial={false}>
                    {toasts.map((t) => (
                        <motion.div
                            key={t.id}
                            layout
                            initial={{ opacity: 0, y: 16, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 40, transition: { duration: 0.15 } }}
                            transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                            className="pointer-events-auto flex items-start gap-3 rounded-md border border-line bg-raised px-3.5 py-3 shadow-[var(--shadow-float)]"
                        >
                            <span className={t.tone === 'success' ? 'mt-0.5 text-ok-text' : 'mt-0.5 text-accent-text'}>
                                {t.tone === 'success' ? <CircleCheck className="size-4" /> : <CircleAlert className="size-4" />}
                            </span>
                            <p className="flex-1 text-base text-fg">{t.message}</p>
                            <button
                                type="button"
                                onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
                                className="-mr-1 grid size-6 place-items-center rounded-xs text-faint hover:text-fg"
                                aria-label="Dismiss"
                            >
                                <X className="size-3.5" />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}
