import { Head, Link, router } from '@inertiajs/react';
import { ArrowRightLeft, FileDown, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button, ButtonLink } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/field';
import { date, money, qty } from '@/lib/format';
import { useCan, useAppPage } from '@/lib/utils';
import type { LineSpec } from '@/types';
import { QUOTE_LABEL, QUOTE_TONE } from './Index';

interface Props {
    quotation: {
        id: number;
        quote_no: string;
        status: string;
        customer: string;
        customer_phone: string | null;
        valid_until: string | null;
        subtotal: number;
        discount_total: number;
        tax_total: number;
        total: number;
        notes: string | null;
        order_id: number | null;
        order_no: string | null;
        prepared_by: string | null;
        created_at: string;
        lines: { id: number; name: string; spec: LineSpec | null; qty: number; unit_price: number; line_total: number; discount_amount: number; note: string | null }[];
    };
    business: { name: string; tagline: string; address: string; phone: string; email: string; quotation_terms: string };
}

export default function QuotationShow({ quotation: q, business: shop }: Props) {
    const can = useCan();
    const { props } = useAppPage();
    const [deleting, setDeleting] = useState(false);
    const converted = q.status === 'converted';

    return (
        <>
            <Head title={q.quote_no} />
            <PageHeader
                back={{ href: route('quotations.index'), label: 'Quotations' }}
                title={<span className="font-mono">{q.quote_no}</span>}
                meta={<Chip tone={QUOTE_TONE[q.status]}>{QUOTE_LABEL[q.status]}</Chip>}
                description={
                    converted && q.order_id ? (
                        <>
                            Became order{' '}
                            <Link className="font-mono text-fg underline" href={route('orders.show', q.order_id)}>
                                {q.order_no}
                            </Link>
                            .
                        </>
                    ) : (
                        `For ${q.customer}. Valid until ${q.valid_until ? date(q.valid_until) : 'confirmed'}.`
                    )
                }
                actions={
                    <>
                        <a href={route('quotations.pdf', q.id)} target="_blank" rel="noreferrer">
                            <Button icon={<FileDown />}>PDF</Button>
                        </a>
                        {!converted && can('quotations.edit') && (
                            <>
                                <Select
                                    className="w-36"
                                    aria-label="Change status"
                                    value={['draft', 'sent', 'accepted', 'expired'].includes(q.status) ? q.status : ''}
                                    onChange={(e) => router.patch(route('quotations.status', q.id), { status: e.target.value }, { preserveScroll: true })}
                                >
                                    <option value="draft">Draft</option>
                                    <option value="sent">Sent</option>
                                    <option value="accepted">Accepted</option>
                                    <option value="expired">Expired</option>
                                </Select>
                                <ButtonLink href={route('quotations.edit', q.id)} icon={<Pencil />}>
                                    Edit
                                </ButtonLink>
                            </>
                        )}
                        {!converted && can('quotations.delete') && <Button variant="danger" icon={<Trash2 />} aria-label="Delete quotation" onClick={() => setDeleting(true)} />}
                        {!converted && props.auth?.pages.includes('pos') && (
                            <Button variant="primary" icon={<ArrowRightLeft />} onClick={() => router.post(route('quotations.convert', q.id))}>
                                Convert to order
                            </Button>
                        )}
                    </>
                }
            />

            {/* White paper on charcoal: the quote as the customer will see it. */}
            <div className="halftone flex justify-center px-4 py-10">
                <article className="w-full max-w-[760px]">
                    <div className="h-1 bg-red-500" />
                    <div className="paper-sheet pb-12">
                        <header className="flex items-center gap-4 bg-ink-950 px-8 py-5 text-[#ECEEF2]">
                            <img src={props.shop.logo} alt="" className="size-12 rounded-full" />
                            <div>
                                <p className="font-display text-lg font-semibold">{shop.name}</p>
                                <p className="text-sm text-[#9AA2B1]">{shop.tagline}</p>
                            </div>
                            <p className="ml-auto max-w-56 text-right text-xs text-[#9AA2B1]">
                                {shop.address}
                                <br />
                                {shop.phone}
                            </p>
                        </header>
                        <div className="px-8 pt-8 text-[#12151B]">
                            <div className="flex flex-wrap justify-between gap-4">
                                <div>
                                    <h2 className="font-display text-3xl font-semibold">Quotation</h2>
                                    <p className="font-mono text-sm">{q.quote_no}</p>
                                </div>
                                <div className="text-right text-sm">
                                    <p className="text-[#626975]">Date</p>
                                    <p>{date(q.created_at)}</p>
                                    <p className="mt-1 text-[#626975]">Valid until</p>
                                    <p className="font-semibold">{q.valid_until ? date(q.valid_until) : 'On confirmation'}</p>
                                </div>
                            </div>
                            <div className="mt-6 border-t border-[#DCDDD8] pt-4">
                                <p className="text-xs text-[#626975]">Prepared for</p>
                                <p className="text-lg font-semibold">{q.customer}</p>
                                {q.customer_phone && <p className="text-sm text-[#4F5663]">{q.customer_phone}</p>}
                            </div>
                            <div className="mt-6 overflow-x-auto">
                                <table className="w-full min-w-[520px] text-sm">
                                    <thead>
                                        <tr className="border-b border-[#12151B] text-left text-xs text-[#626975]">
                                            <th className="py-2 font-normal">Description</th>
                                            <th className="py-2 text-right font-normal">Qty</th>
                                            <th className="py-2 text-right font-normal">Unit price</th>
                                            <th className="py-2 text-right font-normal">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {q.lines.map((l) => (
                                            <tr key={l.id} className="border-b border-[#ECECE8] align-top">
                                                <td className="py-2.5 pr-4">
                                                    <p className="font-medium">{l.name}</p>
                                                    <p className="text-xs text-[#4F5663]">
                                                        {[l.spec?.width ? `${qty(l.spec.width)} × ${qty(l.spec.height)} ${l.spec.unit}, ${qty(l.spec.sqft, 2)} sqft each` : null, l.spec?.options?.length ? `With ${l.spec.options.map((o) => o.name).join(', ')}` : null, l.spec?.rush ? 'Rush' : null, l.note]
                                                            .filter(Boolean)
                                                            .join('. ')}
                                                    </p>
                                                </td>
                                                <td className="num py-2.5 text-right">{qty(l.qty)}</td>
                                                <td className="num py-2.5 text-right">{money(l.unit_price)}</td>
                                                <td className="num py-2.5 text-right">{money(l.line_total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-4 flex flex-wrap justify-between gap-6">
                                <p className="max-w-sm text-sm whitespace-pre-line text-[#4F5663]">{q.notes}</p>
                                <dl className="w-64 text-sm">
                                    <div className="flex justify-between py-0.5">
                                        <dt>Subtotal</dt>
                                        <dd className="num">{money(q.subtotal)}</dd>
                                    </div>
                                    {q.discount_total > 0 && (
                                        <div className="flex justify-between py-0.5">
                                            <dt>Discount</dt>
                                            <dd className="num">−{money(q.discount_total)}</dd>
                                        </div>
                                    )}
                                    <div className="mt-1 flex justify-between border-t border-[#12151B] pt-1.5 font-display text-xl font-semibold">
                                        <dt>Total</dt>
                                        <dd className="num">₱{money(q.total)}</dd>
                                    </div>
                                </dl>
                            </div>
                            {shop.quotation_terms && <p className="mt-8 border-t border-[#DCDDD8] pt-3 text-xs whitespace-pre-line text-[#626975]">{shop.quotation_terms}</p>}
                            <p className="mt-8 text-sm">Prepared by {q.prepared_by}</p>
                        </div>
                        <div className="paper-peel" aria-hidden />
                    </div>
                </article>
            </div>

            <ConfirmDialog
                open={deleting}
                onOpenChange={setDeleting}
                title={`Delete ${q.quote_no}?`}
                body="The quote and its lines are removed. This can not be undone."
                confirmLabel="Delete quotation"
                onConfirm={() => router.delete(route('quotations.destroy', q.id))}
            />
        </>
    );
}
