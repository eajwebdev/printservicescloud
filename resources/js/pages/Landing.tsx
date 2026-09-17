import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight, ArrowUpRight, Mail, MapPin, Menu, Phone, X } from 'lucide-react';
import {
    AnimatePresence,
    motion,
    useAnimationFrame,
    useInView,
    useMotionTemplate,
    useMotionValue,
    useMotionValueEvent,
    useReducedMotion,
    useScroll,
    useSpring,
    useTransform,
    useVelocity,
    animate,
} from 'motion/react';
import { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { accentParts, cmyk, fillTokens, mix, plain, rgba, stripShort, type ArtKey, type SiteContent } from '@/lib/site';
import { cn } from '@/lib/utils';
import type { PageProps } from '@/types';

interface BranchInfo {
    name: string;
    code: string;
    address: string | null;
    phone: string | null;
    email: string | null;
}

interface Props {
    branches: BranchInfo[];
    site: SiteContent;
    signedIn: boolean;
}

interface BrandValue {
    name: string;
    short: string;
    logo: string;
    color: string;
    site: SiteContent;
    branches: BranchInfo[];
    /** Fills {brand}, {region}, {branches} and the other tokens. */
    t: (text: string) => string;
}

const EASE = [0.16, 1, 0.3, 1] as const;
const BrandContext = createContext<BrandValue | null>(null);

function useBrand(): BrandValue {
    const value = useContext(BrandContext);
    if (!value) throw new Error('Landing sections must render inside the page.');
    return value;
}

export default function Landing({ branches, site, signedIn }: Props) {
    const { shop } = usePage<PageProps>().props;
    const brand = useMemo<BrandValue>(() => {
        const short = shop?.short_name ?? 'EAJ';
        const tokens = { brand: shop?.name ?? 'EAJ Custom Print', short, region: site.region, branches: branches.length, branchList: branches.map((b) => stripShort(b.name, short)), services: site.services.length };
        return { name: tokens.brand, short, logo: shop?.logo ?? '/eajlogo.svg', color: shop?.color ?? '#E4141B', site, branches, t: (text) => fillTokens(text, tokens) };
    }, [shop, site, branches]);

    return (
        <BrandContext.Provider value={brand}>
            <div data-theme="dark" className="relative min-h-dvh overflow-x-clip bg-[#07080A] font-sans text-[#ECEEF2] antialiased selection:bg-[color:var(--brand)] selection:text-white">
                <Head title={plain(brand.t(site.meta_title))}>
                    <meta name="description" content={plain(brand.t(site.meta_description))} />
                </Head>
                <Grain />
                <Nav signedIn={signedIn} />
                <Hero />
                <Ticker />
                <Services />
                <Process />
                <Branches />
                <Commitments />
                <Closing />
                <Footer signedIn={signedIn} />
            </div>
        </BrandContext.Provider>
    );
}

Landing.layout = null;

/* -------------------------------------------------------------------------- */
/* Shared bits                                                                */
/* -------------------------------------------------------------------------- */

/** Fine film grain over everything, so flat blacks read like printed stock rather than a screen. */
function Grain() {
    return (
        <svg className="pointer-events-none fixed inset-0 z-[60] h-full w-full opacity-[0.055] mix-blend-overlay" aria-hidden>
            <filter id="eaj-grain">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" />
            </filter>
            <rect width="100%" height="100%" filter="url(#eaj-grain)" />
        </svg>
    );
}

function Eyebrow({ index, children, className }: { index?: string; children: ReactNode; className?: string }) {
    return (
        <p className={cn('flex items-center gap-3 font-mono text-[11px] tracking-[0.22em] text-[#8A93A3] uppercase', className)}>
            {index && <span className="text-[color:var(--brand)]">{index}</span>}
            <span className="h-px w-8 bg-[#2A2F3A]" aria-hidden />
            {children}
        </p>
    );
}

/** A line of text that rises out of a mask when it scrolls into view. */
function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
    const ref = useRef<HTMLSpanElement>(null);
    const inView = useInView(ref, { once: true, margin: '-12% 0px' });
    return (
        <span ref={ref} className={cn('block overflow-hidden pb-[0.08em]', className)}>
            <motion.span className="block" initial={{ y: '110%' }} animate={inView ? { y: '0%' } : undefined} transition={{ duration: 1, delay, ease: EASE }}>
                {children}
            </motion.span>
        </span>
    );
}

/** Copy with its tokens filled and *starred* words in the highlight style. */
function Rich({ text, accent = 'text-[color:var(--brand)]' }: { text: string; accent?: string }) {
    const { t } = useBrand();
    return (
        <>
            {accentParts(t(text)).map((part, i) =>
                part.accent ? (
                    <span key={i} className={accent}>
                        {part.text}
                    </span>
                ) : (
                    <Fragment key={i}>{part.text}</Fragment>
                ),
            )}
        </>
    );
}

function scrollToId(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Printer's crop marks drawn in at the corners of a box. */
function CropMarks({ className, delay = 0 }: { className?: string; delay?: number }) {
    const corners = [
        'top-0 left-0',
        'top-0 right-0 rotate-90',
        'bottom-0 right-0 rotate-180',
        'bottom-0 left-0 -rotate-90',
    ];
    return (
        <div className={cn('pointer-events-none absolute inset-0', className)} aria-hidden>
            {corners.map((pos, i) => (
                <svg key={pos} className={cn('absolute size-6 text-[#5B6472]', pos)} viewBox="0 0 24 24" fill="none">
                    <motion.path d="M0 10 V0 H10" stroke="currentColor" strokeWidth="1" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: delay + i * 0.08, ease: EASE }} />
                </svg>
            ))}
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Navigation                                                                 */
/* -------------------------------------------------------------------------- */

const LINKS = [
    { id: 'services', label: 'Services' },
    { id: 'process', label: 'How it works' },
    { id: 'branches', label: 'Branches' },
    { id: 'contact', label: 'Contact' },
];

function Nav({ signedIn }: { signedIn: boolean }) {
    const { scrollY } = useScroll();
    const [scrolled, setScrolled] = useState(false);
    const [open, setOpen] = useState(false);
    useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24));

    const { name, logo } = useBrand();
    const account = signedIn ? { href: route('dashboard'), label: 'Open dashboard' } : { href: route('login'), label: 'Staff sign in' };

    return (
        <motion.header
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
            className={cn(
                'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-500',
                scrolled || open ? 'border-b border-white/[0.06] bg-[#07080A]/80 backdrop-blur-xl' : 'border-b border-transparent',
            )}
        >
            <nav className="mx-auto flex h-[72px] max-w-[1320px] items-center gap-6 px-5 sm:px-8" aria-label="Main">
                <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="shrink-0" aria-label={`${name}, back to top`}>
                    <img src={logo} alt={name} className="h-10 w-auto max-w-[160px] object-contain" width={80} height={40} />
                </a>
                <ul className="ml-6 hidden items-center gap-1 md:flex">
                    {LINKS.map((l) => (
                        <li key={l.id}>
                            <button type="button" onClick={() => scrollToId(l.id)} className="group relative rounded-full px-3.5 py-2 text-[13px] text-[#B4BAC5] transition-colors hover:text-white">
                                {l.label}
                                <span className="absolute inset-x-3.5 bottom-1 h-px origin-left scale-x-0 bg-[color:var(--brand)] transition-transform duration-300 group-hover:scale-x-100" />
                            </button>
                        </li>
                    ))}
                </ul>
                <div className="ml-auto flex items-center gap-2">
                    <Link href={account.href} className="group hidden items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-[13px] text-white transition-colors hover:border-white/40 sm:flex">
                        {account.label}
                        <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </Link>
                    <button type="button" className="grid size-10 place-items-center rounded-full border border-white/15 md:hidden" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
                        {open ? <X className="size-4" /> : <Menu className="size-4" />}
                    </button>
                </div>
            </nav>
            <AnimatePresence>
                {open && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.4, ease: EASE }} className="overflow-hidden md:hidden">
                        <ul className="space-y-1 px-5 pb-6">
                            {LINKS.map((l, i) => (
                                <motion.li key={l.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}>
                                    <button type="button" onClick={() => { setOpen(false); scrollToId(l.id); }} className="flex w-full items-center justify-between border-b border-white/[0.06] py-4 font-display text-2xl">
                                        {l.label}
                                        <ArrowRight className="size-5 text-[color:var(--brand)]" />
                                    </button>
                                </motion.li>
                            ))}
                            <li className="pt-4">
                                <Link href={account.href} className="flex items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-medium text-black">
                                    {account.label}
                                </Link>
                            </li>
                        </ul>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.header>
    );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A headline line printed in four passes: cyan, magenta and yellow land slightly off-register,
 * then slide into place under the white key plate. It is the moment a print run lines up.
 */
function RegisteredLine({ text, delay, className }: { text: string; delay: number; className?: string }) {
    const reduce = useReducedMotion();
    const plates = [
        { color: '#00AEEF', from: { x: -14, y: 6 } },
        { color: '#EC008C', from: { x: 12, y: -8 } },
        { color: '#FFF200', from: { x: 6, y: 10 } },
    ];
    return (
        <span className={cn('relative block whitespace-nowrap', className)}>
            {plates.map((p, i) => (
                <motion.span
                    key={p.color}
                    aria-hidden
                    className="absolute inset-0 block mix-blend-screen"
                    style={{ color: p.color }}
                    initial={reduce ? false : { ...p.from, opacity: 0 }}
                    animate={{ x: 0, y: 0, opacity: [0, 0.9, 0] }}
                    transition={{ duration: 1.6, delay: delay + i * 0.07, ease: EASE, opacity: { duration: 1.9, delay: delay + i * 0.07, times: [0, 0.35, 1] } }}
                >
                    {text}
                </motion.span>
            ))}
            <span className="-mb-[0.14em] block overflow-hidden pb-[0.14em]">
                <motion.span className="relative block" initial={reduce ? false : { clipPath: 'inset(0 100% -20% 0)' }} animate={{ clipPath: 'inset(0 0% -20% 0)' }} transition={{ duration: 1.1, delay: delay + 0.35, ease: EASE }}>
                    {text}
                </motion.span>
            </span>
        </span>
    );
}

function Hero() {
    const { site, t, color } = useBrand();
    const ref = useRef<HTMLElement>(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
    const logoY = useTransform(scrollYProgress, [0, 1], [0, 140]);
    const logoRotate = useTransform(scrollYProgress, [0, 1], [0, -6]);
    const copyY = useTransform(scrollYProgress, [0, 1], [0, 60]);
    const stripeX = useTransform(scrollYProgress, [0, 1], [0, -260]);
    const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

    // A halftone field that lights up around the pointer.
    const mx = useMotionValue(-999);
    const my = useMotionValue(-999);
    const sx = useSpring(mx, { stiffness: 140, damping: 22 });
    const sy = useSpring(my, { stiffness: 140, damping: 22 });
    const spotlight = useMotionTemplate`radial-gradient(260px circle at ${sx}px ${sy}px, black 0%, transparent 70%)`;
    const onMove = (e: ReactPointerEvent<HTMLElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(e.clientX - r.left);
        my.set(e.clientY - r.top);
    };

    return (
        <section id="top" ref={ref} onPointerMove={onMove} className="relative isolate flex min-h-[100svh] items-center overflow-hidden pt-[72px]">
            {/* Base halftone, and the lit halftone under the pointer. */}
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(rgba(236,238,242,0.07)_1px,transparent_1.4px)] [background-size:14px_14px]" aria-hidden />
            <motion.div
                className="absolute inset-0 -z-10 bg-[radial-gradient(color-mix(in_srgb,var(--brand)_55%,transparent)_1.2px,transparent_1.6px)] [background-size:14px_14px]"
                style={{ maskImage: spotlight, WebkitMaskImage: spotlight }}
                aria-hidden
            />
            <div className="absolute inset-x-0 bottom-0 -z-10 h-64 bg-gradient-to-t from-[#07080A] to-transparent" aria-hidden />
            <div className="absolute top-1/3 -right-40 -z-10 size-[620px] rounded-full bg-[color:var(--brand)] opacity-[0.13] blur-[140px]" aria-hidden />

            {/* Racing stripes lifted from the logo, sweeping in behind the mark. */}
            <motion.div
                className="pointer-events-none absolute top-[30%] right-[-12%] -z-10 hidden h-[44%] w-[52%] [mask-image:linear-gradient(90deg,transparent,black_45%)] lg:block"
                style={{ x: stripeX }}
                aria-hidden
            >
                {[
                    { w: 'h-[16%]', c: 'bg-[color:var(--brand)]/80', d: 0.35, top: 'top-[22%]' },
                    { w: 'h-[3%]', c: 'bg-white/80', d: 0.45, top: 'top-[46%]' },
                    { w: 'h-[8%]', c: 'bg-[color:var(--brand)]/45', d: 0.55, top: 'top-[56%]' },
                ].map((s) => (
                    <motion.span
                        key={s.top}
                        className={cn('absolute left-0 w-full origin-right -skew-x-[28deg]', s.w, s.c, s.top)}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 1.3, delay: s.d, ease: EASE }}
                    />
                ))}
            </motion.div>

            <div className="mx-auto grid w-full max-w-[1320px] items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.25fr_1fr] lg:py-24">
                <motion.div style={{ y: copyY, opacity: fade }}>
                    <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3, ease: EASE }} className="mb-8 flex items-start gap-3 font-mono text-[11px] leading-5 tracking-[0.22em] text-[#8A93A3] uppercase">
                        <span className="relative mt-1.5 flex size-2 shrink-0">
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[color:var(--brand)] opacity-60" />
                            <span className="relative inline-flex size-2 rounded-full bg-[color:var(--brand)]" />
                        </span>
                        {plain(t(site.hero_eyebrow))}
                    </motion.p>

                    <h1 className="font-display text-[clamp(2.6rem,10.5vw,3.6rem)] leading-[0.95] font-semibold tracking-[-0.045em] sm:text-[clamp(3.6rem,7vw,5.4rem)] xl:text-[5.6rem]">
                        <RegisteredLine text={plain(t(site.hero_line_1))} delay={0.45} />
                        {site.hero_line_2 && <RegisteredLine text={plain(t(site.hero_line_2))} delay={0.62} className="text-white" />}
                        <span className="mt-3 block overflow-hidden">
                            <motion.span className="block text-[0.42em] leading-tight font-medium tracking-[-0.02em] text-[#8A93A3]" initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ duration: 1, delay: 1.25, ease: EASE }}>
                                <Rich text={site.hero_sub} />
                            </motion.span>
                        </span>
                    </h1>

                    <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 1.4, ease: EASE }} className="mt-8 max-w-[34rem] text-[17px] leading-relaxed text-[#A3AAB6]">
                        {t(site.hero_body)}
                    </motion.p>

                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 1.55, ease: EASE }} className="mt-10 flex flex-wrap items-center gap-3">
                        <MagneticButton onClick={() => scrollToId('services')} primary>
                            {t(site.hero_cta) || 'See what we make'} <ArrowRight className="size-4" />
                        </MagneticButton>
                        <MagneticButton onClick={() => scrollToId('branches')}>
                            <MapPin className="size-4" /> Find a branch
                        </MagneticButton>
                    </motion.div>
                </motion.div>

                <motion.div className="relative mx-auto w-full max-w-[560px]" style={{ y: logoY, rotate: logoRotate }}>
                    <HeroMark />
                </motion.div>
            </div>

            {/* Press readout along the bottom edge. */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8, duration: 1 }} className="absolute inset-x-0 bottom-6 mx-auto hidden max-w-[1320px] items-center justify-between px-8 font-mono text-[10px] tracking-[0.2em] text-[#5B6472] uppercase md:flex">
                <span className="flex items-center gap-2">
                    {['#00AEEF', '#EC008C', '#FFF200', '#ECEEF2'].map((c) => (
                        <span key={c} className="size-2.5" style={{ background: c }} />
                    ))}
                    <span className="ml-2">{cmyk(color)}</span>
                </span>
                <button type="button" onClick={() => scrollToId('services')} className="flex items-center gap-3 hover:text-[#ECEEF2]">
                    Scroll
                    <span className="relative h-8 w-px overflow-hidden bg-[#2A2F3A]">
                        <motion.span className="absolute inset-x-0 top-0 h-3 bg-[color:var(--brand)]" animate={{ y: [-12, 32] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} />
                    </span>
                </button>
            </motion.div>
        </section>
    );
}

/** The brand mark pressed onto the page, with the service list spinning around it like a stamp. */
function HeroMark() {
    const { site, name, logo } = useBrand();
    // Repeat short service lists so the lettering still runs all the way round the ring.
    const once = site.services.map((s) => s.title.toUpperCase()).join(' • ') + ' • ';
    const ring = once.repeat(Math.max(1, Math.ceil(90 / once.length)));
    return (
        <div className="relative aspect-square w-full">
            <CropMarks delay={0.9} className="inset-6" />
            <motion.svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" initial={{ opacity: 0, rotate: -40 }} animate={{ opacity: 1, rotate: 0 }} transition={{ duration: 1.8, delay: 0.6, ease: EASE }} aria-hidden>
                <defs>
                    <path id="eaj-ring" d="M200,200 m-172,0 a172,172 0 1,1 344,0 a172,172 0 1,1 -344,0" />
                </defs>
                <circle cx="200" cy="200" r="190" fill="none" stroke="#1A1E26" strokeWidth="1" />
                <circle cx="200" cy="200" r="154" fill="none" stroke="#1A1E26" strokeWidth="1" strokeDasharray="2 6" />
                <motion.g animate={{ rotate: 360 }} transition={{ duration: 48, repeat: Infinity, ease: 'linear' }}>
                    <text fill="#5B6472" fontSize="12.5" letterSpacing="4.2" style={{ fontFamily: 'var(--font-mono)' }}>
                        <textPath href="#eaj-ring">{ring + ring}</textPath>
                    </text>
                </motion.g>
            </motion.svg>
            <motion.img
                src={logo}
                alt={name}
                className="absolute top-1/2 left-1/2 w-[82%] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_40px_60px_rgba(0,0,0,0.65)]"
                initial={{ scale: 1.25, opacity: 0, filter: 'blur(14px)' }}
                animate={{ scale: [1.25, 0.96, 1], opacity: 1, filter: 'blur(0px)' }}
                transition={{ duration: 1.3, delay: 0.75, ease: EASE, scale: { duration: 1.1, delay: 0.75, times: [0, 0.7, 1] } }}
                width={460}
                height={230}
            />
            {/* The flash of a heat press closing. */}
            <motion.span className="absolute top-1/2 left-1/2 size-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: [0, 0.22, 0], scale: [0.6, 1.1, 1.3] }} transition={{ duration: 0.9, delay: 1.35, ease: 'easeOut' }} aria-hidden />
        </div>
    );
}

function MagneticButton({ children, onClick, primary }: { children: ReactNode; onClick: () => void; primary?: boolean }) {
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const sx = useSpring(x, { stiffness: 260, damping: 18 });
    const sy = useSpring(y, { stiffness: 260, damping: 18 });
    return (
        <motion.button
            type="button"
            onClick={onClick}
            style={{ x: sx, y: sy }}
            onPointerMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                x.set((e.clientX - r.left - r.width / 2) * 0.22);
                y.set((e.clientY - r.top - r.height / 2) * 0.3);
            }}
            onPointerLeave={() => {
                x.set(0);
                y.set(0);
            }}
            whileTap={{ scale: 0.97 }}
            className={cn(
                'group relative inline-flex h-12 items-center gap-2.5 overflow-hidden rounded-full px-6 text-[14px] font-medium transition-colors',
                primary ? 'bg-[color:var(--brand)] text-white shadow-[0_18px_40px_-14px_color-mix(in_srgb,var(--brand)_75%,transparent)]' : 'border border-white/15 text-white hover:border-white/40',
            )}
        >
            {primary && <span className="absolute inset-0 translate-y-full bg-white transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0" aria-hidden />}
            <span className={cn('relative flex items-center gap-2.5', primary && 'transition-colors duration-500 group-hover:text-black')}>{children}</span>
        </motion.button>
    );
}

/* -------------------------------------------------------------------------- */
/* Ticker                                                                     */
/* -------------------------------------------------------------------------- */

function wrap(min: number, max: number, v: number) {
    const range = max - min;
    return ((((v - min) % range) + range) % range) + min;
}

/** The service list, running like a print feed. Scrolling speeds it up and flips its direction. */
function TickerRow({ reverse, outline }: { reverse?: boolean; outline?: boolean }) {
    const reduce = useReducedMotion();
    const base = useMotionValue(0);
    const { scrollY } = useScroll();
    const velocity = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 400 });
    const factor = useTransform(velocity, [-1200, 0, 1200], [-4, 0, 4], { clamp: false });
    const direction = useRef(reverse ? -1 : 1);
    const x = useTransform(base, (v) => `${wrap(-50, 0, v)}%`);

    useAnimationFrame((_, delta) => {
        // Many desktops have "reduce motion" on (Windows: Animation effects off). The band still runs,
        // just slower and without reacting to scrolling, so it never looks frozen.
        const f = reduce ? 0 : factor.get();
        // Scrolling down pushes the rows their own way; scrolling up flips them.
        if (f < 0) direction.current = reverse ? 1 : -1;
        else if (f > 0) direction.current = reverse ? -1 : 1;
        const speed = reduce ? 1 : 1.6 * (1 + Math.abs(f));
        base.set(base.get() - direction.current * speed * (delta / 1000));
    });

    const { site } = useBrand();
    const titles = site.services.map((s) => s.title);
    // Enough words that one copy is wider than the screen, so the loop has no gap.
    const items = Array.from({ length: Math.max(2, Math.ceil(20 / Math.max(1, titles.length))) }, () => titles).flat();
    return (
        <div className="flex overflow-hidden whitespace-nowrap">
            <motion.div className="flex shrink-0 items-center" style={{ x }}>
                {[0, 1].map((copy) => (
                    <div key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
                        {items.map((t, i) => (
                            <span key={`${copy}-${i}`} className="flex items-center">
                                <span
                                    className={cn('px-6 font-display text-[clamp(2.4rem,6vw,5.2rem)] leading-none font-semibold tracking-[-0.04em]', outline ? 'text-transparent [-webkit-text-stroke:1px_#3A4150]' : 'text-[#ECEEF2]')}
                                >
                                    {t}
                                </span>
                                <span className={cn('size-3 rotate-45', outline ? 'border border-[#3A4150]' : 'bg-[color:var(--brand)]')} />
                            </span>
                        ))}
                    </div>
                ))}
            </motion.div>
        </div>
    );
}

function Ticker() {
    const { site } = useBrand();
    return (
        <section aria-label="What we print" className="relative border-y border-white/[0.06] bg-[#0A0B0E] py-8">
            <p className="sr-only">{site.services.map((s) => s.title).join(', ')}</p>
            <div className="-rotate-[1.2deg] space-y-3">
                <TickerRow />
                <TickerRow reverse outline />
            </div>
        </section>
    );
}

/* -------------------------------------------------------------------------- */
/* Services                                                                   */
/* -------------------------------------------------------------------------- */

const ART: Record<ArtKey, (active: boolean) => ReactNode> = {
    sublimation: (a) => <ArtSublimation active={a} />,
    dtf: (a) => <ArtDtf active={a} />,
    shirt: (a) => <ArtShirt active={a} />,
    tarp: (a) => <ArtTarp active={a} />,
    sign: (a) => <ArtSign active={a} />,
    sticker: (a) => <ArtSticker active={a} />,
    logo: (a) => <ArtLogo active={a} />,
    decal: (a) => <ArtDecal active={a} />,
    laser: (a) => <ArtLaser active={a} />,
    blueprint: (a) => <ArtBlueprint active={a} />,
};

/** Bento layout for any number of services: a large lead tile, two beside it, then rows of three. */
function tileSpan(index: number, count: number): string {
    if (count < 3) return count === 1 ? 'lg:col-span-12' : 'lg:col-span-6';
    if (index === 0) return 'lg:col-span-7 lg:row-span-2';
    if (index <= 2) return 'lg:col-span-5';
    const rest = count - 3;
    const full = Math.floor(rest / 3) * 3;
    if (index - 3 < full) return 'lg:col-span-4';
    return rest - full === 1 ? 'lg:col-span-12' : 'lg:col-span-6';
}

function Services() {
    const { site, t } = useBrand();
    return (
        <section id="services" className="relative mx-auto max-w-[1320px] scroll-mt-20 px-5 py-28 sm:px-8 lg:py-40">
            <div className="mb-16 grid gap-8 lg:mb-20 lg:grid-cols-[1fr_1fr] lg:items-end">
                <div>
                    <Eyebrow index="01">Services</Eyebrow>
                    <h2 className="mt-6 font-display text-[clamp(2.4rem,5.2vw,4.6rem)] leading-[0.95] font-semibold tracking-[-0.04em]">
                        <Reveal>
                            <Rich text={site.services_title_1} />
                        </Reveal>
                        <Reveal delay={0.08}>
                            <Rich text={site.services_title_2} />
                        </Reveal>
                    </h2>
                </div>
                <Reveal delay={0.15} className="lg:justify-self-end">
                    <p className="max-w-md text-[16px] leading-relaxed text-[#8A93A3]">{t(site.services_intro)}</p>
                </Reveal>
            </div>

            <div className="grid auto-rows-[minmax(300px,auto)] gap-3 md:grid-cols-2 lg:grid-cols-12">
                {site.services.map((s, i) => (
                    <ServiceTile key={`${i}-${s.title}`} service={s} index={i} span={tileSpan(i, site.services.length)} />
                ))}
            </div>
        </section>
    );
}

function ServiceTile({ service, index, span }: { service: SiteContent['services'][number]; index: number; span: string }) {
    const { color, t } = useBrand();
    const ref = useRef<HTMLElement>(null);
    const inView = useInView(ref, { once: true, margin: '-10% 0px' });
    const [hover, setHover] = useState(false);
    const rx = useMotionValue(0);
    const ry = useMotionValue(0);
    const px = useMotionValue(50);
    const py = useMotionValue(50);
    const srx = useSpring(rx, { stiffness: 200, damping: 20 });
    const sry = useSpring(ry, { stiffness: 200, damping: 20 });
    const glow = useMotionTemplate`radial-gradient(420px circle at ${px}% ${py}%, ${rgba(color, 0.16)}, transparent 60%)`;

    return (
        <motion.article
            ref={ref}
            initial={{ opacity: 0, y: 40 }}
            animate={inView ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.9, delay: (index % 3) * 0.08, ease: EASE }}
            onPointerEnter={() => setHover(true)}
            onPointerLeave={() => {
                setHover(false);
                rx.set(0);
                ry.set(0);
            }}
            onPointerMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const u = (e.clientX - r.left) / r.width;
                const v = (e.clientY - r.top) / r.height;
                px.set(u * 100);
                py.set(v * 100);
                ry.set((u - 0.5) * 6);
                rx.set(-(v - 0.5) * 6);
            }}
            style={{ rotateX: srx, rotateY: sry, transformPerspective: 1200 }}
            className={cn('group relative flex flex-col overflow-hidden rounded-[22px] border border-white/[0.07] bg-[#0D0F13] p-7 sm:p-8', span)}
        >
            <motion.div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" style={{ background: glow }} aria-hidden />
            <div className="relative flex items-start justify-between gap-4">
                <span className="font-mono text-[11px] tracking-[0.2em] text-[#5B6472]">{String(index + 1).padStart(2, '0')}</span>
                <span className="grid size-9 place-items-center rounded-full border border-white/10 text-[#8A93A3] transition-all duration-500 group-hover:rotate-45 group-hover:border-[color:var(--brand)] group-hover:bg-[color:var(--brand)] group-hover:text-white">
                    <ArrowUpRight className="size-4" />
                </span>
            </div>
            <div className="relative my-6 flex min-h-[140px] flex-1 items-center justify-center">{(ART[service.art] ?? ART.logo)(hover)}</div>
            <div className="relative">
                <h3 className="font-display text-[26px] leading-tight font-semibold tracking-[-0.02em] sm:text-[30px]">{t(service.title)}</h3>
                <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-[#8A93A3]">{t(service.body)}</p>
                <ul className="mt-5 flex flex-wrap gap-1.5">
                    {service.tags.map((tag) => (
                        <li key={tag} className="rounded-full border border-white/[0.08] px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] text-[#8A93A3] uppercase">
                            {tag}
                        </li>
                    ))}
                </ul>
            </div>
        </motion.article>
    );
}

/* Service illustrations: small, drawn, and each moving the way the real process moves. */

function ArtSublimation({ active }: { active: boolean }) {
    const { color } = useBrand();
    return (
        <svg viewBox="0 0 320 220" className="h-full max-h-[300px] w-full" aria-hidden>
            <defs>
                <linearGradient id="sub-dye" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0" stopColor={color} />
                    <stop offset="0.45" stopColor={mix(color, '#000000', 0.45)} />
                    <stop offset="0.55" stopColor="#ECEEF2" />
                    <stop offset="1" stopColor={color} />
                </linearGradient>
                <clipPath id="sub-shirt">
                    <path d="M110 30 L140 18 Q160 34 180 18 L210 30 L250 58 L232 88 L212 78 L212 200 L108 200 L108 78 L88 88 L70 58 Z" />
                </clipPath>
            </defs>
            <path d="M110 30 L140 18 Q160 34 180 18 L210 30 L250 58 L232 88 L212 78 L212 200 L108 200 L108 78 L88 88 L70 58 Z" fill="#14171D" stroke="#2A2F3A" />
            <g clipPath="url(#sub-shirt)">
                <motion.rect x="-220" y="0" width="640" height="220" fill="url(#sub-dye)" animate={{ x: active ? [-400, 0] : -150, opacity: active ? 1 : 0.55 }} transition={{ duration: active ? 1.2 : 0.6, ease: EASE }} />
                {[0, 1, 2, 3].map((i) => (
                    <motion.path key={i} d={`M${60 + i * 50} 220 L${130 + i * 50} 0`} stroke="#07080A" strokeWidth="10" opacity="0.35" animate={{ opacity: active ? 0.35 : 0.15 }} transition={{ delay: active ? 0.5 + i * 0.06 : 0 }} />
                ))}
                <motion.text x="160" y="140" textAnchor="middle" style={{ fontFamily: 'var(--font-display)' }} fontWeight="700" fontSize="46" fill="#ECEEF2" animate={{ opacity: active ? 1 : 0.5, y: active ? 0 : 6 }} transition={{ delay: active ? 0.7 : 0 }}>
                    07
                </motion.text>
            </g>
            <text x="160" y="214" textAnchor="middle" style={{ fontFamily: 'var(--font-mono)' }} fontSize="9" letterSpacing="3" fill="#5B6472">
                {active ? 'DYE INTO FIBER · 200°C' : 'HOVER TO PRESS'}
            </text>
        </svg>
    );
}

function ArtDtf({ active }: { active: boolean }) {
    const { color } = useBrand();
    return (
        <svg viewBox="0 0 240 150" className="h-[150px] w-full" aria-hidden>
            <rect x="60" y="20" width="120" height="110" rx="6" fill="#14171D" stroke="#2A2F3A" />
            <g>
                <circle cx="120" cy="66" r="22" fill={color} />
                <rect x="88" y="96" width="64" height="8" rx="2" fill="#ECEEF2" />
                <rect x="98" y="108" width="44" height="5" rx="2" fill="#5B6472" />
            </g>
            <motion.path
                d="M60 20 H180 V130 H60 Z"
                fill="rgba(160,200,255,0.12)"
                stroke="rgba(160,200,255,0.4)"
                style={{ originX: 1, originY: 1 }}
                animate={{ rotate: active ? -28 : 0, x: active ? 40 : 0, y: active ? -10 : 0 }}
                transition={{ duration: 0.9, ease: EASE }}
            />
            <text x="120" y="146" textAnchor="middle" style={{ fontFamily: 'var(--font-mono)' }} fontSize="8" letterSpacing="2.5" fill="#5B6472">
                PEEL FILM
            </text>
        </svg>
    );
}

function ArtShirt({ active }: { active: boolean }) {
    const { color } = useBrand();
    return (
        <svg viewBox="0 0 240 150" className="h-[150px] w-full" aria-hidden>
            <path d="M88 22 L106 14 Q120 26 134 14 L152 22 L182 42 L170 62 L156 55 L156 138 L84 138 L84 55 L70 62 L58 42 Z" fill="#14171D" stroke="#2A2F3A" />
            {['#ECEEF2', color, '#8A93A3'].map((c, i) => (
                <motion.rect key={i} x={96 + i * 16} y="60" width="14" height="34" rx="2" fill={c} animate={{ scaleY: active ? [0.2, 1] : 0.7, opacity: active ? 1 : 0.55 }} style={{ originY: 1 }} transition={{ duration: 0.5, delay: active ? i * 0.1 : 0, ease: EASE }} />
            ))}
            <motion.rect x="96" y="100" width="46" height="4" rx="1" fill="#5B6472" animate={{ scaleX: active ? 1 : 0.3 }} style={{ originX: 0 }} transition={{ delay: active ? 0.35 : 0 }} />
        </svg>
    );
}

function ArtTarp({ active }: { active: boolean }) {
    const { color } = useBrand();
    return (
        <svg viewBox="0 0 240 150" className="h-[150px] w-full" aria-hidden>
            <motion.g animate={active ? { skewY: [0, -2, 1.5, 0] } : { skewY: 0 }} transition={{ duration: 1.4, repeat: active ? Infinity : 0, ease: 'easeInOut' }}>
                <rect x="28" y="36" width="184" height="80" fill="#ECEEF2" />
                <rect x="28" y="36" width="184" height="18" fill={color} />
                <text x="120" y="92" textAnchor="middle" style={{ fontFamily: 'var(--font-display)' }} fontWeight="700" fontSize="24" fill="#07080A">
                    HAPPY FIESTA!
                </text>
                {[[36, 44], [204, 44], [36, 108], [204, 108]].map(([x, y], i) => (
                    <motion.circle key={i} cx={x} cy={y} r="3.5" fill="#07080A" stroke="#8A93A3" animate={{ scale: active ? [1, 1.6, 1] : 1 }} transition={{ duration: 0.6, delay: i * 0.1, repeat: active ? Infinity : 0, repeatDelay: 0.8 }} />
                ))}
            </motion.g>
        </svg>
    );
}

function ArtSign({ active }: { active: boolean }) {
    const { color } = useBrand();
    const letters = ['O', 'P', 'E', 'N'];
    return (
        <svg viewBox="0 0 240 150" className="h-[150px] w-full" aria-hidden>
            <rect x="34" y="34" width="172" height="82" rx="10" fill="#0A0B0E" stroke="#2A2F3A" />
            {letters.map((l, i) => (
                <motion.text
                    key={l}
                    x={70 + i * 34}
                    y="92"
                    textAnchor="middle"
                    style={{ fontFamily: 'var(--font-display)' }}
                    fontWeight="700"
                    fontSize="40"
                    animate={{ fill: active ? mix(color, '#FFFFFF', 0.2) : '#3A4150', filter: active ? `drop-shadow(0 0 8px ${color})` : 'drop-shadow(0 0 0 transparent)' }}
                    transition={{ delay: active ? 0.15 + i * 0.12 : 0, duration: 0.25 }}
                >
                    {l}
                </motion.text>
            ))}
            <line x1="80" y1="34" x2="80" y2="12" stroke="#2A2F3A" />
            <line x1="160" y1="34" x2="160" y2="12" stroke="#2A2F3A" />
        </svg>
    );
}

function ArtSticker({ active }: { active: boolean }) {
    const { color, short } = useBrand();
    return (
        <svg viewBox="0 0 240 150" className="h-[150px] w-full" aria-hidden>
            <circle cx="120" cy="75" r="52" fill="#ECEEF2" />
            <circle cx="120" cy="75" r="44" fill={color} />
            <text x="120" y="84" textAnchor="middle" style={{ fontFamily: 'var(--font-display)' }} fontWeight="700" fontSize={Math.min(26, 128 / Math.max(1, short.length))} fill="#ECEEF2">
                {short}
            </text>
            <motion.path
                d="M157 112 Q176 104 172 78 L150 100 Z"
                fill="#C9CDD4"
                animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 0.4 }}
                style={{ originX: 0.3, originY: 1 }}
                transition={{ duration: 0.45, ease: EASE }}
            />
            <motion.circle cx="120" cy="75" r="60" fill="none" stroke="#5B6472" strokeDasharray="4 5" animate={{ rotate: active ? 90 : 0 }} transition={{ duration: 1.2, ease: EASE }} />
        </svg>
    );
}

function ArtLogo({ active }: { active: boolean }) {
    const { color: RED } = useBrand();
    const d = 'M70 110 C70 60 110 40 130 40 C160 40 170 70 150 80 C130 90 100 80 100 60 M120 110 L170 40';
    return (
        <svg viewBox="0 0 240 150" className="h-[150px] w-full" aria-hidden>
            <motion.path d={d} fill="none" stroke="#ECEEF2" strokeWidth="5" strokeLinecap="round" initial={false} animate={{ pathLength: active ? [0, 1] : 1, opacity: active ? 1 : 0.7 }} transition={{ duration: 1.1, ease: EASE }} />
            {[
                [70, 110],
                [130, 40],
                [150, 80],
                [170, 40],
            ].map(([x, y], i) => (
                <g key={i}>
                    <motion.rect x={x - 4} y={y - 4} width="8" height="8" fill="#07080A" stroke={RED} strokeWidth="1.5" animate={{ opacity: active ? 1 : 0.35 }} transition={{ delay: active ? 0.2 + i * 0.12 : 0 }} />
                </g>
            ))}
            <motion.line x1="130" y1="40" x2="100" y2="22" stroke={RED} strokeWidth="1" animate={{ opacity: active ? 1 : 0 }} />
            <motion.circle cx="100" cy="22" r="3" fill={RED} animate={{ opacity: active ? 1 : 0 }} />
        </svg>
    );
}

function ArtDecal({ active }: { active: boolean }) {
    const { color: RED } = useBrand();
    return (
        <svg viewBox="0 0 240 150" className="h-[150px] w-full" aria-hidden>
            <defs>
                <clipPath id="decal-body">
                    <path d="M30 98 Q40 70 80 66 L110 48 Q140 40 170 50 L200 70 Q214 74 214 92 L214 104 L30 104 Z" />
                </clipPath>
            </defs>
            <path d="M30 98 Q40 70 80 66 L110 48 Q140 40 170 50 L200 70 Q214 74 214 92 L214 104 L30 104 Z" fill="#14171D" stroke="#2A2F3A" />
            <g clipPath="url(#decal-body)">
                {[0, 1].map((i) => (
                    <motion.rect key={i} x="-60" y={72 + i * 14} width="200" height={i === 0 ? 9 : 4} fill={i === 0 ? RED : '#ECEEF2'} style={{ skewX: -30 }} animate={{ x: active ? [-220, 60] : 60, opacity: active ? 1 : 0.6 }} transition={{ duration: 0.8, delay: active ? i * 0.1 : 0, ease: EASE }} />
                ))}
            </g>
            <circle cx="72" cy="106" r="16" fill="#07080A" stroke="#3A4150" strokeWidth="4" />
            <circle cx="176" cy="106" r="16" fill="#07080A" stroke="#3A4150" strokeWidth="4" />
        </svg>
    );
}

function ArtLaser({ active }: { active: boolean }) {
    const { color } = useBrand();
    const path = 'M60 110 L60 60 Q60 36 90 36 L150 36 Q180 36 180 60 L180 110 Z';
    const ref = useRef<SVGPathElement>(null);
    const t = useMotionValue(0);
    const cx = useMotionValue(60);
    const cy = useMotionValue(110);
    useEffect(() => {
        const controls = animate(t, active ? 1 : 0, { duration: active ? 2 : 0.3, ease: 'linear' });
        return () => controls.stop();
    }, [active, t]);
    useMotionValueEvent(t, 'change', (v) => {
        const el = ref.current;
        if (!el) return;
        const pt = el.getPointAtLength(v * el.getTotalLength());
        cx.set(pt.x);
        cy.set(pt.y);
    });
    const draw = useTransform(t, (v) => v);
    return (
        <svg viewBox="0 0 240 150" className="h-[150px] w-full" aria-hidden>
            <path ref={ref} d={path} fill="none" stroke="#2A2F3A" strokeDasharray="3 4" />
            <motion.path d={path} fill="none" stroke={mix(color, '#FFFFFF', 0.3)} strokeWidth="2" style={{ pathLength: draw, filter: `drop-shadow(0 0 4px ${color})` }} />
            <motion.circle r="4" fill="#FFF" style={{ cx, cy, filter: `drop-shadow(0 0 6px ${color})` }} animate={{ opacity: active ? 1 : 0 }} />
            <text x="120" y="82" textAnchor="middle" style={{ fontFamily: 'var(--font-mono)' }} fontSize="9" letterSpacing="2.5" fill="#5B6472">
                3MM ACRYLIC
            </text>
        </svg>
    );
}

function ArtBlueprint({ active }: { active: boolean }) {
    const edges = ['M160 40 L220 70 L160 100 L100 70 Z', 'M100 70 L100 130 L160 160 L160 100', 'M220 70 L220 130 L160 160'];
    return (
        <div className="relative h-[180px] w-full overflow-hidden rounded-xl border border-[#1B3A5C]/60 bg-[#0B1A2B] bg-[linear-gradient(rgba(90,150,220,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(90,150,220,0.12)_1px,transparent_1px)] [background-size:20px_20px]">
            <svg viewBox="0 0 640 180" className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden>
                {/* Floor plan */}
                <motion.path d="M340 30 H600 V150 H340 Z M440 30 V100 H340 M520 150 V90 H600" fill="none" stroke="#7FB2EA" strokeWidth="2" initial={false} animate={{ pathLength: active ? 1 : 0.35 }} transition={{ duration: 1.4, ease: EASE }} />
                <motion.g animate={{ opacity: active ? 1 : 0.3 }} transition={{ delay: active ? 0.6 : 0 }}>
                    <line x1="340" y1="164" x2="600" y2="164" stroke="#7FB2EA" strokeWidth="1" />
                    <text x="470" y="176" textAnchor="middle" style={{ fontFamily: 'var(--font-mono)' }} fontSize="10" fill="#7FB2EA">
                        12.00 M
                    </text>
                </motion.g>
                {/* Isometric part */}
                <motion.g animate={{ y: active ? -8 : 0 }} transition={{ duration: 0.8, ease: EASE }}>
                    {edges.map((e, i) => (
                        <motion.path key={e} d={e} fill={i === 0 ? 'rgba(127,178,234,0.12)' : 'none'} stroke="#ECEEF2" strokeWidth="1.5" initial={false} animate={{ pathLength: active ? 1 : 0.5 }} transition={{ duration: 1, delay: active ? i * 0.2 : 0, ease: EASE }} />
                    ))}
                </motion.g>
                <text x="40" y="40" style={{ fontFamily: 'var(--font-mono)' }} fontSize="10" letterSpacing="2" fill="#7FB2EA">
                    SHEET A-101
                </text>
            </svg>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Process: a job ticket riding across the production board                    */
/* -------------------------------------------------------------------------- */

function Process() {
    const { site, branches, t } = useBrand();
    const STEPS = site.steps;
    const ref = useRef<HTMLElement>(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
    const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
    const [step, setStep] = useState(0);
    useMotionValueEvent(scrollYProgress, 'change', (v) => setStep(Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length * 0.999)))));
    const board = useRef<HTMLDivElement>(null);
    const [column, setColumn] = useState(0);
    useEffect(() => {
        const el = board.current;
        if (!el) return;
        const measure = () => setColumn((el.clientWidth - 36) / 4 + 12);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    const ticketX = useTransform(progress, (v) => v * column * 3);
    const bar = useTransform(progress, [0, 1], ['0%', '100%']);

    return (
        <section id="process" ref={ref} className="relative scroll-mt-10 border-t border-white/[0.06] bg-[#0A0B0E] lg:h-[320vh]">
            <div className="lg:sticky lg:top-0 lg:flex lg:h-screen lg:items-center">
                <div className="mx-auto w-full max-w-[1320px] px-5 py-28 sm:px-8 lg:py-0">
                    <div className="mb-14 flex flex-wrap items-end justify-between gap-6">
                        <div>
                            <Eyebrow index="02">How an order moves</Eyebrow>
                            <h2 className="mt-6 font-display text-[clamp(2.4rem,5.2vw,4.6rem)] leading-[0.95] font-semibold tracking-[-0.04em]">
                                <Reveal>
                                    <Rich text={site.process_title_1} />
                                </Reveal>
                                <Reveal delay={0.08}>
                                    <Rich text={site.process_title_2} />
                                </Reveal>
                            </h2>
                        </div>
                        <p className="hidden font-mono text-[11px] tracking-[0.2em] text-[#5B6472] uppercase lg:block">
                            Step <span className="text-[#ECEEF2]">{String(step + 1).padStart(2, '0')}</span> / {String(STEPS.length).padStart(2, '0')}
                        </p>
                    </div>

                    {/* Desktop: the board. */}
                    <div className="relative hidden lg:block">
                        <div ref={board} className="grid grid-cols-4 gap-3">
                            {STEPS.map((s, i) => (
                                <div key={i} className={cn('relative min-h-[360px] rounded-[20px] border p-6 transition-colors duration-500', i <= step ? 'border-white/[0.1] bg-[#0F1116]' : 'border-white/[0.04] bg-transparent')}>
                                    <div className="flex items-center justify-between font-mono text-[11px] tracking-[0.2em] uppercase">
                                        <span className={i <= step ? 'text-[color:var(--brand)]' : 'text-[#3A4150]'}>0{i + 1}</span>
                                        <span className={cn('size-1.5 rounded-full transition-colors', i === step ? 'bg-[color:var(--brand)]' : i < step ? 'bg-[#8A93A3]' : 'bg-[#2A2F3A]')} />
                                    </div>
                                    <h3 className={cn('mt-4 font-display text-[24px] font-semibold tracking-[-0.02em] transition-colors duration-500', i <= step ? 'text-white' : 'text-[#3A4150]')}>{t(s.title)}</h3>
                                    <p className={cn('mt-2 text-[14px] leading-relaxed transition-colors duration-500', i <= step ? 'text-[#8A93A3]' : 'text-[#2A2F3A]')}>{t(s.body)}</p>
                                </div>
                            ))}
                        </div>
                        {/* The ticket, riding along the bottom of the columns. */}
                        <div className="pointer-events-none absolute inset-x-0 bottom-10">
                            <motion.div className="w-[calc((100%-36px)/4)] px-5" style={{ x: ticketX }}>
                                <JobTicket stage={t(STEPS[step]?.tag ?? '')} code={branches[0]?.code ?? 'JOB'} title={t(site.ticket_title)} note={t(site.ticket_note)} />
                            </motion.div>
                        </div>
                        <div className="mt-6 h-px w-full bg-white/[0.06]">
                            <motion.div className="h-px bg-[color:var(--brand)]" style={{ width: bar }} />
                        </div>
                    </div>

                    {/* Phones and tablets: a simple list. */}
                    <ol className="space-y-3 lg:hidden">
                        {STEPS.map((s, i) => (
                            <ProcessItem key={i} index={i} title={t(s.title)} body={t(s.body)} />
                        ))}
                    </ol>
                </div>
            </div>
        </section>
    );
}

function ProcessItem({ index, title, body }: { index: number; title: string; body: string }) {
    const ref = useRef<HTMLLIElement>(null);
    const inView = useInView(ref, { once: true, margin: '-15% 0px' });
    return (
        <motion.li ref={ref} initial={{ opacity: 0, x: -20 }} animate={inView ? { opacity: 1, x: 0 } : undefined} transition={{ duration: 0.7, ease: EASE }} className="flex gap-5 rounded-[18px] border border-white/[0.08] bg-[#0F1116] p-6">
            <span className="font-mono text-[12px] text-[color:var(--brand)]">0{index + 1}</span>
            <div>
                <h3 className="font-display text-[22px] font-semibold">{title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-[#8A93A3]">{body}</p>
            </div>
        </motion.li>
    );
}

function JobTicket({ stage, code, title, note }: { stage: string; code: string; title: string; note: string }) {
    const now = new Date();
    const period = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    return (
        <div className="relative rounded-[14px] bg-[#ECEEF2] p-4 text-[#07080A] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.14em]">
                <span>{code}-{period}-0142</span>
                <span className="rounded-full bg-[color:var(--brand)] px-2 py-0.5 text-white">RUSH</span>
            </div>
            <p className="mt-2 font-display text-[16px] leading-tight font-semibold">{title}</p>
            <p className="text-[12px] text-[#5B6472]">{note}</p>
            <div className="mt-3 flex items-center justify-between border-t border-dashed border-[#9AA2B1] pt-2.5">
                <AnimatePresence mode="wait">
                    <motion.span key={stage} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.25 }} className="font-mono text-[10px] font-semibold tracking-[0.14em] text-[color:var(--brand)]">
                        {stage}
                    </motion.span>
                </AnimatePresence>
                <span className="flex gap-0.5" aria-hidden>
                    {Array.from({ length: 16 }).map((_, i) => (
                        <span key={i} className="h-4 bg-[#07080A]" style={{ width: [1, 2, 1, 3][i % 4] }} />
                    ))}
                </span>
            </div>
            <span className="absolute top-1/2 -left-2 size-4 -translate-y-1/2 rounded-full bg-[#0A0B0E]" />
            <span className="absolute top-1/2 -right-2 size-4 -translate-y-1/2 rounded-full bg-[#0A0B0E]" />
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Branches: Negros Island with every shop pinned                              */
/* -------------------------------------------------------------------------- */

// Approximate coastline of Negros Island, clockwise from Bacolod, as [longitude, latitude].
const NEGROS: [number, number][] = [
    [122.95, 10.67], [122.97, 10.78], [123.08, 10.91], [123.3, 10.96], [123.42, 10.92], [123.52, 10.83], [123.55, 10.72],
    [123.43, 10.58], [123.42, 10.48], [123.33, 10.34], [123.28, 10.15], [123.22, 10.0], [123.17, 9.8], [123.14, 9.63],
    [123.17, 9.51], [123.27, 9.38], [123.31, 9.3], [123.28, 9.2], [123.2, 9.08], [123.03, 9.04], [122.87, 9.28],
    [122.79, 9.37], [122.62, 9.42], [122.46, 9.58], [122.4, 9.75], [122.49, 9.95], [122.68, 10.02], [122.8, 10.02],
    [122.86, 10.13], [122.84, 10.25], [122.84, 10.4], [122.83, 10.53],
];
const PINS: Record<string, [number, number]> = { BCD: [122.95, 10.67], KAB: [122.83, 10.0], DGT: [123.3, 9.31] };
const project = ([lon, lat]: [number, number]): [number, number] => [(lon - 122.3) * 320 + 20, (11.05 - lat) * 320 + 20];

/** A closed Catmull-Rom curve through the coastline points, so the island reads as land, not a polygon. */
function smoothPath(points: [number, number][]): string {
    const p = points.map(project);
    const n = p.length;
    let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
    for (let i = 0; i < n; i++) {
        const p0 = p[(i - 1 + n) % n];
        const p1 = p[i];
        const p2 = p[(i + 1) % n];
        const p3 = p[(i + 2) % n];
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return `${d} Z`;
}

function Branches() {
    const { site, branches, name, short, color: RED, t } = useBrand();
    const mapRef = useRef<HTMLDivElement>(null);
    const inView = useInView(mapRef, { once: true, margin: '-20% 0px' });
    const [focus, setFocus] = useState<string | null>(null);
    const island = useMemo(() => smoothPath(NEGROS), []);
    const pinned = site.show_map ? branches.filter((b) => PINS[b.code]) : [];
    const trail = pinned.length > 1 ? `M${[...pinned].sort((a, b) => PINS[b.code][1] - PINS[a.code][1]).map((b) => project(PINS[b.code]).map((v) => v.toFixed(1)).join(',')).join(' L')}` : '';

    return (
        <section id="branches" className="relative mx-auto max-w-[1320px] scroll-mt-20 px-5 py-28 sm:px-8 lg:py-40">
            <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
                <div ref={mapRef} className="relative order-2 lg:order-1">
                    {pinned.length === 0 ? (
                        <BranchStamp />
                    ) : (
                    <div className="relative mx-auto aspect-[460/700] w-full max-w-[440px]">
                        <CropMarks className="-inset-4" delay={0.2} />
                        <svg viewBox="0 0 460 700" className="h-full w-full" role="img" aria-label={`Map of Negros Island with ${pinned.length} ${name} branches`}>
                            <defs>
                                <pattern id="map-dots" width="9" height="9" patternUnits="userSpaceOnUse">
                                    <circle cx="1.5" cy="1.5" r="1.2" fill="#3A4150" />
                                </pattern>
                                <clipPath id="map-island">
                                    <path d={island} />
                                </clipPath>
                            </defs>
                            <text x="40" y="360" style={{ fontFamily: 'var(--font-mono)' }} fontSize="10" letterSpacing="3" fill="#2A2F3A" transform="rotate(-90 40 360)">
                                SULU SEA
                            </text>
                            <text x="430" y="300" style={{ fontFamily: 'var(--font-mono)' }} fontSize="10" letterSpacing="3" fill="#2A2F3A" transform="rotate(90 430 300)">
                                TAÑON STRAIT
                            </text>
                            <motion.path d={island} fill="none" stroke="#3A4150" strokeWidth="1.5" initial={{ pathLength: 0 }} animate={inView ? { pathLength: 1 } : undefined} transition={{ duration: 2.2, ease: EASE }} />
                            <motion.rect width="460" height="700" fill="url(#map-dots)" clipPath="url(#map-island)" initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : undefined} transition={{ duration: 1.2, delay: 0.9 }} />
                            {trail && (
                                <motion.path d={trail} fill="none" stroke={RED} strokeWidth="1.5" strokeDasharray="5 6" initial={{ pathLength: 0 }} animate={inView ? { pathLength: 1 } : undefined} transition={{ duration: 1.6, delay: 1.4, ease: 'easeInOut' }} />
                            )}
                            {pinned.map((b, i) => {
                                const [x, y] = project(PINS[b.code]);
                                const on = focus === b.code;
                                return (
                                    <motion.g key={b.code} initial={{ opacity: 0, y: -30 }} animate={inView ? { opacity: 1, y: 0 } : undefined} transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 1.2 + i * 0.25 }}>
                                        <motion.circle cx={x} cy={y} r="10" fill="none" stroke={RED} animate={{ r: [10, 30], opacity: [0.8, 0] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.6 }} />
                                        <circle cx={x} cy={y} r={on ? 9 : 6} fill={RED} stroke="#07080A" strokeWidth="3" style={{ transition: 'r 0.3s' }} />
                                        <g transform={`translate(${x + (b.code === 'DGT' ? -18 : 16)}, ${y - 12})`}>
                                            <rect x={b.code === 'DGT' ? -118 : 0} y="-12" width="118" height="30" rx="15" fill={on ? '#ECEEF2' : '#0F1116'} stroke="#2A2F3A" style={{ transition: 'fill 0.3s' }} />
                                            <text x={b.code === 'DGT' ? -59 : 59} y="8" textAnchor="middle" fontWeight="600" fontSize="13" fill={on ? '#07080A' : '#ECEEF2'} style={{ fontFamily: 'var(--font-display)', transition: 'fill 0.3s' }}>
                                                {stripShort(b.name, short)}
                                            </text>
                                        </g>
                                    </motion.g>
                                );
                            })}
                        </svg>
                    </div>
                    )}
                </div>

                <div className="order-1 lg:order-2">
                    <Eyebrow index="03">Branches</Eyebrow>
                    <h2 className="mt-6 font-display text-[clamp(2.4rem,5.2vw,4.6rem)] leading-[0.95] font-semibold tracking-[-0.04em]">
                        <Reveal>
                            <Rich text={site.branches_title_1} />
                        </Reveal>
                        <Reveal delay={0.08}>
                            <Rich text={site.branches_title_2} />
                        </Reveal>
                    </h2>
                    <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-[#8A93A3]">{t(site.branches_body)}</p>

                    <ul className="mt-12 divide-y divide-white/[0.07] border-y border-white/[0.07]">
                        {branches.map((b, i) => (
                            <BranchRow key={b.code} branch={b} index={i} onFocus={setFocus} active={focus === b.code} />
                        ))}
                    </ul>
                </div>
            </div>
        </section>
    );
}

/** Stands in for the map when it is turned off or no branch has a pin on it. */
function BranchStamp() {
    const { branches, logo, name, site, t } = useBrand();
    return (
        <div className="relative mx-auto grid aspect-square w-full max-w-[440px] place-items-center">
            <CropMarks className="inset-2" delay={0.2} />
            <div className="absolute inset-10 rounded-full border border-dashed border-[#1A1E26]" aria-hidden />
            <div className="relative flex flex-col items-center px-10 text-center">
                <img src={logo} alt={name} className="w-[70%] max-w-[260px] object-contain drop-shadow-[0_30px_40px_rgba(0,0,0,0.6)]" />
                <p className="mt-8 font-display text-[clamp(3.4rem,8vw,5.6rem)] leading-none font-semibold tracking-[-0.05em] text-white">{String(branches.length).padStart(2, '0')}</p>
                <p className="mt-2 font-mono text-[11px] tracking-[0.2em] text-[color:var(--brand)] uppercase">{branches.length === 1 ? 'Branch' : 'Branches'}{site.region ? ` · ${t(site.region)}` : ''}</p>
            </div>
        </div>
    );
}

function BranchRow({ branch, index, onFocus, active }: { branch: BranchInfo; index: number; onFocus: (code: string | null) => void; active: boolean }) {
    const { name, short } = useBrand();
    const ref = useRef<HTMLLIElement>(null);
    const inView = useInView(ref, { once: true, margin: '-10% 0px' });
    const city = stripShort(branch.name, short);
    const hasShort = city !== branch.name;
    return (
        <motion.li
            ref={ref}
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.8, delay: index * 0.1, ease: EASE }}
            onPointerEnter={() => onFocus(branch.code)}
            onPointerLeave={() => onFocus(null)}
            className="group relative py-7"
        >
            <motion.span className="absolute inset-y-0 -left-5 w-[3px] origin-top bg-[color:var(--brand)]" animate={{ scaleY: active ? 1 : 0 }} transition={{ duration: 0.35, ease: EASE }} aria-hidden />
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <h3 className="font-display text-[clamp(1.8rem,3.4vw,2.7rem)] leading-none font-semibold tracking-[-0.03em]">
                    {hasShort && <span className="text-[#5B6472] transition-colors group-hover:text-[color:var(--brand)]">{short} </span>}
                    {city}
                </h3>
                <span className="font-mono text-[11px] tracking-[0.2em] text-[#5B6472]">{branch.code}</span>
            </div>
            {branch.address && (
                <p className="mt-3 flex items-start gap-2 text-[15px] text-[#8A93A3]">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-[#5B6472]" />
                    {branch.address}
                </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
                {branch.phone && (
                    <a href={`tel:${branch.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3.5 py-1.5 text-[13px] text-[#ECEEF2] transition-colors hover:border-[color:var(--brand)] hover:bg-[color:var(--brand)]">
                        <Phone className="size-3.5" /> {branch.phone}
                    </a>
                )}
                {branch.email && (
                    <a href={`mailto:${branch.email}`} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3.5 py-1.5 text-[13px] text-[#ECEEF2] transition-colors hover:border-white/40">
                        <Mail className="size-3.5" /> {branch.email}
                    </a>
                )}
                {branch.address && (
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${branch.address}`)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] text-[#8A93A3] hover:text-white">
                        Directions <ArrowUpRight className="size-3.5" />
                    </a>
                )}
            </div>
        </motion.li>
    );
}

/* -------------------------------------------------------------------------- */
/* Promise                                                                    */
/* -------------------------------------------------------------------------- */

function CountTo({ value }: { value: number }) {
    const ref = useRef<HTMLSpanElement>(null);
    const inView = useInView(ref, { once: true });
    const [n, setN] = useState(0);
    const reduce = useReducedMotion();
    useEffect(() => {
        if (!inView) return;
        if (reduce) {
            setN(value);
            return;
        }
        let frame = 0;
        const start = performance.now();
        const tick = (t: number) => {
            const k = Math.min(1, (t - start) / 1200);
            setN(Math.round(value * (1 - Math.pow(1 - k, 3))));
            if (k < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [inView, value, reduce]);
    return <span ref={ref}>{String(n).padStart(2, '0')}</span>;
}

function Commitments() {
    const { site, t } = useBrand();
    return (
        <section className="border-y border-white/[0.06] bg-[#0A0B0E]">
            <div className="mx-auto grid max-w-[1320px] sm:grid-cols-2 lg:grid-cols-4">
                {site.highlights.map((it, i) => {
                    const big = t(it.big);
                    // Plain numbers count up as they scroll in; anything else prints as written.
                    return <PromiseCell key={i} index={i} big={/^\d{1,6}$/.test(big) ? <CountTo value={Number(big)} /> : big} label={t(it.label)} body={t(it.body)} />;
                })}
            </div>
        </section>
    );
}

function PromiseCell({ big, label, body, index }: { big: ReactNode; label: string; body: string; index: number }) {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, margin: '-10% 0px' });
    return (
        <motion.div ref={ref} initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : undefined} transition={{ duration: 0.8, delay: index * 0.1 }} className="border-white/[0.06] px-8 py-12 sm:border-r sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:last:border-r-0">
            <p className="font-display text-[clamp(3rem,5vw,4.4rem)] leading-none font-semibold tracking-[-0.05em] text-white">{big}</p>
            <p className="mt-4 font-mono text-[11px] tracking-[0.2em] text-[color:var(--brand)] uppercase">{label}</p>
            <p className="mt-2 text-[14px] leading-relaxed text-[#8A93A3]">{body}</p>
        </motion.div>
    );
}

/* -------------------------------------------------------------------------- */
/* Closing call to action                                                     */
/* -------------------------------------------------------------------------- */

function Closing() {
    const { site, branches, t } = useBrand();
    const ref = useRef<HTMLElement>(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
    const x = useTransform(scrollYProgress, [0, 1], ['8%', '-22%']);
    const first = branches.find((b) => b.phone);

    return (
        <section id="contact" ref={ref} className="relative scroll-mt-20 overflow-hidden py-32 lg:py-44">
            <motion.p className="pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 font-display text-[34vw] leading-none font-bold tracking-[-0.07em] whitespace-nowrap text-transparent [-webkit-text-stroke:1px_#15181E]" style={{ x }} aria-hidden>
                {t(site.closing_outline)}
            </motion.p>
            <div className="relative mx-auto max-w-[1320px] px-5 sm:px-8">
                <Eyebrow index="04">{t(site.closing_eyebrow)}</Eyebrow>
                <h2 className="mt-8 max-w-5xl font-display text-[clamp(2.8rem,7vw,6.6rem)] leading-[0.92] font-semibold tracking-[-0.05em]">
                    <Reveal>
                        <Rich text={site.closing_line_1} />
                    </Reveal>
                    <Reveal delay={0.1}>
                        {accentParts(t(site.closing_line_2)).map((part, i) =>
                            part.accent ? (
                                <span key={i} className="relative inline-block">
                                    {part.text}
                                    <motion.span className="absolute right-0 -bottom-1 left-0 h-[0.08em] origin-left bg-[color:var(--brand)]" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.6, ease: EASE }} />
                                </span>
                            ) : (
                                <span key={i} className="text-[#5B6472]">
                                    {part.text}
                                </span>
                            ),
                        )}
                    </Reveal>
                </h2>
                <div className="mt-12 flex flex-wrap gap-3">
                    {first?.phone && (
                        <a href={`tel:${first.phone.replace(/\s+/g, '')}`} className="group relative inline-flex h-14 items-center gap-3 overflow-hidden rounded-full bg-[color:var(--brand)] px-8 text-[15px] font-medium text-white">
                            <span className="absolute inset-0 translate-y-full bg-white transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0" aria-hidden />
                            <span className="relative flex items-center gap-3 transition-colors duration-500 group-hover:text-black">
                                <Phone className="size-4" /> Call {first.name}
                            </span>
                        </a>
                    )}
                    <button type="button" onClick={() => scrollToId('branches')} className="inline-flex h-14 items-center gap-3 rounded-full border border-white/15 px-8 text-[15px] text-white transition-colors hover:border-white/40">
                        All branches <ArrowRight className="size-4" />
                    </button>
                </div>
            </div>
        </section>
    );
}

/* -------------------------------------------------------------------------- */
/* Footer                                                                     */
/* -------------------------------------------------------------------------- */

function Footer({ signedIn }: { signedIn: boolean }) {
    const { site, branches, name, logo, t } = useBrand();
    return (
        <footer className="relative border-t border-white/[0.06] bg-[#050607]">
            <div className="mx-auto grid max-w-[1320px] gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.3fr_1fr_1fr]">
                <div>
                    <img src={logo} alt={name} className="h-16 w-auto max-w-[220px] object-contain" width={128} height={64} />
                    <p className="mt-5 max-w-xs text-[14px] leading-relaxed text-[#5B6472]">{t(site.footer_blurb)}</p>
                </div>
                <div>
                    <p className="font-mono text-[11px] tracking-[0.2em] text-[#5B6472] uppercase">Services</p>
                    <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[14px] text-[#8A93A3]">
                        {site.services.map((s, i) => (
                            <li key={i}>
                                <button type="button" onClick={() => scrollToId('services')} className="hover:text-white">
                                    {t(s.title)}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
                <div>
                    <p className="font-mono text-[11px] tracking-[0.2em] text-[#5B6472] uppercase">Branches</p>
                    <ul className="mt-4 space-y-3 text-[14px]">
                        {branches.map((b) => (
                            <li key={b.code}>
                                <p className="text-[#ECEEF2]">{b.name}</p>
                                {b.phone && (
                                    <a href={`tel:${b.phone.replace(/\s+/g, '')}`} className="text-[#8A93A3] hover:text-white">
                                        {b.phone}
                                    </a>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            <div className="border-t border-white/[0.06]">
                <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-4 px-5 py-6 font-mono text-[11px] tracking-[0.14em] text-[#5B6472] uppercase sm:px-8">
                    <span>&copy; {new Date().getFullYear()} {name}</span>
                    <Link href={signedIn ? route('dashboard') : route('login')} className="flex items-center gap-2 hover:text-white">
                        {signedIn ? 'Open dashboard' : 'Staff sign in'} <ArrowUpRight className="size-3.5" />
                    </Link>
                </div>
            </div>
        </footer>
    );
}
