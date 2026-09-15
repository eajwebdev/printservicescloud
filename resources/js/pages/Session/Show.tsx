import { Head } from '@inertiajs/react';
import { Printer } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { dateTime } from '@/lib/format';
import { MovementsPanel } from './Index';
import { SessionSummary, type SessionDetail } from './parts';

export default function SessionShow({ session }: { session: SessionDetail }) {
    return (
        <>
            <Head title={`Drawer #${session.id}`} />
            <PageHeader
                back={{ href: route('session.index'), label: 'Cash drawer' }}
                title={`Drawer #${session.id}, ${session.cashier}`}
                meta={session.status === 'open' ? <Chip tone="ok">Open</Chip> : <Chip>Closed</Chip>}
                description={`${dateTime(session.opened_at)}${session.closed_at ? ` to ${dateTime(session.closed_at)}` : ''}${session.closing_note ? `. Note: ${session.closing_note}` : ''}`}
                actions={
                    <a href={route('session.pdf', session.id)} target="_blank" rel="noreferrer">
                        <Button icon={<Printer />}>{session.status === 'open' ? 'Print X-read' : 'Print Z-read'}</Button>
                    </a>
                }
            />
            <div className="space-y-5 p-5 lg:p-6">
                <SessionSummary session={session} />
                <MovementsPanel session={session} />
            </div>
        </>
    );
}
