import { router } from '@inertiajs/react';
import { CheckCircle2, Download, ExternalLink, FileText, Paperclip, Trash2, UploadCloud } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { IconButton } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Segmented } from '@/components/ui/toggle';
import { dateTime } from '@/lib/format';
import { formatBytes } from '@/lib/print';
import { cn, useCan } from '@/lib/utils';
import type { OrderFileRow, ProofStatus } from '@/types';

const KIND_LABEL: Record<OrderFileRow['kind'], string> = { design: 'Customer file', proof: 'Proof', photo: 'Finished photo', other: 'Other' };

export function ProofChip({ status }: { status: ProofStatus }) {
    if (status === 'waiting') return <Chip tone="warn">Proof waiting</Chip>;
    if (status === 'approved') return <Chip tone="ok" icon={<CheckCircle2 />}>Proof OK</Chip>;
    return null;
}

interface Props {
    orderId: number;
    files: OrderFileRow[];
    proofStatus: ProofStatus;
    isJob: boolean;
    onChanged: () => void;
    /** Tighter layout for side panels and the POS receipt. */
    compact?: boolean;
}

/** Customer files, proofs and finished-job photos on an order, plus the proof go-ahead. */
export function OrderFiles({ orderId, files, proofStatus, isJob, onChanged, compact }: Props) {
    const can = useCan();
    const canEdit = can('orders.edit');
    const input = useRef<HTMLInputElement>(null);
    const [kind, setKind] = useState<OrderFileRow['kind']>('design');
    const [progress, setProgress] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const [removing, setRemoving] = useState<OrderFileRow | null>(null);

    const upload = (list: FileList | File[] | null) => {
        const chosen = Array.from(list ?? []);
        if (!chosen.length) return;
        setError(null);
        setProgress(0);
        router.post(
            route('orders.files.store', orderId),
            { kind, files: chosen },
            {
                forceFormData: true,
                preserveScroll: true,
                preserveState: true,
                onProgress: (e) => setProgress(e?.percentage ?? null),
                onSuccess: () => onChanged(),
                onError: (errs) => setError(Object.values(errs)[0] ?? 'Upload failed. Try again.'),
                onFinish: () => {
                    setProgress(null);
                    if (input.current) input.current.value = '';
                },
            },
        );
    };

    const onDrop = (e: DragEvent) => {
        e.preventDefault();
        setDragging(false);
        if (canEdit) upload(e.dataTransfer.files);
    };

    const setProof = (status: ProofStatus) => router.patch(route('orders.proof', orderId), { status }, { preserveScroll: true, preserveState: true, onSuccess: onChanged });

    return (
        <div className="space-y-3">
            {isJob && (
                <div className={cn('flex flex-wrap items-center gap-2', compact ? '' : 'justify-between')}>
                    <span className="text-sm text-muted">Proof</span>
                    <Segmented
                        label="Proof approval"
                        size="sm"
                        value={proofStatus}
                        onChange={(v) => canEdit && setProof(v)}
                        options={[
                            { value: 'none', label: 'Not needed' },
                            { value: 'waiting', label: 'Waiting on customer' },
                            { value: 'approved', label: 'Approved' },
                        ]}
                    />
                </div>
            )}

            {canEdit && (
                <div
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    className={cn('border border-dashed px-3 py-3 transition-colors', dragging ? 'border-fg bg-raised' : 'border-line-strong bg-sunken')}
                >
                    <div className="flex flex-wrap items-center gap-2">
                        <Segmented
                            label="File type"
                            size="sm"
                            value={kind}
                            onChange={setKind}
                            options={(Object.keys(KIND_LABEL) as OrderFileRow['kind'][]).filter((k) => k !== 'other').map((k) => ({ value: k, label: KIND_LABEL[k] }))}
                        />
                        <button type="button" onClick={() => input.current?.click()} className="ml-auto flex h-8 items-center gap-1.5 rounded-xs border border-line-strong bg-raised px-3 text-sm text-fg hover:border-muted">
                            <UploadCloud className="size-4" />
                            Choose files
                        </button>
                    </div>
                    <p className="mt-2 text-xs text-faint">Drop files here: JPG, PNG, PDF, AI, EPS, PSD, CDR, SVG, TIFF or ZIP, up to 50 MB each.</p>
                    <input ref={input} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
                    {progress !== null && (
                        <div className="mt-2 h-1 bg-surface" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                            <div className="h-full bg-fg transition-[width]" style={{ width: `${progress}%` }} />
                        </div>
                    )}
                    {error && <p className="mt-2 text-sm text-accent-text">{error}</p>}
                </div>
            )}

            {files.length ? (
                <ul className={cn('grid gap-2', compact ? 'grid-cols-1' : 'sm:grid-cols-2')}>
                    {files.map((f) => {
                        const ext = f.name.split('.').pop()?.toUpperCase() ?? '';
                        return (
                            <li key={f.id} className="flex items-center gap-3 border border-line bg-surface p-2">
                                <a href={f.is_image || f.mime === 'application/pdf' ? f.preview_url : f.url} target="_blank" rel="noreferrer" className="shrink-0" aria-label={`Open ${f.name}`}>
                                    {f.is_image ? (
                                        <img src={f.preview_url} alt="" loading="lazy" className="size-12 border border-line bg-paper object-cover" />
                                    ) : (
                                        <span className="grid size-12 place-items-center border border-line bg-sunken font-mono text-2xs text-muted">
                                            {ext.length <= 4 ? ext : <FileText className="size-5" />}
                                        </span>
                                    )}
                                </a>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm text-fg" title={f.name}>
                                        {f.name}
                                    </p>
                                    <p className="truncate text-xs text-faint">
                                        {KIND_LABEL[f.kind]}, {formatBytes(f.size)}, {f.user ?? 'staff'} {dateTime(f.at)}
                                    </p>
                                </div>
                                <span className="flex shrink-0 gap-0.5">
                                    {(f.is_image || f.mime === 'application/pdf') && (
                                        <a href={f.preview_url} target="_blank" rel="noreferrer">
                                            <IconButton label={`View ${f.name}`} size="xs">
                                                <ExternalLink />
                                            </IconButton>
                                        </a>
                                    )}
                                    <a href={f.url}>
                                        <IconButton label={`Download ${f.name}`} size="xs">
                                            <Download />
                                        </IconButton>
                                    </a>
                                    {canEdit && (
                                        <IconButton label={`Remove ${f.name}`} size="xs" className="hover:text-accent-text" onClick={() => setRemoving(f)}>
                                            <Trash2 />
                                        </IconButton>
                                    )}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p className="flex items-center gap-2 text-sm text-faint">
                    <Paperclip className="size-4" />
                    No files yet.
                </p>
            )}

            <ConfirmDialog
                open={!!removing}
                onOpenChange={(o) => !o && setRemoving(null)}
                title={`Remove ${removing?.name}?`}
                body="The file is deleted from the shop computer. Keep a copy if the customer may need it again."
                confirmLabel="Remove file"
                onConfirm={() =>
                    removing &&
                    router.delete(route('orders.files.destroy', [orderId, removing.id]), {
                        preserveScroll: true,
                        preserveState: true,
                        onSuccess: onChanged,
                        onFinish: () => setRemoving(null),
                    })
                }
            />
        </div>
    );
}
