import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

function current(): Theme {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(() => (typeof document === 'undefined' ? 'dark' : current()));

    useEffect(() => {
        const obs = new MutationObserver(() => setTheme(current()));
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        return () => obs.disconnect();
    }, []);

    const apply = useCallback((t: Theme) => {
        document.documentElement.setAttribute('data-theme', t);
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0C0E12' : '#F6F6F4');
        try {
            localStorage.setItem('pr-theme', t);
        } catch {
            /* storage blocked */
        }
    }, []);

    return { theme, setTheme: apply, toggle: () => apply(theme === 'dark' ? 'light' : 'dark') };
}
