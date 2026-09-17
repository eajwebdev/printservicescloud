import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Eye, EyeOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/toggle';
import { cmyk, fillTokens } from '@/lib/site';
import type { PageProps } from '@/types';

export default function Login({ loginBody }: { loginBody?: string }) {
    const { shop, demo } = usePage<PageProps>().props;
    const [show, setShow] = useState(false);
    const form = useForm({ email: '', password: '', remember: true });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post('/login', { onFinish: () => form.reset('password') });
    };

    /** Demo shortcut: fill the form and sign straight in. Transform pins the
     *  payload so we don't post a half-applied setData on the same tick. */
    const signInAs = (user: string) => {
        const credentials = { email: `${user}@skccustomprint.test`, password: 'password', remember: true };
        form.setData(credentials);
        form.transform(() => credentials);
        form.post('/login', {
            onFinish: () => {
                form.transform((data) => data);
                form.reset('password');
            },
        });
    };

    return (
        <div className="relative grid min-h-dvh bg-bg lg:grid-cols-[1.1fr_1fr]">
            <Head title="Sign in" />

            {/* Press-sheet side: halftone field, registration marks, the badge. */}
            <div className="halftone relative hidden overflow-hidden border-r border-line lg:block">
                <div className="absolute inset-10 border border-dashed border-line" aria-hidden />
                <RegistrationMark className="absolute top-6 left-1/2 -translate-x-1/2" />
                <RegistrationMark className="absolute bottom-6 left-1/2 -translate-x-1/2" />
                <RegistrationMark className="absolute top-1/2 left-6 -translate-y-1/2" />
                <RegistrationMark className="absolute top-1/2 right-6 -translate-y-1/2" />

                <div className="relative flex h-full flex-col items-start justify-between p-16">
                    <div className="flex gap-1.5" aria-hidden>
                        {['#0C0E12', shop.color, '#FFFFFF', '#3A4150'].map((c, i) => (
                            <span key={i} className="size-3.5 border border-line-strong" style={{ background: c }} />
                        ))}
                    </div>
                    <div>
                        <img src={shop.logo} alt={shop.name} className="max-h-72 w-[26rem] max-w-full object-contain object-left drop-shadow-[0_30px_40px_rgba(0,0,0,0.55)]" width={416} height={208} />
                        <h1 className="mt-10 max-w-md text-4xl leading-[1.05] font-semibold">{shop.tagline}</h1>
                        <p className="mt-4 max-w-sm text-lg text-muted">
                            {fillTokens(loginBody ?? 'Counter sales, job orders, stock and reports for every {brand} branch.', { brand: shop.name, short: shop.short_name, region: '', branches: 0, branchList: [], services: 0 })}
                        </p>
                    </div>
                    <p className="font-mono text-xs text-faint">{cmyk(shop.color)}</p>
                </div>
            </div>

            <div className="flex items-center justify-center px-6 py-12">
                <form onSubmit={submit} className="w-full max-w-sm" noValidate>
                    <div className="mb-8 flex items-center justify-between gap-3">
                        <Link href={route('home')} className="lg:hidden" aria-label={`${shop.name} home`}>
                            <img src={shop.logo} alt={shop.name} className="h-14 w-auto object-contain" />
                        </Link>
                        <Link href={route('home')} className="ml-auto text-sm text-muted hover:text-fg">
                            &larr; Back to site
                        </Link>
                    </div>

                    <h2 className="text-3xl font-semibold">Sign in to the counter</h2>
                    <p className="mt-1.5 text-base text-muted">Use the account the owner set up for you.</p>

                    <div className="mt-8 space-y-4">
                        <Field label="Email" error={form.errors.email}>
                            {(id, d) => (
                                <Input
                                    id={id}
                                    aria-describedby={d}
                                    type="email"
                                    autoComplete="username"
                                    autoFocus
                                    inputSize="lg"
                                    value={form.data.email}
                                    invalid={!!form.errors.email}
                                    onChange={(e) => form.setData('email', e.target.value)}
                                />
                            )}
                        </Field>
                        <Field label="Password" error={form.errors.password}>
                            {(id, d) => (
                                <div className="relative">
                                    <Input
                                        id={id}
                                        aria-describedby={d}
                                        type={show ? 'text' : 'password'}
                                        autoComplete="current-password"
                                        inputSize="lg"
                                        className="pr-11"
                                        value={form.data.password}
                                        invalid={!!form.errors.password}
                                        onChange={(e) => form.setData('password', e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShow((s) => !s)}
                                        className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-xs text-faint hover:text-fg"
                                        aria-label={show ? 'Hide password' : 'Show password'}
                                    >
                                        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                    </button>
                                </div>
                            )}
                        </Field>
                        <Checkbox checked={form.data.remember} onChange={(v) => form.setData('remember', v)} label="Keep me signed in on this counter" />
                    </div>

                    <Button type="submit" variant="primary" size="lg" className="mt-8 w-full" loading={form.processing}>
                        Sign in
                    </Button>

                    {demo && (
                        <div className="mt-8 border-t border-line pt-4 text-sm text-faint">
                            <p className="mb-2">Demo accounts &mdash; click to sign in, password <span className="font-mono text-muted">password</span></p>
                            <div className="flex flex-wrap gap-2">
                                {['admin', 'manager', 'cashier', 'production', 'bacolod.cashier', 'dumaguete.cashier'].map((u) => (
                                    <button
                                        key={u}
                                        type="button"
                                        disabled={form.processing}
                                        className="rounded-xs border border-line px-2 py-1 font-mono text-xs text-muted hover:border-line-strong hover:text-fg disabled:opacity-50"
                                        onClick={() => signInAs(u)}
                                    >
                                        {u}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}

Login.layout = null;

function RegistrationMark({ className }: { className?: string }) {
    return (
        <svg className={className} width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
            <circle cx="14" cy="14" r="7" stroke="var(--fg-ghost)" strokeWidth="1" />
            <path d="M14 0v28M0 14h28" stroke="var(--fg-ghost)" strokeWidth="1" />
        </svg>
    );
}
