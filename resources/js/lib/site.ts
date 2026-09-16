/** Website copy and brand identity, edited under Platform > Branding & website (see app/Support/Brand.php). */

export interface SiteService {
    title: string;
    body: string;
    tags: string[];
    art: ArtKey;
}

export interface SiteStep {
    title: string;
    body: string;
    tag: string;
}

export interface SiteHighlight {
    big: string;
    label: string;
    body: string;
}

export interface SiteContent {
    meta_title: string;
    meta_description: string;
    hero_eyebrow: string;
    hero_line_1: string;
    hero_line_2: string;
    hero_sub: string;
    hero_body: string;
    hero_cta: string;
    region: string;
    services_title_1: string;
    services_title_2: string;
    services_intro: string;
    services: SiteService[];
    process_title_1: string;
    process_title_2: string;
    steps: SiteStep[];
    ticket_title: string;
    ticket_note: string;
    branches_title_1: string;
    branches_title_2: string;
    branches_body: string;
    show_map: boolean;
    highlights: SiteHighlight[];
    closing_eyebrow: string;
    closing_line_1: string;
    closing_line_2: string;
    closing_outline: string;
    footer_blurb: string;
    login_body: string;
}

export const ART_LABELS = {
    sublimation: 'Jersey being dyed (sublimation)',
    dtf: 'Transfer film peeling (DTF)',
    shirt: 'Shirt print',
    tarp: 'Waving banner (tarpaulin)',
    sign: 'Lit-up OPEN sign',
    sticker: 'Round sticker',
    logo: 'Vector pen drawing (logo)',
    decal: 'Car with stripes (decals)',
    laser: 'Laser cutting a shape',
    blueprint: 'Blueprint and 3D part',
} as const;

export type ArtKey = keyof typeof ART_LABELS;

export interface TokenValues {
    brand: string;
    short: string;
    region: string;
    branches: number;
    branchList: string[];
    services: number;
}

/** "Kabankalan, Dumaguete and Bacolod" */
export function joinNames(names: string[]): string {
    if (names.length <= 1) return names[0] ?? '';
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Fills {brand} {short} {region} {branches} {branch_list} {services} {year}. */
export function fillTokens(text: string, t: TokenValues): string {
    return (text ?? '')
        .replaceAll('{brand}', t.brand)
        .replaceAll('{short}', t.short)
        .replaceAll('{region}', t.region)
        .replaceAll('{branches}', String(t.branches))
        .replaceAll('{branch_list}', joinNames(t.branchList))
        .replaceAll('{services}', String(t.services))
        .replaceAll('{year}', String(new Date().getFullYear()));
}

/** Splits "Printed right, *made to be seen.*" into plain and highlighted runs. */
export function accentParts(text: string): { text: string; accent: boolean }[] {
    return (text ?? '')
        .split(/(\*[^*]+\*)/g)
        .filter(Boolean)
        .map((part) => (part.startsWith('*') && part.endsWith('*') && part.length > 2 ? { text: part.slice(1, -1), accent: true } : { text: part, accent: false }));
}

/** Removes the *highlight* markers, for plain-text places like the page title. */
export function plain(text: string): string {
    return accentParts(text)
        .map((p) => p.text)
        .join('');
}

/** A branch name without the brand's short mark: "SKC Kabankalan" -> "Kabankalan". */
export function stripShort(name: string, short: string): string {
    if (!short) return name;
    return name.toLowerCase().startsWith(`${short.toLowerCase()} `) ? name.slice(short.length + 1) : name;
}

function channels(hex: string): [number, number, number] {
    const h = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1] ?? 'E4141B';
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** Mixes a color toward another: mix('#E4141B', '#FFFFFF', 0.2). */
export function mix(hex: string, toward: string, amount: number): string {
    const a = channels(hex);
    const b = channels(toward);
    return `#${a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function rgba(hex: string, alpha: number): string {
    const [r, g, b] = channels(hex);
    return `rgba(${r},${g},${b},${alpha})`;
}

/** "C 0 / M 91 / Y 88 / K 11", the press readout for the brand color. */
export function cmyk(hex: string): string {
    const [r, g, b] = channels(hex).map((v) => v / 255);
    const k = 1 - Math.max(r, g, b);
    const part = (v: number) => (k >= 1 ? 0 : Math.round(((1 - v - k) / (1 - k)) * 100));
    return `C ${part(r)} / M ${part(g)} / Y ${part(b)} / K ${Math.round(k * 100)}`;
}
