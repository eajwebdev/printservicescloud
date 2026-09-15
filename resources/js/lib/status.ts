import type { Tone } from '@/components/ui/chip';

/*
 * Status labels and chip colors shared by several pages. They live here, not in a page file:
 * a page that imports another page gets folded into a shared build chunk and drops out of
 * the Vite manifest, which breaks that page in production.
 */

export const PO_TONE: Record<string, Tone> = { draft: 'outline', ordered: 'info', partial: 'warn', received: 'ok', cancelled: 'neutral' };
export const PO_LABEL: Record<string, string> = { draft: 'Draft', ordered: 'Ordered', partial: 'Partly received', received: 'Received', cancelled: 'Cancelled' };

export const QUOTE_TONE: Record<string, Tone> = { draft: 'outline', sent: 'info', accepted: 'ok', converted: 'neutral', expired: 'warn' };
export const QUOTE_LABEL: Record<string, string> = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', converted: 'Became an order', expired: 'Expired' };

export const SUBSCRIPTION_TONE: Record<string, Tone> = { trial: 'info', active: 'ok', suspended: 'red', cancelled: 'neutral' };
