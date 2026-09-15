<?php

namespace App\Support;

/**
 * The single source of truth for page access. Each page becomes a row of
 * checkboxes on the user form; each ticked box is a spatie permission named
 * "{page}.{action}". Route middleware and the sidebar both read from here.
 */
class Access
{
    public const ACTION_LABELS = [
        'view' => 'Open page',
        'create' => 'Create',
        'edit' => 'Edit',
        'delete' => 'Delete',
        'discount' => 'Give discounts',
        'void' => 'Void orders',
        'refund' => 'Return items / refund',
        'settle' => 'Collect balances',
        'adjust' => 'Adjust stock',
        'export' => 'Export',
        'pay' => 'Pay bills',
    ];

    public static function pages(): array
    {
        return [
            'dashboard' => ['label' => 'Dashboard', 'group' => 'Counter', 'actions' => ['view']],
            'pos' => ['label' => 'POS / New sale', 'group' => 'Counter', 'actions' => ['view', 'discount']],
            'session' => ['label' => 'Cashier session', 'group' => 'Counter', 'actions' => ['view', 'edit']],
            'orders' => ['label' => 'Orders & production', 'group' => 'Counter', 'actions' => ['view', 'edit', 'void', 'refund']],
            'customers' => ['label' => 'Customers', 'group' => 'Counter', 'actions' => ['view', 'create', 'edit', 'delete', 'settle']],
            'quotations' => ['label' => 'Quotations', 'group' => 'Counter', 'actions' => ['view', 'create', 'edit', 'delete']],
            'products' => ['label' => 'Products', 'group' => 'Catalog & stock', 'actions' => ['view', 'create', 'edit', 'delete']],
            'services' => ['label' => 'Services', 'group' => 'Catalog & stock', 'actions' => ['view', 'create', 'edit', 'delete']],
            'inventory' => ['label' => 'Inventory', 'group' => 'Catalog & stock', 'actions' => ['view', 'create', 'edit', 'delete', 'adjust']],
            'purchases' => ['label' => 'Purchases & suppliers', 'group' => 'Catalog & stock', 'actions' => ['view', 'create', 'edit', 'delete']],
            'expenses' => ['label' => 'Expenses', 'group' => 'Money', 'actions' => ['view', 'create', 'edit', 'delete']],
            'petty_cash' => ['label' => 'Petty cash', 'group' => 'Money', 'actions' => ['view', 'create', 'edit']],
            'reports' => ['label' => 'Reports', 'group' => 'Money', 'actions' => ['view', 'export']],
            'settings' => ['label' => 'Settings', 'group' => 'Admin', 'actions' => ['view', 'edit']],
            'users' => ['label' => 'Users & access', 'group' => 'Admin', 'actions' => ['view', 'create', 'edit', 'delete']],
            'billing' => ['label' => 'Billing & subscription', 'group' => 'Admin', 'actions' => ['view', 'pay']],
            'activity' => ['label' => 'Activity log', 'group' => 'Admin', 'actions' => ['view']],
        ];
    }

    public static function allPermissionNames(): array
    {
        $names = [];
        foreach (static::pages() as $page => $meta) {
            foreach ($meta['actions'] as $action) {
                $names[] = "{$page}.{$action}";
            }
        }

        return $names;
    }

    /** Role templates the owner can start from; ticking boxes afterwards overrides them. */
    public static function roleTemplates(): array
    {
        $all = static::allPermissionNames();

        return [
            'Admin' => $all,
            'Manager' => array_values(array_filter($all, fn ($p) => ! str_starts_with($p, 'users.') && $p !== 'settings.edit')),
            'Cashier' => [
                'dashboard.view', 'pos.view', 'pos.discount', 'session.view', 'orders.view', 'orders.edit',
                'customers.view', 'customers.create', 'customers.settle', 'quotations.view', 'quotations.create',
                'products.view', 'services.view', 'expenses.view', 'expenses.create', 'petty_cash.view',
            ],
            'Production' => ['dashboard.view', 'orders.view', 'orders.edit', 'inventory.view', 'services.view'],
        ];
    }
}
