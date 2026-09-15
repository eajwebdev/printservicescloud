import * as Popover from '@radix-ui/react-popover';
import { router } from '@inertiajs/react';
import { ChevronDown, UserPlus, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Chip } from '@/components/ui/chip';
import { peso } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CustomerLite, PageProps } from '@/types';

interface Props {
    value: CustomerLite | null;
    onChange: (c: CustomerLite | null) => void;
    recent: CustomerLite[];
    allowCreate?: boolean;
    className?: string;
}

export function CustomerPicker({ value, onChange, recent, allowCreate = true, className }: Props) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<CustomerLite[]>(recent);
    const [creating, setCreating] = useState(false);
    const [draft, setDraft] = useState({ name: '', phone: '' });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        const ctrl = new AbortController();
        const t = window.setTimeout(() => {
            fetch(`${route('pos.customers.search')}?q=${encodeURIComponent(query)}`, { headers: { Accept: 'application/json' }, credentials: 'same-origin', signal: ctrl.signal })
                .then((r) => r.json())
                .then((d: { customers: CustomerLite[] }) => setResults(d.customers))
                .catch(() => {});
        }, 150);
        return () => {
            ctrl.abort();
            window.clearTimeout(t);
        };
    }, [query, open]);

    const create = (e: FormEvent) => {
        e.preventDefault();
        setSaving(true);
        router.post(route('pos.customers'), draft, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: (page) => {
                const created = (page.props as unknown as PageProps).flash.created_customer;
                if (created) onChange(created);
                setCreating(false);
                setDraft({ name: '', phone: '' });
                setErrors({});
                setOpen(false);
            },
            onError: (errs) => setErrors(errs),
            onFinish: () => setSaving(false),
        });
    };

    return (
        <Popover.Root
            open={open}
            onOpenChange={(o) => {
                setOpen(o);
                if (o) {
                    setQuery('');
                    setCreating(false);
                    setTimeout(() => inputRef.current?.focus(), 30);
                }
            }}
        >
            <div className={cn('flex min-w-0 items-stretch', className)}>
                <Popover.Trigger asChild>
                    <button
                        type="button"
                        className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xs border border-line bg-sunken px-3 text-left transition-colors hover:border-line-strong"
                    >
                        <UserRound className="size-4 shrink-0 text-faint" />
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-base text-fg">{value ? value.name : 'Walk-in customer'}</span>
                            <span className="block truncate text-xs text-faint">
                                {value ? [value.phone, value.credit_balance > 0 ? `owes ${peso(value.credit_balance)}` : null].filter(Boolean).join(', ') || 'No phone on file' : 'Attach a customer for job orders or credit'}
                            </span>
                        </span>
                        {value?.is_senior_pwd && <Chip tone="info">Senior/PWD</Chip>}
                        <ChevronDown className="size-4 text-faint" />
                    </button>
                </Popover.Trigger>
                {value && (
                    <button type="button" onClick={() => onChange(null)} className="ml-1 grid w-9 place-items-center rounded-xs text-faint hover:bg-raised hover:text-fg" aria-label="Back to walk-in">
                        <X className="size-4" />
                    </button>
                )}
            </div>
            <Popover.Portal>
                <Popover.Content align="start" sideOffset={6} className="z-50 w-[min(380px,calc(100vw-2rem))] rounded-md border border-line bg-raised shadow-[var(--shadow-float)]">
                    {creating ? (
                        <form onSubmit={create} className="space-y-3 p-4">
                            <p className="font-display text-base font-semibold">New customer</p>
                            <Field label="Name" error={errors.name}>
                                {(id, d) => <Input id={id} aria-describedby={d} autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />}
                            </Field>
                            <Field label="Mobile" hint="For ready-for-pickup texts" error={errors.phone}>
                                {(id, d) => <Input id={id} aria-describedby={d} inputMode="tel" placeholder="09XX XXX XXXX" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />}
                            </Field>
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
                                    Back
                                </Button>
                                <Button type="submit" variant="primary" size="sm" loading={saving} disabled={!draft.name.trim()}>
                                    Save and attach
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <>
                            <div className="border-b border-line p-2">
                                <Input ref={inputRef} placeholder="Name, business or phone" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search customers" />
                            </div>
                            <ul className="max-h-72 overflow-y-auto p-1" role="listbox">
                                <li>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onChange(null);
                                            setOpen(false);
                                        }}
                                        className="flex w-full items-center gap-2 rounded-xs px-2.5 py-2 text-left text-base text-muted hover:bg-surface hover:text-fg"
                                    >
                                        Walk-in customer
                                    </button>
                                </li>
                                {results.map((c) => (
                                    <li key={c.id}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onChange(c);
                                                setOpen(false);
                                            }}
                                            className={cn('flex w-full items-center justify-between gap-3 rounded-xs px-2.5 py-2 text-left hover:bg-surface', value?.id === c.id && 'bg-selected')}
                                        >
                                            <span className="min-w-0">
                                                <span className="block truncate text-base text-fg">{c.name}</span>
                                                <span className="block truncate text-xs text-faint">{[c.business_name, c.phone].filter(Boolean).join(', ')}</span>
                                            </span>
                                            {c.credit_balance > 0 && <span className="num shrink-0 text-xs text-warn-text">owes {peso(c.credit_balance)}</span>}
                                        </button>
                                    </li>
                                ))}
                                {!results.length && query && <li className="px-2.5 py-3 text-sm text-faint">No customer matches “{query}”.</li>}
                            </ul>
                            {allowCreate && (
                                <div className="border-t border-line p-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon={<UserPlus />}
                                        className="w-full justify-start"
                                        onClick={() => {
                                            setDraft({ name: /\d{4}/.test(query) ? '' : query, phone: /\d{4}/.test(query) ? query : '' });
                                            setCreating(true);
                                        }}
                                    >
                                        Add {query && !/\d{4}/.test(query) ? `“${query}”` : 'a new customer'}
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
