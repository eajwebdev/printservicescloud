import { Head, router, useForm } from '@inertiajs/react';
import { Paperclip, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ListPage, SummaryStrip, ToolbarSearch } from '@/components/list-page';
import { moneyTabs } from '@/components/module-tabs';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ConfirmDialog, Drawer } from '@/components/ui/dialog';
import { Field, Input, MoneyInput, Select, Textarea } from '@/components/ui/field';
import { EmptyState, Pagination } from '@/components/ui/misc';
import { ChipGroup, FilterChip } from '@/components/ui/filter-chip';
import { Segmented } from '@/components/ui/toggle';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { useFilters } from '@/hooks/use-filters';
import { date, peso, todayISO } from '@/lib/format';
import { useAppPage, useCan } from '@/lib/utils';
import type { Paginated } from '@/types';

interface Row {
    id: number;
    expense_date: string;
    category: string;
    amount: number;
    payee: string | null;
    notes: string | null;
    source: 'drawer' | 'petty' | 'bank';
    receipt_url: string | null;
    user: string | null;
    created_at: string;
}

interface Props {
    expenses: Paginated<Row>;
    filters: { from: string; to: string; category?: string; source?: string; q?: string };
    categories: Record<string, string>;
    totals: { all: number; by_category: Record<string, number>; by_source: Record<string, number> };
}

const SOURCE_LABEL = { drawer: 'Cash drawer', petty: 'Petty cash', bank: 'Bank' } as const;

export default function ExpensesIndex({ expenses, filters: initial, categories, totals }: Props) {
    const can = useCan();
    const { props } = useAppPage();
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Row | null>(null);
    const [deleting, setDeleting] = useState<Row | null>(null);
    const { filters, set, setFilters } = useFilters(route('expenses.index'), {
        from: initial.from,
        to: initial.to,
        category: initial.category ?? '',
        source: initial.source ?? '',
        q: initial.q ?? '',
    });

    const form = useForm<{ expense_date: string; category: string; amount: string; payee: string; notes: string; source: string; receipt: File | null }>({
        expense_date: todayISO(),
        category: 'supplies',
        amount: '',
        payee: '',
        notes: '',
        source: 'drawer',
        receipt: null,
    });

    useEffect(() => {
        if (!open) return;
        form.clearErrors();
        form.setData({
            expense_date: editing?.expense_date ?? todayISO(),
            category: editing?.category ?? 'supplies',
            amount: editing ? String(editing.amount) : '',
            payee: editing?.payee ?? '',
            notes: editing?.notes ?? '',
            source: editing?.source ?? (props.drawer?.open ? 'drawer' : 'petty'),
            receipt: null,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, editing]);

    const submit = () => {
        const opts = { preserveScroll: true, forceFormData: true, onSuccess: () => setOpen(false) };
        if (editing) {
            form.transform((d) => ({ ...d, _method: 'put' }));
            form.post(route('expenses.update', editing.id), opts);
        } else {
            form.transform((d) => d);
            form.post(route('expenses.store'), opts);
        }
    };

    const ranges = (() => {
        const t = new Date();
        const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return [
            { label: 'Today', from: iso(t), to: iso(t) },
            { label: 'Last 7 days', from: iso(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 6)), to: iso(t) },
            { label: 'This month', from: iso(new Date(t.getFullYear(), t.getMonth(), 1)), to: iso(t) },
            { label: 'Last month', from: iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), to: iso(new Date(t.getFullYear(), t.getMonth(), 0)) },
        ];
    })();
    const topCategories = Object.entries(totals.by_category).sort((a, b) => b[1] - a[1]);

    return (
        <>
            <Head title="Expenses" />
            <ListPage
                title="Money out"
                description="Rent, CENECO, wages and the small buys. Cash from the drawer or petty cash is taken out of there automatically."
                tabs={moneyTabs('expenses')}
                actions={
                    can('expenses.create') && (
                        <Button
                            variant="primary"
                            icon={<Plus />}
                            onClick={() => {
                                setEditing(null);
                                setOpen(true);
                            }}
                        >
                            Record expense
                        </Button>
                    )
                }
                toolbar={
                    <>
                        <ToolbarSearch value={filters.q ?? ''} onChange={(v) => set('q', v)} placeholder="Payee or note" />
                        <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label="Date range">
                            {ranges.map((r) => (
                                <FilterChip
                                    key={r.label}
                                    active={filters.from === r.from && filters.to === r.to}
                                    onClick={() => setFilters((f) => ({ ...f, from: r.from, to: r.to }))}
                                >
                                    {r.label}
                                </FilterChip>
                            ))}
                        </div>
                        <span className="flex items-center gap-1.5">
                            <Input type="date" inputSize="sm" className="w-36" value={filters.from} onChange={(e) => set('from', e.target.value)} aria-label="From" />
                            <span className="text-faint">to</span>
                            <Input type="date" inputSize="sm" className="w-36" value={filters.to} onChange={(e) => set('to', e.target.value)} aria-label="To" />
                        </span>
                        <Select selectSize="sm" className="w-44" value={filters.category} onChange={(e) => set('category', e.target.value)} aria-label="Category">
                            <option value="">All categories</option>
                            {Object.entries(categories).map(([k, v]) => (
                                <option key={k} value={k}>
                                    {v}
                                </option>
                            ))}
                        </Select>
                        <ChipGroup
                            label="Paid from"
                            value={(filters.source ?? '') as 'drawer' | 'petty' | 'bank' | ''}
                            onChange={(v) => set('source', v)}
                            options={(['drawer', 'petty', 'bank'] as const).map((k) => ({ value: k, label: SOURCE_LABEL[k] }))}
                        />
                    </>
                }
                summary={
                    <>
                        <SummaryStrip
                            items={[
                                { label: `Total, ${date(filters.from)} to ${date(filters.to)}`, value: peso(totals.all) },
                                ...(['drawer', 'petty', 'bank'] as const).map((k) => ({ label: `From ${SOURCE_LABEL[k].toLowerCase()}`, value: peso(totals.by_source[k] ?? 0) })),
                            ]}
                        />
                        {topCategories.length > 0 && (
                            <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-line bg-bg px-4 py-2 text-sm lg:px-6">
                                {topCategories.map(([k, v]) => (
                                    <button
                                        key={k}
                                        type="button"
                                        onClick={() => set('category', filters.category === k ? '' : k)}
                                        className={filters.category === k ? 'text-fg underline' : 'text-muted hover:text-fg'}
                                    >
                                        {categories[k]} <span className="num text-faint">{peso(v)}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                }
                footer={expenses.data.length > 0 && <Pagination links={expenses.links} from={expenses.from} to={expenses.to} total={expenses.total} />}
            >
                {expenses.data.length ? (
                    <Table flush minWidth={860}>
                        <THead>
                            <tr>
                                <Th>Date</Th>
                                <Th>Category</Th>
                                <Th>Payee</Th>
                                <Th>Paid from</Th>
                                <Th>Recorded by</Th>
                                <Th align="right">Amount</Th>
                                <Th />
                            </tr>
                        </THead>
                        <tbody>
                            {expenses.data.map((e) => (
                                <Tr
                                    key={e.id}
                                    interactive={can('expenses.edit')}
                                    onClick={() => {
                                        if (!can('expenses.edit')) return;
                                        setEditing(e);
                                        setOpen(true);
                                    }}
                                >
                                    <Td muted className="text-sm whitespace-nowrap">
                                        {date(e.expense_date)}
                                    </Td>
                                    <Td>{categories[e.category]}</Td>
                                    <Td>
                                        {e.payee}
                                        {e.notes && <p className="max-w-72 truncate text-xs text-faint">{e.notes}</p>}
                                    </Td>
                                    <Td>
                                        <Chip tone="outline">{SOURCE_LABEL[e.source]}</Chip>
                                    </Td>
                                    <Td muted className="text-sm">
                                        {e.user}
                                    </Td>
                                    <Td numeric>{peso(e.amount)}</Td>
                                    <Td align="right" onClick={(ev) => ev.stopPropagation()}>
                                        <span className="flex items-center justify-end gap-1">
                                            {e.receipt_url && (
                                                <a
                                                    href={e.receipt_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="grid size-7 place-items-center text-muted hover:text-fg"
                                                    aria-label="View receipt"
                                                >
                                                    <Paperclip className="size-3.5" />
                                                </a>
                                            )}
                                            {can('expenses.edit') && (
                                                <Button
                                                    size="xs"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        setEditing(e);
                                                        setOpen(true);
                                                    }}
                                                >
                                                    Edit
                                                </Button>
                                            )}
                                            {can('expenses.delete') && (
                                                <Button size="xs" variant="ghost" onClick={() => setDeleting(e)}>
                                                    Delete
                                                </Button>
                                            )}
                                        </span>
                                    </Td>
                                </Tr>
                            ))}
                        </tbody>
                    </Table>
                ) : (
                    <EmptyState className="h-full" title="No expenses in this range" body="Pick a wider date range, or record the first one: rent, electricity, a rider fee." />
                )}
            </ListPage>

            <Drawer
                open={open}
                onOpenChange={setOpen}
                title={editing ? 'Edit expense' : 'Record an expense'}
                description={editing ? 'Amount and source are locked once recorded so the drawer and petty cash still reconcile. Delete and re-enter to change them.' : undefined}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" loading={form.processing} onClick={submit}>
                            {editing ? 'Save expense' : 'Record expense'}
                        </Button>
                    </>
                }
            >
                <form
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        submit();
                    }}
                >
                    <Field label="Paid from" error={form.errors.source}>
                        {() => (
                            <Segmented
                                label="Paid from"
                                className="w-full"
                                value={form.data.source}
                                onChange={(v) => !editing && form.setData('source', v)}
                                options={Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }))}
                            />
                        )}
                    </Field>
                    {form.data.source === 'drawer' && !editing && !props.drawer?.open && (
                        <p className="text-sm text-warn-text">Your drawer is closed. Open it first, or pay from petty cash or bank.</p>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Amount" error={form.errors.amount}>
                            {(id, d) => (
                                <MoneyInput
                                    id={id}
                                    aria-describedby={d}
                                    inputSize="lg"
                                    autoFocus
                                    disabled={!!editing}
                                    value={form.data.amount}
                                    onChange={(e) => form.setData('amount', e.target.value)}
                                />
                            )}
                        </Field>
                        <Field label="Date" error={form.errors.expense_date}>
                            {(id, d) => (
                                <Input
                                    id={id}
                                    aria-describedby={d}
                                    type="date"
                                    inputSize="lg"
                                    max={todayISO()}
                                    value={form.data.expense_date}
                                    onChange={(e) => form.setData('expense_date', e.target.value)}
                                />
                            )}
                        </Field>
                    </div>
                    <Field label="Category" error={form.errors.category}>
                        {(id) => (
                            <Select id={id} value={form.data.category} onChange={(e) => form.setData('category', e.target.value)}>
                                {Object.entries(categories).map(([k, v]) => (
                                    <option key={k} value={k}>
                                        {v}
                                    </option>
                                ))}
                            </Select>
                        )}
                    </Field>
                    <Field label="Paid to" error={form.errors.payee}>
                        {(id, d) => (
                            <Input
                                id={id}
                                aria-describedby={d}
                                placeholder="e.g. CENECO, tricycle driver"
                                value={form.data.payee}
                                onChange={(e) => form.setData('payee', e.target.value)}
                            />
                        )}
                    </Field>
                    <Field label="Notes">{(id) => <Textarea id={id} value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} />}</Field>
                    <Field label="Receipt photo or PDF" hint="Optional, up to 5 MB" error={form.errors.receipt}>
                        {(id, d) => (
                            <input
                                id={id}
                                aria-describedby={d}
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={(e) => form.setData('receipt', e.target.files?.[0] ?? null)}
                                className="block w-full text-sm text-muted file:mr-3 file:h-8 file:rounded-xs file:border file:border-line-strong file:bg-raised file:px-3 file:text-fg"
                            />
                        )}
                    </Field>
                    <button type="submit" hidden />
                </form>
            </Drawer>

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(o) => !o && setDeleting(null)}
                title="Delete this expense?"
                body={
                    deleting
                        ? `${peso(deleting.amount)} goes back to ${SOURCE_LABEL[deleting.source].toLowerCase()}.${deleting.source === 'drawer' ? ' Only possible while that drawer is still open.' : ''}`
                        : ''
                }
                confirmLabel="Delete expense"
                onConfirm={() => deleting && router.delete(route('expenses.destroy', deleting.id), { preserveScroll: true, onFinish: () => setDeleting(null) })}
            />
        </>
    );
}
