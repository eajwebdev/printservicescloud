import type { ReactNode } from 'react';
import { METHOD_LABEL, money, qty as fmtQty } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface PaperLine {
    name: string;
    detail?: string | null;
    qty: number;
    unitPrice: number;
    total: number;
    rush?: boolean;
}

export interface PaperData {
    shopName: string;
    tagline: string;
    logo: string;
    title: string;
    number: string;
    date: string;
    customer: string;
    lines: PaperLine[];
    subtotal: number;
    discount: number;
    tax?: number;
    total: number;
    payments: { method: string; amount: number; reference?: string | null }[];
    change?: number;
    balance?: number;
    footer?: ReactNode;
}

/** The one place white dominates: a printed receipt on charcoal, with the logo's peeling corner. */
export function ReceiptPaper({ data, className }: { data: PaperData; className?: string }) {
    return (
        <div className={cn('mx-auto w-full max-w-[330px]', className)}>
            <div className="perforated" aria-hidden />
            <div className="paper-sheet px-6 pt-5 pb-10 font-mono text-[12px] leading-[1.55]">
                <div className="text-center">
                    <img src={data.logo} alt="" className="mx-auto size-12 rounded-full" />
                    <p className="mt-2 font-display text-base font-semibold tracking-tight">{data.shopName}</p>
                    <p className="text-[11px] text-[#5B6472]">{data.tagline}</p>
                </div>
                <Rule />
                <Row left={data.title} right={<b>{data.number}</b>} />
                <Row left="Date" right={data.date} muted />
                <Row left="Customer" right={data.customer} muted />
                <Rule />
                {data.lines.map((l, i) => (
                    <div key={i} className="mb-1.5">
                        <p className="font-sans text-[12.5px] font-medium">
                            {l.name}
                            {l.rush && <span className="ml-1 text-[#C21016]">RUSH</span>}
                        </p>
                        {l.detail && <p className="text-[11px] text-[#5B6472]">{l.detail}</p>}
                        <Row left={`${fmtQty(l.qty)} × ${money(l.unitPrice)}`} right={money(l.total)} muted />
                    </div>
                ))}
                <Rule />
                <Row left="Subtotal" right={money(data.subtotal)} />
                {data.discount > 0 && <Row left="Discounts" right={`-${money(data.discount)}`} />}
                {!!data.tax && <Row left="VAT" right={money(data.tax)} />}
                <div className="mt-1 flex items-baseline justify-between border-t border-[#12151B] pt-1.5 font-display text-lg font-semibold">
                    <span>TOTAL</span>
                    <span className="num">₱{money(data.total)}</span>
                </div>
                <div className="mt-1.5">
                    {data.payments.map((p, i) => (
                        <Row key={i} left={`${METHOD_LABEL[p.method] ?? p.method}${p.reference ? ` ${p.reference}` : ''}`} right={money(p.amount)} />
                    ))}
                    {!!data.change && <Row left="Change" right={money(data.change)} />}
                    {!!data.balance && (
                        <div className="flex justify-between font-semibold text-[#C21016]">
                            <span>BALANCE DUE</span>
                            <span className="num">₱{money(data.balance)}</span>
                        </div>
                    )}
                </div>
                <Rule />
                <div className="text-center text-[11px] text-[#5B6472]">{data.footer ?? 'Thank you! Keep this receipt for pickup.'}</div>
                <div className="paper-peel" aria-hidden />
            </div>
        </div>
    );
}

function Row({ left, right, muted }: { left: ReactNode; right: ReactNode; muted?: boolean }) {
    return (
        <div className={cn('flex justify-between gap-3', muted && 'text-[#4F5663]')}>
            <span className="min-w-0 truncate">{left}</span>
            <span className="num shrink-0 text-right">{right}</span>
        </div>
    );
}

function Rule() {
    return <div className="my-2 border-t border-dashed border-[#9AA2B1]" />;
}
