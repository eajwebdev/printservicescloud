import { router } from '@inertiajs/react';
import { Check, ChevronDown, Layers, MapPin } from 'lucide-react';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/menu';
import { cn, useAppPage } from '@/lib/utils';

/** Where to land after switching: the same list page, or the dashboard when on a single record (it belongs to one branch). */
function landingUrl(): string {
    const path = window.location.pathname;
    return /\/\d+(\/|$)/.test(path) || path.startsWith('/branches') || path.startsWith('/billing/payments') ? route('dashboard') : path;
}

export function switchBranch(branchId: number | null, redirect?: string) {
    router.post(route('branches.switch'), { branch_id: branchId, redirect: redirect ?? landingUrl() }, { preserveScroll: false });
}

/**
 * Top-bar branch indicator. Admins and the superadmin get a menu to move between branches
 * or view all of them; branch staff just see which branch they are signed in to.
 */
export function BranchSwitcher() {
    const { props } = useAppPage();
    const branch = props.branch;
    if (!branch) return null;

    const current = branch.current;
    const label = current ? current.name : 'All branches';

    if (!branch.can_switch) {
        return current ? (
            <span className="hidden h-9 items-center gap-2 rounded-xs border border-line px-2.5 text-sm text-muted sm:flex" title={`You are signed in to ${current.name}`}>
                <MapPin className="size-3.5 text-faint" />
                <span className="max-w-32 truncate text-fg">{current.name}</span>
                <span className="font-mono text-2xs text-faint">{current.code}</span>
            </span>
        ) : null;
    }

    return (
        <Menu
            align="start"
            trigger={
                <button
                    type="button"
                    className={cn(
                        'flex h-9 min-w-0 items-center gap-2 rounded-xs border px-2.5 text-sm transition-colors hover:border-line-strong',
                        current ? 'border-line text-fg' : 'border-[color-mix(in_srgb,var(--info)_45%,transparent)] text-fg',
                    )}
                    aria-label={`Branch: ${label}. Change branch`}
                >
                    {current ? <MapPin className="size-3.5 shrink-0 text-faint" /> : <Layers className="size-3.5 shrink-0 text-info-text" />}
                    <span className="max-w-28 truncate sm:max-w-40">{label}</span>
                    {current && <span className="hidden font-mono text-2xs text-faint sm:inline">{current.code}</span>}
                    <ChevronDown className="size-3.5 shrink-0 text-faint" />
                </button>
            }
        >
            <MenuLabel>Work in</MenuLabel>
            <MenuItem icon={<Layers />} onSelect={() => switchBranch(null)} className="pr-3">
                <span className="flex-1">All branches</span>
                {!current && <Check className="size-4 text-fg" />}
            </MenuItem>
            <MenuSeparator />
            {branch.list.map((b) => (
                <MenuItem key={b.id} icon={<MapPin />} onSelect={() => switchBranch(b.id)} className="pr-3">
                    <span className="flex-1 truncate">{b.name}</span>
                    <span className="font-mono text-2xs text-faint">{b.code}</span>
                    {current?.id === b.id && <Check className="size-4 text-fg" />}
                </MenuItem>
            ))}
        </Menu>
    );
}
