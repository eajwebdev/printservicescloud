import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource-variable/space-grotesk';
import '../css/app.css';

import { createInertiaApp, router } from '@inertiajs/react';
import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import AppLayout from '@/layouts/app-layout';

type PageModule = { default: { layout?: ((page: ReactNode) => ReactNode) | null } };

// The system name and color come from Platform > Branding & website (printed into app.blade.php).
declare global {
    interface Window {
        __brand?: { name: string; color: string };
    }
}
let brandName = window.__brand?.name ?? 'SKC Custom Print';
router.on('success', (event) => {
    const shop = (event.detail.page.props as { shop?: { name?: string } }).shop;
    if (shop?.name) brandName = shop.name;
});

createInertiaApp({
    title: (title) => (title ? `${title} | ${brandName}` : brandName),
    resolve: (name) => {
        const pages = import.meta.glob<PageModule>('./pages/**/*.tsx', { eager: false });
        const importer = pages[`./pages/${name}.tsx`];
        if (!importer) throw new Error(`Page not found: ${name}`);
        return importer().then((module) => {
            // Persistent shell for every page except the ones that opt out with `layout = null`.
            if (module.default.layout === undefined) {
                module.default.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
            }
            return module;
        });
    },
    setup({ el, App, props }) {
        createRoot(el).render(
            <MotionConfig reducedMotion="user">
                <App {...props} />
            </MotionConfig>,
        );
    },
    progress: { color: window.__brand?.color ?? '#E4141B', delay: 300, showSpinner: false },
});
