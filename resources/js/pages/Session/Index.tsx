import { Head, Link, useForm } from '@inertiajs/react';
import { Calculator, LockOpen, Printer } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { CashCount } from '@/components/cash-count';
import { PageHeader } from '@/components/page-header';
import { StaleDrawerBanner } from '@/components/stale-drawer-banner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Field, Input, MoneyInput, Select } from '@/components/ui/field';
import { AnimatedMoney, EmptyState, Pagination, Panel } from '@/components/ui/misc';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { dateTime, peso, time } from '@/lib/format';
import { cn, useAppPage, useCan } from '@/lib/utils';
import type { Paginated, SessionRow } from '@/types';
import { SessionSummary, type SessionDetail, VarianceText } from './parts';

interface Props {
    current: SessionDetail | null;
    history: Paginated<SessionRow>;
    suggestedFloat: number;
}

export default function SessionIndex({ current, history, suggestedFloat }: Props) {
    const { props } = useAppPage();
    return (
        <>
            <Head title="Cash drawer" />
            <PageHeader
                title="Cash drawer"
                description={current ? `Open since ${props.drawer?.stale ? dateTime(current.opened_at) : time(current.opened_at)}. Every cash sale, refund, expense and petty-cash move posts here.` : 'Count the cash you are starting with. The POS stays locked until your drawer is open.'}
                meta={current ? <Chip tone="ok">Open</Chip> : <Chip tone="red">Closed</Chip>}
                actions={
                    current && (
                        <a href={route('session.pdf', current.id)} target="_blank" rel="noreferrer">
                            <Button icon={<Printer />}>Print X-read</Button>
                        </a>
                    )
                }
            />
            <div className="space-y-5 p-5 lg:p-6">
                <StaleDrawerBanner linkToDrawer={false} />
                {current ? <OpenDrawer session={current} /> : <OpenForm suggested={suggestedFloat} />}
            </div>

            <div className="px-5 pb-8 lg:px-6">
                <Panel title="Drawer history">
                    {history.data.length ? (
                        <>
                            <Table>
                                <THead>
                                    <tr>
                                        <Th>Session</Th>
                                        <Th>Cashier</Th>
                                        <Th>Opened</Th>
                                        <Th>Closed</Th>
                                        <Th align="right">Float</Th>
                                        <Th align="right">Expected</Th>
                                        <Th align="right">Counted</Th>
                                        <Th align="right">Over / short</Th>
                                    </tr>
                                </THead>
                                <tbody>
                                    {history.data.map((s) => (
                                        <Tr key={s.id}>
                                            <Td>
                                                <Link href={route('session.show', s.id)} className="font-mono text-sm hover:underline">
                                                    #{s.id}
                                                </Link>
                                            </Td>
                                            <Td>{s.cashier}</Td>
                                            <Td muted className="text-sm whitespace-nowrap">{dateTime(s.opened_at)}</Td>
                                            <Td muted className="text-sm whitespace-nowrap">{s.closed_at ? dateTime(s.closed_at) : <Chip tone="ok">Open now</Chip>}</Td>
                                            <Td numeric>{peso(s.opening_float)}</Td>
                                            <Td numeric>{s.expected_cash !== null ? peso(s.expected_cash) : ''}</Td>
                                            <Td numeric>{s.closing_counted !== null ? peso(s.closing_counted) : ''}</Td>
                                            <Td numeric>{s.variance !== null && <VarianceText value={s.variance} />}</Td>
                                        </Tr>
                                    ))}
                                </tbody>
                            </Table>
                            <Pagination links={history.links} from={history.from} to={history.to} total={history.total} />
                        </>
                    ) : (
                        <EmptyState compact title="No drawers yet" body="Your first opened drawer will be listed here with its count." />
                    )}
                </Panel>
            </div>
        </>
    );
}

function OpenForm({ suggested }: { suggested: number }) {
    const form = useForm({ opening_float: String(suggested), note: '', return_to: new URLSearchParams(window.location.search).get('return') ?? '' });
    const [counting, setCounting] = useState(false);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(route('session.open'));
    };

    return (
        <form onSubmit={submit} className="grid gap-0 border border-line bg-surface lg:grid-cols-[1fr_1.2fr]">
            <div className="halftone flex flex-col justify-center border-b border-line p-8 lg:border-r lg:border-b-0">
                <LockOpen className="size-7 text-faint" strokeWidth={1.5} />
                <h2 className="mt-4 text-3xl font-semibold">Open your drawer</h2>
                <p className="mt-2 max-w-sm text-base text-muted">Count the bills and coins in the tray before the first customer. This is your opening float, and closing compares against it.</p>
            </div>
            <div className="space-y-5 p-6 lg:p-8">
                <Field label="Starting cash in the drawer" error={form.errors.opening_float}>
                    {(id, d) => (
                        <MoneyInput
                            id={id}
                            aria-describedby={d}
                            inputSize="lg"
                            autoFocus
                            className="max-w-xs text-2xl"
                            value={form.data.opening_float}
                            invalid={!!form.errors.opening_float}
                            onChange={(e) => form.setData('opening_float', e.target.value)}
                        />
                    )}
                </Field>
                <div>
                    <Button variant="quiet" size="sm" icon={<Calculator />} onClick={() => setCounting((c) => !c)}>
                        {counting ? 'Hide bill counter' : 'Count by bills and coins'}
                    </Button>
                    {counting && (
                        <div className="mt-3">
                            <CashCount onTotal={(t) => t > 0 && form.setData('opening_float', String(t))} />
                        </div>
                    )}
                </div>
                <Field label="Note" hint="Optional">
                    {(id) => <Input id={id} placeholder="e.g. Two 500s, rest in coins" value={form.data.note} onChange={(e) => form.setData('note', e.target.value)} />}
                </Field>
                <Button type="submit" variant="primary" size="lg" loading={form.processing}>
                    Open drawer with {peso(Number(form.data.opening_float) || 0)}
                </Button>
            </div>
        </form>
    );
}

function OpenDrawer({ session }: { session: SessionDetail }) {
    const can = useCan();
    const close = useForm({ closing_counted: '', note: '' });
    const move = useForm({ type: 'paid_out', direction: 'out', amount: '', note: '' });
    const [counting, setCounting] = useState(false);
    const expected = session.summary.expected_cash;
    const counted = close.data.closing_counted === '' ? null : Number(close.data.closing_counted);
    const variance = counted === null ? null : Math.round((counted - expected) * 100) / 100;

    return (
        <>
            <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
                <SessionSummary session={session} />

                <div className="space-y-5">
                    <Panel title="Count and close">
                        <form
                            className="space-y-4 p-5"
                            onSubmit={(e) => {
                                e.preventDefault();
                                close.post(route('session.close'));
                            }}
                        >
                            <div className="flex items-end justify-between gap-4 border border-line bg-sunken px-4 py-3">
                                <div>
                                    <p className="text-sm text-faint">Should be in the drawer</p>
                                    <AnimatedMoney value={expected} className="hud text-3xl font-semibold" />
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-faint">Over / short</p>
                                    <p className="hud text-xl font-semibold">{variance === null ? <span className="text-ghost">Count first</span> : <VarianceText value={variance} />}</p>
                                </div>
                            </div>
                            <Field label="Cash you counted" error={close.errors.closing_counted}>
                                {(id, d) => (
                                    <MoneyInput
                                        id={id}
                                        aria-describedby={d}
                                        inputSize="lg"
                                        className="text-xl"
                                        value={close.data.closing_counted}
                                        invalid={!!close.errors.closing_counted}
                                        onChange={(e) => close.setData('closing_counted', e.target.value)}
                                    />
                                )}
                            </Field>
                            <Button variant="quiet" size="sm" icon={<Calculator />} onClick={() => setCounting((c) => !c)}>
                                {counting ? 'Hide bill counter' : 'Count by bills and coins'}
                            </Button>
                            {counting && <CashCount onTotal={(t) => t > 0 && close.setData('closing_counted', String(t))} />}
                            <Field label="Note" hint={variance !== null && Math.abs(variance) >= 0.01 ? 'Explain the difference' : 'Optional'}>
                                {(id) => <Input id={id} value={close.data.note} onChange={(e) => close.setData('note', e.target.value)} placeholder="e.g. Recounted twice, ₱20 short" />}
                            </Field>
                            <Button type="submit" variant="primary" className="w-full" size="lg" disabled={counted === null} loading={close.processing}>
                                Close drawer
                            </Button>
                        </form>
                    </Panel>

                    {can('session.edit') && (
                        <Panel title="Cash in or out of the drawer">
                            <form
                                className="grid gap-3 p-5 sm:grid-cols-2"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    move.post(route('session.movements'), { preserveScroll: true, onSuccess: () => move.reset('amount', 'note') });
                                }}
                            >
                                <Field label="Type">
                                    {(id) => (
                                        <Select id={id} value={move.data.type} onChange={(e) => move.setData('type', e.target.value)}>
                                            <option value="paid_out">Paid out (rider, small buy)</option>
                                            <option value="cash_drop">Cash drop (to safe or bank)</option>
                                            <option value="adjustment">Adjustment</option>
                                        </Select>
                                    )}
                                </Field>
                                {move.data.type === 'adjustment' ? (
                                    <Field label="Direction">
                                        {(id) => (
                                            <Select id={id} value={move.data.direction} onChange={(e) => move.setData('direction', e.target.value)}>
                                                <option value="in">Add to drawer</option>
                                                <option value="out">Take from drawer</option>
                                            </Select>
                                        )}
                                    </Field>
                                ) : (
                                    <div />
                                )}
                                <Field label="Amount" error={move.errors.amount}>
                                    {(id, d) => <MoneyInput id={id} aria-describedby={d} value={move.data.amount} onChange={(e) => move.setData('amount', e.target.value)} />}
                                </Field>
                                <Field label="What for" error={move.errors.note}>
                                    {(id, d) => <Input id={id} aria-describedby={d} value={move.data.note} onChange={(e) => move.setData('note', e.target.value)} />}
                                </Field>
                                <div className="sm:col-span-2">
                                    <Button type="submit" loading={move.processing} disabled={!move.data.amount}>
                                        Record
                                    </Button>
                                </div>
                            </form>
                        </Panel>
                    )}
                </div>
            </div>
            <MovementsPanel session={session} />
        </>
    );
}

export function MovementsPanel({ session }: { session: SessionDetail }) {
    return (
        <Panel title="Drawer ledger">
            {session.movements.length ? (
                <Table minWidth={620}>
                    <THead>
                        <tr>
                            <Th>Time</Th>
                            <Th>Movement</Th>
                            <Th>Reference</Th>
                            <Th>By</Th>
                            <Th align="right">Amount</Th>
                        </tr>
                    </THead>
                    <tbody>
                        {session.movements.map((m) => (
                            <Tr key={m.id}>
                                <Td muted className="num text-sm whitespace-nowrap">{time(m.at)}</Td>
                                <Td>{m.label}</Td>
                                <Td muted className="max-w-72 truncate font-mono text-sm">{m.note}</Td>
                                <Td muted className="text-sm">{m.user}</Td>
                                <Td numeric className={cn(m.amount < 0 ? 'text-accent-text' : 'text-fg')}>{peso(m.amount, { sign: true })}</Td>
                            </Tr>
                        ))}
                    </tbody>
                </Table>
            ) : (
                <EmptyState compact title="No cash has moved yet" body="Cash sales, refunds and expenses from this drawer will list here as they happen." />
            )}
        </Panel>
    );
}
