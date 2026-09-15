import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource-variable/space-grotesk';
import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import AppLayout from '@/layouts/app-layout';

type PageModule = { default: { layout?: ((page: ReactNode) => ReactNode) | null } };

createInertiaApp({
    title: (title) => (title ? `${title} | SKC Custom Print` : 'SKC Custom Print'),
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
    progress: { color: '#E4141B', delay: 300, showSpinner: false },
});
