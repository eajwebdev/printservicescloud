import type { FormDataConvertible } from '@inertiajs/core';
import { Head, router, useForm } from '@inertiajs/react';
import { Archive, ArchiveRestore, BadgePercent, FileText, History, ListOrdered, Printer, ReceiptText, ScanBarcode, Search, Trash2, Vault } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CartLines, specSummary } from '@/components/pos/cart-lines';
import { CatalogPicker } from '@/components/pos/catalog-picker';
import { CustomerPicker } from '@/components/pos/customer-picker';
import { PaymentModal, type CheckoutExtras } from '@/components/pos/payment-modal';
import { ReceiptPaper, type PaperData } from '@/components/pos/receipt-paper';
import { ServiceSpecModal } from '@/components/pos/service-spec-modal';
import { StaleDrawerBanner } from '@/components/stale-drawer-banner';
import { useToast } from '@/components/toaster';
import { Button, ButtonLink } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { Field, Input, MoneyInput, Select } from '@/components/ui/field';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/menu';
import { AnimatedMoney, Kbd } from '@/components/ui/misc';
import { Segmented, Switch } from '@/components/ui/toggle';
import { emptyCart, useCart, type CartState } from '@/hooks/use-cart';
import { useHotkey } from '@/hooks/use-filters';
import { dateTime, peso, time } from '@/lib/format';
import { newLineKey, serializeLines } from '@/lib/pricing';
import { printReceipt } from '@/lib/print';
import { useAppPage } from '@/lib/utils';
import { OrderFiles } from '@/components/orders/order-files';
import type { CartLine, Catalog, CatalogService, CustomerLite, DiscountType, OrderDetail, Option, PageProps } from '@/types';

interface HeldCart {
    id: number;
    label: string;
    payload: CartState;
    total: string;
    created_at: string;
}

interface Props {
    catalog: Catalog;
    staff: Option[];
    held: HeldCart[];
    recentCustomers: CustomerLite[];
    recentOrders: { id: number; order_no: string; type: 'instant' | 'job'; status: string; customer: string; total: number; balance: number; created_at: string }[];
    quote: {
        id: number;
        quote_no: string;
        customer: CustomerLite | null;
        discount_type: DiscountType;
        discount_value: number;
        notes: string | null;
        lines: Omit<CartLine, 'key'>[];
    } | null;
    presetCustomer: CustomerLite | null;
    canDiscount: boolean;
    payTo: { gcash: string; bank: string };
}

const DRAFT_KEY = 'pr-pos-draft';

function initialCart(quote: Props['quote'], userId: number | undefined, preset: CustomerLite | null): CartState {
    if (quote) {
        return {
            ...emptyCart(),
            type: 'job',
            customer: quote.customer,
            discount_type: quote.discount_type,
            discount_value: quote.discount_value,
            notes: quote.notes ?? '',
            quotation_id: quote.id,
            lines: quote.lines.map((l) => ({ ...l, key: newLineKey(), spec: l.spec ?? {}, note: l.note ?? '' })),
        };
    }
    try {
        const raw = localStorage.getItem(`${DRAFT_KEY}-${userId}`);
        if (raw) return { ...emptyCart(), ...(JSON.parse(raw) as CartState), ...(preset ? { customer: preset } : {}) };
    } catch {
        /* ignore */
    }
    return { ...emptyCart(), customer: preset };
}

export default function PosIndex({ catalog, staff, held, recentCustomers, recentOrders, quote, presetCustomer, canDiscount, payTo }: Props) {
    const { props } = useAppPage();
    const shop = props.shop;
    const userId = props.auth?.user.id;
    const toast = useToast();
    const searchRef = useRef<HTMLInputElement>(null);
    const { cart, setCart, priced, totals, addProduct, upsertService, updateLine, removeLine, patch } = useCart(catalog, shop, initialCart(quote, userId, presetCustomer), canDiscount);

    const [specFor, setSpecFor] = useState<{ service: CatalogService; line: CartLine | null } | null>(null);
    const [paying, setPaying] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [receipt, setReceipt] = useState<(PaperData & { orderId: number; type: 'instant' | 'job' }) | null>(null);
    const [discountOpen, setDiscountOpen] = useState(false);
    const drawerOpen = !!props.drawer?.open;

    // Keep an unfinished cart through an accidental refresh.
    useEffect(() => {
        if (quote) return;
        try {
            if (cart.lines.length) localStorage.setItem(`${DRAFT_KEY}-${userId}`, JSON.stringify(cart));
            else localStorage.removeItem(`${DRAFT_KEY}-${userId}`);
        } catch {
            /* storage blocked */
        }
    }, [cart, userId, quote]);

    useEffect(() => {
        if (cart.customer?.is_senior_pwd && !cart.senior_pwd) patch({ senior_pwd: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cart.customer?.id]);

    useHotkey('/', (e) => {
        const target = e.target as HTMLElement;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
        e.preventDefault();
        searchRef.current?.focus();
    });
    useHotkey('f8', (e) => {
        e.preventDefault();
        startPayment();
    });

    const onService = (s: CatalogService) => {
        if (s.pricing_model !== 'per_sqft' && s.options.length === 0) {
            upsertService({ item_type: 'service', item_id: s.id, qty: 1, spec: {}, discount_type: null, discount_value: 0, note: '' });
            return;
        }
        setSpecFor({ service: s, line: null });
    };

    const blocking = priced.find((l) => l.needsSize || l.missing || (l.product && Number(l.line.qty) > l.product.stock) || !(Number(l.line.qty) > 0));
    const hasJobService = priced.some((l) => l.service?.is_job);
    const leadHours = Math.max(0, ...priced.map((l) => l.service?.lead_time_hours ?? 0));

    const startPayment = () => {
        if (!drawerOpen) return;
        if (!cart.lines.length) {
            toast('error', 'The cart is empty. Add a service or product first.');
            return;
        }
        if (blocking) {
            toast('error', blocking.needsSize ? `Enter a size for ${blocking.name}.` : blocking.missing ? 'Remove the unavailable item from the cart.' : `Check the quantity of ${blocking.name}.`);
            return;
        }
        setErrors({});
        setPaying(true);
    };

    const checkout = (extras: CheckoutExtras) => {
        const snapshot = { priced, totals, cart };
        setProcessing(true);
        router.post(
            route('pos.checkout'),
            {
                type: cart.type,
                customer_id: cart.customer?.id ?? null,
                lines: serializeLines(cart.lines),
                discount_type: cart.discount_type,
                discount_value: cart.discount_value,
                senior_pwd: cart.senior_pwd,
                quotation_id: cart.quotation_id,
                expected_total: totals.total,
                rush: cart.lines.some((l) => l.spec.rush),
                ...extras,
            },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: (page) => {
                    const flash = (page.props as unknown as PageProps).flash.receipt;
                    if (!flash) return;
                    const moneyIn = extras.payments.filter((p) => p.method !== 'credit').reduce((s, p) => s + p.amount, 0);
                    setReceipt({
                        orderId: flash.order_id,
                        type: flash.type,
                        shopName: shop.name,
                        tagline: shop.tagline,
                        logo: shop.logo,
                        title: flash.type === 'job' ? 'JOB ORDER' : 'SALES RECEIPT',
                        number: flash.order_no,
                        date: dateTime(new Date().toISOString()),
                        customer: snapshot.cart.customer?.name ?? 'Walk-in',
                        lines: snapshot.priced.map((l) => ({ name: l.name, detail: specSummary(l), qty: Number(l.line.qty), unitPrice: l.unitPrice, total: l.total, rush: l.line.spec.rush })),
                        subtotal: snapshot.totals.subtotal,
                        discount: snapshot.totals.discountTotal,
                        tax: shop.tax_mode !== 'none' ? snapshot.totals.tax : 0,
                        total: snapshot.totals.total,
                        payments: extras.payments.map((p) => ({ method: p.method, amount: p.method === 'cash' && p.tendered ? p.tendered : p.amount, reference: p.reference })),
                        change: flash.change,
                        balance: Math.max(0, Math.round((snapshot.totals.total - moneyIn) * 100) / 100),
                    });
                    if (shop.auto_print) void printReceipt(flash.order_id);
                    setPaying(false);
                    setCart(emptyCart());
                    if (quote) router.replace({ url: route('pos.index'), preserveState: true });
                },
                onError: (errs) => setErrors(errs),
                onFinish: () => setProcessing(false),
            },
        );
    };

    const park = () => {
        if (!cart.lines.length) return;
        router.post(
            route('pos.held.store'),
            { label: cart.customer?.name ?? `Walk-in, ${time(new Date().toISOString())}`, payload: cart as unknown as FormDataConvertible, total: totals.total },
            { preserveScroll: true, onSuccess: () => setCart(emptyCart()) },
        );
    };

    const resume = (h: HeldCart) => {
        if (cart.lines.length && !window.confirm('Replace the current cart with this parked sale?')) return;
        setCart({ ...emptyCart(), ...h.payload });
        router.delete(route('pos.held.destroy', h.id), { preserveScroll: true, preserveState: true });
    };

    const itemCount = useMemo(() => cart.lines.reduce((s, l) => s + (Number(l.qty) || 0), 0), [cart.lines]);

    return (
        <>
            <Head title="New sale" />
            <div className="relative grid h-[calc(100dvh-3.5rem)] min-h-[560px] grid-cols-1 md:grid-cols-[1fr_minmax(360px,420px)]">
                {/* Catalog */}
                <section className="min-h-0 min-w-0 border-r border-line bg-surface max-md:hidden" aria-label="Catalog">
                    <CatalogPicker ref={searchRef} catalog={catalog} onProduct={(p) => addProduct(p)} onService={onService} onScanMiss={(code) => toast('error', `Nothing in the catalog matches “${code}”.`)} />
                </section>

                {/* Cart */}
                <section className="flex min-h-0 min-w-0 flex-col bg-bg" aria-label="Cart">
                    <div className="space-y-2 border-b border-line bg-surface p-3">
                        <StaleDrawerBanner />
                        {quote && cart.quotation_id && (
                            <div className="flex items-center gap-2 border border-line bg-raised px-3 py-2 text-sm">
                                <FileText className="size-4 text-faint" />
                                <span className="flex-1">
                                    Converting quotation <span className="font-mono">{quote.quote_no}</span>
                                </span>
                            </div>
                        )}
                        <CustomerPicker value={cart.customer} onChange={(c) => patch({ customer: c })} recent={recentCustomers} />
                        <div className="flex items-center gap-2">
                            <Segmented
                                label="Sale type"
                                className="flex-1"
                                value={cart.type}
                                onChange={(t) => patch({ type: t })}
                                options={[
                                    { value: 'instant', label: 'Instant sale', hint: 'Paid and done now' },
                                    { value: 'job', label: 'Job order', hint: 'Goes to the production board' },
                                ]}
                            />
                            <Menu
                                trigger={
                                    <Button variant="quiet" size="md" icon={<History />} aria-label="My recent sales today" title="My recent sales today">
                                        {recentOrders.length > 0 && <span className="num">{recentOrders.length}</span>}
                                    </Button>
                                }
                            >
                                <MenuLabel>My sales today</MenuLabel>
                                {recentOrders.length ? (
                                    recentOrders.map((o) => (
                                        <MenuItem key={o.id} className="h-auto min-w-80 gap-3 py-2" onSelect={() => router.visit(route('orders.index', { view: o.type === 'job' && o.status !== 'released' ? 'board' : 'today', highlight: o.id }))}>
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center gap-1.5">
                                                    <span className="font-mono text-sm">{o.order_no}</span>
                                                    {o.type === 'job' && <span className="rounded-xs bg-surface px-1 text-2xs text-muted">Job</span>}
                                                </span>
                                                <span className="block truncate text-xs text-faint">
                                                    {time(o.created_at)}, {o.customer}
                                                    {o.balance > 0 ? `, owes ${peso(o.balance)}` : ''}
                                                </span>
                                            </span>
                                            <span className="num text-sm text-muted">{peso(o.total)}</span>
                                        </MenuItem>
                                    ))
                                ) : (
                                    <p className="px-2 py-2 text-sm text-faint">No sales yet today.</p>
                                )}
                                <MenuSeparator />
                                <MenuItem icon={<ListOrdered />} onSelect={() => router.visit(route('orders.index', { view: 'today' }))}>
                                    All sales today
                                </MenuItem>
                            </Menu>
                            <Menu
                                trigger={
                                    <Button variant="quiet" size="md" icon={<ArchiveRestore />} aria-label="Parked sales" title="Parked sales">
                                        {held.length > 0 && <span className="num">{held.length}</span>}
                                    </Button>
                                }
                            >
                                <MenuLabel>Parked sales</MenuLabel>
                                {held.length ? (
                                    held.map((h) => (
                                        <MenuItem key={h.id} onSelect={() => resume(h)}>
                                            <span className="flex-1 truncate">{h.label}</span>
                                            <span className="num text-sm text-muted">{peso(Number(h.total))}</span>
                                        </MenuItem>
                                    ))
                                ) : (
                                    <p className="px-2 py-2 text-sm text-faint">Nothing parked.</p>
                                )}
                                <MenuSeparator />
                                <MenuItem icon={<Archive />} onSelect={park} disabled={!cart.lines.length}>
                                    Park this sale
                                </MenuItem>
                                <MenuItem icon={<Trash2 />} danger onSelect={() => setCart(emptyCart())} disabled={!cart.lines.length}>
                                    Clear cart
                                </MenuItem>
                            </Menu>
                        </div>
                        {hasJobService && cart.type === 'instant' && (
                            <p className="text-xs text-warn-text">This cart has produced items. Switch to Job order to put it on the board with a pickup date.</p>
                        )}
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto bg-surface">
                        <CartLines
                            lines={priced}
                            canDiscount={canDiscount}
                            onUpdate={updateLine}
                            onRemove={removeLine}
                            onEditService={(line) => {
                                const s = catalog.services.find((x) => x.id === line.item_id);
                                if (s) setSpecFor({ service: s, line });
                            }}
                        />
                        {/* Phone-width fallback: the catalog stacks under the cart. */}
                        <div className="h-[60vh] border-t border-line md:hidden">
                            <CatalogPicker catalog={catalog} onProduct={(p) => addProduct(p)} onService={onService} compact />
                        </div>
                    </div>

                    <div className="border-t border-line bg-surface">
                        <dl className="space-y-1 px-4 pt-3 text-base">
                            <div className="flex justify-between text-muted">
                                <dt>
                                    Subtotal <span className="num text-faint">({itemCount} items)</span>
                                </dt>
                                <dd className="num">{peso(totals.subtotal + totals.lineDiscounts)}</dd>
                            </div>
                            {totals.lineDiscounts + totals.discountTotal > 0 && (
                                <div className="flex justify-between text-muted">
                                    <dt>Discounts</dt>
                                    <dd className="num text-info-text">−{peso(totals.lineDiscounts + totals.discountTotal)}</dd>
                                </div>
                            )}
                            {shop.tax_mode !== 'none' && (
                                <div className="flex justify-between text-muted">
                                    <dt>VAT {shop.tax_mode === 'inclusive' ? '(included)' : `${shop.tax_rate}%`}</dt>
                                    <dd className="num">{peso(totals.tax)}</dd>
                                </div>
                            )}
                        </dl>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
                            <Switch checked={cart.senior_pwd} onChange={(v) => patch({ senior_pwd: v })} label={<span className="text-sm">Senior / PWD {shop.senior_pwd_percent}%</span>} disabled={!canDiscount && !cart.customer?.is_senior_pwd} />
                            {canDiscount && (
                                <button type="button" onClick={() => setDiscountOpen(true)} className="ml-auto flex items-center gap-1.5 text-sm text-muted hover:text-fg">
                                    <BadgePercent className="size-4" />
                                    {cart.discount_type ? `Order discount ${cart.discount_type === 'percent' ? `${cart.discount_value}%` : peso(cart.discount_value)}` : 'Order discount'}
                                </button>
                            )}
                        </div>
                        <div className="flex items-end justify-between gap-3 border-t border-line px-4 pt-3 pb-2">
                            <span className="text-base text-muted">Total</span>
                            <AnimatedMoney value={totals.total} className="hud text-4xl leading-none font-semibold" />
                        </div>
                        <div className="p-3 pt-1">
                            <Button variant="primary" size="xl" className="w-full" onClick={startPayment} disabled={!cart.lines.length || !drawerOpen}>
                                {cart.type === 'job' ? 'Take payment and create job' : 'Charge'} {cart.lines.length > 0 && peso(totals.total)}
                                <Kbd className="ml-1 border-white/30 bg-white/10 text-white/80">F8</Kbd>
                            </Button>
                        </div>
                    </div>
                </section>

                {!drawerOpen && <DrawerLock />}
            </div>

            <ServiceSpecModal service={specFor?.service ?? null} editing={specFor?.line} shop={shop} onClose={() => setSpecFor(null)} onSave={upsertService} />

            <PaymentModal
                open={paying}
                onClose={() => setPaying(false)}
                total={totals.total}
                type={cart.type}
                customer={cart.customer}
                staff={staff}
                leadHours={leadHours}
                payTo={payTo}
                notes={cart.notes}
                processing={processing}
                errors={errors}
                onSubmit={checkout}
            />

            <OrderDiscountModal
                open={discountOpen}
                onClose={() => setDiscountOpen(false)}
                type={cart.discount_type}
                value={cart.discount_value}
                onSave={(type, value) => {
                    patch({ discount_type: type, discount_value: value });
                    setDiscountOpen(false);
                }}
            />

            <ReceiptModal receipt={receipt} autoPrinted={shop.auto_print} onClose={() => {
                setReceipt(null);
                setTimeout(() => searchRef.current?.focus(), 50);
            }} />
        </>
    );
}

function ReceiptModal({ receipt, autoPrinted, onClose }: { receipt: (PaperData & { orderId: number; type: 'instant' | 'job' }) | null; autoPrinted: boolean; onClose: () => void }) {
    const [printing, setPrinting] = useState(false);
    const [detail, setDetail] = useState<OrderDetail | null>(null);
    const orderId = receipt?.orderId;
    const isJob = receipt?.type === 'job';
    const loadDetail = () => {
        if (!orderId) return;
        fetch(route('orders.peek', orderId), { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => j && setDetail(j.order))
            .catch(() => undefined);
    };
    useEffect(() => {
        setDetail(null);
        if (isJob) loadDetail();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderId]);
    useHotkey('enter', (e) => {
        if (!receipt) return;
        e.preventDefault();
        onClose();
    }, !!receipt);

    return (
        <Modal
            open={!!receipt}
            onOpenChange={(o) => !o && onClose()}
            size="md"
            title={receipt?.type === 'job' ? `Job order ${receipt?.number} is on the board` : `Sale ${receipt?.number} complete`}
            description={receipt?.balance ? `Balance of ${peso(receipt.balance)} is on the customer's account.` : 'Paid in full.'}
            className="bg-bg"
            footer={
                receipt && (
                    <>
                        <Button
                            icon={<Printer />}
                            loading={printing}
                            onClick={() => {
                                setPrinting(true);
                                printReceipt(receipt.orderId).finally(() => setPrinting(false));
                            }}
                        >
                            {autoPrinted ? 'Print again' : 'Print receipt'}
                        </Button>
                        <Button
                            variant="ghost"
                            icon={<Search />}
                            className="mr-auto"
                            onClick={() => router.visit(route('orders.index', { view: receipt.type === 'job' ? 'board' : 'today', highlight: receipt.orderId }))}
                        >
                            Find this order
                        </Button>
                        {receipt.type === 'job' && (
                            <a href={route('orders.ticket', receipt.orderId)} target="_blank" rel="noreferrer">
                                <Button icon={<ReceiptText />}>Job ticket</Button>
                            </a>
                        )}
                        <Button variant="primary" onClick={onClose} icon={<ScanBarcode />} data-autofocus>
                            Next customer <Kbd className="border-white/30 bg-white/10 text-white/80">Enter</Kbd>
                        </Button>
                    </>
                )
            }
        >
            {receipt && (
                <div className="grid items-start gap-6 sm:grid-cols-[1fr_auto]">
                    <div>
                        <ReceiptPaper data={receipt} />
                        <p className="mt-3 text-center text-xs text-faint">
                            Saved under Orders, {receipt.type === 'job' ? 'Production board' : 'Sales today'}. The clock button above the cart lists your sales too.
                        </p>
                    </div>
                    {isJob && (
                        <div className="border border-line bg-surface p-3 sm:col-span-2">
                            <p className="mb-2 text-base font-medium">Attach the customer's files</p>
                            {detail ? (
                                <OrderFiles compact orderId={receipt.orderId} files={detail.files} proofStatus={detail.proof_status} isJob onChanged={loadDetail} />
                            ) : (
                                <p className="text-sm text-faint">Loading…</p>
                            )}
                        </div>
                    )}
                    {!!receipt.change && (
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.1 }} className="order-first border border-line bg-surface px-5 py-4 text-center sm:order-none">
                            <p className="text-sm text-faint">Give change</p>
                            <p className="hud text-4xl font-semibold text-ok-text">{peso(receipt.change)}</p>
                        </motion.div>
                    )}
                </div>
            )}
        </Modal>
    );
}

function OrderDiscountModal({ open, onClose, type, value, onSave }: { open: boolean; onClose: () => void; type: DiscountType; value: number; onSave: (t: DiscountType, v: number) => void }) {
    const [t, setT] = useState<string>(type ?? 'percent');
    const [v, setV] = useState(String(value || ''));
    useEffect(() => {
        if (open) {
            setT(type ?? 'percent');
            setV(value ? String(value) : '');
        }
    }, [open, type, value]);

    return (
        <Modal
            open={open}
            onOpenChange={(o) => !o && onClose()}
            size="sm"
            title="Order discount"
            description="Applies to the whole order after line discounts."
            footer={
                <>
                    <Button variant="ghost" className="mr-auto" onClick={() => onSave(null, 0)}>
                        Remove
                    </Button>
                    <Button variant="primary" onClick={() => onSave((Number(v) > 0 ? t : null) as DiscountType, Number(v) || 0)}>
                        Apply
                    </Button>
                </>
            }
        >
            <div className="grid grid-cols-[130px_1fr] gap-3">
                <Field label="Type">
                    {(id) => (
                        <Select id={id} value={t} onChange={(e) => setT(e.target.value)}>
                            <option value="percent">Percent</option>
                            <option value="amount">Peso off</option>
                        </Select>
                    )}
                </Field>
                <Field label={t === 'percent' ? 'Percent' : 'Amount'}>
                    {(id) => (t === 'percent' ? <Input id={id} type="number" min={0} max={100} autoFocus suffix="%" value={v} onChange={(e) => setV(e.target.value)} /> : <MoneyInput id={id} autoFocus value={v} onChange={(e) => setV(e.target.value)} />)}
                </Field>
            </div>
        </Modal>
    );
}

/** The POS is locked until this cashier opens a drawer. Open it right here. */
function DrawerLock() {
    const form = useForm({ opening_float: '1000', note: '', return_to: 'pos' });
    return (
        <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-20 flex items-center justify-center bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] p-6 backdrop-blur-[2px]">
                <div className="halftone absolute inset-0" aria-hidden />
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.post(route('session.open'));
                    }}
                    className="crop-marks relative w-full max-w-md border border-line bg-surface p-7 shadow-[var(--shadow-float)]"
                >
                    <span className="crop-b" />
                    <Vault className="size-7 text-accent-text" strokeWidth={1.5} />
                    <h2 className="mt-3 text-2xl font-semibold">Open your drawer to start selling</h2>
                    <p className="mt-1.5 text-base text-muted">Count the cash in the tray and enter it as your starting amount. Sales, refunds and cash expenses will reconcile against it when you close.</p>
                    <Field label="Starting cash" error={form.errors.opening_float} className="mt-5">
                        {(id, d) => <MoneyInput id={id} aria-describedby={d} inputSize="lg" className="text-2xl" autoFocus value={form.data.opening_float} onChange={(e) => form.setData('opening_float', e.target.value)} />}
                    </Field>
                    <div className="mt-5 flex flex-wrap gap-2">
                        <Button type="submit" variant="primary" size="lg" loading={form.processing} className="flex-1">
                            Open drawer
                        </Button>
                        <ButtonLink href={route('session.index')} size="lg" variant="ghost">
                            Count by bills
                        </ButtonLink>
                    </div>
                </form>
            </motion.div>
        </AnimatePresence>
    );
}
