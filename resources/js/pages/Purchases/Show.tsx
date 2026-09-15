import { Head, router } from '@inertiajs/react';
import { PackageCheck, Pencil, Send, X } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button, ButtonLink } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ConfirmDialog } from '@/components/ui/dialog';
import { ErrorText, Input } from '@/components/ui/field';
import { Panel } from '@/components/ui/misc';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { date, dateTime, money, peso, qty } from '@/lib/format';
import { useCan } from '@/lib/utils';
import { PO_LABEL, PO_TONE } from '@/lib/status';

interface Props {
    purchase: {
        id: number;
        po_no: string;
        status: string;
        supplier: { id: number; name: string; contact_person: string | null; phone: string | null; terms: string | null } | null;
        expected_at: string | null;
        ordered_at: string | null;
        received_at: string | null;
        total: number;
        notes: string | null;
        created_by: string | null;
        created_at: string;
        items: { id: number; item_type: string; name: string; qty_ordered: number; qty_received: number; unit_cost: number; line_total: number }[];
    };
}

export default function PurchaseShow({ purchase: p }: Props) {
    const can = useCan();
    const receivable = p.status === 'ordered' || p.status === 'partial';
    const [received, setReceived] = useState<Record<number, string>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    const receive = () => {
        setProcessing(true);
        router.post(route('purchases.receive', p.id), { received: Object.fromEntries(Object.entries(received).map(([k, v]) => [k, Number(v) || 0])) }, { preserveScroll: true, onSuccess: () => setReceived({}), onError: setErrors, onFinish: () => setProcessing(false) });
    };

    const fillAll = () => setReceived(Object.fromEntries(p.items.map((i) => [i.id, String(Math.max(0, i.qty_ordered - i.qty_received))])));

    return (
        <>
            <Head title={p.po_no} />
            <PageHeader
                back={{ href: route('purchases.index'), label: 'Purchases' }}
                title={<span className="font-mono">{p.po_no}</span>}
                meta={<Chip tone={PO_TONE[p.status]}>{PO_LABEL[p.status]}</Chip>}
                description={`${p.supplier?.name}${p.supplier?.terms ? `, terms ${p.supplier.terms}` : ''}. Created ${dateTime(p.created_at)} by ${p.created_by}.`}
                actions={
                    can('purchases.edit') && (
                        <>
                            {(p.status === 'draft' || p.status === 'ordered') && (
                                <>
                                    <Button variant="ghost" icon={<X />} onClick={() => setCancelling(true)}>
                                        Cancel PO
                                    </Button>
                                    <ButtonLink href={route('purchases.edit', p.id)} icon={<Pencil />}>
                                        Edit
                                    </ButtonLink>
                                </>
                            )}
                            {p.status === 'draft' && (
                                <Button variant="primary" icon={<Send />} onClick={() => router.post(route('purchases.order', p.id), {}, { preserveScroll: true })}>
                                    Mark as ordered
                                </Button>
                            )}
                        </>
                    )
                }
            />
            <div className="grid gap-5 p-5 lg:p-6 xl:grid-cols-[1fr_300px]">
                <Panel
                    title={receivable ? 'Receive the delivery' : 'Items'}
                    className="min-w-0"
                    actions={
                        receivable &&
                        can('purchases.edit') && (
                            <Button size="sm" variant="quiet" onClick={fillAll}>
                                Everything arrived
                            </Button>
                        )
                    }
                >
                    <Table minWidth={720}>
                        <THead>
                            <tr>
                                <Th>Item</Th>
                                <Th align="right">Ordered</Th>
                                <Th align="right">Received</Th>
                                <Th align="right">Unit cost</Th>
                                <Th align="right">Total</Th>
                                {receivable && can('purchases.edit') && <Th align="right">Arrived now</Th>}
                            </tr>
                        </THead>
                        <tbody>
                            {p.items.map((i) => {
                                const due = Math.max(0, i.qty_ordered - i.qty_received);
                                return (
                                    <Tr key={i.id}>
                                        <Td>
                                            {i.name}
                                            {i.item_type === 'product' && <Chip className="ml-2">Product</Chip>}
                                        </Td>
                                        <Td numeric>{qty(i.qty_ordered)}</Td>
                                        <Td numeric className={i.qty_received >= i.qty_ordered ? 'text-ok-text' : i.qty_received > 0 ? 'text-warn-text' : 'text-faint'}>
                                            {qty(i.qty_received)}
                                        </Td>
                                        <Td numeric muted>{money(i.unit_cost)}</Td>
                                        <Td numeric>{money(i.line_total)}</Td>
                                        {receivable && can('purchases.edit') && (
                                            <Td align="right">
                                                {due > 0 ? (
                                                    <Input type="number" min={0} max={due} step="any" aria-label={`Received ${i.name}`} placeholder={qty(due)} className="num ml-auto w-28 text-right" value={received[i.id] ?? ''} onChange={(e) => setReceived((r) => ({ ...r, [i.id]: e.target.value }))} />
                                                ) : (
                                                    <span className="text-sm text-ok-text">Complete</span>
                                                )}
                                            </Td>
                                        )}
                                    </Tr>
                                );
                            })}
                        </tbody>
                    </Table>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
                        <ErrorText>{Object.values(errors)[0]}</ErrorText>
                        <p className="ml-auto text-base text-muted">
                            Total <span className="num ml-2 text-lg font-semibold text-fg">{peso(p.total)}</span>
                        </p>
                        {receivable && can('purchases.edit') && (
                            <Button variant="primary" icon={<PackageCheck />} onClick={receive} loading={processing} disabled={!Object.values(received).some((v) => Number(v) > 0)}>
                                Receive into stock
                            </Button>
                        )}
                    </div>
                </Panel>
                <Panel title="Timeline" bodyClass="space-y-3 p-5 text-base">
                    <Line label="Created" value={dateTime(p.created_at)} />
                    <Line label="Ordered" value={p.ordered_at ? dateTime(p.ordered_at) : 'Not yet'} />
                    <Line label="Expected" value={p.expected_at ? date(p.expected_at) : 'No date'} />
                    <Line label="Received" value={p.received_at ? dateTime(p.received_at) : p.status === 'partial' ? 'Partly' : 'Not yet'} />
                    {p.supplier?.contact_person && <Line label="Contact" value={`${p.supplier.contact_person}, ${p.supplier.phone ?? ''}`} />}
                    {p.notes && <p className="border-t border-line pt-3 text-muted">{p.notes}</p>}
                </Panel>
            </div>
            <ConfirmDialog open={cancelling} onOpenChange={setCancelling} title={`Cancel ${p.po_no}?`} body="Nothing has been received on it, so stock is unchanged." confirmLabel="Cancel PO" onConfirm={() => router.post(route('purchases.cancel', p.id), {}, { onFinish: () => setCancelling(false) })} />
        </>
    );
}

function Line({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs text-faint">{label}</p>
            <p>{value}</p>
        </div>
    );
}
