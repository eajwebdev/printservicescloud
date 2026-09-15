import { usePage } from '@inertiajs/react';
import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import type { PageProps } from '@/types';

// Teach the merger our custom utilities so e.g. `text-2xs` never swallows `text-muted`.
const twMerge = extendTailwindMerge({
    extend: {
        classGroups: {
            'font-size': [{ text: ['2xs'] }],
        },
    },
});

/** Join classes; later ones win on conflicts, so a caller's `w-40` beats a component's `w-full`. */
export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}

export function useAppPage() {
    return usePage<PageProps>();
}

/** Permission check against the checkbox-driven access list shared by Laravel. */
export function useCan() {
    const { auth } = usePage<PageProps>().props;
    const set = new Set(auth?.permissions ?? []);
    return (permission: string) => !!auth?.user.is_owner || set.has(permission);
}

export function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join('');
}

export function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Remove empty values so filter query strings stay tidy. */
export function cleanQuery<T extends Record<string, unknown>>(q: T): Partial<T> {
    return Object.fromEntries(Object.entries(q).filter(([, v]) => v !== '' && v !== null && v !== undefined && v !== false)) as Partial<T>;
}
