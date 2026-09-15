const pesoFmt = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compactFmt = new Intl.NumberFormat('en-PH', { notation: 'compact', maximumFractionDigits: 1 });

/** ₱1,234.50. Negative values keep the sign in front of the peso. */
export function peso(value: number | null | undefined, opts: { sign?: boolean } = {}): string {
    const n = Number(value ?? 0);
    const body = pesoFmt.format(Math.abs(n));
    if (n < 0) return `−₱${body}`;
    return `${opts.sign && n > 0 ? '+' : ''}₱${body}`;
}

export function money(value: number | null | undefined): string {
    return pesoFmt.format(Number(value ?? 0));
}

export function compactPeso(value: number): string {
    return `₱${compactFmt.format(value)}`;
}

/** 12, 1.5, 0.125: no trailing zeros. */
export function qty(value: number | null | undefined, max = 3): string {
    const n = Number(value ?? 0);
    return n.toLocaleString('en-PH', { maximumFractionDigits: max });
}

export function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

const dateFmt = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
const shortDateFmt = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' });
const dayTimeFmt = new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export const date = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso)) : '');
export const shortDate = (iso: string | null | undefined) => (iso ? shortDateFmt.format(new Date(iso)) : '');
export const time = (iso: string | null | undefined) => (iso ? timeFmt.format(new Date(iso)) : '');
export const dayTime = (iso: string | null | undefined) => (iso ? dayTimeFmt.format(new Date(iso)) : '');
export const dateTime = (iso: string | null | undefined) => (iso ? `${dateFmt.format(new Date(iso))}, ${timeFmt.format(new Date(iso))}` : '');

/** "in 3h", "2d ago", "overdue 5h". Used on due dates. */
export function relative(iso: string | null | undefined, now = Date.now()): string {
    if (!iso) return '';
    const diff = new Date(iso).getTime() - now;
    const abs = Math.abs(diff);
    const mins = Math.round(abs / 60000);
    const unit = mins < 60 ? `${mins}m` : mins < 60 * 36 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`;
    return diff >= 0 ? `in ${unit}` : `${unit} ago`;
}

export function isPast(iso: string | null | undefined): boolean {
    return !!iso && new Date(iso).getTime() < Date.now();
}

/** yyyy-mm-ddThh:mm for datetime-local inputs, in local time. */
export function toLocalInput(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function todayISO(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const METHOD_LABEL: Record<string, string> = { cash: 'Cash', gcash: 'GCash', bank: 'Bank', credit: 'Credit' };

export const STATUS_LABEL: Record<string, string> = {
    completed: 'Completed',
    pending: 'Pending',
    in_production: 'In production',
    ready: 'Ready for pickup',
    released: 'Released',
    voided: 'Voided',
};

export const PRICING_LABEL: Record<string, string> = {
    per_sqft: 'Per sq ft',
    per_piece: 'Per piece',
    tiered: 'Tiered by qty',
    fixed: 'Fixed',
};
