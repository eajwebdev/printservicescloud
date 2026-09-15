import { Boxes, Building2, Coins, History, Package, Printer, Receipt, ShieldCheck, Truck } from 'lucide-react';
import type { ModuleTab } from './list-page';

/** Related pages share a tab row so staff can hop between them without the sidebar. */
export function catalogTabs(active: 'services' | 'products' | 'inventory'): ModuleTab[] {
    return [
        { label: 'Services', href: route('services.index'), active: active === 'services', page: 'services', icon: Printer },
        { label: 'Products', href: route('products.index'), active: active === 'products', page: 'products', icon: Package },
        { label: 'Inventory', href: route('inventory.index'), active: active === 'inventory', page: 'inventory', icon: Boxes },
    ];
}

export function purchaseTabs(active: 'purchases' | 'suppliers'): ModuleTab[] {
    return [
        { label: 'Purchase orders', href: route('purchases.index'), active: active === 'purchases', page: 'purchases', icon: Truck },
        { label: 'Suppliers', href: route('suppliers.index'), active: active === 'suppliers', page: 'purchases', icon: Building2 },
    ];
}

export function moneyTabs(active: 'expenses' | 'petty'): ModuleTab[] {
    return [
        { label: 'Expenses', href: route('expenses.index'), active: active === 'expenses', page: 'expenses', icon: Receipt },
        { label: 'Petty cash', href: route('petty.index'), active: active === 'petty', page: 'petty_cash', icon: Coins },
    ];
}

export function adminTabs(active: 'users' | 'activity'): ModuleTab[] {
    return [
        { label: 'Users and access', href: route('users.index'), active: active === 'users', page: 'users', icon: ShieldCheck },
        { label: 'Activity log', href: route('activity.index'), active: active === 'activity', page: 'activity', icon: History },
    ];
}
