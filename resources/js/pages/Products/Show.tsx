import { Head } from '@inertiajs/react';
import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { StockAdjustModal } from '@/components/stock-adjust';
import { StockLedger } from '@/components/stock-ledger';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Panel, Stat } from '@/components/ui/misc';
import { peso, qty } from '@/lib/format';
import { useCan } from '@/lib/utils';
import type { Paginated, StockMovementRow } from '@/types';
import type { ProductRow } from './Index';

export default function ProductShow({ product, ledger, sold30, reasons }: { product: ProductRow; ledger: Paginated<StockMovementRow>; sold30: { qty: number; revenue: number }; reasons?: Record<string, string> }) {
    const can = useCan();
    const [adjusting, setAdjusting] = useState(false);

    return (
        <>
            <Head title={product.name} />
            <PageHeader
                back={{ href: route('products.index'), label: 'Products' }}
                title={product.name}
                meta={
                    <>
                        {!product.active && <Chip>Inactive</Chip>}
                        {product.low && <Chip tone="warn">Low stock</Chip>}
                    </>
                }
                description={[product.sku, product.barcode, product.category, product.supplier ? `from ${product.supplier}` : null].filter(Boolean).join(', ')}
                actions={
                    can('inventory.adjust') &&
                    !product.inventory_item_id && (
                        <Button icon={<SlidersHorizontal />} onClick={() => setAdjusting(true)}>
                            Adjust stock
                        </Button>
                    )
                }
            />
            <section className="grid grid-cols-2 divide-x divide-line border-b border-line bg-surface md:grid-cols-4">
                <Stat label="On hand" value={qty(product.stock)} tone={product.low ? 'warn' : undefined} sub={product.inventory_item ? `Shared with ${product.inventory_item}` : `Reorder at ${product.reorder_level}`} />
                <Stat label="Price" value={peso(product.price)} sub={product.margin !== null ? `${product.margin}% margin` : undefined} />
                <Stat label="Sold, 30 days" value={qty(sold30.qty)} />
                <Stat label="Revenue, 30 days" value={peso(sold30.revenue)} />
            </section>
            <div className="p-5 lg:p-6">
                <Panel title="Stock ledger">
                    <StockLedger ledger={ledger} unit="pc" />
                </Panel>
            </div>
            <StockAdjustModal open={adjusting} onClose={() => setAdjusting(false)} item={{ type: 'product', id: product.id, name: product.name, unit: 'pc', stock: product.stock }} reasons={reasons} />
        </>
    );
}
