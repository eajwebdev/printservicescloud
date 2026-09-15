import { METHOD_LABEL, peso } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { SessionRow } from '@/types';
import { Panel } from '@/components/ui/misc';

export interface SessionDetail extends SessionRow {
    opening_note: string | null;
    closing_note: string | null;
    summary: {
        opening_float: number;
        movements: { type: string; label: string; amount: number; count: number }[];
        by_method: Record<string, number>;
        order_count: number;
        voided_count: number;
        gross_sales: number;
        discounts: number;
        expected_cash: number;
        closing_counted: number | null;
        variance: number | null;
    };
    movements: { id: number; type: string; label: string; amount: number; note: string | null; user: string | null; at: string }[];
}

export function VarianceText({ value }: { value: number }) {
    if (Math.abs(value) < 0.01) return <span className="num text-ok-text">Balanced</span>;
    return (
        <span className={cn('num', value < 0 ? 'text-accent-text' : 'text-ok-text')}>
            {value < 0 ? 'Short ' : 'Over '}
            {peso(Math.abs(value))}
        </span>
    );
}

/** The X/Z read as a two-column ledger: sales on the left, the drawer math on the right. */
export function SessionSummary({ session }: { session: SessionDetail }) {
    const s = session.summary;
    const cashLines = s.movements.filter((m) => m.count > 0);

    return (
        <Panel title={session.status === 'open' ? 'Live X-read' : 'Z-read'} bodyClass="grid md:grid-cols-2">
            <div className="border-b border-line p-5 md:border-r md:border-b-0">
                <p className="text-sm text-faint">Sales this session</p>
                <p className="hud mt-1 text-3xl font-semibold">{peso(s.gross_sales)}</p>
                <p className="mt-1 text-sm text-muted">
                    {s.order_count} orders{s.voided_count ? `, ${s.voided_count} voided` : ''}; discounts {peso(s.discounts)}
                </p>
                <dl className="mt-5 divide-y divide-line border-t border-line">
                    {Object.entries(s.by_method).map(([method, amount]) => (
                        <div key={method} className="flex items-center justify-between py-2">
                            <dt className="text-base text-muted">{METHOD_LABEL[method]}</dt>
                            <dd className="num text-base">{peso(amount)}</dd>
                        </div>
                    ))}
                </dl>
            </div>
            <div className="p-5">
                <p className="text-sm text-faint">Drawer math</p>
                <dl className="mt-2 divide-y divide-line">
                    <div className="flex items-center justify-between py-2">
                        <dt className="text-base text-muted">Opening float</dt>
                        <dd className="num">{peso(s.opening_float)}</dd>
                    </div>
                    {cashLines.map((m) => (
                        <div key={m.type} className="flex items-center justify-between py-2">
                            <dt className="text-base text-muted">
                                {m.label} <span className="num text-faint">×{m.count}</span>
                            </dt>
                            <dd className={cn('num', m.amount < 0 && 'text-accent-text')}>{peso(m.amount, { sign: true })}</dd>
                        </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-line-strong py-2.5">
                        <dt className="font-medium">Expected cash</dt>
                        <dd className="num text-lg font-semibold">{peso(s.expected_cash)}</dd>
                    </div>
                    {s.closing_counted !== null && (
                        <>
                            <div className="flex items-center justify-between py-2">
                                <dt className="text-base text-muted">Counted</dt>
                                <dd className="num">{peso(s.closing_counted)}</dd>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <dt className="text-base text-muted">Over / short</dt>
                                <dd className="text-lg font-semibold">
                                    <VarianceText value={s.variance ?? 0} />
                                </dd>
                            </div>
                        </>
                    )}
                </dl>
            </div>
        </Panel>
    );
}
