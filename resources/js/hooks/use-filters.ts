import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { cleanQuery } from '@/lib/utils';

/**
 * Keeps filter state in the query string. Text fields debounce; selects apply at once.
 */
export function useFilters<T extends Record<string, string | undefined>>(url: string, initial: T, extra: Record<string, string> = {}) {
    const [filters, setFilters] = useState<T>(initial);
    const first = useRef(true);
    const timer = useRef<number | undefined>(undefined);

    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
            router.get(url, cleanQuery({ ...extra, ...filters }), { preserveState: true, preserveScroll: true, replace: true });
        }, 280);
        return () => window.clearTimeout(timer.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters]);

    const set = <K extends keyof T>(key: K, value: T[K]) => setFilters((f) => ({ ...f, [key]: value }));

    return { filters, set, setFilters };
}

export function useHotkey(combo: string, handler: (e: KeyboardEvent) => void, enabled = true) {
    const ref = useRef(handler);
    ref.current = handler;
    useEffect(() => {
        if (!enabled) return;
        const parts = combo.toLowerCase().split('+');
        const key = parts.pop();
        const wantMod = parts.includes('mod');
        const wantShift = parts.includes('shift');
        const wantAlt = parts.includes('alt');
        const onKey = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() !== key) return;
            if (wantMod !== (e.metaKey || e.ctrlKey)) return;
            if (wantShift !== e.shiftKey || wantAlt !== e.altKey) return;
            ref.current(e);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [combo, enabled]);
}
