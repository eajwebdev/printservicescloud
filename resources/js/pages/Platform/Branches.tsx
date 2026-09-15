import { Head, router, useForm } from '@inertiajs/react';
import { Ban, CalendarClock, KeyRound, MoreHorizontal, PauseCircle, Pencil, PlayCircle, Plus, Receipt, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { ListPage, SummaryStrip, ToolbarSearch } from '@/components/list-page';
import { Button, IconButton } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ConfirmDialog, Drawer, Modal } from '@/components/ui/dialog';
import { Field, Input, MoneyInput, Select, Textarea } from '@/components/ui/field';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/menu';
import { EmptyState } from '@/components/ui/misc';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { Segmented, Switch } from '@/components/ui/toggle';
import { useFilters } from '@/hooks/use-filters';
import { date, peso, todayISO } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BillingState } from '@/types';
import { SUBSCRIPTION_TONE } from '@/lib/status';

type Row = BillingState & {
    id: number;
    name: string;
    code: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    active: boolean;
    monthly_fee: number | null;
    effective_fee: number;
    subscribed_on: string | null;
    billing_day: number | null;
    billing_notes: string | null;
    suspend_reason: string | null;
    grace_until_raw: string | null;
    users_count: number;
    sales_month: number;
    orders_month: number;
    paid_total: number;
};

interface Props {
    branches: Row[];
    filters: { q?: string; status?: string };
    summary: { branches: number; trial: number; active: number; suspended: number; locked: number; mrr: number; outstanding: number; overdue: number; collected_month: number };
    defaults: { monthly_fee: number; trial_days: number; lock_after: number; due_days: number };
    copyFrom: { id: number; name: string }[];
    freeAccess: boolean;
}

const addDays = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function PlatformBranches({ branches, filters: initial, summary, defaults, copyFrom, freeAccess }: Props) {
    const { filters, set } = useFilters(route('platform.branches.index'), { q: initial.q ?? '', status: initial.status ?? '' });
    const [editing, setEditing] = useState<Row | 'new' | null>(null);
    const [trial, setTrial] = useState<Row | null>(null);
    const [activate, setActivate] = useState<Row | null>(null);
    const [suspend, setSuspend] = useState<Row | null>(null);
    const [cancel, setCancel] = useState<Row | null>(null);
    const [keyDialog, setKeyDialog] = useState(false);

    return (
        <>
            <Head title="Branches & plans" />
            <ListPage
                title="Branches and subscriptions"
                description={`Every branch pays ${peso(defaults.monthly_fee)} a month unless you set its own price. Bills are due ${defaults.due_days} days after they are issued; ${defaults.lock_after} overdue bills lock the branch.`}
                actions={
                    <>
                        <Button
                            variant={freeAccess ? 'primary' : 'secondary'}
                            icon={<KeyRound />}
                            onClick={() => setKeyDialog(true)}
                            title={freeAccess ? 'Every branch has free access. Click to turn off.' : 'Give every branch access without a subscription'}
                        >
                            Master key: {freeAccess ? 'On' : 'Off'}
                        </Button>
                        <Button icon={<RefreshCw />} disabled={freeAccess} onClick={() => router.post(route('platform.billing.run'), {}, { preserveScroll: true })}>
                            Run billing now
                        </Button>
                        <Button variant="primary" icon={<Plus />} onClick={() => setEditing('new')}>
                            Add branch
                        </Button>
                    </>
                }
                toolbar={
                    <>
                        <ToolbarSearch value={filters.q ?? ''} onChange={(v) => set('q', v)} placeholder="Branch name or code" />
                        <Select selectSize="sm" className="w-44" value={filters.status} onChange={(e) => set('status', e.target.value)} aria-label="Status">
                            <option value="">Every branch</option>
                            <option value="trial">Free trial</option>
                            <option value="active">Subscribed</option>
                            <option value="overdue">With overdue bills</option>
                            <option value="locked">Locked</option>
                            <option value="suspended">Suspended</option>
                            <option value="cancelled">Cancelled</option>
                        </Select>
                    </>
                }
                summary={
                    <>
                    {freeAccess && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-selected px-4 py-2 text-sm lg:px-6">
                            <KeyRound className="size-4 text-accent-text" />
                            <span className="text-fg">Master key is on: every branch can use the system without a subscription. No bills are issued and no branch is locked.</span>
                            <button type="button" className="ml-auto font-medium text-fg underline underline-offset-2" onClick={() => setKeyDialog(true)}>
                                Turn off
                            </button>
                        </div>
                    )}
                    <SummaryStrip
                        items={[
                            { label: 'Monthly recurring', value: peso(summary.mrr), sub: `${summary.active} subscribed, ${summary.trial} on trial` },
                            { label: 'Collected this month', value: peso(summary.collected_month), tone: 'ok' },
                            { label: 'Unpaid bills', value: peso(summary.outstanding), sub: 'issued and not yet paid' },
                            { label: 'Overdue', value: peso(summary.overdue), tone: summary.overdue > 0 ? 'red' : undefined },
                            { label: 'Locked branches', value: String(summary.locked), sub: `${summary.suspended} suspended`, tone: summary.locked > 0 ? 'red' : undefined },
                        ]}
                    />
                    </>
                }
            >
                {branches.length ? (
                    <Table flush minWidth={1080}>
                        <THead>
                            <tr>
                                <Th>Branch</Th>
                                <Th>Plan</Th>
                                <Th align="right">Monthly fee</Th>
                                <Th>Next</Th>
                                <Th align="right">Due now</Th>
                                <Th align="right">Sales this month</Th>
                                <Th align="right">Staff</Th>
                                <Th />
                            </tr>
                        </THead>
                        <tbody>
                            {branches.map((b) => (
                                <Tr key={b.id} className={cn(!b.active && 'opacity-55', b.locked && 'bg-selected')}>
                                    <Td>
                                        <p className="flex items-center gap-2">
                                            <span className="font-medium">{b.name}</span>
                                            <span className="font-mono text-2xs text-faint">{b.code}</span>
                                        </p>
                                        <p className="max-w-64 truncate text-xs text-faint">{b.address}</p>
                                    </Td>
                                    <Td>
                                        <span className="flex flex-wrap gap-1">
                                            <Chip tone={SUBSCRIPTION_TONE[b.status]}>{b.status_label}</Chip>
                                            {b.locked && <Chip tone="red">Locked</Chip>}
                                            {!b.active && <Chip>Off</Chip>}
                                            {b.grace_until && <Chip tone="info">Grace to {date(b.grace_until)}</Chip>}
                                        </span>
                                        {b.suspend_reason && b.status === 'suspended' && <p className="mt-0.5 text-xs text-faint">{b.suspend_reason}</p>}
                                    </Td>
                                    <Td numeric>
                                        {peso(b.effective_fee)}
                                        {b.monthly_fee !== null && <span className="block text-2xs text-faint">custom price</span>}
                                    </Td>
                                    <Td className="text-sm whitespace-nowrap text-muted">
                                        {b.status === 'trial' ? (
                                            <>
                                                Trial ends {date(b.trial_ends_on)}
                                                <span className="block text-xs text-faint">{b.trial_days_left} days left</span>
                                            </>
                                        ) : b.next_bill_on ? (
                                            <>
                                                Bill on {date(b.next_bill_on)}
                                                {b.subscribed_on && <span className="block text-xs text-faint">since {date(b.subscribed_on)}</span>}
                                            </>
                                        ) : (
                                            '—'
                                        )}
                                    </Td>
                                    <Td numeric className={b.overdue_count ? 'text-accent-text' : b.due_total ? 'text-warn-text' : 'text-faint'}>
                                        {b.due_total ? peso(b.due_total) : 'Paid up'}
                                        {b.overdue_count > 0 && <span className="block text-2xs">{b.overdue_count} overdue</span>}
                                    </Td>
                                    <Td numeric muted>
                                        {peso(b.sales_month)}
                                        <span className="block text-2xs text-faint">{b.orders_month} orders</span>
                                    </Td>
                                    <Td numeric muted>{b.users_count}</Td>
                                    <Td align="right">
                                        <Menu trigger={<IconButton label={`Actions for ${b.name}`}><MoreHorizontal /></IconButton>}>
                                            <MenuLabel>{b.name}</MenuLabel>
                                            <MenuItem icon={<Pencil />} onSelect={() => setEditing(b)}>Edit branch and price</MenuItem>
                                            <MenuSeparator />
                                            <MenuItem icon={<CalendarClock />} onSelect={() => setTrial(b)}>{b.status === 'trial' ? 'Extend free trial' : 'Give a free trial'}</MenuItem>
                                            <MenuItem icon={<PlayCircle />} onSelect={() => setActivate(b)}>{b.status === 'active' ? 'Restart billing from a date' : 'Start paid subscription'}</MenuItem>
                                            {(b.status === 'active' || b.status === 'suspended') && (
                                                <MenuItem icon={<Receipt />} onSelect={() => router.post(route('platform.branches.bill', b.id), {}, { preserveScroll: true })}>
                                                    Issue next bill now
                                                </MenuItem>
                                            )}
                                            <MenuItem icon={<Receipt />} onSelect={() => router.get(route('platform.invoices.index', { branch: b.id }))}>See bills</MenuItem>
                                            <MenuSeparator />
                                            {b.status === 'suspended' ? (
                                                <MenuItem icon={<PlayCircle />} onSelect={() => router.post(route('platform.branches.resume', b.id), {}, { preserveScroll: true })}>Resume branch</MenuItem>
                                            ) : (
                                                b.status !== 'cancelled' && <MenuItem icon={<PauseCircle />} onSelect={() => setSuspend(b)}>Suspend branch</MenuItem>
                                            )}
                                            {b.status !== 'cancelled' && (
                                                <MenuItem icon={<Ban />} danger onSelect={() => setCancel(b)}>Cancel subscription</MenuItem>
                                            )}
                                        </Menu>
                                    </Td>
                                </Tr>
                            ))}
                        </tbody>
                    </Table>
                ) : (
                    <EmptyState className="h-full" title="No branches match" body="Clear the filters, or add a branch." />
                )}
            </ListPage>

            <BranchForm row={editing} onClose={() => setEditing(null)} defaults={defaults} copyFrom={copyFrom} />
            <DateAction
                row={trial}
                onClose={() => setTrial(null)}
                title={trial?.status === 'trial' ? `Extend ${trial?.name}'s free trial` : `Free trial for ${trial?.name}`}
                description="The branch uses everything for free until this date. No bills are issued; billing starts the day after unless you change it."
                field="until"
                initial={trial?.trial_ends_on && trial.trial_ends_on > todayISO() ? trial.trial_ends_on : addDays(defaults.trial_days)}
                min={todayISO()}
                label="Free until"
                action={(row) => route('platform.branches.trial', row.id)}
                submit="Save free trial"
            />
            <DateAction
                row={activate}
                onClose={() => setActivate(null)}
                title={`Start ${activate?.name}'s subscription`}
                description={`The first bill of ${peso(activate?.effective_fee ?? 0)} is issued on the start date, then every month on the same day. A start date in the past issues the bills that are already due.`}
                field="starts_on"
                initial={todayISO()}
                label="Billing starts"
                action={(row) => route('platform.branches.activate', row.id)}
                submit="Start subscription"
            />
            <ConfirmDialog
                open={!!suspend}
                onOpenChange={(o) => !o && setSuspend(null)}
                title={`Suspend ${suspend?.name}?`}
                body="Its staff can still sign in, but every page shows the bill screen until you resume the branch."
                confirmLabel="Suspend branch"
                requireReason="Reason (shows on the branch list)"
                onConfirm={(reason) => suspend && router.post(route('platform.branches.suspend', suspend.id), { reason }, { preserveScroll: true, onFinish: () => setSuspend(null) })}
            />
            <ConfirmDialog
                open={keyDialog}
                onOpenChange={setKeyDialog}
                title={freeAccess ? 'Turn the master key off?' : 'Turn the master key on?'}
                body={
                    freeAccess
                        ? 'Subscriptions apply again: bills are issued on each branch’s billing day, trials end on their date, and branches with overdue bills lock.'
                        : 'Every branch (except cancelled ones) can use the whole system without a subscription. Billing is paused: no bills are issued, trials don’t end, and no branch is locked or reminded. Only you can see or change this.'
                }
                confirmLabel={freeAccess ? 'Turn off' : 'Turn on master key'}
                danger={freeAccess}
                onConfirm={() => router.post(route('platform.master-key'), { enabled: !freeAccess }, { preserveScroll: true, onFinish: () => setKeyDialog(false) })}
            />
            <ConfirmDialog
                open={!!cancel}
                onOpenChange={(o) => !o && setCancel(null)}
                title={`Cancel ${cancel?.name}?`}
                body="No more bills are issued and its staff can no longer sign in. Sales history and data are kept, and you can start a new subscription later."
                confirmLabel="Cancel subscription"
                danger
                onConfirm={() => cancel && router.post(route('platform.branches.cancel', cancel.id), {}, { preserveScroll: true, onFinish: () => setCancel(null) })}
            />
        </>
    );
}

function DateAction({ row, onClose, title, description, field, initial, min, label, action, submit }: { row: Row | null; onClose: () => void; title: string; description: string; field: string; initial: string; min?: string; label: string; action: (row: Row) => string; submit: string }) {
    const form = useForm<Record<string, string>>({ [field]: initial });
    const key = `${row?.id}-${initial}`;
    return (
        <Modal
            key={key}
            open={!!row}
            onOpenChange={(o) => !o && onClose()}
            title={title}
            description={description}
            size="sm"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        Close
                    </Button>
                    <Button variant="primary" loading={form.processing} onClick={() => row && form.post(action(row), { preserveScroll: true, onSuccess: onClose })}>
                        {submit}
                    </Button>
                </>
            }
        >
            <Field label={label} error={form.errors[field]}>
                {(id, d) => <Input id={id} aria-describedby={d} type="date" min={min} value={form.data[field] || initial} onChange={(e) => form.setData(field, e.target.value)} />}
            </Field>
        </Modal>
    );
}

function BranchForm({ row, onClose, defaults, copyFrom }: { row: Row | 'new' | null; onClose: () => void; defaults: Props['defaults']; copyFrom: Props['copyFrom'] }) {
    const editing = row && row !== 'new' ? row : null;
    const form = useForm({
        name: editing?.name ?? '',
        code: editing?.code ?? '',
        address: editing?.address ?? '',
        phone: editing?.phone ?? '',
        email: editing?.email ?? '',
        active: editing?.active ?? true,
        monthly_fee: editing?.monthly_fee !== null && editing?.monthly_fee !== undefined ? String(editing.monthly_fee) : '',
        billing_notes: editing?.billing_notes ?? '',
        grace_until: editing?.grace_until_raw ?? '',
        start: 'trial' as 'trial' | 'paid',
        trial_days: String(defaults.trial_days),
        starts_on: todayISO(),
        copy_from: copyFrom[0] ? String(copyFrom[0].id) : '',
    });
    const d = form.data;
    const e = form.errors;

    const save = () => {
        const opts = { preserveScroll: true, onSuccess: onClose };
        form.transform((data) => ({ ...data, monthly_fee: data.monthly_fee === '' ? null : data.monthly_fee, grace_until: data.grace_until || null, copy_from: data.copy_from || null }));
        if (editing) form.put(route('platform.branches.update', editing.id), opts);
        else form.post(route('platform.branches.store'), opts);
    };

    return (
        <Drawer
            key={editing?.id ?? (row === 'new' ? 'new' : 'closed')}
            open={!!row}
            onOpenChange={(o) => !o && onClose()}
            title={editing ? `Edit ${editing.name}` : 'Add a branch'}
            description={editing ? 'Details, price and grace period.' : 'The branch gets its own sales, stock, staff and bills.'}
            size="md"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" loading={form.processing} onClick={save}>
                        {editing ? 'Save branch' : 'Add branch'}
                    </Button>
                </>
            }
        >
            <form
                className="space-y-4"
                onSubmit={(ev) => {
                    ev.preventDefault();
                    save();
                }}
            >
                <div className="grid grid-cols-[1fr_110px] gap-3">
                    <Field label="Branch name" error={e.name}>
                        {(id, dd) => <Input id={id} aria-describedby={dd} value={d.name} onChange={(ev) => form.setData('name', ev.target.value)} autoFocus placeholder="Kabankalan" />}
                    </Field>
                    <Field label="Code" hint="On receipts" error={e.code}>
                        {(id, dd) => <Input id={id} aria-describedby={dd} className="font-mono uppercase" maxLength={10} value={d.code} onChange={(ev) => form.setData('code', ev.target.value.toUpperCase())} placeholder="KAB" />}
                    </Field>
                </div>
                <Field label="Address" error={e.address}>
                    {(id, dd) => <Input id={id} aria-describedby={dd} value={d.address} onChange={(ev) => form.setData('address', ev.target.value)} />}
                </Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Phone" error={e.phone}>
                        {(id, dd) => <Input id={id} aria-describedby={dd} value={d.phone} onChange={(ev) => form.setData('phone', ev.target.value)} />}
                    </Field>
                    <Field label="Email" error={e.email}>
                        {(id, dd) => <Input id={id} aria-describedby={dd} type="email" value={d.email} onChange={(ev) => form.setData('email', ev.target.value)} />}
                    </Field>
                </div>
                <Field label="Monthly fee" hint={`Blank uses the default ${peso(defaults.monthly_fee)}`} error={e.monthly_fee}>
                    {(id, dd) => <MoneyInput id={id} aria-describedby={dd} value={d.monthly_fee} placeholder={String(defaults.monthly_fee)} onChange={(ev) => form.setData('monthly_fee', ev.target.value)} />}
                </Field>

                {!editing && (
                    <div className="space-y-3 border border-line p-3">
                        <p className="text-sm font-medium text-muted">How it starts</p>
                        <Segmented
                            label="Start"
                            value={d.start}
                            onChange={(v) => form.setData('start', v)}
                            options={[
                                { value: 'trial', label: 'Free trial' },
                                { value: 'paid', label: 'Paid from a date' },
                            ]}
                            className="w-full"
                        />
                        {d.start === 'trial' ? (
                            <Field label="Trial length" hint="days" error={e.trial_days}>
                                {(id, dd) => <Input id={id} aria-describedby={dd} type="number" min={1} max={365} value={d.trial_days} onChange={(ev) => form.setData('trial_days', ev.target.value)} />}
                            </Field>
                        ) : (
                            <Field label="First bill on" error={e.starts_on}>
                                {(id, dd) => <Input id={id} aria-describedby={dd} type="date" value={d.starts_on} onChange={(ev) => form.setData('starts_on', ev.target.value)} />}
                            </Field>
                        )}
                        {copyFrom.length > 0 && (
                            <Field label="Copy price list from" hint="Services, products, materials, suppliers" error={e.copy_from}>
                                {(id) => (
                                    <Select id={id} value={d.copy_from} onChange={(ev) => form.setData('copy_from', ev.target.value)}>
                                        <option value="">Start empty</option>
                                        {copyFrom.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </Select>
                                )}
                            </Field>
                        )}
                    </div>
                )}

                {editing && (
                    <Field label="Keep open until" hint="Grace period past the lock" error={e.grace_until}>
                        {(id, dd) => <Input id={id} aria-describedby={dd} type="date" value={d.grace_until} onChange={(ev) => form.setData('grace_until', ev.target.value)} />}
                    </Field>
                )}
                <Field label="Notes" hint="Only you see these" error={e.billing_notes}>
                    {(id, dd) => <Textarea id={id} aria-describedby={dd} value={d.billing_notes} onChange={(ev) => form.setData('billing_notes', ev.target.value)} className="min-h-16" />}
                </Field>
                <Switch checked={d.active} onChange={(v) => form.setData('active', v)} label="Branch is on" description="Switched off, its staff can not sign in." className="border border-line px-3 py-2.5" />
                <button type="submit" hidden />
            </form>
        </Drawer>
    );
}
