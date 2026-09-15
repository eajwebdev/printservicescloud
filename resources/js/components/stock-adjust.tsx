import { useForm } from '@inertiajs/react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/field';
import { Segmented } from '@/components/ui/toggle';
import { qty } from '@/lib/format';

const DEFAULT_REASONS: Record<string, string> = {
    count_correction: 'Count correction',
    damaged: 'Damaged',
    misprint: 'Misprint / wastage',
    test_print: 'Test print / sample',
    found: 'Found stock',
    returned_to_supplier: 'Returned to supplier',
    other: 'Other',
};

export function StockAdjustModal({
    open,
    onClose,
    item,
    reasons = DEFAULT_REASONS,
}: {
    open: boolean;
    onClose: () => void;
    item: { type: 'product' | 'inventory'; id: number; name: string; unit: string; stock: number } | null;
    reasons?: Record<string, string>;
}) {
    const form = useForm({ item_type: 'inventory', item_id: 0, direction: 'out', qty: '', reason: 'misprint', note: '' });

    useEffect(() => {
        if (open && item) {
            form.clearErrors();
            form.setData({ item_type: item.type, item_id: item.id, direction: 'out', qty: '', reason: 'misprint', note: '' });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, item?.id]);

    if (!item) return null;
    const change = (Number(form.data.qty) || 0) * (form.data.direction === 'out' ? -1 : 1);

    return (
        <Modal
            open={open}
            onOpenChange={(o) => !o && onClose()}
            title={`Adjust ${item.name}`}
            description={`On hand now: ${qty(item.stock)} ${item.unit}. Every adjustment is logged with your name and reason.`}
            size="sm"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" loading={form.processing} disabled={!Number(form.data.qty)} onClick={() => form.post(route('inventory.adjust'), { preserveScroll: true, onSuccess: onClose })}>
                        Save adjustment
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <Segmented
                    label="Direction"
                    value={form.data.direction}
                    onChange={(v) => {
                        form.setData('direction', v);
                        form.setData('reason', v === 'in' ? 'found' : 'misprint');
                    }}
                    options={[
                        { value: 'out', label: 'Remove stock' },
                        { value: 'in', label: 'Add stock' },
                    ]}
                    className="w-full"
                />
                <Field label={`Quantity (${item.unit})`} error={form.errors.qty}>
                    {(id, d) => <Input id={id} aria-describedby={d} type="number" min={0} step="any" autoFocus inputSize="lg" className="num" value={form.data.qty} onChange={(e) => form.setData('qty', e.target.value)} />}
                </Field>
                <Field label="Reason" error={form.errors.reason}>
                    {(id) => (
                        <Select id={id} value={form.data.reason} onChange={(e) => form.setData('reason', e.target.value)}>
                            {Object.entries(reasons).map(([k, v]) => (
                                <option key={k} value={k}>
                                    {v}
                                </option>
                            ))}
                        </Select>
                    )}
                </Field>
                <Field label="Note" hint="Optional">
                    {(id) => <Input id={id} value={form.data.note} onChange={(e) => form.setData('note', e.target.value)} placeholder="e.g. Tarp torn during trimming" />}
                </Field>
                <p className="num text-sm text-muted">
                    New balance: <span className="text-fg">{qty(item.stock + change)} {item.unit}</span>
                </p>
                {(form.errors as Record<string, string>).lines && <p className="text-sm text-accent-text">{(form.errors as Record<string, string>).lines}</p>}
            </div>
        </Modal>
    );
}
