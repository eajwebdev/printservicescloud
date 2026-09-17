import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowDown, ArrowUp, ArrowUpRight, ImageUp, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Switch } from '@/components/ui/toggle';
import { ART_LABELS, type ArtKey, type SiteContent, type SiteService } from '@/lib/site';
import { cn } from '@/lib/utils';

interface Identity {
    business_name: string;
    brand_short: string;
    tagline: string;
    brand_color: string;
}

interface Props {
    identity: Identity;
    site: SiteContent;
    defaults: { site: SiteContent; color: string };
    logoUrl: string;
    faviconUrl: string;
    customLogo: boolean;
    customFavicon: boolean;
    artOptions: ArtKey[];
}

type TextKey = { [K in keyof SiteContent]: SiteContent[K] extends string ? K : never }[keyof SiteContent];

const PRESETS = ['#E4141B', '#F97316', '#CA8A04', '#16A34A', '#0D9488', '#1F6FEB', '#7C3AED', '#DB2777'];
const TOKENS = ['{brand}', '{short}', '{region}', '{branches}', '{branch_list}', '{services}', '{year}'];

/** Superadmin: rename and re-dress the whole system for a demo or a new client, from logo to the last line of the website. */
export default function PlatformBranding({ identity, site, defaults, logoUrl, faviconUrl, customLogo, customFavicon, artOptions }: Props) {
    const form = useForm<Identity & { site: SiteContent }>({ ...identity, site });
    const [confirmReset, setConfirmReset] = useState(false);
    const d = form.data;
    const errors = form.errors as Record<string, string | undefined>;

    // Preview the color across the app while picking; leaving the page puts the saved one back.
    const savedColor = useRef(identity.brand_color);
    savedColor.current = identity.brand_color;
    useEffect(() => {
        if (/^#[0-9a-f]{6}$/i.test(d.brand_color)) document.documentElement.style.setProperty('--brand', d.brand_color);
    }, [d.brand_color]);
    useEffect(
        () => () => {
            document.documentElement.style.setProperty('--brand', savedColor.current);
        },
        [],
    );

    const setSite = <K extends keyof SiteContent>(key: K, value: SiteContent[K]) => form.setData('site', { ...form.data.site, [key]: value });
    const save = () => form.put(route('platform.branding.update'), { preserveScroll: true });

    const line = (key: TextKey, label: string, hint?: ReactNode, wide = false) => (
        <Field label={label} hint={hint} error={errors[`site.${key}`]} className={wide ? 'sm:col-span-2' : undefined}>
            {(id, desc) => <Input id={id} aria-describedby={desc} value={d.site[key]} placeholder={defaults.site[key]} onChange={(ev) => setSite(key, ev.target.value)} />}
        </Field>
    );
    const para = (key: TextKey, label: string, hint?: ReactNode) => (
        <Field label={label} hint={hint} error={errors[`site.${key}`]} className="sm:col-span-2">
            {(id, desc) => <Textarea id={id} aria-describedby={desc} className="min-h-20" value={d.site[key]} placeholder={defaults.site[key]} onChange={(ev) => setSite(key, ev.target.value)} />}
        </Field>
    );

    const updateService = (index: number, patch: Partial<SiteService>) => setSite('services', d.site.services.map((s, i) => (i === index ? { ...s, ...patch } : s)));
    const moveService = (index: number, by: -1 | 1) => {
        const list = [...d.site.services];
        const [item] = list.splice(index, 1);
        list.splice(index + by, 0, item);
        setSite('services', list);
    };

    return (
        <>
            <Head title="Branding & website" />
            <PageHeader
                title="Branding & website"
                description="The system name, logo, colors and every line of the public home page. Change them to set the system up for a different shop."
                actions={
                    <>
                        <a href={route('home')} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-xs border border-line-strong px-3.5 text-base hover:border-muted">
                            View website <ArrowUpRight className="size-4" />
                        </a>
                        <Button variant="primary" loading={form.processing} disabled={!form.isDirty} onClick={save}>
                            Save changes
                        </Button>
                    </>
                }
            />

            <div className="border-b border-line bg-sunken px-5 py-3 text-sm text-muted lg:px-6">
                <span className="font-medium text-fg">Writing tips.</span> These words fill in for you: {TOKENS.map((t) => (
                    <code key={t} className="mx-0.5 rounded-xs border border-line bg-surface px-1 font-mono text-xs text-fg">
                        {t}
                    </code>
                ))}
                . Put <code className="rounded-xs border border-line bg-surface px-1 font-mono text-xs text-fg">*stars*</code> around words to show them in the brand color. Empty boxes show the default in grey.
            </div>

            <form
                className="divide-y divide-line"
                onSubmit={(ev) => {
                    ev.preventDefault();
                    save();
                }}
            >
                <Section title="Identity" body="Shown in the sidebar, the browser tab, the sign-in page, the website, receipts, quotations and bills.">
                    <Field label="System or business name" error={errors.business_name}>
                        {(id, desc) => <Input id={id} aria-describedby={desc} value={d.business_name} onChange={(ev) => form.setData('business_name', ev.target.value)} />}
                    </Field>
                    <Field label="Short name" hint="Like EAJ. Branch names that start with it are shortened on the website." error={errors.brand_short}>
                        {(id, desc) => <Input id={id} aria-describedby={desc} value={d.brand_short} onChange={(ev) => form.setData('brand_short', ev.target.value)} />}
                    </Field>
                    <Field label="Tagline" hint="Sign-in page and receipts" error={errors.tagline} className="sm:col-span-2">
                        {(id, desc) => <Input id={id} aria-describedby={desc} value={d.tagline} onChange={(ev) => form.setData('tagline', ev.target.value)} />}
                    </Field>
                    <Field label="Brand color" hint="Buttons, highlights and the website accents" error={errors.brand_color} className="sm:col-span-2">
                        {(id, desc) => (
                            <div className="flex flex-wrap items-center gap-2">
                                <input type="color" aria-label="Pick a brand color" className="h-9 w-12 cursor-pointer rounded-xs border border-line-strong bg-transparent p-0.5" value={/^#[0-9a-f]{6}$/i.test(d.brand_color) ? d.brand_color : defaults.color} onChange={(ev) => form.setData('brand_color', ev.target.value.toUpperCase())} />
                                <Input id={id} aria-describedby={desc} className="w-28 font-mono" maxLength={7} value={d.brand_color} onChange={(ev) => form.setData('brand_color', ev.target.value.trim())} />
                                <span className="flex flex-wrap gap-1.5">
                                    {PRESETS.map((c) => (
                                        <button
                                            key={c}
                                            type="button"
                                            aria-label={`Use ${c}`}
                                            title={c}
                                            onClick={() => form.setData('brand_color', c)}
                                            className={cn('size-7 rounded-full border-2 transition-transform hover:scale-110', d.brand_color.toUpperCase() === c ? 'border-fg' : 'border-transparent')}
                                            style={{ background: c }}
                                        />
                                    ))}
                                </span>
                            </div>
                        )}
                    </Field>
                    <ImagePicker kind="logo" label="Logo" hint="PNG with a transparent background looks best." url={logoUrl} custom={customLogo} />
                    <ImagePicker kind="favicon" label="Browser icon" hint="Square PNG or ICO, 64 × 64 or larger." url={faviconUrl} custom={customFavicon} />
                </Section>

                <Section title="Website: top of the page" body="The first screen visitors see, plus the title and description search engines and link previews show.">
                    {line('meta_title', 'Browser tab title', 'The system name is added after it', true)}
                    {para('meta_description', 'Search and link preview description')}
                    {line('hero_eyebrow', 'Small line above the headline', undefined, true)}
                    {line('hero_line_1', 'Headline, first line')}
                    {line('hero_line_2', 'Headline, second line')}
                    {line('hero_sub', 'Line under the headline', undefined, true)}
                    {para('hero_body', 'Introduction')}
                    {line('hero_cta', 'Main button')}
                </Section>

                <Section title="Website: services" body="Each service becomes a card with a moving illustration, and its name runs across the page in the scrolling band. Add, remove or reorder them freely.">
                    {line('services_title_1', 'Heading, first line')}
                    {line('services_title_2', 'Heading, second line')}
                    {para('services_intro', 'Introduction')}
                    <div className="space-y-3 sm:col-span-2">
                        {errors['site.services'] && <p className="text-sm text-accent-text">{errors['site.services']}</p>}
                        {d.site.services.map((service, i) => (
                            <div key={i} className="border border-line bg-bg p-3">
                                <div className="mb-3 flex items-center gap-2">
                                    <span className="font-mono text-xs text-faint">{String(i + 1).padStart(2, '0')}</span>
                                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{service.title || 'New service'}</span>
                                    <Button size="xs" variant="quiet" icon={<ArrowUp />} aria-label="Move up" disabled={i === 0} onClick={() => moveService(i, -1)} />
                                    <Button size="xs" variant="quiet" icon={<ArrowDown />} aria-label="Move down" disabled={i === d.site.services.length - 1} onClick={() => moveService(i, 1)} />
                                    <Button size="xs" variant="danger" icon={<Trash2 />} aria-label={`Remove ${service.title}`} disabled={d.site.services.length === 1} onClick={() => setSite('services', d.site.services.filter((_, j) => j !== i))} />
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Field label="Name" error={errors[`site.services.${i}.title`]}>
                                        {(id) => <Input id={id} value={service.title} onChange={(ev) => updateService(i, { title: ev.target.value })} />}
                                    </Field>
                                    <Field label="Illustration" error={errors[`site.services.${i}.art`]}>
                                        {(id) => (
                                            <Select id={id} value={service.art} onChange={(ev) => updateService(i, { art: ev.target.value as ArtKey })}>
                                                {artOptions.map((key) => (
                                                    <option key={key} value={key}>
                                                        {ART_LABELS[key]}
                                                    </option>
                                                ))}
                                            </Select>
                                        )}
                                    </Field>
                                    <Field label="Description" error={errors[`site.services.${i}.body`]} className="sm:col-span-2">
                                        {(id) => <Textarea id={id} className="min-h-16" value={service.body} onChange={(ev) => updateService(i, { body: ev.target.value })} />}
                                    </Field>
                                    <Field label="Tags" hint="Separate with commas" error={errors[`site.services.${i}.tags`]} className="sm:col-span-2">
                                        {(id) => <Input id={id} value={service.tags.join(',')} placeholder="Jerseys, Polo shirts, Mugs" onChange={(ev) => updateService(i, { tags: ev.target.value.split(',') })} />}
                                    </Field>
                                </div>
                            </div>
                        ))}
                        <Button icon={<Plus />} disabled={d.site.services.length >= 16} onClick={() => setSite('services', [...d.site.services, { title: '', body: '', tags: [], art: 'logo' }])}>
                            Add a service
                        </Button>
                    </div>
                </Section>

                <Section title="Website: how an order moves" body="Four steps on a board, with a sample job ticket that slides across as visitors scroll.">
                    {line('process_title_1', 'Heading, first line')}
                    {line('process_title_2', 'Heading, second line')}
                    {d.site.steps.map((step, i) => (
                        <div key={i} className="grid gap-3 border border-line bg-bg p-3 sm:col-span-2 sm:grid-cols-[1fr_9rem]">
                            <Field label={`Step ${i + 1}`} error={errors[`site.steps.${i}.title`]}>
                                {(id) => <Input id={id} value={step.title} onChange={(ev) => setSite('steps', d.site.steps.map((s, j) => (j === i ? { ...s, title: ev.target.value } : s)))} />}
                            </Field>
                            <Field label="Ticket stamp" error={errors[`site.steps.${i}.tag`]}>
                                {(id) => <Input id={id} className="font-mono uppercase" value={step.tag} onChange={(ev) => setSite('steps', d.site.steps.map((s, j) => (j === i ? { ...s, tag: ev.target.value.toUpperCase() } : s)))} />}
                            </Field>
                            <Field label="Description" error={errors[`site.steps.${i}.body`]} className="sm:col-span-2">
                                {(id) => <Textarea id={id} className="min-h-14" value={step.body} onChange={(ev) => setSite('steps', d.site.steps.map((s, j) => (j === i ? { ...s, body: ev.target.value } : s)))} />}
                            </Field>
                        </div>
                    ))}
                    {line('ticket_title', 'Sample ticket, job')}
                    {line('ticket_note', 'Sample ticket, note')}
                </Section>

                <Section
                    title="Website: branches"
                    body={
                        <>
                            Branch names, addresses, phone numbers and emails come from{' '}
                            <Link href={route('platform.branches.index')} className="text-fg underline">
                                Branches & plans
                            </Link>
                            .
                        </>
                    }
                >
                    {line('region', 'Area served', 'Fills {region}, like Negros')}
                    <div />
                    {line('branches_title_1', 'Heading, first line')}
                    {line('branches_title_2', 'Heading, second line')}
                    {para('branches_body', 'Introduction')}
                    <Switch
                        className="border border-line px-3 py-2.5 sm:col-span-2"
                        checked={d.site.show_map}
                        onChange={(v) => setSite('show_map', v)}
                        label="Show the Negros Island map"
                        description="Pins branches coded BCD, KAB and DGT. Turn it off for shops elsewhere; the logo and branch count show instead."
                    />
                </Section>

                <Section title="Website: highlights strip" body="Four big figures in a row. A plain number, or {branches} or {services}, counts up as it scrolls into view.">
                    {d.site.highlights.map((item, i) => (
                        <div key={i} className="grid gap-3 border border-line bg-bg p-3 sm:grid-cols-[7rem_1fr]">
                            <Field label="Big text" error={errors[`site.highlights.${i}.big`]}>
                                {(id) => <Input id={id} value={item.big} onChange={(ev) => setSite('highlights', d.site.highlights.map((h, j) => (j === i ? { ...h, big: ev.target.value } : h)))} />}
                            </Field>
                            <Field label="Label" error={errors[`site.highlights.${i}.label`]}>
                                {(id) => <Input id={id} value={item.label} onChange={(ev) => setSite('highlights', d.site.highlights.map((h, j) => (j === i ? { ...h, label: ev.target.value } : h)))} />}
                            </Field>
                            <Field label="Description" error={errors[`site.highlights.${i}.body`]} className="sm:col-span-2">
                                {(id) => <Textarea id={id} className="min-h-14" value={item.body} onChange={(ev) => setSite('highlights', d.site.highlights.map((h, j) => (j === i ? { ...h, body: ev.target.value } : h)))} />}
                            </Field>
                        </div>
                    ))}
                </Section>

                <Section title="Website: closing and footer" body="The last call to action, the giant outlined word behind it, and the footer.">
                    {line('closing_eyebrow', 'Small label')}
                    {line('closing_outline', 'Outlined background word')}
                    {line('closing_line_1', 'Heading, first line', undefined, true)}
                    {line('closing_line_2', 'Heading, second line', 'Starred words get the underline', true)}
                    {para('footer_blurb', 'Footer description')}
                </Section>

                <Section title="Sign-in page">{para('login_body', 'Text under the tagline')}</Section>

                <Section title="Start over" body="Puts all the website text back to the original copy. The name, short name, tagline, color and images stay as they are.">
                    <div className="sm:col-span-2">
                        <Button variant="danger" icon={<RotateCcw />} onClick={() => setConfirmReset(true)}>
                            Restore default website text
                        </Button>
                    </div>
                </Section>

                <div className="flex justify-end px-5 py-5 lg:px-6">
                    <Button type="submit" variant="primary" loading={form.processing} disabled={!form.isDirty}>
                        Save changes
                    </Button>
                </div>
            </form>

            <ConfirmDialog
                open={confirmReset}
                onOpenChange={setConfirmReset}
                title="Restore the default website text?"
                body="Every heading, service, step and highlight goes back to the original copy. Unsaved edits on this page are lost."
                confirmLabel="Restore defaults"
                danger
                onConfirm={() =>
                    router.post(
                        route('platform.branding.reset'),
                        {},
                        {
                            preserveScroll: true,
                            onSuccess: (page) => {
                                const fresh = (page.props as unknown as Props).site;
                                form.setDefaults({ ...form.data, site: fresh });
                                form.setData('site', fresh);
                                setConfirmReset(false);
                            },
                        },
                    )
                }
            />
        </>
    );
}

function ImagePicker({ kind, label, hint, url, custom }: { kind: 'logo' | 'favicon'; label: string; hint: string; url: string; custom: boolean }) {
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const done = { preserveScroll: true, onFinish: () => setBusy(false) };

    return (
        <div className="sm:col-span-2">
            <p className="mb-1.5 text-sm font-medium text-muted">{label}</p>
            <div className="flex flex-wrap items-center gap-3">
                {/* On dark and light, since the website is dark and printouts are white. */}
                <span className="grid h-20 w-36 place-items-center border border-line bg-[#07080A] p-2">
                    <img src={url} alt={`${label} on dark`} className={cn('max-h-full max-w-full object-contain', kind === 'favicon' && 'size-8')} />
                </span>
                <span className="grid h-20 w-36 place-items-center border border-line bg-white p-2">
                    <img src={url} alt={`${label} on white`} className={cn('max-h-full max-w-full object-contain', kind === 'favicon' && 'size-8')} />
                </span>
                <div className="flex flex-col gap-2">
                    <input
                        ref={input}
                        type="file"
                        accept={kind === 'logo' ? 'image/png,image/jpeg,image/webp' : 'image/png,image/x-icon,image/vnd.microsoft.icon,image/jpeg,image/webp,.ico'}
                        className="hidden"
                        onChange={(ev) => {
                            const file = ev.target.files?.[0];
                            ev.target.value = '';
                            if (!file) return;
                            setBusy(true);
                            setError(null);
                            router.post(route('platform.branding.image', kind), { file }, { ...done, forceFormData: true, onError: (e) => setError(e.file ?? 'That file could not be used.') });
                        }}
                    />
                    <Button size="sm" icon={<ImageUp />} loading={busy} onClick={() => input.current?.click()}>
                        Upload {kind === 'logo' ? 'logo' : 'icon'}
                    </Button>
                    {custom && (
                        <Button size="sm" variant="ghost" icon={<RotateCcw />} disabled={busy} onClick={() => { setBusy(true); router.delete(route('platform.branding.image', kind), done); }}>
                            Use the built-in one
                        </Button>
                    )}
                </div>
            </div>
            <p className={cn('mt-1.5 text-xs', error ? 'text-accent-text' : 'text-faint')}>{error ?? hint}</p>
        </div>
    );
}

function Section({ title, body, children }: { title: string; body?: ReactNode; children: ReactNode }) {
    return (
        <section className="grid gap-6 px-5 py-7 lg:grid-cols-[280px_1fr] lg:px-6">
            <div>
                <h2 className="text-lg font-semibold">{title}</h2>
                {body && <p className="mt-1 max-w-[60ch] text-sm text-muted">{body}</p>}
            </div>
            <div className="grid max-w-3xl content-start gap-4 sm:grid-cols-2">{children}</div>
        </section>
    );
}
