# Build Prompt — "Print Request" Printing Services POS

> Paste this whole file into a fresh Claude session pointed at an **empty project folder**. It is written as a build brief, not a checklist to skim — read it end to end before writing code.

---

## 0. Before you write a single line

Read `/mnt/skills/public/frontend-design/SKILL.md` first and treat it as binding. This project's whole point is that it must **not** look like a generated admin template. If any screen you build could be dropped into an unrelated SaaS app without anyone noticing, you've failed the brief. Work in the skill's two-pass way: write a short design plan (color/type/layout/principles tokens), critique it against the "generic tells" list, revise, *then* build.

Then do a quick web scan for how small Philippine print shops actually price and run jobs (per-sqft tarpaulin, per-piece stickers, lamination by size, rush fees, "layout/design" charge) so the domain model matches reality, not a generic retail POS.

---

## 1. What you're building

A **standalone, single-tenant Point-of-Sale and shop-management system** for **Print Request** — a printing-services business in Kabankalan City, Negros Occidental, Philippines. Tagline: *"Prints you can trust, quality you can see."*

This is not a grocery POS. A print shop takes **jobs**, not just instant sales: a customer orders 3 tarpaulins at 3×5 ft, the job goes into production, materials get consumed, it's picked up and paid later. The system has to handle both **instant counter sales** (photocopy, print-out, lamination) *and* **produced jobs with a queue** (tarpaulins, signage, invitations, bulk stickers).

Everything runs on one shop's data. No multi-branch, no franchise layer. Keep it focused and fast.

---

## 2. Tech stack (use exactly this)

- **Laravel 12** (PHP 8.3+) as the application backend.
- **Inertia.js v2 + React 19 + TypeScript** for the frontend. One Laravel app, SPA feel, no separate API auth to babysit. (Do **not** build a decoupled REST API + standalone React app — Inertia is the right tool for a single-shop POS.)
- **MySQL 8** as the database.
- **Tailwind CSS v4** + a **custom, brand-themed component layer**. You may use Radix primitives / shadcn as *unstyled* behavioral bases, but every component must be restyled to the brand — shipping default shadcn styling counts as a fail.
- **Vite** for bundling, **Framer Motion (`motion`)** for interaction motion, **Recharts** (or ECharts) for analytics.
- **Laravel Sanctum** session auth, **spatie/laravel-permission** for roles.
- Queue via database driver; **spatie/laravel-activitylog** for the audit trail; **barryvdh/laravel-dompdf** for receipts/quotations.

Set up a clean `composer create-project` + Inertia-React + TypeScript scaffold. Provide a working `.env.example`, migrations, seeders, and a `README.md` with exact setup commands. It must boot with `php artisan migrate --seed && npm run dev`.

---

## 3. Brand & color system (derived from the logo)

The logo is a red-black-white circular badge with a bold overlapping **FR** monogram (white F, red R) and a peeling-sticker corner. Build the entire palette from these three, dark-first.

**This is a dark-mode-primary interface.** Charcoal is the environment; red is a *precision signal color* for primary actions, live states, and alerts — never wallpaper. Ship a genuine light mode too (for bright counter lighting), but design the dark theme first and make it the signature.

Core tokens — define these as CSS variables, don't hardcode:

```
--red-500:   #E4141B   /* brand red — primary actions, active, danger-critical */
--red-600:   #C21016   /* pressed / deep */
--red-400:   #F5333A   /* hover glow, focus ring */
--red-tint:  rgba(228,20,27,0.12)  /* selected rows, subtle fills */

--ink-950:   #0C0E12   /* app background (near-black, faint cool cast like the logo circle) */
--ink-900:   #12151B   /* raised surface / cards */
--ink-800:   #1A1E27   /* elevated / modals, header */
--ink-700:   #262B36   /* borders, dividers */
--ink-600:   #3A4150   /* muted borders, disabled */

--paper:     #FFFFFF   /* the "printed" white — receipts, print previews, light-mode base */
--paper-2:   #F6F6F4   /* off-white surface in light mode */

--fg:        #ECEEF2   /* primary text on dark */
--fg-muted:  #9AA2B1   /* secondary text */
--fg-faint:  #5B6472   /* labels, timestamps */

--ok:   #22C079   --warn: #E8A73B   --info: #4A90D9
```

Don't invent a purple/teal accent, don't add gradient washes as decoration, and don't use a tinted-black (`#111`) where true charcoal belongs. Red + charcoal + white is the entire identity. One restrained red glow on a focused primary button is worth more than red everywhere.

---

## 4. Design direction — the anti-generic brief

Concept: **"a print-shop control room."** Think a professional press operator's console — dark, high-contrast, information-dense but calm, with the confidence of industrial equipment. The bold, sharp geometry of the logo's `R` (angular counter, hard diagonal) should echo in the UI: **low border-radius (2–4px, not pill-rounded everything)**, crisp 1px `--ink-700` borders doing structural work, generous but disciplined spacing.

Hard rules (violating these = redo the screen):

- **No SaaS-card kit.** Do not chop every screen into identical rounded cards with the same soft grey shadow. Use borders, background-tier shifts (`ink-900` vs `ink-800`), and real tables for dense data. Shadows only where something genuinely floats (menus, modals, toasts).
- **No tracked-out ALL-CAPS eyebrow labels** above every heading. No `WORD — fragment` em-dash labels. No `→` glued onto button text. No middle-dot meta strings (`A · B · C`).
- **No accenting one word of a headline** in red/italic. Headlines are just clear headlines.
- **No scattered fade-and-slide-up on every section.** Motion is reserved (see §7).
- Numbered `01 / 02 / 03` markers only where content is a real sequence (e.g. job-status pipeline), never as decoration.

Distinctive touches that fit *this* subject (use judgment, don't cram all in):
- The **peeling-sticker corner** from the logo can become a subtle, tasteful signature — e.g. a small folded-corner treatment on the receipt preview or the "released" job card. Use once, quietly.
- A thin **red "live" pulse** dot next to jobs currently in production.
- Receipt / quotation previews rendered as literal **white paper** floating on charcoal — the one place white dominates, reinforcing "quality you can see."
- Micro **halftone / registration-mark** motifs (a faint dotted texture, corner crop marks) as restrained background detail on empty states and the login screen only — printing vernacular, not stock decoration.

### Typography
Pick deliberately; do **not** default to Inter-for-everything. Suggested pairing (choose these or something equally intentional):
- **Display / headings & the numeric HUD:** a strong, slightly condensed grotesque with character — e.g. **Space Grotesk**, **Clash Display**, or **Archivo (Expanded/SemiCondensed weights)**. It should feel machined, matching the logo's boldness.
- **UI / body:** a clean, highly legible neutral — e.g. **Geist**, **IBM Plex Sans**, or **Söhne**-like. 
- **Tabular numerals everywhere numbers matter** (prices, stock, totals) — enable `font-variant-numeric: tabular-nums`. In a POS, numbers not aligning is amateur hour.
Set a real type scale (Elements of Typographic Style defaults), intentional weights, line length < 80ch for any prose.

Hit the quality floor without announcing it: responsive to a tablet at the counter, visible keyboard focus, `prefers-reduced-motion` respected, WCAG-AA contrast, working empty/error/loading states written in the interface's own voice.

---

## 5. Modules & features

Sidebar navigation (dark rail, red active indicator). Build all of these.

### 5.1 Cashier Session / Cash Drawer — sell nothing without it
The POS is **locked until the logged-in cashier opens a session.**
- **Open session**: cashier enters the **starting cash-drawer amount** (opening float / beginning balance). Record who opened it and the timestamp. Only one open session per cashier at a time.
- While open, the session tallies every **cash** movement live: cash sales in, cash refunds out, cash expenses out, petty-cash out, paid-outs/cash-drops.
- **Close session (X/Z read)**: cashier counts the physical drawer and enters the counted amount. System shows **expected cash** = opening float + cash sales − cash refunds − cash expenses − petty out ± cash adjustments, and computes **variance (over/short)** in red/green. Produce a printable session summary (sales by payment method, order count, discounts, expected vs counted).
- A persistent **session status chip** in the top bar shows open/closed, cashier name, and current expected drawer total. Attempting to sell with no open session prompts "Open your drawer to start selling."

### 5.2 POS / New Sale — the heart of the app
The screen a cashier lives in. Fast, keyboard-first, requires an open session (§5.1).
- **Mixed cart — products AND services together.** A single sale can hold retail **products** (finished goods with stock) and **services** (produced/priced print jobs) at the same time, each line behaving correctly: a product just decrements its own stock; a service runs its pricing model and (if it has a recipe) deducts raw materials. One search box, one tabbed picker (**Products | Services**), one cart.
- **Service spec panel**: size WxH + unit (ft/in/cm) → auto sqft, quantity, material choice, finishing add-ons (eyelets/lamination/rush) that **live-calculate price** (per-sqft, per-piece, tiered, or fixed) as you type.
- **Cart** with per-line qty/discount, line notes, running subtotal/discount/total in tabular numerals.
- **Customer attach** (walk-in default, or search existing / quick-create).
- **Sale type toggle**: *Instant sale* (paid & done now) vs *Job order* (enters the production queue; can be partial/downpayment or on account).
- **Payments — four methods, Cash pre-selected by default:**
  - **Cash** (default; change calculator; feeds the open drawer session).
  - **GCash** (reference no. field).
  - **Bank** (bank/transfer reference field).
  - **Credit** — pay on account / *utang*: no money collected now, the full amount becomes a customer **receivable** (requires an attached customer, not walk-in).
  - Support **split payment** across methods and **partial / downpayment** with the remaining **balance** tracked on the order and the customer's account.
- **Discounts**: line + whole-order, percent or amount, plus a **PWD/Senior** toggle where relevant.
- On confirm: generate an **order number**, deduct product stock and any service materials (see BOM in Services, §5.4), post cash to the session, record the receivable if Credit/partial, print/preview **receipt**, and — for job orders — push a card onto the production board.
- **Command palette (Ctrl/Cmd-K)** for jump-to-anything; **barcode/SKU scan** to add products; **held/parked orders** so a cashier can pause one sale and start another.

### 5.3 Products (finished goods for direct sale)
- CRUD for sellable goods the shop stocks and sells as-is (e.g. photo paper packs, ID holders, pens, notebooks, USBs, frames): name, **SKU/barcode**, category, selling price, cost, **stock on hand**, reorder level, supplier.
- Own stock ledger; low-stock alerts; sold directly in POS. Kept distinct from raw-material **Inventory** (§5.5) — products are sold whole; inventory items are consumed by services. (An item may be flagged as both if the shop resells a raw material over the counter.)

### 5.4 Services (print-services catalog)
- CRUD for services: name, category (Tarpaulin, Signage, Stickers, Business Cards, Invitations, Photocopy, Print-out, Lamination, ID/Photo, Mug/Sublimation, Layout/Design, Other), and **pricing model**: *per sqft*, *per piece*, *tiered by quantity*, or *fixed*.
- Optional **material recipe (BOM)**: which inventory items a service consumes and how much per unit (e.g. tarpaulin service consumes X sqft of tarpaulin roll + Y ml ink) — this is what makes inventory auto-deduct on sale.
- Finishing/add-on options with their own prices. Active/inactive toggle. Cost vs price so margin is known.

### 5.5 Inventory (raw materials & consumables)
- Items: rolls (tarpaulin, vinyl, sticker paper), sheets (photo paper, sintra, PVC), ink/toner, lamination film, eyelets, tape — each with **unit** (sqft, sheet, ml, pc, roll), current stock, cost, reorder level, supplier link.
- **Stock movements** ledger (in/out/adjustment) with reason and who did it — every change traceable.
- **Low-stock alerts** on the dashboard and as a nav badge.
- Stock adjustment screen with reason codes; optional stock-count / reconciliation mode.

### 5.6 Purchases (restocking)
- **Purchase Orders** to suppliers: draft → ordered → received (partial receive supported). Receiving increments inventory/product stock and records unit cost (moving-average cost update).
- Supplier CRUD (name, contact, terms). Purchase history, cost trends, outstanding POs.

### 5.7 Orders / Production Board — premium feature
- A **kanban board** for job orders: columns *Pending → In Production → Ready for Pickup → Released*. **Drag-and-drop** to advance status (Framer Motion drag, spring physics, optimistic update + server persist).
- Each card: order #, customer, summary, due date (overdue in red), assigned staff, payment-status chip (Paid / Partial / Credit / Balance ₱x), a **live red pulse** while In Production.
- Board **and** a filterable list view of the same data. Click a card → full order detail (line items, payments, balance, activity timeline, print job ticket / claim stub). Collect a balance/settle a credit right from the order.
- Due-date + rush handling; SMS/notification hook stub for "ready for pickup" (service interface only, no hardwired paid gateway).

### 5.8 Customers
- CRUD, contact info, **order history**, **outstanding receivables / credit balance** with a settle-payment action, lifetime value. Quick-create from POS. A statement view of what each account owes.

### 5.9 Quotations
- Build a quote like an order (no stock impact), export a branded **PDF quotation**, and **convert quote → order** in one click.

### 5.10 Expenses
- Record business expenses: date, **category** (Rent, Utilities, Salaries/Wages, Supplies, Repairs, Transport, Marketing, Misc), amount, payee, notes, optional **receipt attachment**, and **funding source** — *Cash drawer* (posts against the open session), *Petty cash* (posts against the petty-cash fund, §5.11), or *Bank*.
- Filter by date/category/source; totals per period; feeds the reports and the drawer/petty reconciliations. Every entry stamped with who recorded it.

### 5.11 Petty Cash
- A dedicated **petty-cash fund** separate from the sales drawer: set/top-up the fund (replenishment), record **disbursements** (small cash-outs, optionally linked to an Expense), and show a **running balance** at all times.
- Ledger of every in/out with reason, ref, and user. Simple reconcile screen (expected vs counted). Low-fund warning.

### 5.12 Reports & Analytics
- Dashboard home: animated **counter** stat tiles (today's sales, orders in production, low-stock count, **receivables outstanding**, cash on hand) — count-up runs once on load.
- Charts: sales over time, **sales by payment method** (Cash/GCash/Bank/Credit), sales by category, top services & products, material usage, expenses vs sales, profit margin. Recharts themed to the palette.
- Date-range filter, export CSV/PDF, cashier-session (X/Z read) daily summary, receivables aging.

### 5.13 Settings
- Business profile (name, address, logo, TIN, tagline) used on receipts/quotes; receipt & quotation template config.
- Tax config, rush-fee rules, order-number format, petty-cash defaults, GCash/bank account details shown on receipts.
- **Users & access control** — this is explicit and checkbox-driven:
  - Create/edit staff (Admin, Manager, Cashier, Production, or custom).
  - On the user form, a **checklist of every page/module** in the app (POS, Cashier Session, Products, Services, Inventory, Purchases, Orders, Customers, Quotations, Expenses, Petty Cash, Reports, Settings, Users…). Ticking a box grants that page; unticked pages are hidden from that user's **sidebar** and blocked at the **route/middleware** level (not just visually). Optionally a second column of action checkboxes (view / create / edit / delete / void / discount) for finer control.
  - Back it with spatie/permission under the hood, but the owner manages it purely through these checkboxes.
  - Activity-log viewer (spatie/activitylog) so the owner sees who did what.
- Theme toggle (dark default / light), and a data backup/export button.

---

## 6. Data model (MySQL) — build sensible migrations for at least

`users`, `roles`, `permissions` + `page_access` (spatie, exposed as the §5.13 checkboxes) · `settings` · `customers` (with `credit_balance`) · `suppliers` · `service_categories` · `services` (pricing_model enum, base_price, cost) · `service_options` · `service_materials` (BOM: service_id, inventory_item_id, qty_per_unit) · `products` (sku/barcode, price, cost, stock, reorder_level, supplier_id) · `inventory_items` (unit, stock, cost, reorder_level, supplier_id) · `stock_movements` (item_type[product|inventory], type, qty, reason, ref, user_id) · `purchases` + `purchase_items` · `cashier_sessions` (user_id, opening_float, closing_counted, expected_cash, variance, opened_at, closed_at, status) · `orders` (order_no, customer_id, type[instant|job], status, subtotal, discount, total, paid, balance, due_date, assigned_to, session_id) · `order_items` (item_type[product|service], spec JSON: width/height/unit/sqft/qty, computed price) · `payments` (method[cash|gcash|bank|credit], amount, ref, session_id) · `receivables`/account ledger (customer_id, order_id, amount, settled) · `expenses` (category, amount, payee, source[drawer|petty|bank], receipt_path, user_id, session_id) · `petty_cash_fund` + `petty_cash_transactions` (type[in|out], amount, reason, ref, user_id) · `quotations` + `quotation_items` · `activity_log`.

Use decimals for money (never floats), foreign keys with sensible cascade rules. **Cash-affecting writes (sales, refunds, cash expenses, petty out) must post against the open `cashier_session` in a DB transaction** so the drawer math is always reconcilable. Seeders create: an admin user with all pages ticked plus a limited cashier, realistic PH-priced services and products, sample inventory, an open demo session with an opening float, a petty-cash fund, sample expenses, and demo orders across all four board columns (including one on Credit with a balance) so nothing is empty on first boot.

---

## 7. Motion & interaction spec (restrained on purpose)

Motion answers actions; it does not decorate. Follow the frontend-design rule — one orchestrated moment beats scattered effects.

- **One** page-load orchestration on the dashboard: stat counters count up + charts draw in, once. Everywhere else, no auto entrance animations.
- **Action motion (the good kind):** cart line add/remove (layout animation), drag-and-drop on the production board (spring), modal/drawer open, toast in/out, command-palette spring, number transitions when a total updates, status-chip color morph. These show *what changed* — keep them.
- **Skeleton loaders** for data, not spinners, on Inertia navigations.
- Hover: subtle — a border brighten or a 1px lift, not a scale-bounce on every card.
- Respect `prefers-reduced-motion`: disable non-essential motion, keep instant state changes.
- The red focus ring (`--red-400`) is the consistent "you are here" across keyboard nav.

---

## 8. Quality bar — definition of done

- Boots clean from the README commands; `migrate --seed` gives a usable, populated app.
- A cashier must **open a session with a starting drawer amount** before the POS unlocks; closing it computes expected vs counted cash and shows the over/short variance.
- POS completes a **mixed sale (products + services in one cart)** and a partially-paid job order end to end, with product stock and service materials both deducting correctly and the job appearing on the board.
- All four payment methods work with **Cash pre-selected by default**; **Credit** and partial payments create a tracked receivable on the customer that can later be settled.
- Cash sales, cash expenses, and petty-cash-outs all post against the open session and reconcile.
- Expenses and Petty Cash record, show running balances, and flow into reports.
- Production board drag-to-advance persists and survives refresh.
- Receipt and quotation PDFs render branded and correct.
- **Page access is checkbox-driven and truly enforced:** unticking a page hides it from the sidebar *and* blocks the route (a Cashier with Settings unticked gets 403, not just a hidden link).
- TypeScript throughout the frontend, no `any` littering; Laravel form-request validation on every write.
- Responsive to counter tablet; keyboard-operable POS; AA contrast; reduced-motion honored.
- **The look test:** put any screen next to a stock admin template. If they're mistakable, keep going. It should read unmistakably as *Print Request* — charcoal control room, red signal, printed-white receipts.

Build it module by module, keep components genuinely reusable, and write copy in plain, active, print-shop voice (empty states invite action; errors say what happened and how to fix it). Ship something the owner would be proud to run the counter on.
