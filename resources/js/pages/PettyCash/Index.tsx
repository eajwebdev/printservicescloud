import { Head, useForm } from '@inertiajs/react';
import { ArrowDownToLine, ArrowUpFromLine, Calculator, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { CashCount } from '@/components/cash-count';
import { ListPage } from '@/components/list-page';
import { moneyTabs } from '@/components/module-tabs';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Modal } from '@/components/ui/dialog';
import { Field, Input, MoneyInput, Select } from '@/components/ui/field';
import { AnimatedMoney, EmptyState, Pagination } from '@/components/ui/misc';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { dateTime, peso } from '@/lib/format';
import { cn, useCan } from '@/lib/utils';
import type { Paginated } from '@/types';

interface Props {
    fund: { id: number; name: string; balance: number; float_target: number; low_threshold: number; low: boolean; spent_month: number; topped_month: number };
    transactions: Paginated<{
        id: number;
        type: 'in' | 'out' | 'adjustment';
        amount: number;
        balance_after: number;
        reason: string;
        ref: string | null;
        funded_from: string | null;
        expense_id: number | null;
        user: string | null;
        at: string;
    }>;
    drawerOpen: boolean;
}

export default function PettyCash({ fund, transactions, drawerOpen }: Props) {
    const can = useCan();
    const [modal, setModal] = useState<'topup' | 'disburse' | 'reconcile' | 'limits' | null>(null);
    const topup = useForm({ amount: Math.max(0, fund.float_target - fund.balance).toFixed(2), funded_from: drawerOpen ? 'drawer' : 'owner', ref: '', reason: '' });
    const out = useForm({ amount: '', reason: '', ref: '' });
    const count = useForm({ counted: '', note: '' });
    const limits = useForm({ float_target: String(fund.float_target), low_threshold: String(fund.low_threshold) });
    const [counting, setCounting] = useState(false);
    const pct = fund.float_target > 0 ? Math.min(1, fund.balance / fund.float_target) : 0;
    const close = () => setModal(null);

    return (
        <>
            <Head title="Petty cash" />
            <ListPage
                title="Money out"
                description="A separate cash box for small buys. A top-up taken from the sales drawer is recorded against your open drawer."
                tabs={moneyTabs('petty')}
                actions={
                    <>
                        {can('petty_cash.edit') && (
                            <Button variant="ghost" icon={<Settings2 />} onClick={() => setModal('limits')}>
                                Limits
                            </Button>
                        )}
                        {can('petty_cash.edit') && (
                            <Button icon={<Calculator />} onClick={() => setModal('reconcile')}>
                                Count the box
                            </Button>
                        )}
                        {can('petty_cash.create') && (
                            <>
                                <Button icon={<ArrowUpFromLine />} onClick={() => setModal('disburse')}>
                                    Pay out
                                </Button>
                                <Button variant="primary" icon={<ArrowDownToLine />} onClick={() => setModal('topup')}>
                                    Top up
                                </Button>
                            </>
                        )}
                    </>
                }
                summary={
                    <section className="grid border-b border-line bg-bg md:grid-cols-[1.4fr_1fr_1fr]">
                        <div className="border-b border-line px-4 py-3 md:border-r md:border-b-0 lg:px-6">
                            <p className="flex items-center gap-2 text-sm text-faint">Balance in the box {fund.low && <Chip tone="warn">Low, top up soon</Chip>}</p>
                            <AnimatedMoney value={fund.balance} className={cn('hud mt-0.5 block text-3xl font-semibold', fund.low && 'text-warn-text')} />
                            <div className="mt-2 h-1.5 bg-sunken" aria-hidden>
                                <div className={cn('h-full', fund.low ? 'bg-warn' : 'bg-[var(--chart-neutral)]')} style={{ width: `${pct * 100}%` }} />
                            </div>
                            <p className="num mt-1 text-xs text-faint">
                                Full box {peso(fund.float_target)}; warns under {peso(fund.low_threshold)}
                            </p>
                        </div>
                        <div className="border-b border-line px-4 py-3 md:border-r md:border-b-0 lg:px-6">
                            <p className="text-sm text-faint">Paid out this month</p>
                            <p className="hud mt-0.5 text-2xl font-semibold">{peso(fund.spent_month)}</p>
                        </div>
                        <div className="px-4 py-3 lg:px-6">
                            <p className="text-sm text-faint">Topped up this month</p>
                            <p className="hud mt-0.5 text-2xl font-semibold">{peso(fund.topped_month)}</p>
                        </div>
                    </section>
                }
                footer={transactions.data.length > 0 && <Pagination links={transactions.links} from={transactions.from} to={transactions.to} total={transactions.total} />}
            >
                {transactions.data.length ? (
                    <Table flush minWidth={760}>
                        <THead>
                            <tr>
                                <Th>When</Th>
                                <Th>What for</Th>
                                <Th>Ref</Th>
                                <Th>By</Th>
                                <Th align="right">In / out</Th>
                                <Th align="right">Balance</Th>
                            </tr>
                        </THead>
                        <tbody>
                            {transactions.data.map((t) => (
                                <Tr key={t.id}>
                                    <Td muted className="text-sm whitespace-nowrap">
                                        {dateTime(t.at)}
                                    </Td>
                                    <Td>
                                        {t.reason}
                                        <span className="ml-2 inline-flex gap-1">
                                            {t.type === 'adjustment' && <Chip tone="warn">Count</Chip>}
                                            {t.funded_from && <Chip tone="outline">from {t.funded_from}</Chip>}
                                            {t.expense_id && <Chip tone="outline">Expense</Chip>}
                                        </span>
                                    </Td>
                                    <Td muted className="font-mono text-sm">
                                        {t.ref}
                                    </Td>
                                    <Td muted className="text-sm">
                                        {t.user}
                                    </Td>
                                    <Td numeric className={t.amount < 0 ? 'text-accent-text' : 'text-ok-text'}>
                                        {peso(t.amount, { sign: true })}
                                    </Td>
                                    <Td numeric>{peso(t.balance_after)}</Td>
                                </Tr>
                            ))}
                        </tbody>
                    </Table>
                ) : (
                    <EmptyState className="h-full" title="The box is empty" body="Top up the fund to start. Every peso in and out is listed here with a reason." />
                )}
            </ListPage>

            <Modal
                open={modal === 'topup'}
                onOpenChange={(o) => !o && close()}
                title="Top up petty cash"
                size="sm"
                footer={
                    <Button variant="primary" loading={topup.processing} onClick={() => topup.post(route('petty.topup'), { preserveScroll: true, onSuccess: close })}>
                        Add to fund
                    </Button>
                }
            >
                <div className="space-y-4">
                    <Field label="Amount" error={topup.errors.amount}>
                        {(id, d) => (
                            <MoneyInput id={id} aria-describedby={d} inputSize="lg" autoFocus value={topup.data.amount} onChange={(e) => topup.setData('amount', e.target.value)} />
                        )}
                    </Field>
                    <Field label="Where the cash came from" error={topup.errors.funded_from}>
                        {(id) => (
                            <Select id={id} value={topup.data.funded_from} onChange={(e) => topup.setData('funded_from', e.target.value)}>
                                <option value="drawer" disabled={!drawerOpen}>
                                    Sales drawer {drawerOpen ? '(posts against your session)' : '(open your drawer first)'}
                                </option>
                                <option value="bank">Bank withdrawal</option>
                                <option value="owner">Owner's cash</option>
                            </Select>
                        )}
                    </Field>
                    <Field label="Reference" hint="Optional">
                        {(id) => <Input id={id} value={topup.data.ref} onChange={(e) => topup.setData('ref', e.target.value)} />}
                    </Field>
                </div>
            </Modal>

            <Modal
                open={modal === 'disburse'}
                onOpenChange={(o) => !o && close()}
                title="Pay out from petty cash"
                description="For a bill with a category, use Expenses and pick Petty cash so it also shows in reports."
                size="sm"
                footer={
                    <Button
                        variant="primary"
                        loading={out.processing}
                        onClick={() =>
                            out.post(route('petty.disburse'), {
                                preserveScroll: true,
                                onSuccess: () => {
                                    out.reset();
                                    close();
                                },
                            })
                        }
                    >
                        Record payout
                    </Button>
                }
            >
                <div className="space-y-4">
                    <Field label="Amount" hint={`${peso(fund.balance)} in the box`} error={out.errors.amount}>
                        {(id, d) => (
                            <MoneyInput id={id} aria-describedby={d} inputSize="lg" autoFocus value={out.data.amount} onChange={(e) => out.setData('amount', e.target.value)} />
                        )}
                    </Field>
                    <Field label="What for" error={out.errors.reason}>
                        {(id, d) => (
                            <Input
                                id={id}
                                aria-describedby={d}
                                placeholder="e.g. Merienda for rush job crew"
                                value={out.data.reason}
                                onChange={(e) => out.setData('reason', e.target.value)}
                            />
                        )}
                    </Field>
                    <Field label="Receipt / ref" hint="Optional">
                        {(id) => <Input id={id} value={out.data.ref} onChange={(e) => out.setData('ref', e.target.value)} />}
                    </Field>
                </div>
            </Modal>

            <Modal
                open={modal === 'reconcile'}
                onOpenChange={(o) => !o && close()}
                title="Count the petty cash box"
                size="md"
                footer={
                    <Button
                        variant="primary"
                        loading={count.processing}
                        disabled={count.data.counted === ''}
                        onClick={() =>
                            count.post(route('petty.reconcile'), {
                                preserveScroll: true,
                                onSuccess: () => {
                                    count.reset();
                                    close();
                                },
                            })
                        }
                    >
                        Save count
                    </Button>
                }
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 border border-line">
                        <div className="border-r border-line px-4 py-3">
                            <p className="text-sm text-faint">Books say</p>
                            <p className="hud text-2xl font-semibold">{peso(fund.balance)}</p>
                        </div>
                        <div className="px-4 py-3">
                            <p className="text-sm text-faint">Difference</p>
                            <p
                                className={cn(
                                    'hud text-2xl font-semibold',
                                    count.data.counted === '' ? 'text-ghost' : Number(count.data.counted) - fund.balance < 0 ? 'text-accent-text' : 'text-ok-text',
                                )}
                            >
                                {count.data.counted === '' ? 'Count first' : peso(Number(count.data.counted) - fund.balance, { sign: true })}
                            </p>
                        </div>
                    </div>
                    <Field label="Cash counted" error={count.errors.counted}>
                        {(id, d) => (
                            <MoneyInput id={id} aria-describedby={d} inputSize="lg" value={count.data.counted} onChange={(e) => count.setData('counted', e.target.value)} />
                        )}
                    </Field>
                    <Button size="sm" variant="quiet" icon={<Calculator />} onClick={() => setCounting((c) => !c)}>
                        {counting ? 'Hide bill counter' : 'Count by bills and coins'}
                    </Button>
                    {counting && <CashCount onTotal={(t) => t > 0 && count.setData('counted', String(t))} />}
                    <Field label="Note" hint="Explain any difference">
                        {(id) => <Input id={id} value={count.data.note} onChange={(e) => count.setData('note', e.target.value)} />}
                    </Field>
                </div>
            </Modal>

            <Modal
                open={modal === 'limits'}
                onOpenChange={(o) => !o && close()}
                title="Fund limits"
                size="sm"
                footer={
                    <Button variant="primary" loading={limits.processing} onClick={() => limits.put(route('petty.fund'), { preserveScroll: true, onSuccess: close })}>
                        Save limits
                    </Button>
                }
            >
                <div className="space-y-4">
                    <Field label="Target float" hint="What a full box holds" error={limits.errors.float_target}>
                        {(id, d) => <MoneyInput id={id} aria-describedby={d} value={limits.data.float_target} onChange={(e) => limits.setData('float_target', e.target.value)} />}
                    </Field>
                    <Field label="Warn when under" error={limits.errors.low_threshold}>
                        {(id, d) => <MoneyInput id={id} aria-describedby={d} value={limits.data.low_threshold} onChange={(e) => limits.setData('low_threshold', e.target.value)} />}
                    </Field>
                </div>
            </Modal>
        </>
    );
}
