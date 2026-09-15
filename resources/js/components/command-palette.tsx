import * as DialogPrimitive from '@radix-ui/react-dialog';
import { router } from '@inertiajs/react';
import { Command } from 'cmdk';
import { ArrowRight, CornerDownLeft, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { NAV } from '@/layouts/nav';
import { useAppPage } from '@/lib/utils';
import { Kbd } from './ui/misc';

interface Result {
    group: string;
    label: string;
    hint: string;
    url: string;
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const { props } = useAppPage();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Result[]>([]);
    const [loading, setLoading] = useState(false);
    const pages = new Set(props.auth?.pages ?? []);
    const perms = new Set(props.auth?.permissions ?? []);

    useEffect(() => {
        if (!open) {
            setQuery('');
            setResults([]);
        }
    }, [open]);

    useEffect(() => {
        if (query.trim().length < 2) {
            setResults([]);
            return;
        }
        const ctrl = new AbortController();
        setLoading(true);
        const t = window.setTimeout(() => {
            fetch(`${route('search')}?q=${encodeURIComponent(query)}`, {
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin',
                signal: ctrl.signal,
            })
                .then((r) => (r.ok ? r.json() : { results: [] }))
                .then((d: { results: Result[] }) => setResults(d.results))
                .catch(() => {})
                .finally(() => setLoading(false));
        }, 160);
        return () => {
            ctrl.abort();
            window.clearTimeout(t);
        };
    }, [query]);

    const actions = useMemo(
        () =>
            [
                { label: 'Ring up a new sale', url: route('pos.index'), show: pages.has('pos') },
                { label: props.drawer?.open ? 'Count and close my drawer' : 'Open my drawer', url: route('session.index'), show: pages.has('session') },
                { label: 'Write a quotation', url: route('quotations.create'), show: perms.has('quotations.create') || !!props.auth?.user.is_owner },
                { label: 'Record an expense', url: route('expenses.index'), show: perms.has('expenses.create') || !!props.auth?.user.is_owner },
                { label: 'Count stock', url: route('inventory.count'), show: perms.has('inventory.adjust') || !!props.auth?.user.is_owner },
                { label: 'Reorder from a supplier', url: route('purchases.create'), show: perms.has('purchases.create') || !!props.auth?.user.is_owner },
            ].filter((a) => a.show),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [props.auth, props.drawer?.open],
    );

    const go = (url: string) => {
        onOpenChange(false);
        router.visit(url);
    };

    const grouped = results.reduce<Record<string, Result[]>>((acc, r) => {
        (acc[r.group] ??= []).push(r);
        return acc;
    }, {});

    const itemClass =
        'flex h-10 cursor-pointer items-center gap-3 rounded-xs px-3 text-base text-muted data-[selected=true]:bg-surface data-[selected=true]:text-fg [&_svg]:size-4';

    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <AnimatePresence>
                {open && (
                    <DialogPrimitive.Portal forceMount>
                        <DialogPrimitive.Overlay asChild forceMount>
                            <motion.div className="fixed inset-0 z-50 bg-[rgba(6,7,9,0.7)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} />
                        </DialogPrimitive.Overlay>
                        <DialogPrimitive.Content asChild forceMount>
                            <motion.div
                                className="fixed top-[12vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl overflow-hidden rounded-md border border-line bg-raised shadow-[var(--shadow-float)]"
                                initial={{ opacity: 0, x: '-50%', y: -10, scale: 0.97 }}
                                animate={{ opacity: 1, x: '-50%', y: 0, scale: 1 }}
                                exit={{ opacity: 0, x: '-50%', y: -6, scale: 0.98, transition: { duration: 0.1 } }}
                                transition={{ type: 'spring', stiffness: 600, damping: 36 }}
                            >
                                <DialogPrimitive.Title className="sr-only">Jump to anything</DialogPrimitive.Title>
                                <DialogPrimitive.Description className="sr-only">Search orders, customers and items, or jump to a page.</DialogPrimitive.Description>
                                <Command shouldFilter={query.trim().length < 2} loop label="Command palette">
                                    <div className="flex items-center gap-3 border-b border-line px-4">
                                        <Search className="size-4 text-faint" />
                                        <Command.Input
                                            value={query}
                                            onValueChange={setQuery}
                                            placeholder="Order no., customer, SKU, or a page"
                                            className="h-12 flex-1 bg-transparent text-lg text-fg outline-none placeholder:text-ghost"
                                        />
                                        <Kbd>Esc</Kbd>
                                    </div>
                                    <Command.List className="max-h-[56vh] overflow-y-auto p-2">
                                        <Command.Empty className="px-3 py-8 text-center text-base text-muted">
                                            {loading ? 'Looking…' : `Nothing matches “${query}”. Try an order number or phone.`}
                                        </Command.Empty>

                                        {Object.entries(grouped).map(([group, rows]) => (
                                            <Command.Group key={group} heading={group} className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-faint">
                                                {rows.map((r) => (
                                                    <Command.Item key={r.url + r.label} value={`${group} ${r.label} ${r.hint}`} onSelect={() => go(r.url)} className={itemClass}>
                                                        <span className="font-mono text-sm text-fg">{r.label}</span>
                                                        <span className="flex-1 truncate text-sm text-faint">{r.hint}</span>
                                                        <CornerDownLeft className="opacity-40" />
                                                    </Command.Item>
                                                ))}
                                            </Command.Group>
                                        ))}

                                        {query.trim().length < 2 && (
                                            <>
                                                <Command.Group heading="Do" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-faint">
                                                    {actions.map((a) => (
                                                        <Command.Item key={a.label} value={a.label} onSelect={() => go(a.url)} className={itemClass}>
                                                            <ArrowRight className="text-faint" />
                                                            {a.label}
                                                        </Command.Item>
                                                    ))}
                                                </Command.Group>
                                                <Command.Group heading="Go to" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-faint">
                                                    {NAV.flatMap((s) => s.items)
                                                        .filter((i) => pages.has(i.page))
                                                        .map((i) => (
                                                            <Command.Item key={i.page} value={`go ${i.label}`} onSelect={() => go(route(i.route))} className={itemClass}>
                                                                <i.icon className="text-faint" strokeWidth={1.75} />
                                                                {i.label}
                                                            </Command.Item>
                                                        ))}
                                                </Command.Group>
                                            </>
                                        )}
                                    </Command.List>
                                </Command>
                            </motion.div>
                        </DialogPrimitive.Content>
                    </DialogPrimitive.Portal>
                )}
            </AnimatePresence>
        </DialogPrimitive.Root>
    );
}
