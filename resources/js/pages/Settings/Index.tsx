import { Head, router, useForm } from '@inertiajs/react';
import { DatabaseBackup, Download, ImageUp, Moon, Sun } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Segmented, Switch } from '@/components/ui/toggle';
import { useTheme } from '@/hooks/use-theme';
import { dateTime } from '@/lib/format';
import { formatBytes } from '@/lib/print';
import { useCan } from '@/lib/utils';

interface Settings {
    business_name: string;
    tagline: string;
    address: string;
    phone: string;
    email: string;
    tin: string;
    receipt_footer: string;
    quotation_terms: string;
    quotation_valid_days: number;
    tax_mode: 'none' | 'inclusive' | 'exclusive';
    tax_rate: number;
    senior_pwd_percent: number;
    rush_fee_percent: number;
    credit_terms_days: number;
    order_no_format: string;
    quotation_no_format: string;
    purchase_no_format: string;
    gcash_name: string;
    gcash_number: string;
    bank_name: string;
    bank_account_name: string;
    bank_account_number: string;
    sms_ready_enabled: boolean;
    receipt_paper: number;
    auto_print: boolean;
    print_claim_stub: boolean;
}

interface Backup {
    name: string;
    size: number;
    created_at: string;
}

function preview(format: string) {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return format
        .replace('{YYYY}', String(d.getFullYear()))
        .replace('{YYMM}', yy + mm)
        .replace('{YY}', yy)
        .replace('{MM}', mm)
        .replace('{DD}', String(d.getDate()).padStart(2, '0'))
        .replace(/\{(#+)\}/, (_, h: string) => '1'.padStart(h.length, '0'));
}

export default function SettingsIndex({ settings, logoUrl, backups, branch, canEditBrand }: { settings: Settings; logoUrl: string; backups: Backup[] | null; branch: { id: number; name: string; code: string } | null; canEditBrand: boolean }) {
    const can = useCan();
    const editable = can('settings.edit');
    const { theme, setTheme } = useTheme();
    const form = useForm<Settings>({ ...settings });
    const logo = useForm<{ logo: File | null }>({ logo: null });
    const fileRef = useRef<HTMLInputElement>(null);
    const [backingUp, setBackingUp] = useState(false);
    const d = form.data;
    const e = form.errors;
    const text = (key: keyof Settings, label: string, hint?: string, placeholder?: string, locked = false) => (
        <Field label={label} hint={hint} error={e[key]}>
            {(id, desc) => <Input id={id} aria-describedby={desc} disabled={!editable || locked} placeholder={placeholder} value={String(d[key] ?? '')} onChange={(ev) => form.setData(key, ev.target.value as never)} />}
        </Field>
    );

    return (
        <>
            <Head title="Settings" />
            <PageHeader
                title={branch ? `Settings, ${branch.name}` : 'Settings'}
                description={`The ${branch ? `${branch.name} branch's` : 'shop'} profile printed on receipts and quotes, taxes and fees, number formats and payment accounts. Other branches keep their own.`}
                actions={
                    editable && (
                        <>
                            <Button variant="primary" loading={form.processing} disabled={!form.isDirty} onClick={() => form.put(route('settings.update'), { preserveScroll: true })}>
                                Save settings
                            </Button>
                        </>
                    )
                }
            />
            <form
                className="divide-y divide-line"
                onSubmit={(ev) => {
                    ev.preventDefault();
                    form.put(route('settings.update'), { preserveScroll: true });
                }}
            >
                <Section title="Business profile" body="Shown at the top of receipts, job tickets, quotations and statements.">
                    <div className="flex items-center gap-4 sm:col-span-2">
                        <img src={logoUrl} alt="Current logo" className="h-16 w-auto max-w-40 border border-line bg-bg object-contain p-1" />
                        {editable && (
                            <>
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    className="hidden"
                                    onChange={(ev) => {
                                        const f = ev.target.files?.[0];
                                        if (!f) return;
                                        logo.setData('logo', f);
                                        logo.post(route('settings.logo'), { forceFormData: true, preserveScroll: true });
                                    }}
                                />
                                <Button icon={<ImageUp />} loading={logo.processing} onClick={() => fileRef.current?.click()}>
                                    Replace logo
                                </Button>
                                {logo.errors.logo && <p className="text-sm text-accent-text">{logo.errors.logo}</p>}
                            </>
                        )}
                    </div>
                    {text('business_name', 'Business name', canEditBrand ? 'Shared by all branches' : 'Set by the admin', undefined, !canEditBrand)}
                    {text('tagline', 'Tagline', canEditBrand ? 'Shared by all branches' : undefined, undefined, !canEditBrand)}
                    <div className="sm:col-span-2">{text('address', 'Address')}</div>
                    {text('phone', 'Phone')}
                    {text('email', 'Email')}
                    {text('tin', 'TIN', 'BIR registration')}
                </Section>

                <Section title="Receipts and quotations">
                    <Field label="Receipt footer" error={e.receipt_footer} className="sm:col-span-2">
                        {(id) => <Textarea id={id} className="min-h-16" disabled={!editable} value={d.receipt_footer} onChange={(ev) => form.setData('receipt_footer', ev.target.value)} />}
                    </Field>
                    <Field label="Quotation terms" error={e.quotation_terms} className="sm:col-span-2">
                        {(id) => <Textarea id={id} disabled={!editable} value={d.quotation_terms} onChange={(ev) => form.setData('quotation_terms', ev.target.value)} />}
                    </Field>
                    <Field label="Quotes are valid for" hint="days" error={e.quotation_valid_days}>
                        {(id) => <Input id={id} type="number" min={1} className="num" disabled={!editable} value={d.quotation_valid_days} onChange={(ev) => form.setData('quotation_valid_days', Number(ev.target.value))} />}
                    </Field>
                </Section>

                <Section title="Receipt printer" body="Receipts print straight to the thermal printer. For printing with no dialog at all, start Chrome with --kiosk-printing on the counter PC (see README).">
                    <Field label="Paper width" error={e.receipt_paper} className="sm:col-span-2">
                        {() => (
                            <Segmented
                                label="Paper width"
                                value={String(d.receipt_paper)}
                                onChange={(v) => editable && form.setData('receipt_paper', Number(v))}
                                options={[
                                    { value: '58', label: '58 mm' },
                                    { value: '80', label: '80 mm' },
                                ]}
                            />
                        )}
                    </Field>
                    <Switch
                        className="border border-line px-3 py-2.5 sm:col-span-2"
                        checked={d.auto_print}
                        disabled={!editable}
                        onChange={(v) => form.setData('auto_print', v)}
                        label="Print the receipt as soon as a sale is saved"
                        description="Turn off to print only when someone taps Print receipt."
                    />
                    <Switch
                        className="border border-line px-3 py-2.5 sm:col-span-2"
                        checked={d.print_claim_stub}
                        disabled={!editable}
                        onChange={(v) => form.setData('print_claim_stub', v)}
                        label="Add a tear-off claim stub on job orders"
                        description="The customer keeps the stub and shows it at pickup."
                    />
                </Section>

                <Section title="Tax, discounts and fees" body="Most small print shops are non-VAT. Pick Inclusive if your prices already include VAT.">
                    <Field label="VAT" error={e.tax_mode} className="sm:col-span-2">
                        {() => (
                            <Segmented
                                label="VAT mode"
                                value={d.tax_mode}
                                onChange={(v) => editable && form.setData('tax_mode', v)}
                                options={[
                                    { value: 'none', label: 'Non-VAT' },
                                    { value: 'inclusive', label: 'Prices include VAT' },
                                    { value: 'exclusive', label: 'Add VAT on top' },
                                ]}
                            />
                        )}
                    </Field>
                    <Field label="VAT rate" hint="%" error={e.tax_rate}>
                        {(id) => <Input id={id} type="number" step="0.01" className="num" suffix="%" disabled={!editable || d.tax_mode === 'none'} value={d.tax_rate} onChange={(ev) => form.setData('tax_rate', Number(ev.target.value))} />}
                    </Field>
                    <Field label="Senior / PWD discount" error={e.senior_pwd_percent}>
                        {(id) => <Input id={id} type="number" step="0.01" className="num" suffix="%" disabled={!editable} value={d.senior_pwd_percent} onChange={(ev) => form.setData('senior_pwd_percent', Number(ev.target.value))} />}
                    </Field>
                    <Field label="Rush fee" hint="added to rush lines" error={e.rush_fee_percent}>
                        {(id) => <Input id={id} type="number" step="0.01" className="num" suffix="%" disabled={!editable} value={d.rush_fee_percent} onChange={(ev) => form.setData('rush_fee_percent', Number(ev.target.value))} />}
                    </Field>
                    <Field label="Credit terms" hint="days until a balance is due" error={e.credit_terms_days}>
                        {(id) => <Input id={id} type="number" className="num" disabled={!editable} value={d.credit_terms_days} onChange={(ev) => form.setData('credit_terms_days', Number(ev.target.value))} />}
                    </Field>
                </Section>

                <Section title="Document numbers" body="Tokens: {YYYY} {YY} {MM} {DD} {YYMM}, and a run of # for the counter. The counter restarts whenever the date part changes.">
                    {(
                        [
                            ['order_no_format', 'Orders'],
                            ['quotation_no_format', 'Quotations'],
                            ['purchase_no_format', 'Purchase orders'],
                        ] as const
                    ).map(([key, label]) => (
                        <Field key={key} label={label} hint={`Next looks like ${preview(d[key])}`} error={e[key]}>
                            {(id, desc) => <Input id={id} aria-describedby={desc} className="font-mono" disabled={!editable} value={d[key]} onChange={(ev) => form.setData(key, ev.target.value)} />}
                        </Field>
                    ))}
                </Section>

                <Section title="Payment accounts" body="Printed on receipts and quotations so customers know where to send GCash or bank payments.">
                    {text('gcash_name', 'GCash account name')}
                    {text('gcash_number', 'GCash number', undefined, '09XX XXX XXXX')}
                    {text('bank_name', 'Bank', undefined, 'e.g. BDO Kabankalan')}
                    {text('bank_account_name', 'Account name')}
                    {text('bank_account_number', 'Account number')}
                </Section>

                <Section title="Notifications and display">
                    <Switch
                        className="border border-line px-3 py-2.5 sm:col-span-2"
                        checked={d.sms_ready_enabled}
                        disabled={!editable}
                        onChange={(v) => form.setData('sms_ready_enabled', v)}
                        label="Text customers when a job is ready for pickup"
                        description="Uses the SMS gateway configured on the server. Without one, messages are written to the log."
                    />
                    <Field label="Theme on this device" className="sm:col-span-2">
                        {() => (
                            <Segmented
                                label="Theme"
                                value={theme}
                                onChange={setTheme}
                                options={[
                                    {
                                        value: 'dark',
                                        label: (
                                            <span className="flex items-center gap-1.5">
                                                <Moon className="size-3.5" /> Dark
                                            </span>
                                        ),
                                    },
                                    {
                                        value: 'light',
                                        label: (
                                            <span className="flex items-center gap-1.5">
                                                <Sun className="size-3.5" /> Light, for bright counters
                                            </span>
                                        ),
                                    },
                                ]}
                            />
                        )}
                    </Field>
                </Section>
                <button type="submit" hidden />
            </form>
            {editable && backups && (
                <div className="border-t border-line">
                    <Section title="Backups" body="A backup of every branch is saved on the server every night at 9:30 PM and the last 14 are kept. Copy one to a USB drive or Google Drive now and then.">
                        <div className="space-y-3 sm:col-span-2">
                            <Button
                                icon={<DatabaseBackup />}
                                loading={backingUp}
                                onClick={() => {
                                    setBackingUp(true);
                                    router.post(route('settings.backups.store'), {}, { preserveScroll: true, onFinish: () => setBackingUp(false) });
                                }}
                            >
                                Back up now
                            </Button>
                            {backups.length ? (
                                <ul className="divide-y divide-line border border-line">
                                    {backups.map((b, i) => (
                                        <li key={b.name} className="flex items-center gap-3 px-3 py-2">
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-mono text-sm">{b.name}</p>
                                                <p className="text-xs text-faint">
                                                    {dateTime(b.created_at)}, {formatBytes(b.size)}
                                                    {i === 0 && ', latest'}
                                                </p>
                                            </div>
                                            <a href={route('settings.backups.download', b.name)}>
                                                <Button size="sm" icon={<Download />}>
                                                    Download
                                                </Button>
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-warn-text">No backups yet. Make one now.</p>
                            )}
                        </div>
                    </Section>
                </div>
            )}
        </>
    );
}

function Section({ title, body, children }: { title: string; body?: string; children: ReactNode }) {
    return (
        <section className="grid gap-6 px-5 py-7 lg:grid-cols-[280px_1fr] lg:px-6">
            <div>
                <h2 className="text-lg font-semibold">{title}</h2>
                {body && <p className="mt-1 max-w-[60ch] text-sm text-muted">{body}</p>}
            </div>
            <div className="grid max-w-3xl gap-4 sm:grid-cols-2">{children}</div>
        </section>
    );
}
