import { Head, router, useForm } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ListPage, ToolbarSearch } from '@/components/list-page';
import { purchaseTabs } from '@/components/module-tabs';
import { Button, ButtonLink } from '@/components/ui/button';
import { ConfirmDialog, Drawer } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/misc';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { date, peso } from '@/lib/format';
import { useCan } from '@/lib/utils';

interface Supplier {
    id: number;
    name: string;
    contact_person: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    terms: string | null;
    notes: string | null;
    open_pos: number;
    total_bought: number;
    last_purchase_at: string | null;
}

export default function Suppliers({ suppliers }: { suppliers: Supplier[] }) {
    const can = useCan();
    const [editing, setEditing] = useState<Supplier | null>(null);
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const needle = q.trim().toLowerCase();
    const shown = needle ? suppliers.filter((s) => [s.name, s.contact_person, s.phone, s.address].some((v) => v?.toLowerCase().includes(needle))) : suppliers;
    const [deleting, setDeleting] = useState<Supplier | null>(null);
    const form = useForm({ name: '', contact_person: '', phone: '', email: '', address: '', terms: '', notes: '' });

    useEffect(() => {
        if (!open) return;
        form.clearErrors();
        form.setData({
            name: editing?.name ?? '',
            contact_person: editing?.contact_person ?? '',
            phone: editing?.phone ?? '',
            email: editing?.email ?? '',
            address: editing?.address ?? '',
            terms: editing?.terms ?? '',
            notes: editing?.notes ?? '',
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, editing]);

    const submit = () => {
        const opts = { preserveScroll: true, onSuccess: () => setOpen(false) };
        if (editing) form.put(route('suppliers.update', editing.id), opts);
        else form.post(route('suppliers.store'), opts);
    };

    const fields: [keyof typeof form.data, string][] = [
        ['name', 'Name'],
        ['contact_person', 'Contact person'],
        ['phone', 'Phone'],
        ['email', 'Email'],
        ['address', 'Address'],
        ['terms', 'Payment terms'],
    ];

    return (
        <>
            <Head title="Suppliers" />
            <ListPage
                title="Purchases"
                description="Where tarps, ink and paper come from. Click a supplier to edit their details."
                tabs={purchaseTabs('suppliers')}
                toolbar={<ToolbarSearch autoFocus value={q} onChange={setQ} placeholder="Supplier, contact or phone" />}
                actions={
                    can('purchases.create') && (
                        <Button
                            variant="primary"
                            icon={<Plus />}
                            onClick={() => {
                                setEditing(null);
                                setOpen(true);
                            }}
                        >
                            New supplier
                        </Button>
                    )
                }
            >
                {shown.length ? (
                    <Table flush minWidth={860}>
                        <THead>
                            <tr>
                                <Th>Supplier</Th>
                                <Th>Contact</Th>
                                <Th>Terms</Th>
                                <Th align="right">Open POs</Th>
                                <Th align="right">Bought</Th>
                                <Th>Last order</Th>
                                <Th />
                            </tr>
                        </THead>
                        <tbody>
                            {shown.map((s) => (
                                <Tr
                                    key={s.id}
                                    interactive={can('purchases.edit')}
                                    onClick={() => {
                                        if (!can('purchases.edit')) return;
                                        setEditing(s);
                                        setOpen(true);
                                    }}
                                >
                                    <Td>
                                        {s.name}
                                        {s.address && <p className="text-xs text-faint">{s.address}</p>}
                                    </Td>
                                    <Td muted className="text-sm">
                                        {s.contact_person}
                                        {s.phone && <span className="num block">{s.phone}</span>}
                                    </Td>
                                    <Td muted>{s.terms}</Td>
                                    <Td numeric>{s.open_pos}</Td>
                                    <Td numeric>{peso(s.total_bought)}</Td>
                                    <Td muted className="text-sm">
                                        {s.last_purchase_at ? date(s.last_purchase_at) : 'Never'}
                                    </Td>
                                    <Td align="right" onClick={(e) => e.stopPropagation()}>
                                        <span className="flex justify-end gap-1">
                                            {can('purchases.create') && (
                                                <ButtonLink size="xs" href={route('purchases.create', { supplier: s.id })}>
                                                    Order from them
                                                </ButtonLink>
                                            )}
                                            {can('purchases.delete') && (
                                                <Button size="xs" variant="ghost" onClick={() => setDeleting(s)}>
                                                    Remove
                                                </Button>
                                            )}
                                        </span>
                                    </Td>
                                </Tr>
                            ))}
                        </tbody>
                    </Table>
                ) : (
                    <EmptyState
                        className="h-full"
                        title={q ? 'No supplier matches' : 'No suppliers yet'}
                        body={q ? 'Try part of the name or phone.' : 'Add the shops you buy tarpaulin, ink and paper from.'}
                    />
                )}
            </ListPage>

            <Drawer
                open={open}
                onOpenChange={setOpen}
                title={editing ? `Edit ${editing.name}` : 'New supplier'}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" loading={form.processing} onClick={submit}>
                            Save supplier
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
                    {fields.map(([key, label]) => (
                        <Field key={key} label={label} error={form.errors[key]}>
                            {(id, d) => (
                                <Input id={id} aria-describedby={d} value={form.data[key]} onChange={(e) => form.setData(key, e.target.value)} autoFocus={key === 'name'} />
                            )}
                        </Field>
                    ))}
                    <Field label="Notes">{(id) => <Textarea id={id} value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} />}</Field>
                    <button type="submit" hidden />
                </form>
            </Drawer>
            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(o) => !o && setDeleting(null)}
                title={`Remove ${deleting?.name}?`}
                body="Past purchase orders keep the supplier's name."
                confirmLabel="Remove supplier"
                onConfirm={() => deleting && router.delete(route('suppliers.destroy', deleting.id), { preserveScroll: true, onFinish: () => setDeleting(null) })}
            />
        </>
    );
}
