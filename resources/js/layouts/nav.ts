import {
    Boxes,
    Building2,
    ChartColumn,
    CreditCard,
    Coins,
    FileText,
    FileSpreadsheet,
    Gauge,
    History,
    KanbanSquare,
    Package,
    Printer,
    Receipt,
    ScanBarcode,
    Settings2,
    ShieldCheck,
    SlidersHorizontal,
    Truck,
    Users,
    Vault,
    type LucideIcon,
} from 'lucide-react';

export interface NavItem {
    page: string;
    label: string;
    route: string;
    match: string;
    icon: LucideIcon;
    badge?: 'low_stock' | 'in_production' | 'overdue';
    shortcut?: string;
}

export const NAV: { group: string; items: NavItem[] }[] = [
    {
        group: 'Counter',
        items: [
            { page: 'dashboard', label: 'Dashboard', route: 'dashboard', match: 'dashboard', icon: Gauge },
            { page: 'pos', label: 'New sale', route: 'pos.index', match: 'pos.*', icon: ScanBarcode, shortcut: 'F2' },
            { page: 'orders', label: 'Orders', route: 'orders.index', match: 'orders.*', icon: KanbanSquare, badge: 'overdue' },
            { page: 'session', label: 'Cash drawer', route: 'session.index', match: 'session.*', icon: Vault },
            { page: 'customers', label: 'Customers', route: 'customers.index', match: 'customers.*', icon: Users },
            { page: 'quotations', label: 'Quotations', route: 'quotations.index', match: 'quotations.*', icon: FileText },
        ],
    },
    {
        group: 'Catalog & stock',
        items: [
            { page: 'services', label: 'Services', route: 'services.index', match: 'services.*', icon: Printer },
            { page: 'products', label: 'Products', route: 'products.index', match: 'products.*', icon: Package },
            { page: 'inventory', label: 'Inventory', route: 'inventory.index', match: 'inventory.*', icon: Boxes, badge: 'low_stock' },
            { page: 'purchases', label: 'Purchases', route: 'purchases.index', match: 'purchases.*', icon: Truck },
        ],
    },
    {
        group: 'Money',
        items: [
            { page: 'expenses', label: 'Expenses', route: 'expenses.index', match: 'expenses.*', icon: Receipt },
            { page: 'petty_cash', label: 'Petty cash', route: 'petty.index', match: 'petty.*', icon: Coins },
            { page: 'reports', label: 'Reports', route: 'reports.index', match: 'reports.*', icon: ChartColumn },
        ],
    },
    {
        group: 'Admin',
        items: [
            { page: 'settings', label: 'Settings', route: 'settings.index', match: 'settings.*', icon: Settings2 },
            { page: 'users', label: 'Users & access', route: 'users.index', match: 'users.*', icon: ShieldCheck },
            { page: 'activity', label: 'Activity log', route: 'activity.index', match: 'activity.*', icon: History },
            { page: 'billing', label: 'Billing', route: 'billing.index', match: 'billing.*', icon: CreditCard },
        ],
    },
];

/** The system provider's pages. Shown only to the superadmin (the page key is not a checkbox). */
export const PLATFORM_NAV: NavItem[] = [
    { page: 'platform', label: 'Branches & plans', route: 'platform.branches.index', match: 'platform.branches.*', icon: Building2 },
    { page: 'platform', label: 'Branch bills', route: 'platform.invoices.index', match: 'platform.invoices.*', icon: FileSpreadsheet },
    { page: 'platform', label: 'Platform settings', route: 'platform.settings.index', match: 'platform.settings.*', icon: SlidersHorizontal },
];
