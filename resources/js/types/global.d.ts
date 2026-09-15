import type { PageProps as AppPageProps } from '@/types';

type RouteParam = string | number | boolean | null | undefined;
type RouteParams = RouteParam | RouteParam[] | Record<string, RouteParam | RouteParam[]>;

interface ZiggyRouter {
    current(name?: string, params?: RouteParams): boolean;
    has(name: string): boolean;
    params: Record<string, string>;
}

declare global {
    /** Ziggy's route() helper, injected by the @routes Blade directive. */
    function route(): ZiggyRouter;
    function route(name: string, params?: RouteParams, absolute?: boolean): string;
}

declare module '@inertiajs/core' {
    interface PageProps extends AppPageProps {}
}

export {};
