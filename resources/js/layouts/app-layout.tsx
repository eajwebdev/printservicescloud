import { Link, router } from '@inertiajs/react';
import { LogOut, Menu as MenuIcon, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import { BillingNotice } from '@/components/billing-notice';
import { BranchSwitcher } from '@/components/branch-switcher';
import { CommandPalette } from '@/components/command-palette';
import { ToastProvider } from '@/components/toaster';
import { IconButton } from '@/components/ui/button';
import { Kbd, Skeleton } from '@/components/ui/misc';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/menu';
import { useHotkey } from '@/hooks/use-filters';
import { useTheme } from '@/hooks/use-theme';
import { peso, time } from '@/lib/format';
import { cn, initials, useAppPage } from '@/lib/utils';
import { NAV, PLATFORM_NAV, type NavItem } from './nav';

function readCollapsed(): boolean {
    try {
        return localStorage.getItem('pr-rail') === '1';
    } catch {
        return false;
    }
}

export default function AppLayout({ children }: { children: ReactNode }) {
    return (
        <ToastProvider>
            <Shell>{children}</Shell>
        </ToastProvider>
    );
}

function Shell({ children }: { children: ReactNode }) {
    const { props } = useAppPage();
    const [collapsed, setCollapsed] = useState(readCollapsed);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [navigating, setNavigating] = useState(false);
    const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 1599px)').matches);

    // A brand color saved on Branding & website applies without a full reload.
    const brandColor = props.shop?.color;
    useEffect(() => {
        if (brandColor) document.documentElement.style.setProperty('--brand', brandColor);
    }, [brandColor]);

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 1599px)');
        const on = () => setNarrow(mq.matches);
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, []);

    const [tablet, setTablet] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 1279px)').matches);
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 1279px)');
        const on = () => setTablet(mq.matches);
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, []);

    // Counter tablets need the room: fold the rail on every page below 1280px,
    // and on the POS and Orders hub up to 1600px.
    const railCollapsed = collapsed || tablet || (narrow && (route().current('pos.*') || route().current('orders.index')));

    useHotkey('mod+k', (e) => {
        e.preventDefault();
        setPaletteOpen((o) => !o);
    });
    useHotkey('f2', (e) => {
        if (props.auth?.pages.includes('pos')) {
            e.preventDefault();
            router.visit(route('pos.index'));
        }
    });

    // Skeletons (not spinners) while Inertia fetches a different page.
    useEffect(() => {
        let timer: number | undefined;
        const offStart = router.on('start', (e) => {
            const visit = e.detail.visit;
            if (visit.method !== 'get' || visit.only.length > 0) return;
            if (visit.url.pathname === window.location.pathname) return;
            timer = window.setTimeout(() => setNavigating(true), 140);
        });
        const offFinish = router.on('finish', () => {
            window.clearTimeout(timer);
            setNavigating(false);
            setMobileOpen(false);
        });
        return () => {
            offStart();
            offFinish();
        };
    }, []);

    const toggleRail = () => {
        setCollapsed((c) => {
            try {
                localStorage.setItem('pr-rail', c ? '0' : '1');
            } catch {
                /* private mode */
            }
            return !c;
        });
    };

    return (
        <div className="flex min-h-dvh bg-bg">
            <a href="#main" className="sr-only z-[70] bg-accent px-3 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
                Skip to content
            </a>

            {/* Desktop rail */}
            <aside
                className={cn(
                    'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-bg transition-[width] duration-200 lg:flex',
                    railCollapsed ? 'w-[64px]' : 'w-[232px]',
                )}
            >
                <SidebarContent collapsed={railCollapsed} onToggle={toggleRail} />
            </aside>

            {/* Tablet / phone sheet */}
            <AnimatePresence>
                {mobileOpen && (
                    <>
                        <motion.div className="fixed inset-0 z-40 bg-black/60 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
                        <motion.aside
                            className="fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-line bg-bg lg:hidden"
                            initial={{ x: -270 }}
                            animate={{ x: 0 }}
                            exit={{ x: -270 }}
                            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
                        >
                            <button className="absolute top-3 right-3 grid size-8 place-items-center text-muted" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                                <X className="size-4" />
                            </button>
                            <SidebarContent collapsed={false} />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            <div className="flex min-w-0 flex-1 flex-col">
                <TopBar onMenu={() => setMobileOpen(true)} onSearch={() => setPaletteOpen(true)} />
                <BillingNotice />
                <main id="main" className="relative min-w-0 flex-1">
                    {navigating ? <PageSkeleton /> : children}
                </main>
            </div>

            <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        </div>
    );
}

function SidebarContent({ collapsed, onToggle }: { collapsed: boolean; onToggle?: () => void }) {
    const { props } = useAppPage();
    const pages = new Set(props.auth?.pages ?? []);
    const badges = props.badges;
    const branchName = props.branch?.current?.name ?? (props.branch?.can_switch ? 'All branches' : '');
    const sections = [
        ...(props.auth?.user.is_superadmin ? [{ group: 'Platform', items: PLATFORM_NAV }] : []),
        ...NAV,
    ];

    return (
        <>
            <div className={cn('flex h-14 items-center gap-2.5 border-b border-line', collapsed ? 'justify-center px-0' : 'px-4')}>
                <Link href={route('dashboard')} className="flex min-w-0 items-center gap-2.5" aria-label={`${props.shop?.name ?? 'EAJ Custom Print'} home`}>
                    <img src={props.shop?.logo ?? '/eajlogo.svg'} alt="" className={cn('shrink-0 object-contain', collapsed ? 'h-7 w-11' : 'h-9 w-[4.5rem]')} width={72} height={36} />
                    {!collapsed && (
                        <span className="min-w-0 leading-tight">
                            <span className="block truncate font-display text-sm font-semibold tracking-tight">{props.shop?.name ?? 'EAJ Custom Print'}</span>
                            <span className="block truncate text-2xs text-faint">{branchName || 'Custom printing'}</span>
                        </span>
                    )}
                </Link>
            </div>

            <nav className="flex-1 overflow-y-auto py-3" aria-label="Main">
                {sections.map((section) => {
                    const items = (section.items as NavItem[]).filter((i) => i.page === 'platform' || pages.has(i.page));
                    if (!items.length) return null;
                    return (
                        <div key={section.group} className="mb-3">
                            {collapsed ? (
                                <div className="mx-4 mb-2 h-px bg-line first:hidden" />
                            ) : (
                                <p className="px-5 pb-1 text-2xs text-faint">{section.group}</p>
                            )}
                            <ul>
                                {items.map((item) => {
                                    const active = route().current(item.match);
                                    const count = item.badge && badges ? badges[item.badge] : 0;
                                    const Icon = item.icon;
                                    return (
                                        <li key={item.route}>
                                            <Link
                                                href={route(item.route)}
                                                title={collapsed ? item.label : undefined}
                                                aria-current={active ? 'page' : undefined}
                                                className={cn(
                                                    'group relative flex h-9 items-center gap-3 text-base transition-colors',
                                                    collapsed ? 'mx-2 justify-center rounded-xs' : 'mx-2 rounded-xs px-3',
                                                    active ? 'bg-surface text-fg' : 'text-muted hover:bg-surface hover:text-fg',
                                                )}
                                            >
                                                {active && <motion.span layoutId="nav-active" className="absolute top-1.5 bottom-1.5 -left-2 w-[2px] bg-accent" transition={{ type: 'spring', stiffness: 600, damping: 45 }} />}
                                                <Icon className={cn('size-[18px] shrink-0', active ? 'text-fg' : 'text-faint group-hover:text-muted')} strokeWidth={1.75} />
                                                {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                                                {count > 0 &&
                                                    (collapsed ? (
                                                        <span className="absolute top-1.5 right-2 size-1.5 rounded-full bg-accent" aria-label={`${count} need attention`} />
                                                    ) : (
                                                        <span className={cn('num rounded-xs px-1.5 text-2xs leading-4', item.badge === 'low_stock' ? 'bg-[color-mix(in_srgb,var(--warn)_16%,transparent)] text-warn-text' : 'bg-selected text-accent-text')}>
                                                            {count}
                                                        </span>
                                                    ))}
                                                {!collapsed && item.shortcut && !count && <Kbd className="opacity-0 group-hover:opacity-100">{item.shortcut}</Kbd>}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    );
                })}
            </nav>

            {onToggle && (
                <div className={cn('border-t border-line p-2', collapsed && 'flex justify-center')}>
                    <button
                        type="button"
                        onClick={onToggle}
                        className={cn('flex h-8 items-center gap-2 rounded-xs text-sm text-faint hover:bg-surface hover:text-fg', collapsed ? 'w-10 justify-center' : 'w-full px-3')}
                        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
                        {!collapsed && 'Collapse'}
                    </button>
                </div>
            )}
        </>
    );
}

function TopBar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
    const { props } = useAppPage();
    const { theme, toggle } = useTheme();
    const user = props.auth?.user;

    return (
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-surface/85 lg:px-5">
            <IconButton label="Open menu" onClick={onMenu} className="lg:hidden">
                <MenuIcon />
            </IconButton>

            <button
                type="button"
                onClick={onSearch}
                aria-label="Find an order, customer or item"
                className="flex h-9 w-9 min-w-0 shrink items-center justify-center gap-2 rounded-xs border border-line bg-sunken px-0 text-base text-faint transition-colors hover:border-line-strong sm:w-full sm:max-w-[380px] sm:justify-start sm:px-3"
            >
                <Search className="size-4 shrink-0" />
                <span className="hidden flex-1 truncate text-left sm:block">Find an order, customer or item</span>
                <Kbd className="hidden sm:inline-flex">Ctrl K</Kbd>
            </button>

            <BranchSwitcher />

            <div className="ml-auto flex items-center gap-1.5">
                {props.auth?.pages.includes('session') && props.drawer && <DrawerChip />}
                <IconButton label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggle}>
                    {theme === 'dark' ? <Sun /> : <Moon />}
                </IconButton>
                {user && (
                    <Menu
                        trigger={
                            <button type="button" className="flex h-9 items-center gap-2 rounded-xs pr-1 pl-1 hover:bg-raised" aria-label="Account menu">
                                <span className="grid size-7 place-items-center rounded-xs bg-ink-700 font-display text-xs font-semibold text-[#ECEEF2]">{initials(user.name)}</span>
                                <span className="hidden text-left leading-tight md:block">
                                    <span className="block text-sm text-fg">{user.name}</span>
                                    <span className="block text-2xs text-faint">{user.role}</span>
                                </span>
                            </button>
                        }
                    >
                        <MenuLabel>{user.email}</MenuLabel>
                        <MenuSeparator />
                        <MenuItem icon={theme === 'dark' ? <Sun /> : <Moon />} onSelect={toggle}>
                            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                        </MenuItem>
                        <MenuItem icon={<LogOut />} onSelect={() => router.post(route('logout'))}>
                            Sign out
                        </MenuItem>
                    </Menu>
                )}
            </div>
        </header>
    );
}

/** Persistent drawer status: open or closed, whose it is, and the cash that should be in it. */
function DrawerChip() {
    const { props } = useAppPage();
    const drawer = props.drawer;
    const open = !!drawer?.open;
    const stale = open && !!drawer?.stale;

    return (
        <Link
            href={route('session.index')}
            className={cn(
                'flex h-9 items-center overflow-hidden rounded-xs border text-sm transition-colors',
                stale ? 'border-[color-mix(in_srgb,var(--warn)_55%,transparent)] hover:bg-selected' : open ? 'border-line hover:border-line-strong' : 'border-[color-mix(in_srgb,var(--accent)_45%,transparent)] hover:bg-selected',
            )}
            title={stale ? "Opened on an earlier day. Count and close it, then open today's drawer." : open ? `Opened ${time(drawer?.opened_at)}` : 'Open your drawer to start selling'}
        >
            <motion.span layout className="flex h-full items-center gap-2 px-2.5">
                <motion.span
                    className="size-2 rounded-full"
                    animate={{ backgroundColor: stale ? 'var(--warn)' : open ? 'var(--ok)' : 'var(--accent)' }}
                    transition={{ duration: 0.3 }}
                />
                <span className={cn(stale ? 'text-warn-text' : open ? 'hidden text-fg sm:inline' : 'text-accent-text')}>{stale ? 'Close old drawer' : open ? 'Drawer open' : 'Drawer closed'}</span>
            </motion.span>
            {open && (
                <>
                    <span className="hidden h-full items-center border-l border-line px-2.5 text-muted xl:flex">{props.auth?.user.name.split(' ')[0]}</span>
                    <span className="num flex h-full items-center border-l border-line bg-raised px-2.5 text-fg">{peso(drawer?.expected_cash)}</span>
                </>
            )}
        </Link>
    );
}

function PageSkeleton() {
    return (
        <div aria-busy="true" aria-label="Loading page">
            <div className="border-b border-line px-6 pt-6 pb-4">
                <Skeleton className="h-7 w-56" />
                <Skeleton className="mt-2 h-4 w-80" />
            </div>
            <div className="border-b border-line bg-surface px-5 py-3">
                <Skeleton className="h-8 w-72" />
            </div>
            <div className="divide-y divide-line">
                {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-6 px-5 py-3">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 flex-1" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-16" />
                    </div>
                ))}
            </div>
        </div>
    );
}
