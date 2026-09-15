import { useEffect, useState } from 'react';
import { peso } from '@/lib/format';

const DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5, 1, 0.25];

/** Count the drawer by bill and coin; reports the total upward as you type. */
export function CashCount({ onTotal }: { onTotal: (total: number) => void }) {
    const [counts, setCounts] = useState<Record<number, string>>({});
    const total = DENOMS.reduce((s, d) => s + d * (parseInt(counts[d] || '0', 10) || 0), 0);

    useEffect(() => {
        onTotal(Math.round(total * 100) / 100);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [total]);

    return (
        <div className="border border-line bg-sunken">
            <div className="grid grid-cols-2 sm:grid-cols-5">
                {DENOMS.map((d) => (
                    <label key={d} className="flex items-center justify-between gap-2 border-r border-b border-line px-3 py-2 text-sm">
                        <span className="num w-12 text-muted">{d >= 1 ? `₱${d}` : '25¢'}</span>
                        <span className="text-faint">×</span>
                        <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={counts[d] ?? ''}
                            onChange={(e) => setCounts((c) => ({ ...c, [d]: e.target.value }))}
                            className="num h-7 w-14 rounded-xs border border-line bg-surface px-1.5 text-right text-fg focus-visible:border-red-400"
                            aria-label={`Number of ${d >= 1 ? `${d} peso` : '25 centavo'} pieces`}
                        />
                    </label>
                ))}
            </div>
            <div className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-faint">Counted by denomination</span>
                <span className="num font-medium text-fg">{peso(total)}</span>
            </div>
        </div>
    );
}
