import { Head, Link, usePage } from '@inertiajs/react';
import { ButtonLink } from '@/components/ui/button';
import type { PageProps } from '@/types';

const COPY: Record<number, { title: string; body: string }> = {
    403: { title: 'This page is not ticked for you', body: 'Your account can not open this part of the shop. Ask the owner to tick it on your user profile.' },
    404: { title: 'That page is not on the press', body: 'The link may be old, or the record was removed. Check the address or start from the dashboard.' },
    500: { title: 'Something jammed', body: 'The server hit an error. Your last action may not have saved. Try again, and tell the owner if it keeps happening.' },
    503: { title: 'Down for maintenance', body: 'The system is being updated. Check back in a few minutes.' },
};

export default function Status({ status, message }: { status: number; message?: string | null }) {
    const { auth } = usePage<PageProps>().props;
    const copy = COPY[status] ?? COPY[500];

    return (
        <div className="halftone flex min-h-[70vh] items-center justify-center px-6 py-16">
            <Head title={copy.title} />
            <div className="crop-marks max-w-lg bg-surface px-8 py-7">
                <span className="crop-b" />
                <p className="hud text-5xl font-semibold text-accent-text">{status}</p>
                <h1 className="mt-3 text-2xl font-semibold">{copy.title}</h1>
                <p className="mt-2 text-base text-muted">{status === 403 && message ? message : copy.body}</p>
                <div className="mt-6 flex gap-2">
                    {auth ? (
                        <ButtonLink href={route('dashboard')} variant="primary">
                            Back to dashboard
                        </ButtonLink>
                    ) : (
                        <Link href="/login" className="text-accent-text underline">
                            Sign in
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
