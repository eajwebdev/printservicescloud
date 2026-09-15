export type PaymentMethod = 'cash' | 'gcash' | 'bank' | 'credit';
export type PricingModel = 'per_sqft' | 'per_piece' | 'tiered' | 'fixed';
export type OptionPriceType = 'per_piece' | 'per_sqft' | 'flat' | 'percent';
export type SizeUnit = 'ft' | 'in' | 'cm';
export type DiscountType = 'percent' | 'amount' | null;
export type OrderStatus = 'completed' | 'pending' | 'in_production' | 'ready' | 'released' | 'voided';
export type BoardStatus = 'pending' | 'in_production' | 'ready' | 'released';
export type PaymentStatus = 'paid' | 'partial' | 'credit' | 'unpaid';

export interface ShopProps {
    name: string;
    tagline: string;
    logo: string;
    rush_fee_percent: number;
    senior_pwd_percent: number;
    tax_rate: number;
    tax_mode: 'none' | 'inclusive' | 'exclusive';
    auto_print: boolean;
    receipt_paper: number;
}

export interface AuthUser {
    id: number;
    name: string;
    email: string;
    role: string;
    is_owner: boolean;
    is_superadmin: boolean;
    /** Admins and the superadmin work across every branch. */
    all_branches: boolean;
}

export interface BranchLite {
    id: number;
    name: string;
    code: string;
}

export interface BranchShared {
    current: BranchLite | null;
    can_switch: boolean;
    list: BranchLite[];
}

export type SubscriptionStatus = 'trial' | 'active' | 'suspended' | 'cancelled';
export type InvoiceStatus = 'unpaid' | 'overdue' | 'paid' | 'void';

export interface InvoiceRow {
    id: number;
    branch_id: number;
    branch: string | null;
    number: string;
    description: string | null;
    period: string;
    period_start: string;
    period_end: string;
    issued_on: string;
    due_on: string;
    amount: number;
    status: InvoiceStatus;
    days_overdue: number;
    paid_at: string | null;
    notes: string | null;
}

export interface BillingState {
    status: SubscriptionStatus;
    status_label: string;
    locked: boolean;
    lock_reason: 'overdue' | 'suspended' | 'cancelled' | null;
    warning: boolean;
    overdue_count: number;
    unpaid_count: number;
    due_total: number;
    overdue_total: number;
    lock_after: number;
    next_due_on: string | null;
    next_bill_on: string | null;
    trial_ends_on: string | null;
    trial_days_left: number | null;
    monthly_fee: number;
    grace_until: string | null;
    invoices: InvoiceRow[];
}

export type BillingShared =
    | ({ scope: 'branch'; branch: { id: number; name: string }; can_pay: boolean; can_view: boolean } & Pick<
          BillingState,
          'status' | 'status_label' | 'locked' | 'warning' | 'overdue_count' | 'unpaid_count' | 'due_total' | 'overdue_total' | 'lock_after' | 'next_due_on' | 'trial_days_left' | 'trial_ends_on' | 'invoices'
      >)
    | { scope: 'all'; branches: { id: number; name: string; locked: boolean; overdue_count: number; due_total: number }[]; can_pay: boolean; can_view: boolean };

export interface BranchFilterProps {
    selected: number[];
    locked: boolean;
    label: string;
    options: BranchLite[];
}

export interface DrawerState {
    open: boolean;
    id?: number;
    opened_at?: string;
    stale?: boolean;
    opening_float?: number;
    expected_cash?: number;
}

export interface ReceiptFlash {
    order_id: number;
    order_no: string;
    type: 'instant' | 'job';
    change: number;
}

export interface PageProps {
    [key: string]: unknown;
    shop: ShopProps;
    demo: boolean;
    auth: { user: AuthUser; pages: string[]; permissions: string[] } | null;
    branch: BranchShared | null;
    billing: BillingShared | null;
    drawer: DrawerState | null;
    badges: { low_stock: number; in_production: number; overdue: number } | null;
    flash: {
        success: string | null;
        error: string | null;
        receipt: ReceiptFlash | null;
        created_customer: CustomerLite | null;
    };
    errors: Record<string, string>;
}

export interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

export interface Paginated<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: PaginationLink[];
}

export interface Option {
    id: number;
    name: string;
}

export interface CustomerLite {
    id: number;
    name: string;
    phone: string | null;
    business_name: string | null;
    credit_balance: number;
    credit_limit: number | null;
    is_senior_pwd: boolean;
}

export interface CatalogProduct {
    id: number;
    name: string;
    sku: string;
    barcode: string | null;
    category: string | null;
    price: number;
    stock: number;
    reorder_level: number;
}

export interface CatalogServiceOption {
    id: number;
    name: string;
    price_type: OptionPriceType;
    price: number;
}

export interface Tier {
    min_qty: number;
    price: number;
}

export interface CatalogService {
    id: number;
    name: string;
    code: string | null;
    category_id: number;
    category: string | null;
    pricing_model: PricingModel;
    base_price: number;
    min_charge: number;
    tiers: Tier[];
    unit_label: string;
    is_job: boolean;
    lead_time_hours: number;
    options: CatalogServiceOption[];
}

export interface Catalog {
    products: CatalogProduct[];
    services: CatalogService[];
    categories: Option[];
}

export interface LineSpec {
    width?: number | null;
    height?: number | null;
    unit?: SizeUnit | null;
    option_ids?: number[];
    rush?: boolean;
    sqft?: number;
    options?: { id: number; name: string }[];
}

/** A cart line as edited in the POS or quotation builder. */
export interface CartLine {
    key: string;
    item_type: 'product' | 'service';
    item_id: number;
    qty: number;
    spec: LineSpec;
    discount_type: DiscountType;
    discount_value: number;
    note: string;
}

export interface OrderCard {
    id: number;
    order_no: string;
    type: 'instant' | 'job';
    status: OrderStatus;
    customer: string;
    summary: string | null;
    total: number;
    paid: number;
    balance: number;
    payment_status: PaymentStatus;
    due_at: string | null;
    rush: boolean;
    assignee: string | null;
    cashier: string | null;
    methods: string[];
    created_at: string;
    status_changed_at: string | null;
    released_at: string | null;
    proof_status: ProofStatus;
    files_count: number;
}

export type ProofStatus = 'none' | 'waiting' | 'approved';

export interface OrderFileRow {
    id: number;
    kind: 'design' | 'proof' | 'photo' | 'other';
    name: string;
    mime: string | null;
    size: number;
    is_image: boolean;
    note: string | null;
    user: string | null;
    at: string;
    url: string;
    preview_url: string;
}

export interface OrderRevisionRow {
    id: number;
    reason: string;
    old_total: number;
    new_total: number;
    collected: number;
    refunded: number;
    user: string | null;
    at: string;
    old_lines: { name: string; qty: number; line_total: number }[];
    new_lines: { name: string; qty: number; line_total: number }[];
}

export interface OrderDetail extends OrderCard {
    print_count: number;
    proof_approved_at: string | null;
    files: OrderFileRow[];
    revisions: OrderRevisionRow[];
    subtotal: number;
    discount_total: number;
    senior_pwd: boolean;
    senior_pwd_discount: number;
    tax_total: number;
    cost_total: number;
    notes: string | null;
    void_reason: string | null;
    assigned_to: number | null;
    customer_id: number | null;
    customer_phone: string | null;
    customer_balance: number;
    lines: { id: number; item_type: string; name: string; spec: LineSpec | null; qty: number; unit_price: number; gross: number; discount_amount: number; line_total: number; note: string | null }[];
    payments: { id: number; method: string; kind: string; amount: number; tendered: number | null; reference: string | null; user: string | null; at: string }[];
}

export interface OrderCounts {
    today: number;
    board: number;
    overdue: number;
    ready: number;
    due_today: number;
    rush: number;
    to_collect: number;
}

export interface StockMovementRow {
    id: number;
    item_type: 'product' | 'inventory';
    item_id: number;
    item: string | null;
    type: string;
    qty: number;
    balance_after: number;
    unit_cost: number | null;
    reason: string | null;
    ref: string | null;
    user: string | null;
    at: string;
}

export interface SessionRow {
    id: number;
    cashier: string | null;
    status: 'open' | 'closed';
    opened_at: string;
    closed_at: string | null;
    opening_float: number;
    expected_cash: number | null;
    closing_counted: number | null;
    variance: number | null;
}
