import { Head, usePage } from '@inertiajs/react';
import type { PageProps } from '@/types';

const COPY: Record<number, { title: string; body: string }> = {
    403: { title: 'This page is not ticked for you', body: 'Your account can not open this part of the shop. Ask the owner to tick it on your user profile.' },
    404: { title: 'That page is not on the press', body: 'The link may be old, or the record was removed. Check the address or start from the dashboard.' },
    500: { title: 'Something jammed', body: 'The server hit an error. Your last action may not have saved. Try again, and tell the owner if it keeps happening.' },
    503: { title: 'Down for maintenance', body: 'The system is being updated. Check back in a few minutes.' },
};

/**
 * Stands on its own, without the app shell: a server error can happen before the shop,
 * branch and account details are loaded, and the error page must still render.
 */
export default function Status({ status, message }: { status: number; message?: string | null }) {
    // Any of these may be missing when the error happened early in the request.
    const props = usePage().props as Partial<PageProps>;
    const signedIn = !!props.auth;
    const copy = COPY[status] ?? COPY[500];

    return (
        <div className="halftone flex min-h-dvh flex-col items-center justify-center gap-8 bg-bg px-6 py-16">
            <Head title={copy.title} />
            <a href="/" aria-label={`${props.shop?.name ?? 'Home'} home`}>
                <img src={props.shop?.logo ?? '/skclogo.png'} alt={props.shop?.name ?? ''} className="h-16 w-auto object-contain" />
            </a>
            <div className="crop-marks max-w-lg bg-surface px-8 py-7">
                <span className="crop-b" />
                <p className="hud text-5xl font-semibold text-accent-text">{status}</p>
                <h1 className="mt-3 text-2xl font-semibold">{copy.title}</h1>
                <p className="mt-2 text-base text-muted">{status === 403 && message ? message : copy.body}</p>
                <div className="mt-6 flex flex-wrap gap-3">
                    {/* Plain links: a full page load recovers even when the app state is broken. */}
                    <a href={signedIn ? '/dashboard' : '/login'} className="inline-flex h-9 items-center rounded-xs bg-accent px-4 text-base font-medium text-white hover:bg-accent-hover">
                        {signedIn ? 'Back to dashboard' : 'Staff sign in'}
                    </a>
                    <a href="/" className="inline-flex h-9 items-center rounded-xs border border-line-strong px-4 text-base text-fg hover:border-muted">
                        Home page
                    </a>
                </div>
            </div>
        </div>
    );
}

Status.layout = null;
