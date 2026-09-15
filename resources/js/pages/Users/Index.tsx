import { Head, Link, router } from '@inertiajs/react';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { ListPage, ToolbarSearch } from '@/components/list-page';
import { adminTabs } from '@/components/module-tabs';
import { ButtonLink, Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { dateTime } from '@/lib/format';
import { Select } from '@/components/ui/field';
import { initials, useAppPage, useCan } from '@/lib/utils';
import type { BranchLite } from '@/types';

interface Row {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    role: string;
    is_owner: boolean;
    is_superadmin: boolean;
    branch: string;
    branch_id: number | null;
    active: boolean;
    last_login_at: string | null;
    pages: string[];
}

export default function UsersIndex({ users, pageLabels, branches, filters }: { users: Row[]; pageLabels: Record<string, string>; branches: BranchLite[]; filters: { branch?: string } }) {
    const can = useCan();
    const { props } = useAppPage();
    const [removing, setRemoving] = useState<Row | null>(null);
    const total = Object.keys(pageLabels).length;
    const [q, setQ] = useState('');
    const needle = q.trim().toLowerCase();
    const shown = needle ? users.filter((u) => [u.name, u.email, u.role, u.branch].some((v) => v.toLowerCase().includes(needle))) : users;
    const locked = (u: Row) => u.is_superadmin || (u.is_owner && !props.auth?.user.all_branches);

    return (
        <>
            <Head title="Users & access" />
            <ListPage
                title="Staff and access"
                description="Each person sees only the pages ticked on their profile. Click someone to change what they can open."
                tabs={adminTabs('users')}
                toolbar={
                    <>
                        <ToolbarSearch autoFocus value={q} onChange={setQ} placeholder="Name, email, role or branch" />
                        {branches.length > 1 && !props.branch?.current && (
                            <Select selectSize="sm" className="w-44" value={filters.branch ?? ''} onChange={(e) => router.get(route('users.index'), e.target.value ? { branch: e.target.value } : {}, { preserveState: true })} aria-label="Branch">
                                <option value="">All branches</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.name}
                                    </option>
                                ))}
                            </Select>
                        )}
                    </>
                }
                actions={
                    can('users.create') && (
                        <ButtonLink href={route('users.create')} variant="primary" icon={<UserPlus />}>
                            Add staff
                        </ButtonLink>
                    )
                }
            >
                <Table flush minWidth={880}>
                    <THead>
                        <tr>
                            <Th>Person</Th>
                            <Th>Role</Th>
                            <Th>Branch</Th>
                            <Th>Pages they can open</Th>
                            <Th>Last sign-in</Th>
                            <Th />
                        </tr>
                    </THead>
                    <tbody>
                        {shown.map((u) => (
                            <Tr
                                key={u.id}
                                className={u.active ? '' : 'opacity-55'}
                                interactive={can('users.edit') && !locked(u)}
                                onClick={() => can('users.edit') && !locked(u) && router.visit(route('users.edit', u.id))}
                            >
                                <Td>
                                    <div className="flex items-center gap-3">
                                        <span className="grid size-8 shrink-0 place-items-center rounded-xs bg-ink-700 font-display text-xs font-semibold text-[#ECEEF2]">
                                            {initials(u.name)}
                                        </span>
                                        <div>
                                            <p>
                                                {u.name} {u.id === props.auth?.user.id && <span className="text-sm text-faint">(you)</span>}
                                            </p>
                                            <p className="text-sm text-faint">{u.email}</p>
                                        </div>
                                    </div>
                                </Td>
                                <Td>
                                    <span className="flex gap-1.5">
                                        <Chip tone={u.is_superadmin || u.is_owner ? 'red' : 'outline'}>{u.role}</Chip>
                                        {!u.active && <Chip>Deactivated</Chip>}
                                    </span>
                                </Td>
                                <Td muted className="text-sm whitespace-nowrap">{u.branch}</Td>
                                <Td>
                                    {u.pages.length === total ? (
                                        <span className="text-sm text-muted">Everything</span>
                                    ) : (
                                        <span className="flex max-w-md flex-wrap gap-1">
                                            {u.pages.map((p) => (
                                                <span key={p} className="rounded-xs bg-raised px-1.5 text-xs leading-5 text-muted">
                                                    {pageLabels[p]}
                                                </span>
                                            ))}
                                            {!u.pages.length && <span className="text-sm text-accent-text">No pages ticked</span>}
                                        </span>
                                    )}
                                </Td>
                                <Td muted className="text-sm whitespace-nowrap">
                                    {u.last_login_at ? dateTime(u.last_login_at) : 'Never'}
                                </Td>
                                <Td align="right" onClick={(e) => e.stopPropagation()}>
                                    {!locked(u) && (
                                        <span className="flex justify-end gap-1">
                                            {can('users.edit') && (
                                                <Link href={route('users.edit', u.id)} className="px-2 text-sm text-muted hover:text-fg">
                                                    Edit access
                                                </Link>
                                            )}
                                            {can('users.delete') && u.id !== props.auth?.user.id && !u.is_superadmin && (
                                                <Button size="xs" variant="ghost" onClick={() => setRemoving(u)}>
                                                    Remove
                                                </Button>
                                            )}
                                        </span>
                                    )}
                                </Td>
                            </Tr>
                        ))}
                    </tbody>
                </Table>
                {!shown.length && <p className="px-5 py-8 text-center text-base text-muted">No one matches “{q}”.</p>}
            </ListPage>
            <ConfirmDialog
                open={!!removing}
                onOpenChange={(o) => !o && setRemoving(null)}
                title={`Remove ${removing?.name}?`}
                body="Staff with sales history are deactivated instead, so their receipts and drawer counts stay traceable."
                confirmLabel="Remove"
                onConfirm={() => removing && router.delete(route('users.destroy', removing.id), { preserveScroll: true, onFinish: () => setRemoving(null) })}
            />
        </>
    );
}
