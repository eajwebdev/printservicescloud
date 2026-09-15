import { Head, router } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { Fragment } from 'react';
import { ListPage, ToolbarSearch } from '@/components/list-page';
import { catalogTabs } from '@/components/module-tabs';
import { ButtonLink } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ChipGroup, FilterChip } from '@/components/ui/filter-chip';
import { EmptyState } from '@/components/ui/misc';
import { Switch } from '@/components/ui/toggle';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { useFilters } from '@/hooks/use-filters';
import { money, peso, PRICING_LABEL } from '@/lib/format';
import { cn, useCan } from '@/lib/utils';

interface Row {
    id: number;
    name: string;
    code: string | null;
    category: string | null;
    pricing_model: string;
    base_price: number;
    min_charge: number;
    unit_label: string;
    active: boolean;
    is_job: boolean;
    options_count: number;
    materials_count: number;
    unit_cost: number;
    margin: number | null;
}

interface Props {
    services: Row[];
    filters: Record<string, string | undefined>;
    categories: { id: number; name: string; count: number }[];
    counts: { all: number; active: number; inactive: number };
}

export default function ServicesIndex({ services, filters: initial, categories, counts }: Props) {
    const can = useCan();
    const { filters, set, setFilters } = useFilters(route('services.index'), { q: initial.q ?? '', category: initial.category ?? '', status: initial.status ?? '' });
    const groups = services.reduce<Record<string, Row[]>>((acc, s) => {
        (acc[s.category ?? 'Other'] ??= []).push(s);
        return acc;
    }, {});
    const noRecipe = services.filter((s) => s.materials_count === 0 && s.active).length;

    return (
        <>
            <Head title="Services" />
            <ListPage
                title="Catalog and stock"
                description="What the shop produces and how each is priced. Click a service to edit its price, finishing and material recipe."
                tabs={catalogTabs('services')}
                actions={
                    can('services.create') && (
                        <ButtonLink href={route('services.create')} variant="primary" icon={<Plus />}>
                            New service
                        </ButtonLink>
                    )
                }
                toolbar={
                    <>
                        <ToolbarSearch autoFocus value={filters.q ?? ''} onChange={(v) => set('q', v)} placeholder="Search services" />
                        <ChipGroup
                            label="Status"
                            value={(filters.status ?? '') as 'active' | 'inactive' | ''}
                            onChange={(v) => set('status', v)}
                            options={[
                                { value: 'active', label: 'On the POS', count: counts.active },
                                { value: 'inactive', label: 'Switched off', count: counts.inactive },
                            ]}
                        />
                    </>
                }
                summary={
                    <div className="flex gap-1.5 overflow-x-auto border-b border-line bg-bg px-4 py-2 lg:px-6" role="group" aria-label="Categories">
                        <FilterChip active={!filters.category} onClick={() => set('category', '')} count={counts.all}>
                            All
                        </FilterChip>
                        {categories
                            .filter((c) => c.count > 0)
                            .map((c) => (
                                <FilterChip key={c.id} active={filters.category === String(c.id)} count={c.count} onClick={() => set('category', filters.category === String(c.id) ? '' : String(c.id))}>
                                    {c.name}
                                </FilterChip>
                            ))}
                    </div>
                }
                footer={
                    noRecipe > 0 && (
                        <p className="px-4 py-2 text-sm text-warn-text lg:px-6">
                            {noRecipe} active {noRecipe === 1 ? 'service has' : 'services have'} no material recipe, so selling them won't deduct inventory.
                        </p>
                    )
                }
            >
                {services.length ? (
                    <Table flush minWidth={820}>
                        <THead>
                            <tr>
                                <Th>Service</Th>
                                <Th>Pricing</Th>
                                <Th align="right">Price</Th>
                                <Th align="right">Margin</Th>
                                <Th>Setup</Th>
                                <Th align="right">On POS</Th>
                            </tr>
                        </THead>
                        <tbody>
                            {Object.entries(groups).map(([group, rows]) => (
                                <Fragment key={group}>
                                    <tr className="bg-bg">
                                        <td colSpan={6} className="border-b border-line px-5 py-1.5 text-sm font-medium text-muted">
                                            {group} <span className="num text-faint">{rows.length}</span>
                                        </td>
                                    </tr>
                                    {rows.map((s) => (
                                        <Tr key={s.id} interactive={can('services.edit')} className={cn(!s.active && 'opacity-55')} onClick={() => can('services.edit') && router.visit(route('services.edit', s.id))}>
                                            <Td>
                                                {s.name}
                                                {s.code && <span className="ml-2 font-mono text-xs text-faint">{s.code}</span>}
                                            </Td>
                                            <Td muted className="text-sm">{PRICING_LABEL[s.pricing_model]}</Td>
                                            <Td numeric>
                                                ₱{money(s.base_price)}
                                                <span className="text-faint"> / {s.pricing_model === 'per_sqft' ? 'sqft' : s.pricing_model === 'fixed' ? 'job' : s.unit_label}</span>
                                                {s.min_charge > 0 && <span className="block text-xs text-faint">min {peso(s.min_charge)}</span>}
                                            </Td>
                                            <Td numeric className={s.margin !== null && s.margin < 30 ? 'text-warn-text' : 'text-muted'}>
                                                {s.margin !== null && s.unit_cost ? `${s.margin}%` : ''}
                                            </Td>
                                            <Td>
                                                <span className="flex flex-wrap gap-1">
                                                    {s.is_job && <Chip>Job order</Chip>}
                                                    {s.materials_count > 0 ? <Chip tone="outline">{s.materials_count} materials</Chip> : <Chip tone="warn">No recipe</Chip>}
                                                    {s.options_count > 0 && <Chip tone="outline">{s.options_count} finishing</Chip>}
                                                </span>
                                            </Td>
                                            <Td align="right" onClick={(e) => e.stopPropagation()}>
                                                <span className="inline-flex">
                                                    <Switch checked={s.active} disabled={!can('services.edit')} onChange={() => router.patch(route('services.toggle', s.id), {}, { preserveScroll: true })} />
                                                </span>
                                            </Td>
                                        </Tr>
                                    ))}
                                </Fragment>
                            ))}
                        </tbody>
                    </Table>
                ) : (
                    <EmptyState
                        className="h-full"
                        title="No services match"
                        body="Clear the search or pick another category."
                        action={
                            <button type="button" className="text-sm text-fg underline" onClick={() => setFilters({ q: '', category: '', status: '' })}>
                                Clear filters
                            </button>
                        }
                    />
                )}
            </ListPage>
        </>
    );
}
