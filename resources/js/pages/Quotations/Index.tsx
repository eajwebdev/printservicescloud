import { Head, router } from '@inertiajs/react';
import { ArrowRightLeft, FileDown, FilePlus2 } from 'lucide-react';
import { ListPage, SummaryStrip, ToolbarSearch } from '@/components/list-page';
import { Button, ButtonLink, IconButton } from '@/components/ui/button';
import { Chip, type Tone } from '@/components/ui/chip';
import { ChipGroup } from '@/components/ui/filter-chip';
import { EmptyState, Pagination } from '@/components/ui/misc';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { useFilters } from '@/hooks/use-filters';
import { date, isPast, peso, relative } from '@/lib/format';
import { cn, useAppPage, useCan } from '@/lib/utils';
import type { Paginated } from '@/types';

export const QUOTE_TONE: Record<string, Tone> = { draft: 'outline', sent: 'info', accepted: 'ok', converted: 'neutral', expired: 'warn' };
export const QUOTE_LABEL: Record<string, string> = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', converted: 'Became an order', expired: 'Expired' };

interface Row {
    id: number;
    quote_no: string;
    customer: string;
    status: string;
    total: number;
    valid_until: string | null;
    created_at: string;
    order_id: number | null;
}

interface Props {
    quotations: Paginated<Row>;
    filters: Record<string, string | undefined>;
    counts: { draft: number; sent: number; accepted: number; converted: number; expired: number };
}

type StatusKey = keyof Props['counts'];

export default function QuotationsIndex({ quotations, filters: initial, counts }: Props) {
    const can = useCan();
    const { props } = useAppPage();
    const { filters, set, setFilters } = useFilters(route('quotations.index'), { q: initial.q ?? '', status: initial.status ?? '' });
    const openCount = counts.draft + counts.sent + counts.accepted;
    const canConvert = props.auth?.pages.includes('pos');

    return (
        <>
            <Head title="Quotations" />
            <ListPage
                title="Quotations"
                description="Price a job before the customer commits. Convert an accepted quote straight into an order."
                actions={
                    can('quotations.create') && (
                        <ButtonLink href={route('quotations.create')} variant="primary" icon={<FilePlus2 />}>
                            New quotation
                        </ButtonLink>
                    )
                }
                toolbar={
                    <>
                        <ToolbarSearch autoFocus value={filters.q ?? ''} onChange={(v) => set('q', v)} placeholder="Quote no. or customer" />
                        <ChipGroup
                            label="Status"
                            value={(filters.status ?? '') as StatusKey | ''}
                            onChange={(v) => set('status', v)}
                            options={[
                                { value: 'draft', label: 'Draft', count: counts.draft },
                                { value: 'sent', label: 'Waiting on customer', count: counts.sent },
                                { value: 'accepted', label: 'Accepted, not converted', count: counts.accepted, tone: 'warn' },
                                { value: 'expired', label: 'Expired', count: counts.expired },
                                { value: 'converted', label: 'Became orders', count: counts.converted },
                            ]}
                        />
                    </>
                }
                summary={
                    <SummaryStrip
                        items={[
                            { label: 'Open quotes', value: openCount },
                            { label: 'Accepted, ready to convert', value: counts.accepted, tone: counts.accepted ? 'warn' : undefined },
                            { label: 'Won so far', value: counts.converted, tone: 'ok' },
                        ]}
                    />
                }
                footer={quotations.data.length > 0 && <Pagination links={quotations.links} from={quotations.from} to={quotations.to} total={quotations.total} />}
            >
                {quotations.data.length ? (
                    <Table flush minWidth={760}>
                        <THead>
                            <tr>
                                <Th>Quote</Th>
                                <Th>Customer</Th>
                                <Th>Valid until</Th>
                                <Th>Status</Th>
                                <Th align="right">Total</Th>
                                <Th align="right">Actions</Th>
                            </tr>
                        </THead>
                        <tbody>
                            {quotations.data.map((q) => {
                                const open = !['converted', 'expired'].includes(q.status);
                                const soon = q.valid_until && open && !isPast(q.valid_until) && new Date(q.valid_until).getTime() - Date.now() < 3 * 86400000;
                                return (
                                    <Tr key={q.id} interactive onClick={() => router.visit(route('quotations.show', q.id))}>
                                        <Td className="whitespace-nowrap">
                                            <span className="block font-mono text-sm">{q.quote_no}</span>
                                            <span className="block text-xs text-faint">{date(q.created_at)}</span>
                                        </Td>
                                        <Td>{q.customer}</Td>
                                        <Td className={cn('text-sm whitespace-nowrap', soon ? 'text-warn-text' : 'text-muted')}>
                                            {q.valid_until ? date(q.valid_until) : 'No date'}
                                            {soon && <span className="block text-xs">expires {relative(q.valid_until)}</span>}
                                        </Td>
                                        <Td>
                                            <Chip tone={QUOTE_TONE[q.status]}>{QUOTE_LABEL[q.status]}</Chip>
                                        </Td>
                                        <Td numeric>{peso(q.total)}</Td>
                                        <Td align="right" onClick={(e) => e.stopPropagation()}>
                                            <span className="flex justify-end gap-1">
                                                <a href={route('quotations.pdf', q.id)} target="_blank" rel="noreferrer">
                                                    <IconButton label={`PDF of ${q.quote_no}`} size="xs" variant="quiet">
                                                        <FileDown />
                                                    </IconButton>
                                                </a>
                                                {q.status === 'converted' && q.order_id ? (
                                                    <ButtonLink size="xs" variant="ghost" href={route('orders.show', q.order_id)}>
                                                        See order
                                                    </ButtonLink>
                                                ) : (
                                                    canConvert &&
                                                    q.status !== 'expired' && (
                                                        <Button size="xs" variant={q.status === 'accepted' ? 'primary' : 'secondary'} icon={<ArrowRightLeft />} onClick={() => router.post(route('quotations.convert', q.id))}>
                                                            Convert
                                                        </Button>
                                                    )
                                                )}
                                            </span>
                                        </Td>
                                    </Tr>
                                );
                            })}
                        </tbody>
                    </Table>
                ) : (
                    <EmptyState
                        className="h-full"
                        title={filters.q || filters.status ? 'No quotations match' : 'No quotations yet'}
                        body={filters.q || filters.status ? 'Clear the filter to see every quote.' : 'Barangay fiesta tarps, school IDs, business signage: quote them first, then convert in one click.'}
                        action={
                            filters.q || filters.status ? (
                                <button type="button" className="text-sm text-fg underline" onClick={() => setFilters({ q: '', status: '' })}>
                                    Clear filters
                                </button>
                            ) : (
                                can('quotations.create') && (
                                    <ButtonLink href={route('quotations.create')} variant="primary">
                                        Write a quotation
                                    </ButtonLink>
                                )
                            )
                        }
                    />
                )}
            </ListPage>
        </>
    );
}
