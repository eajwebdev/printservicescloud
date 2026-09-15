import { Head, router } from '@inertiajs/react';
import { Phone, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { CustomerPeek } from '@/components/customers/customer-peek';
import { ListPage, SummaryStrip, ToolbarSearch } from '@/components/list-page';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Select } from '@/components/ui/field';
import { ChipGroup } from '@/components/ui/filter-chip';
import { EmptyState, Pagination } from '@/components/ui/misc';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { useFilters } from '@/hooks/use-filters';
import { date, peso } from '@/lib/format';
import { useCan } from '@/lib/utils';
import type { Paginated } from '@/types';
import { CustomerDrawer, type CustomerFormValue } from './form';

interface Row extends CustomerFormValue {
    id: number;
    credit_balance: number;
    orders_count: number;
    lifetime_value: number;
    last_order_at: string | null;
}

interface Props {
    customers: Paginated<Row>;
    filters: Record<string, string | undefined>;
    totalOwed: number;
    counts: { all: number; owing: number; senior: number };
}

export default function CustomersIndex({ customers, filters: initial, totalOwed, counts }: Props) {
    const can = useCan();
    const [editing, setEditing] = useState<CustomerFormValue | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [peek, setPeek] = useState<number | null>(null);
    const { filters, set, setFilters } = useFilters(route('customers.index'), { q: initial.q ?? '', owing: initial.owing ?? '', senior: initial.senior ?? '', sort: initial.sort ?? '' });
    const quick = filters.owing ? 'owing' : filters.senior ? 'senior' : '';

    return (
        <>
            <Head title="Customers" />
            <ListPage
                title="Customers"
                description="Click a customer to call them, start a sale for them, or collect what they owe."
                actions={
                    can('customers.create') && (
                        <Button
                            variant="primary"
                            icon={<UserPlus />}
                            onClick={() => {
                                setEditing(null);
                                setDrawerOpen(true);
                            }}
                        >
                            New customer
                        </Button>
                    )
                }
                toolbar={
                    <>
                        <ToolbarSearch autoFocus value={filters.q ?? ''} onChange={(v) => set('q', v)} placeholder="Name, business or phone" />
                        <ChipGroup
                            label="Quick filters"
                            value={quick as 'owing' | 'senior' | ''}
                            onChange={(v) => setFilters((f) => ({ ...f, owing: v === 'owing' ? '1' : '', senior: v === 'senior' ? '1' : '' }))}
                            options={[
                                { value: 'owing', label: 'Owes money', count: counts.owing, tone: 'warn' },
                                { value: 'senior', label: 'Senior/PWD', count: counts.senior },
                            ]}
                        />
                        <Select selectSize="sm" className="ml-auto w-48" aria-label="Sort" value={filters.sort} onChange={(e) => set('sort', e.target.value)}>
                            <option value="">Sort: name A to Z</option>
                            <option value="balance">Sort: biggest balance</option>
                            <option value="recent">Sort: ordered most recently</option>
                        </Select>
                    </>
                }
                summary={
                    <SummaryStrip
                        items={[
                            { label: 'Customers', value: counts.all },
                            { label: 'With a balance', value: counts.owing, tone: counts.owing ? 'warn' : undefined },
                            { label: 'Total owed to the shop', value: peso(totalOwed), tone: totalOwed ? 'warn' : undefined },
                        ]}
                    />
                }
                footer={customers.data.length > 0 && <Pagination links={customers.links} from={customers.from} to={customers.to} total={customers.total} />}
            >
                {customers.data.length ? (
                    <Table flush minWidth={760}>
                        <THead>
                            <tr>
                                <Th>Customer</Th>
                                <Th>Phone</Th>
                                <Th align="right">Orders</Th>
                                <Th>Last order</Th>
                                <Th align="right">Lifetime</Th>
                                <Th align="right">Owes</Th>
                            </tr>
                        </THead>
                        <tbody>
                            {customers.data.map((c) => (
                                <Tr key={c.id} interactive selected={peek === c.id} onClick={() => setPeek(c.id)}>
                                    <Td>
                                        <span className="flex items-center gap-2">
                                            <span className="text-base">{c.name}</span>
                                            {c.is_senior_pwd && <Chip tone="info">Senior/PWD</Chip>}
                                        </span>
                                        {c.business_name && <span className="block text-sm text-faint">{c.business_name}</span>}
                                    </Td>
                                    <Td className="whitespace-nowrap">
                                        {c.phone ? (
                                            <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} onClick={(e) => e.stopPropagation()} className="num inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
                                                <Phone className="size-3.5" />
                                                {c.phone}
                                            </a>
                                        ) : (
                                            <span className="text-sm text-ghost">None</span>
                                        )}
                                    </Td>
                                    <Td numeric>{c.orders_count}</Td>
                                    <Td muted className="text-sm whitespace-nowrap">{c.last_order_at ? date(c.last_order_at) : 'Never'}</Td>
                                    <Td numeric muted>{peso(c.lifetime_value)}</Td>
                                    <Td numeric className={c.credit_balance > 0 ? 'text-warn-text' : 'text-faint'}>
                                        {c.credit_balance > 0 ? peso(c.credit_balance) : 'Nothing'}
                                    </Td>
                                </Tr>
                            ))}
                        </tbody>
                    </Table>
                ) : (
                    <EmptyState
                        className="h-full"
                        title={filters.q || quick ? 'No customer matches' : 'No customers yet'}
                        body={filters.q || quick ? 'Try part of the name or the last digits of the phone.' : 'Add regulars so job orders, credit and pickup texts have a name and number.'}
                        action={
                            filters.q || quick ? (
                                <button type="button" className="text-sm text-fg underline" onClick={() => setFilters({ q: '', owing: '', senior: '', sort: '' })}>
                                    Clear filters
                                </button>
                            ) : (
                                can('customers.create') && (
                                    <Button variant="primary" onClick={() => setDrawerOpen(true)}>
                                        Add a customer
                                    </Button>
                                )
                            )
                        }
                    />
                )}
            </ListPage>

            <CustomerPeek
                customerId={peek}
                onClose={() => setPeek(null)}
                onChanged={() => router.reload({ only: ['customers', 'counts', 'totalOwed'] })}
                onEdit={(c) => {
                    setEditing(c);
                    setDrawerOpen(true);
                }}
            />
            <CustomerDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} customer={editing} />
        </>
    );
}
