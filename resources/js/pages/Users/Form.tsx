import { Head, useForm } from '@inertiajs/react';
import { Fragment } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Panel } from '@/components/ui/misc';
import { Checkbox, Switch } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';
import type { BranchLite } from '@/types';

interface PageDef {
    key: string;
    label: string;
    group: string;
    actions: string[];
}

interface Props {
    user: { id: number; name: string; email: string; phone: string | null; active: boolean; is_owner: boolean; is_superadmin: boolean; branch_id: number | null; role: string; permissions: string[] } | null;
    pages: PageDef[];
    actionLabels: Record<string, string>;
    templates: Record<string, string[]>;
    branches: BranchLite[];
    canChooseBranch: boolean;
    defaultBranchId: number | null;
    actorBranch: string | null;
}

const COLUMNS = ['view', 'create', 'edit', 'delete'] as const;

export default function UserForm({ user, pages, actionLabels, templates, branches, canChooseBranch, defaultBranchId, actorBranch }: Props) {
    const form = useForm({
        name: user?.name ?? '',
        email: user?.email ?? '',
        phone: user?.phone ?? '',
        password: '',
        role: user?.role ?? 'Cashier',
        active: user?.active ?? true,
        permissions: user?.permissions ?? templates.Cashier ?? [],
        all_branches: user?.is_owner ?? false,
        branch_id: user ? (user.branch_id ? String(user.branch_id) : '') : defaultBranchId ? String(defaultBranchId) : '',
    });
    const allBranches = form.data.all_branches || !!user?.is_superadmin;
    const perms = new Set(form.data.permissions);
    const toggle = (name: string, on: boolean) => {
        const next = new Set(perms);
        if (on) next.add(name);
        else next.delete(name);
        // Without page access, nothing else on that page means anything.
        const [page, action] = name.split('.');
        if (action === 'view' && !on) [...next].filter((p) => p.startsWith(`${page}.`)).forEach((p) => next.delete(p));
        if (action !== 'view' && on) next.add(`${page}.view`);
        form.setData('permissions', [...next]);
    };
    const groups = [...new Set(pages.map((p) => p.group))];
    const allNames = pages.flatMap((p) => p.actions.map((a) => `${p.key}.${a}`));

    const submit = () => {
        if (user) form.put(route('users.update', user.id));
        else form.post(route('users.store'));
    };

    return (
        <>
            <Head title={user ? `Access for ${user.name}` : 'Add staff'} />
            <PageHeader
                back={{ href: route('users.index'), label: 'Users and access' }}
                title={user ? user.name : 'Add a staff account'}
                description="Tick the pages this person can open. Unticked pages disappear from their sidebar and return a 403 if they type the address."
                actions={
                    <Button variant="primary" onClick={submit} loading={form.processing}>
                        {user ? 'Save access' : 'Create account'}
                    </Button>
                }
            />
            <form
                className="grid gap-5 p-5 lg:p-6 xl:grid-cols-[340px_1fr]"
                onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                }}
            >
                <aside className="space-y-5">
                    <Panel title="Account" bodyClass="space-y-4 p-5">
                        <Field label="Full name" error={form.errors.name}>
                            {(id, d) => <Input id={id} aria-describedby={d} value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} autoFocus={!user} />}
                        </Field>
                        <Field label="Email (sign-in)" error={form.errors.email}>
                            {(id, d) => <Input id={id} aria-describedby={d} type="email" autoComplete="off" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} />}
                        </Field>
                        <Field label="Mobile" error={form.errors.phone}>
                            {(id, d) => <Input id={id} aria-describedby={d} value={form.data.phone} onChange={(e) => form.setData('phone', e.target.value)} />}
                        </Field>
                        <Field label={user ? 'New password' : 'Password'} hint={user ? 'Leave blank to keep' : 'At least 8 characters'} error={form.errors.password}>
                            {(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="new-password" value={form.data.password} onChange={(e) => form.setData('password', e.target.value)} />}
                        </Field>
                        <Switch checked={form.data.active} onChange={(v) => form.setData('active', v)} label="Can sign in" className="border border-line px-3 py-2.5" />
                    </Panel>
                    <Panel title="Branch" bodyClass="space-y-3 p-5">
                        {user?.is_superadmin ? (
                            <p className="text-sm text-muted">The system provider works across every branch.</p>
                        ) : canChooseBranch ? (
                            <>
                                <Switch
                                    checked={form.data.all_branches}
                                    onChange={(v) => form.setData('all_branches', v)}
                                    label="Admin: all branches"
                                    description="Sees and manages every branch, with full access."
                                    className="border border-line px-3 py-2.5"
                                />
                                {!form.data.all_branches && (
                                    <Field label="Works in" error={form.errors.branch_id}>
                                        {(id) => (
                                            <Select id={id} value={form.data.branch_id} onChange={(e) => form.setData('branch_id', e.target.value)}>
                                                <option value="">Pick a branch</option>
                                                {branches.map((b) => (
                                                    <option key={b.id} value={b.id}>
                                                        {b.name} ({b.code})
                                                    </option>
                                                ))}
                                            </Select>
                                        )}
                                    </Field>
                                )}
                                <p className="text-xs text-faint">Branch staff only ever see their own branch's sales, stock, customers and reports.</p>
                            </>
                        ) : (
                            <p className="text-sm text-muted">Works in {actorBranch}, the same branch as you.</p>
                        )}
                    </Panel>
                    {!allBranches && <Panel title="Role" bodyClass="space-y-3 p-5">
                        <Field label="Role label" error={form.errors.role}>
                            {(id) => (
                                <Select id={id} value={Object.keys(templates).includes(form.data.role) ? form.data.role : '__custom'} onChange={(e) => e.target.value !== '__custom' && form.setData('role', e.target.value)}>
                                    {Object.keys(templates).map((r) => (
                                        <option key={r}>{r}</option>
                                    ))}
                                    <option value="__custom">Custom</option>
                                </Select>
                            )}
                        </Field>
                        {!Object.keys(templates).includes(form.data.role) && (
                            <Field label="Custom role name">{(id) => <Input id={id} value={form.data.role} onChange={(e) => form.setData('role', e.target.value)} />}</Field>
                        )}
                        <div>
                            <p className="mb-1.5 text-sm text-muted">Start from a template</p>
                            <div className="flex flex-wrap gap-1.5">
                                {Object.entries(templates).map(([r, list]) => (
                                    <Button
                                        key={r}
                                        size="xs"
                                        variant="quiet"
                                        onClick={() => {
                                            form.setData((d) => ({ ...d, role: r, permissions: list }));
                                        }}
                                    >
                                        {r}
                                    </Button>
                                ))}
                            </div>
                            <p className="mt-2 text-xs text-faint">A template only ticks boxes. What you leave ticked is what they get.</p>
                        </div>
                    </Panel>}
                </aside>

                {allBranches ? (
                    <Panel title="Page access" className="min-w-0" bodyClass="p-5">
                        <p className="text-base text-muted">Admins can open every page in every branch, so there is nothing to tick.</p>
                    </Panel>
                ) : (
                <Panel
                    title={`Page access, ${pages.filter((p) => perms.has(`${p.key}.view`)).length} of ${pages.length} pages`}
                    className="min-w-0"
                    actions={
                        <>
                            <Button size="xs" variant="ghost" onClick={() => form.setData('permissions', allNames)}>
                                Tick everything
                            </Button>
                            <Button size="xs" variant="ghost" onClick={() => form.setData('permissions', [])}>
                                Clear
                            </Button>
                        </>
                    }
                >
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] border-collapse text-base">
                            <thead className="bg-surface">
                                <tr className="border-b border-line text-left text-sm text-faint">
                                    <th className="h-9 px-5 font-medium">Page</th>
                                    {COLUMNS.map((c) => (
                                        <th key={c} className="w-24 px-2 text-center font-medium">
                                            {actionLabels[c]}
                                        </th>
                                    ))}
                                    <th className="px-3 font-medium">Also allowed to</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groups.map((g) => (
                                    <Fragment key={g}>
                                        <tr className="bg-bg">
                                            <td colSpan={6} className="border-b border-line px-5 py-1.5 text-sm font-medium text-muted">
                                                {g}
                                            </td>
                                        </tr>
                                        {pages
                                            .filter((p) => p.group === g)
                                            .map((p) => {
                                                const on = perms.has(`${p.key}.view`);
                                                const extras = p.actions.filter((a) => !COLUMNS.includes(a as (typeof COLUMNS)[number]));
                                                return (
                                                    <tr key={p.key} className={cn('border-b border-line', !on && 'bg-bg')}>
                                                        <td className="px-5 py-2.5">
                                                            <span className={on ? 'text-fg' : 'text-muted'}>{p.label}</span>
                                                        </td>
                                                        {COLUMNS.map((c) => (
                                                            <td key={c} className="px-2 text-center">
                                                                {p.actions.includes(c) ? (
                                                                    <span className="inline-flex">
                                                                        <Checkbox checked={perms.has(`${p.key}.${c}`)} onChange={(v) => toggle(`${p.key}.${c}`, v)} ariaLabel={`${p.label}: ${actionLabels[c]}`} />
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-ghost" aria-hidden>
                                                                        ·
                                                                    </span>
                                                                )}
                                                            </td>
                                                        ))}
                                                        <td className="px-3 py-2">
                                                            <span className="flex flex-wrap gap-x-4 gap-y-1.5">
                                                                {extras.map((a) => (
                                                                    <Checkbox key={a} checked={perms.has(`${p.key}.${a}`)} onChange={(v) => toggle(`${p.key}.${a}`, v)} label={<span className="text-sm">{actionLabels[a]}</span>} />
                                                                ))}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Panel>
                )}
                <button type="submit" hidden />
            </form>
        </>
    );
}
