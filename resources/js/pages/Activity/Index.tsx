import { Head } from '@inertiajs/react';
import { useState } from 'react';
import { ListPage, ToolbarSearch } from '@/components/list-page';
import { adminTabs } from '@/components/module-tabs';
import { Chip } from '@/components/ui/chip';
import { Input, Select } from '@/components/ui/field';
import { EmptyState, Pagination } from '@/components/ui/misc';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { useFilters } from '@/hooks/use-filters';
import { dateTime } from '@/lib/format';
import type { Option, Paginated } from '@/types';

interface Row {
    id: number;
    log: string;
    description: string;
    event: string | null;
    subject: string | null;
    causer: string;
    branch: string | null;
    properties: Record<string, unknown> | null;
    at: string;
}

export default function ActivityIndex({
    activities,
    filters: initial,
    users,
    logs,
    branches,
}: {
    activities: Paginated<Row>;
    filters: Record<string, string | undefined>;
    users: Option[];
    logs: string[];
    branches: Option[];
}) {
    const { filters, set } = useFilters(route('activity.index'), { user: initial.user ?? '', log: initial.log ?? '', q: initial.q ?? '', date: initial.date ?? '', branch: initial.branch ?? '' });
    const showBranch = branches.length > 1;
    const [expanded, setExpanded] = useState<number | null>(null);

    return (
        <>
            <Head title="Activity log" />
            <ListPage
                title="Staff and access"
                description="Who did what, and when. Click a row to see exactly what changed."
                tabs={adminTabs('activity')}
                footer={activities.data.length > 0 && <Pagination links={activities.links} from={activities.from} to={activities.to} total={activities.total} />}
                toolbar={
                    <>
                        <ToolbarSearch value={filters.q ?? ''} onChange={(v) => set('q', v)} placeholder="Search what happened" />
                        <Select selectSize="sm" className="w-44" value={filters.user} onChange={(e) => set('user', e.target.value)} aria-label="Person">
                            <option value="">Everyone</option>
                            {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name}
                                </option>
                            ))}
                        </Select>
                        <Select selectSize="sm" className="w-40" value={filters.log} onChange={(e) => set('log', e.target.value)} aria-label="Area">
                            <option value="">All areas</option>
                            {logs.map((l) => (
                                <option key={l} value={l}>
                                    {l === 'default' ? 'records' : l.replace('_', ' ')}
                                </option>
                            ))}
                        </Select>
                        {showBranch && (
                            <Select selectSize="sm" className="w-40" value={filters.branch} onChange={(e) => set('branch', e.target.value)} aria-label="Branch">
                                <option value="">All branches</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.name}
                                    </option>
                                ))}
                            </Select>
                        )}
                        <Input type="date" inputSize="sm" className="w-40" value={filters.date} onChange={(e) => set('date', e.target.value)} aria-label="Date" />
                    </>
                }
            >
                {activities.data.length ? (
                    <Table flush minWidth={820}>
                        <THead>
                            <tr>
                                <Th>When</Th>
                                <Th>Who</Th>
                                {showBranch && <Th>Branch</Th>}
                                <Th>Area</Th>
                                <Th>What happened</Th>
                                <Th>Record</Th>
                            </tr>
                        </THead>
                        <tbody>
                            {activities.data.map((a) => (
                                <Tr key={a.id} interactive={!!a.properties} onClick={() => a.properties && setExpanded(expanded === a.id ? null : a.id)}>
                                    <Td muted className="text-sm whitespace-nowrap align-top">
                                        {dateTime(a.at)}
                                    </Td>
                                    <Td className="align-top whitespace-nowrap">{a.causer}</Td>
                                    {showBranch && <Td muted className="align-top text-sm whitespace-nowrap">{a.branch ?? '—'}</Td>}
                                    <Td className="align-top">
                                        <Chip tone="outline">{a.log === 'default' ? 'records' : a.log.replace('_', ' ')}</Chip>
                                    </Td>
                                    <Td className="align-top">
                                        {a.description}
                                        {expanded === a.id && a.properties && (
                                            <pre className="mt-2 max-w-xl overflow-x-auto border border-line bg-sunken p-2 font-mono text-xs text-muted">
                                                {JSON.stringify(a.properties, null, 2)}
                                            </pre>
                                        )}
                                    </Td>
                                    <Td muted className="text-sm align-top">
                                        {a.subject}
                                    </Td>
                                </Tr>
                            ))}
                        </tbody>
                    </Table>
                ) : (
                    <EmptyState className="h-full" title="Nothing recorded for these filters" body="Try another date or clear the person filter." />
                )}
            </ListPage>
        </>
    );
}
