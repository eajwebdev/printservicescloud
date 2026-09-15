import { Head, Link, router } from '@inertiajs/react';
import { AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CartLines } from '@/components/pos/cart-lines';
import { CatalogPicker } from '@/components/pos/catalog-picker';
import { ServiceSpecModal } from '@/components/pos/service-spec-modal';
import { Button } from '@/components/ui/button';
import { ErrorText, Field, Input, MoneyInput } from '@/components/ui/field';
import { AnimatedMoney } from '@/components/ui/misc';
import { emptyCart, useCart } from '@/hooks/use-cart';
import { METHOD_LABEL, peso, round2 } from '@/lib/format';
import { newLineKey, serializeLines } from '@/lib/pricing';
import { cn, useAppPage } from '@/lib/utils';
import type { CartLine, Catalog, CatalogService, DiscountType, OrderDetail } from '@/types';

interface Props {
    order: OrderDetail;
    lines: Omit<CartLine, 'key'>[];
    orderDiscount: { type: DiscountType; value: number; senior_pwd: boolean };
    catalog: Catalog;
    canRefund: boolean;
    canDiscount: boolean;
}

/**
 * Change what's on an order after checkout. The screen shows what the customer
 * already paid and turns the difference into a collection or a refund.
 */
export default function OrderChange({ order, lines, orderDiscount, catalog, canRefund, canDiscount }: Props) {
    const { props } = useAppPage();
    const shop = props.shop;
    const initial = useMemo(
        () => ({
            ...emptyCart(),
            discount_type: orderDiscount.type,
            discount_value: orderDiscount.value,
            senior_pwd: orderDiscount.senior_pwd,
            lines: lines.map((l) => ({ ...l, key: newLineKey(), spec: l.spec ?? {}, note: l.note ?? '' })),
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const { cart, priced, totals, addProduct, upsertService, updateLine, removeLine } = useCart(catalog, shop, initial, true);
    const [specFor, setSpecFor] = useState<{ service: CatalogService; line: CartLine | null } | null>(null);
    const [reason, setReason] = useState('');
    const [collect, setCollect] = useState({ method: 'cash', amount: '', reference: '' });
    const [refund, setRefund] = useState({ method: 'cash', reference: '' });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const newTotal = totals.total;
    const difference = round2(newTotal - order.paid);
    const lowered = newTotal < order.total - 0.009;
    const blocked = priced.find((l) => l.needsSize || l.missing || !(Number(l.line.qty) > 0));
    const refundNotAllowed = lowered && !canRefund;
    const walkIn = !order.customer_id;
    const mustCollect = difference > 0.009 && walkIn;
    const collectAmount = Number(collect.amount) || 0;
    const unchanged = Math.abs(newTotal - order.total) < 0.009 && JSON.stringify(serializeLines(cart.lines)) === JSON.stringify(serializeLines(initial.lines));

    const problem = !cart.lines.length
        ? 'An order needs at least one item. To cancel everything, void the order instead.'
        : blocked
          ? `Check ${blocked.name}: it needs a size or quantity.`
          : refundNotAllowed
            ? 'Lowering the total is a return. Your account can add items but not refund; ask a manager.'
            : mustCollect && round2(collectAmount) < difference
              ? `This is a walk-in sale, so collect the full ${peso(difference)} now.`
              : reason.trim().length < 3
                ? 'Write a short reason for the change.'
                : null;

    const save = () => {
        if (problem) return;
        setSaving(true);
        router.put(
            route('orders.change.save', order.id),
            {
                reason,
                lines: serializeLines(cart.lines),
                expected_total: newTotal,
                collect_amount: difference > 0 ? collectAmount : 0,
                collect_method: collect.method,
                collect_reference: collect.reference || null,
                refund_method: refund.method,
                refund_reference: refund.reference || null,
            },
            { onError: setErrors, onFinish: () => setSaving(false) },
        );
    };

    const onService = (s: CatalogService) => {
        if (s.pricing_model !== 'per_sqft' && s.options.length === 0) {
            upsertService({ item_type: 'service', item_id: s.id, qty: 1, spec: {}, discount_type: null, discount_value: 0, note: '' });
        } else setSpecFor({ service: s, line: null });
    };

    const methodButtons = (value: string, onChange: (m: string) => void) => (
        <div className="grid grid-cols-3 gap-1">
            {['cash', 'gcash', 'bank'].map((m) => (
                <button
                    key={m}
                    type="button"
                    aria-pressed={value === m}
                    onClick={() => onChange(m)}
                    className={cn('h-9 rounded-xs border text-base', value === m ? 'border-fg bg-raised text-fg' : 'border-line text-muted hover:text-fg')}
                >
                    {METHOD_LABEL[m]}
                </button>
            ))}
        </div>
    );

    return (
        <>
            <Head title={`Change ${order.order_no}`} />
            <div className="grid h-[calc(100dvh-3.5rem)] min-h-[560px] grid-cols-1 md:grid-cols-[1fr_minmax(380px,440px)]">
                <section className="flex min-h-0 min-w-0 flex-col border-r border-line bg-surface max-md:h-[55vh]">
                    <header className="flex flex-wrap items-center gap-3 border-b border-line bg-bg px-4 py-3">
                        <Link href={route('orders.show', order.id)} className="text-sm text-muted hover:text-fg">
                            Back to order
                        </Link>
                        <h1 className="text-lg font-semibold">
                            Change items on <span className="font-mono">{order.order_no}</span>
                        </h1>
                        <span className="text-sm text-faint">{order.customer}</span>
                    </header>
                    <div className="min-h-0 flex-1">
                        <CatalogPicker catalog={catalog} onProduct={(p) => addProduct(p)} onService={onService} />
                    </div>
                </section>

                <section className="flex min-h-0 min-w-0 flex-col bg-bg">
                    <div className="border-b border-line bg-surface px-4 py-2.5 text-sm text-muted">
                        Edit quantities, remove items, or add from the catalog. Stock is adjusted when you save.
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
                            emptyText="No items left. Add something, or go back and void the order instead."
                        />
                    </div>

                    <div className="space-y-3 border-t border-line bg-surface p-4">
                        <dl className="grid grid-cols-3 border border-line text-center">
                            <div className="border-r border-line px-2 py-2">
                                <dt className="text-xs text-faint">Was</dt>
                                <dd className="num text-base text-muted">{peso(order.total)}</dd>
                            </div>
                            <div className="border-r border-line px-2 py-2">
                                <dt className="text-xs text-faint">Now</dt>
                                <dd>
                                    <AnimatedMoney value={newTotal} className="hud text-lg font-semibold" />
                                </dd>
                            </div>
                            <div className="px-2 py-2">
                                <dt className="text-xs text-faint">Paid so far</dt>
                                <dd className="num text-base">{peso(order.paid)}</dd>
                            </div>
                        </dl>

                        {difference > 0.009 && (
                            <div className="space-y-2 border border-line p-3">
                                <p className="text-base">
                                    Customer owes <span className="num font-semibold text-warn-text">{peso(difference)}</span> more
                                </p>
                                {methodButtons(collect.method, (m) => setCollect({ ...collect, method: m }))}
                                <div className="flex gap-2">
                                    <MoneyInput aria-label="Collect now" placeholder="0.00" className="flex-1" value={collect.amount} onChange={(e) => setCollect({ ...collect, amount: e.target.value })} />
                                    <Button onClick={() => setCollect({ ...collect, amount: difference.toFixed(2) })}>Full</Button>
                                </div>
                                {collect.method !== 'cash' && (
                                    <Input aria-label="Reference number" placeholder="Reference no." className="font-mono" value={collect.reference} onChange={(e) => setCollect({ ...collect, reference: e.target.value })} />
                                )}
                                <p className="text-xs text-faint">
                                    {walkIn ? 'Walk-in sale: collect it all now.' : 'Leave blank or collect part; whatever is left goes on the customer\'s balance.'}
                                </p>
                                <ErrorText>{errors.collect_amount ?? errors.collect_reference ?? errors.collect_method}</ErrorText>
                            </div>
                        )}

                        {difference < -0.009 && (
                            <div className={cn('space-y-2 border p-3', canRefund ? 'border-line' : 'border-accent')}>
                                <p className="text-base">
                                    Give back <span className="num font-semibold text-accent-text">{peso(-difference)}</span>
                                </p>
                                {canRefund ? (
                                    <>
                                        {methodButtons(refund.method, (m) => setRefund({ ...refund, method: m }))}
                                        {refund.method !== 'cash' && (
                                            <Input aria-label="Refund reference" placeholder="Reference no." className="font-mono" value={refund.reference} onChange={(e) => setRefund({ ...refund, reference: e.target.value })} />
                                        )}
                                        <p className="text-xs text-faint">{refund.method === 'cash' ? 'Taken out of your open drawer.' : 'Recorded on the order; send it from the shop account.'}</p>
                                    </>
                                ) : (
                                    <p className="flex items-center gap-2 text-sm text-accent-text">
                                        <AlertTriangle className="size-4" />
                                        Only staff with refund access can lower an order.
                                    </p>
                                )}
                                <ErrorText>{errors.refund_method}</ErrorText>
                            </div>
                        )}

                        <Field label="Reason for the change" error={errors.reason}>
                            {(id, d) => <Input id={id} aria-describedby={d} placeholder="e.g. Added 2 more tarps; returned 1 frame" value={reason} onChange={(e) => setReason(e.target.value)} />}
                        </Field>
                        <ErrorText>{errors.lines}</ErrorText>
                        {problem && !unchanged && <p className="text-sm text-warn-text">{problem}</p>}
                        <div className="flex gap-2">
                            <Link href={route('orders.show', order.id)} className="flex-1">
                                <Button className="w-full" size="lg">
                                    Cancel
                                </Button>
                            </Link>
                            <Button variant="primary" size="lg" className="flex-[2]" disabled={!!problem || unchanged} loading={saving} onClick={save}>
                                {difference < -0.009 ? `Save and refund ${peso(-difference)}` : collectAmount > 0 && difference > 0 ? `Save and collect ${peso(Math.min(collectAmount, difference))}` : 'Save changes'}
                            </Button>
                        </div>
                    </div>
                </section>
            </div>
            <ServiceSpecModal service={specFor?.service ?? null} editing={specFor?.line} shop={shop} onClose={() => setSpecFor(null)} onSave={upsertService} />
        </>
    );
}
