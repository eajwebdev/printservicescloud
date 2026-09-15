import { Chip, type Tone } from '@/components/ui/chip';
import { EmptyState, Pagination } from '@/components/ui/misc';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { dateTime, qty } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Paginated, StockMovementRow } from '@/types';

const TYPE: Record<string, { label: string; tone: Tone }> = {
    in: { label: 'Stock in', tone: 'ok' },
    purchase: { label: 'Received', tone: 'ok' },
    sale: { label: 'Used / sold', tone: 'neutral' },
    return: { label: 'Returned', tone: 'info' },
    adjustment: { label: 'Adjusted', tone: 'warn' },
    count: { label: 'Count', tone: 'warn' },
    out: { label: 'Stock out', tone: 'neutral' },
};

export function StockLedger({ ledger, unit, showItem }: { ledger: Paginated<StockMovementRow>; unit: string; showItem?: boolean }) {
    if (!ledger.data.length) return <EmptyState compact title="No movements yet" body="Every sale, purchase and adjustment will be traced here." />;
    return (
        <>
            <Table minWidth={760}>
                <THead>
                    <tr>
                        <Th>When</Th>
                        {showItem && <Th>Item</Th>}
                        <Th>Movement</Th>
                        <Th>Reference</Th>
                        <Th>By</Th>
                        <Th align="right">Change</Th>
                        <Th align="right">Balance</Th>
                    </tr>
                </THead>
                <tbody>
                    {ledger.data.map((m) => (
                        <Tr key={m.id}>
                            <Td muted className="text-sm whitespace-nowrap">{dateTime(m.at)}</Td>
                            {showItem && <Td>{m.item}</Td>}
                            <Td>
                                <Chip tone={TYPE[m.type]?.tone ?? 'neutral'}>{TYPE[m.type]?.label ?? m.type}</Chip>
                                {m.reason && !['sale', 'purchase'].includes(m.reason) && <span className="ml-2 text-sm text-faint">{m.reason}</span>}
                            </Td>
                            <Td muted className="max-w-56 truncate font-mono text-sm">{m.ref}</Td>
                            <Td muted className="text-sm">{m.user}</Td>
                            <Td numeric className={cn(m.qty < 0 ? 'text-accent-text' : 'text-ok-text')}>
                                {m.qty > 0 ? '+' : ''}
                                {qty(m.qty)} {unit}
                            </Td>
                            <Td numeric className={m.balance_after < 0 ? 'text-accent-text' : ''}>
                                {qty(m.balance_after)}
                            </Td>
                        </Tr>
                    ))}
                </tbody>
            </Table>
            <Pagination links={ledger.links} from={ledger.from} to={ledger.to} total={ledger.total} />
        </>
    );
}
