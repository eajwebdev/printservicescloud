import { useForm } from '@inertiajs/react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/dialog';
import { Field, Input, MoneyInput, Textarea } from '@/components/ui/field';
import { Switch } from '@/components/ui/toggle';

export interface CustomerFormValue {
    id?: number;
    name: string;
    business_name: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    credit_limit: number | null;
    is_senior_pwd: boolean;
    notes: string | null;
}

export function CustomerDrawer({ open, onClose, customer }: { open: boolean; onClose: () => void; customer: CustomerFormValue | null }) {
    const form = useForm({
        name: '',
        business_name: '',
        phone: '',
        email: '',
        address: '',
        credit_limit: '',
        is_senior_pwd: false,
        notes: '',
    });

    useEffect(() => {
        if (!open) return;
        form.clearErrors();
        form.setData({
            name: customer?.name ?? '',
            business_name: customer?.business_name ?? '',
            phone: customer?.phone ?? '',
            email: customer?.email ?? '',
            address: customer?.address ?? '',
            credit_limit: customer?.credit_limit != null ? String(customer.credit_limit) : '',
            is_senior_pwd: customer?.is_senior_pwd ?? false,
            notes: customer?.notes ?? '',
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, customer]);

    const submit = () => {
        form.transform((d) => ({ ...d, credit_limit: d.credit_limit === '' ? null : Number(d.credit_limit) }));
        const opts = { preserveScroll: true, onSuccess: onClose };
        if (customer?.id) form.put(route('customers.update', customer.id), opts);
        else form.post(route('customers.store'), opts);
    };

    return (
        <Drawer
            open={open}
            onOpenChange={(o) => !o && onClose()}
            title={customer?.id ? `Edit ${customer.name}` : 'New customer'}
            description="Phone numbers get the ready-for-pickup text."
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={submit} loading={form.processing}>
                        {customer?.id ? 'Save customer' : 'Add customer'}
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
                <Field label="Name" error={form.errors.name}>
                    {(id, d) => <Input id={id} aria-describedby={d} autoFocus value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />}
                </Field>
                <Field label="Business or organization" hint="Optional" error={form.errors.business_name}>
                    {(id, d) => <Input id={id} aria-describedby={d} value={form.data.business_name} onChange={(e) => form.setData('business_name', e.target.value)} />}
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Mobile" error={form.errors.phone}>
                        {(id, d) => <Input id={id} aria-describedby={d} inputMode="tel" placeholder="09XX XXX XXXX" value={form.data.phone} onChange={(e) => form.setData('phone', e.target.value)} />}
                    </Field>
                    <Field label="Email" error={form.errors.email}>
                        {(id, d) => <Input id={id} aria-describedby={d} type="email" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} />}
                    </Field>
                </div>
                <Field label="Address" error={form.errors.address}>
                    {(id, d) => <Input id={id} aria-describedby={d} value={form.data.address} onChange={(e) => form.setData('address', e.target.value)} />}
                </Field>
                <Field label="Credit limit" hint="Blank means no limit" error={form.errors.credit_limit}>
                    {(id, d) => <MoneyInput id={id} aria-describedby={d} value={form.data.credit_limit} onChange={(e) => form.setData('credit_limit', e.target.value)} />}
                </Field>
                <Switch checked={form.data.is_senior_pwd} onChange={(v) => form.setData('is_senior_pwd', v)} label="Senior citizen or PWD" description="Turns on the discount automatically at the POS" className="border border-line px-3 py-2.5" />
                <Field label="Notes" error={form.errors.notes}>
                    {(id, d) => <Textarea id={id} aria-describedby={d} value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} />}
                </Field>
                <button type="submit" hidden />
            </form>
        </Drawer>
    );
}
