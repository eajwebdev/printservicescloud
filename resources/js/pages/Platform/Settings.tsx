import { Head, useForm } from '@inertiajs/react';
import { Copy, KeyRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/page-header';
import { useToast } from '@/components/toaster';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Field, Input, MoneyInput } from '@/components/ui/field';
import { Checkbox, Switch } from '@/components/ui/toggle';
import { peso } from '@/lib/format';

interface Props {
    settings: { monthly_fee: number; due_days: number; lock_after: number; trial_days: number; remind_days: number; provider_name: string; payment_methods: string[]; paymongo_public_key: string };
    secrets: { secret_key: string | null; webhook_secret: string | null };
    paymongo: { configured: boolean; live: boolean; webhook_url: string };
    methodOptions: Record<string, string>;
}

/** Superadmin: the subscription plan every branch is on, when bills lock a branch, and the PayMongo account that collects. */
export default function PlatformSettings({ settings, secrets, paymongo, methodOptions }: Props) {
    const toast = useToast();
    const form = useForm({
        ...settings,
        monthly_fee: String(settings.monthly_fee),
        due_days: String(settings.due_days),
        lock_after: String(settings.lock_after),
        trial_days: String(settings.trial_days),
        remind_days: String(settings.remind_days),
        paymongo_secret_key: '',
        paymongo_webhook_secret: '',
        clear_secrets: false,
    });
    const d = form.data;
    const e = form.errors;
    const num = (key: 'due_days' | 'lock_after' | 'trial_days' | 'remind_days', label: string, hint: string, min = 0) => (
        <Field label={label} hint={hint} error={e[key]}>
            {(id, dd) => <Input id={id} aria-describedby={dd} type="number" min={min} value={d[key]} onChange={(ev) => form.setData(key, ev.target.value)} />}
        </Field>
    );
    const save = () => form.put(route('platform.settings.update'), { preserveScroll: true, onSuccess: () => form.setData((x) => ({ ...x, paymongo_secret_key: '', paymongo_webhook_secret: '', clear_secrets: false })) });

    return (
        <>
            <Head title="Platform settings" />
            <PageHeader
                title="Platform settings"
                description="The subscription every branch is on, how billing and locking work, and the PayMongo account that receives branch payments."
                actions={
                    <Button variant="primary" loading={form.processing} disabled={!form.isDirty} onClick={save}>
                        Save settings
                    </Button>
                }
            />
            <form
                className="divide-y divide-line"
                onSubmit={(ev) => {
                    ev.preventDefault();
                    save();
                }}
            >
                <Section title="Subscription plan" body={`New bills use this price. A branch with its own price keeps it. Now ${peso(Number(d.monthly_fee) || 0)} per branch, per month.`}>
                    <Field label="Monthly fee per branch" error={e.monthly_fee}>
                        {(id, dd) => <MoneyInput id={id} aria-describedby={dd} value={d.monthly_fee} onChange={(ev) => form.setData('monthly_fee', ev.target.value)} />}
                    </Field>
                    <Field label="Shown on bills as" error={e.provider_name}>
                        {(id, dd) => <Input id={id} aria-describedby={dd} value={d.provider_name} onChange={(ev) => form.setData('provider_name', ev.target.value)} />}
                    </Field>
                    {num('trial_days', 'Default free trial', 'days', 1)}
                </Section>

                <Section title="Due dates and locking" body="Like a utility bill: each branch is billed on the same day every month. Unpaid past the due date, a bill is overdue. With enough overdue bills, staff can still sign in but only see the bill until it is paid.">
                    {num('due_days', 'Bill is due after', 'days')}
                    {num('remind_days', 'Remind before due date', 'days')}
                    {num('lock_after', 'Lock the branch at', 'overdue bills', 1)}
                    <p className="self-end pb-2 text-sm text-muted">
                        With these settings a branch that never pays locks about {Math.max(0, (Number(d.lock_after) || 1) - 1)} month{Number(d.lock_after) === 2 ? '' : 's'} and {d.due_days || 0} days after its first bill.
                    </p>
                </Section>

                <Section
                    title="PayMongo"
                    body="Branches pay their bills on a PayMongo checkout page. Get the keys in the PayMongo dashboard under Developers. Use test keys first; switch to live keys once PayMongo activates your account."
                    badge={paymongo.configured ? <Chip tone={paymongo.live ? 'ok' : 'warn'}>{paymongo.live ? 'Live' : 'Test mode'}</Chip> : <Chip tone="red">Not set up</Chip>}
                >
                    <Field label="Public key" hint="pk_test_ or pk_live_" error={e.paymongo_public_key} className="sm:col-span-2">
                        {(id, dd) => <Input id={id} aria-describedby={dd} className="font-mono" value={d.paymongo_public_key} onChange={(ev) => form.setData('paymongo_public_key', ev.target.value)} />}
                    </Field>
                    <Field label="Secret key" hint={secrets.secret_key ? `Saved: ${secrets.secret_key}` : 'sk_test_ or sk_live_'} error={e.paymongo_secret_key} className="sm:col-span-2">
                        {(id, dd) => <Input id={id} aria-describedby={dd} className="font-mono" type="password" autoComplete="off" placeholder={secrets.secret_key ? 'Leave blank to keep the saved key' : ''} value={d.paymongo_secret_key} onChange={(ev) => form.setData('paymongo_secret_key', ev.target.value)} />}
                    </Field>
                    <Field label="Webhook secret" hint={secrets.webhook_secret ? `Saved: ${secrets.webhook_secret}` : 'whsk_...'} error={e.paymongo_webhook_secret} className="sm:col-span-2">
                        {(id, dd) => <Input id={id} aria-describedby={dd} className="font-mono" type="password" autoComplete="off" placeholder={secrets.webhook_secret ? 'Leave blank to keep the saved secret' : ''} value={d.paymongo_webhook_secret} onChange={(ev) => form.setData('paymongo_webhook_secret', ev.target.value)} />}
                    </Field>
                    <div className="sm:col-span-2">
                        <p className="mb-1.5 text-sm font-medium text-muted">Webhook address</p>
                        <div className="flex gap-2">
                            <Input readOnly className="font-mono text-sm" value={paymongo.webhook_url} onFocus={(ev) => ev.currentTarget.select()} />
                            <Button
                                icon={<Copy />}
                                onClick={() => {
                                    navigator.clipboard?.writeText(paymongo.webhook_url).then(() => toast('success', 'Webhook address copied.'));
                                }}
                            >
                                Copy
                            </Button>
                        </div>
                        <p className="mt-1.5 text-xs text-faint">In PayMongo, add a webhook to this address for the event checkout_session.payment.paid, then paste its secret above. Bills also mark paid when the payer returns to the app.</p>
                    </div>
                    <div className="sm:col-span-2">
                        <p className="mb-2 text-sm font-medium text-muted">Payment methods offered</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {Object.entries(methodOptions).map(([key, label]) => (
                                <Checkbox
                                    key={key}
                                    checked={d.payment_methods.includes(key)}
                                    onChange={(on) => form.setData('payment_methods', on ? [...d.payment_methods, key] : d.payment_methods.filter((m) => m !== key))}
                                    label={label}
                                />
                            ))}
                        </div>
                        {e.payment_methods && <p className="mt-1.5 text-sm text-accent-text">{e.payment_methods}</p>}
                        <p className="mt-1.5 text-xs text-faint">Only methods activated on your PayMongo account will work.</p>
                    </div>
                    {(secrets.secret_key || secrets.webhook_secret) && (
                        <Switch
                            checked={d.clear_secrets}
                            onChange={(v) => form.setData('clear_secrets', v)}
                            label={
                                <span className="flex items-center gap-2">
                                    <KeyRound className="size-4 text-faint" /> Remove saved keys
                                </span>
                            }
                            description="Turns off online payment until new keys are saved."
                            className="border border-line px-3 py-2.5 sm:col-span-2"
                        />
                    )}
                </Section>
                <button type="submit" hidden />
            </form>
        </>
    );
}

function Section({ title, body, badge, children }: { title: string; body?: string; badge?: ReactNode; children: ReactNode }) {
    return (
        <section className="grid gap-6 px-5 py-7 lg:grid-cols-[280px_1fr] lg:px-6">
            <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                    {title} {badge}
                </h2>
                {body && <p className="mt-1 max-w-[60ch] text-sm text-muted">{body}</p>}
            </div>
            <div className="grid max-w-3xl content-start gap-4 sm:grid-cols-2">{children}</div>
        </section>
    );
}
