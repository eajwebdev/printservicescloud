# SKC Custom Print POS

A public website and multi-branch point-of-sale and shop-management system for **SKC Custom Print**: full sublimation, DTF, shirts, tarpaulin, signages, stickers, logo, decals, laser cutting and 3D/CAD/blueprint. Each branch handles counter sales and produced job orders, a production board, the cash drawer, inventory with material recipes, purchases, customers and credit, quotations, expenses, petty cash and reports. Admins see every branch together; branch staff see only their own. The system is sold as a subscription: each branch pays its own monthly bill (₱1,699 by default) online through PayMongo.

Built with Laravel 12, Inertia v2, React 19, TypeScript, Tailwind CSS v4 and MySQL.

## Requirements

- PHP 8.2 or newer (8.3 recommended) with `pdo_mysql`, `gd`, `mbstring`, `bcmath`, `fileinfo` and `zip`
- Composer 2
- Node.js 20 or newer
- MySQL 8, or MariaDB 10.4 or newer

## Setup

```bash
# 1. Install dependencies
composer install
npm install

# 2. Configure the environment
cp .env.example .env          # on Windows: copy .env.example .env
php artisan key:generate
# Edit DB_* in .env if your MySQL user or password differ.

# 3. Create the database (once)
mysql -u root -e "CREATE DATABASE skc_pos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 4. Link storage for logos and expense receipts, then migrate and seed demo data
php artisan storage:link
php artisan migrate --seed

# 5. Run it (in separate terminals)
php artisan serve             # http://127.0.0.1:8000 (public site; staff sign in at /login)
npm run dev                   # Vite dev server
php artisan queue:work        # optional: sends "ready for pickup" notifications
php artisan schedule:work     # issues monthly branch bills and runs nightly backups
```

Steps 2 to 4 are also available as a single command, `composer setup`. `composer dev` starts the web server, queue worker and Vite together.

For production, run `npm run build` instead of `npm run dev`, set `APP_ENV=production` and `APP_DEBUG=false`, and keep a queue worker running under a process manager.

To reset the demo data at any time, run `php artisan migrate:fresh --seed`.

### Upgrading an existing Print Request install

`php artisan migrate` moves all existing data into a first branch called **Main branch** (code `MAIN`) on a 30-day free trial. Existing owner accounts become all-branch admins; everyone else works in Main branch. Rename the branch and start its subscription from **Platform > Branches & plans**. Take a backup before migrating.

## Demo accounts

All demo accounts use the password `password`.

| Email | Role | Access |
|---|---|---|
| `superadmin@skc.test` | Superadmin (system provider) | Every branch, plus **Platform**: branches, subscriptions, free trials, bills, PayMongo keys |
| `admin@skc.test` | Admin | Every branch and every page. Starts on "All branches"; pick a branch in the top bar to sell or count stock |
| `manager@skc.test` | Manager, SKC Kabankalan | Everything in Kabankalan except users and editing settings |
| `cashier@skc.test` | Cashier, SKC Kabankalan | Counter pages only |
| `production@skc.test` | Production, SKC Kabankalan | Dashboard, production board, inventory and services (view only) |
| `bacolod.manager@skc.test`, `bacolod.cashier@skc.test` | SKC Bacolod staff | Bacolod only |
| `dumaguete.manager@skc.test`, `dumaguete.cashier@skc.test` | SKC Dumaguete staff | Dumaguete only. The branch is behind on its bill, so they sign in to the locked bill screen |

The demo has three branches:

- **SKC Kabankalan (KAB)**: two weeks of history, subscribed, older bills paid, the current bill open
- **SKC Dumaguete (DGT)**: about a week of history, on a ₱1,499 promo price, four bills overdue, so it is locked
- **SKC Bacolod (BCD)**: about a week of history, on a free trial

Branch names, addresses and phone numbers live in `database/seeders/BranchSeeder.php`. Edit them before seeding a real install, or change them later in **Platform > Branches & plans**.

The seeder plays out shop activity through the real services, so the drawers, stock ledger, receivables and reports all reconcile. Each branch gets SKC's price list: 27 services in nine categories (Full Sublimation, DTF Printing, Shirts & Apparel, Tarpaulin, Signages, Stickers & Decals, Logo & Layout, Laser Cutting, 3D / CAD / Blueprint) with material recipes, 11 ready-made products, 26 materials, 12 customers, drawer sessions, expenses, petty cash, purchase orders, quotations and job orders in every board column. The prices are starting points; adjust them in **Services** per branch.

## Public website

The home page (`/`) is the public site: services, how an order moves from quote to pickup, a map of Negros with every active branch, and contact buttons that call or email a branch. Branch details come from the database, so a new branch appears there once it is added, and cancelled or switched-off branches drop off. Staff sign in from the button in the top right (`/login`); the dashboard is at `/dashboard`. The page is built in `resources/js/pages/Landing.tsx` and respects the visitor's reduced-motion setting.

## Branches

- **Every record belongs to a branch.** Sales, customers, products, services, stock, drawers, expenses, petty cash, purchases, quotations and the activity log are scoped to the branch they were made in. A branch account can't open another branch's records, even by typing the address.
- **Numbers never collide.** Order, quotation and PO numbers carry the branch code (`KAB-2609-0001`) and count separately per branch. SKUs, barcodes and service codes only need to be unique within a branch.
- **Staff belong to one branch.** Set it on the user form. Tick **Admin: all branches** for someone who manages every branch. Branch managers with *Users & access* can only add staff to their own branch.
- **Admins switch in the top bar.** On **All branches** the dashboard, reports, users, activity log and billing cover every branch. Pages that belong to one branch (POS, drawer, stock, settings) ask which branch first. Opening a record from search switches to its branch automatically.
- **Settings are per branch.** Address, phone, receipt text, taxes, number formats and payment accounts can differ per branch. The business name and tagline are shared.
- **New branches** are added by the superadmin, optionally copying another branch's price list (services, products, materials, suppliers) with stock at zero.

## Dashboard and reports

Both have a branch filter: **All branches**, or tick any mix of branches. With more than one branch picked you also get a side-by-side table per branch.

The report covers the picked dates and branches: sales, cost of goods, gross and net profit, money collected, receivables, discounts and voids; daily sales and expenses; payment methods; sales by category, hour and day of the week; branch comparison; staff performance (sales, discounts, voids, drawer over/short); production (jobs taken and released, turnaround, on-time rate, late jobs); top items and customers; material usage and wastage; expenses by category and source; receivables aging; voids and refunds; and drawer sessions. Every table exports to CSV (including a full order register and payments ledger), and the whole report exports to PDF.

## Subscriptions and billing

The superadmin runs this from **Platform**.

- **Plans.** Every branch pays the default monthly fee (₱1,699) unless it has its own price. Change the default in **Platform settings**; bills already issued keep their amount.
- **Free trials.** Add a branch on a free trial, or give or extend a trial from the branch menu. A trial branch uses everything and gets no bills. When the trial ends, billing starts the next day automatically.
- **Monthly bills, like a utility.** A subscribed branch gets one bill on the same day each month, due 10 days later (configurable). `php artisan billing:run` issues bills and ends trials. It is scheduled every day at 12:15 AM, and **Run billing now** does the same from the screen.
- **Overdue and locking.** An unpaid bill past its due date is overdue. The branch sees a reminder bar and a popup once per sign-in. When a branch has **3 overdue bills** (configurable), its staff can still sign in, but every page shows the bill and a **Pay now** button until enough is paid. Other branches are not affected. The superadmin can also suspend a branch (same bill screen), keep a locked branch open until a grace date, or cancel it (its staff can't sign in; data is kept).
- **Paying.** Branches pay from **Billing** or the bill screen through PayMongo Checkout (GCash, Maya, cards, GrabPay, QR Ph and more). Payments made by cash or bank transfer are recorded by the superadmin in **Branch bills**, where bills can also be voided. Each bill has a printable statement.

### Setting up PayMongo

1. In the PayMongo dashboard, go to **Developers** and copy the public and secret keys. Start with test keys.
2. Add a webhook pointing to `https://your-domain/webhooks/paymongo` for the event `checkout_session.payment.paid`, and copy its secret.
3. Paste the keys and webhook secret into **Platform settings > PayMongo**. They are stored encrypted. You can put them in `.env` instead (`PAYMONGO_PUBLIC_KEY`, `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`).
4. Switch to live keys once PayMongo activates your account.

Bills are marked paid when the webhook arrives. The app also checks the checkout when the payer returns, so the lock lifts immediately even if the webhook is delayed. The paid amount must match the bill, and repeated events are ignored.

## How the money works

- **Drawer first.** A cashier can't sell until they open a drawer with a starting float. Every cash movement is written as a signed row against that session: cash sales, balance collections, refunds from voids, cash expenses, petty-cash top-ups taken from the drawer, and paid-outs. Expected cash is the float plus the sum of those rows. Closing the drawer records the counted amount and the variance.
- **Payments.** Cash is selected by default. GCash and bank payments need a reference number. Credit puts the amount on the customer's account. Payments can be split, and job orders can take a downpayment. Any unpaid balance becomes a receivable, which requires a named customer (walk-ins pay in full) and respects the customer's credit limit.
- **Stock.** Selling a product decrements its stock. Selling a service deducts materials from its recipe, for example 1 sq ft of tarpaulin and 1.2 ml of ink per sq ft printed. Every change goes through one service that writes the stock ledger. Receiving a purchase order updates the moving-average cost.
- **Changing an order after checkout.** *Change items* on an order puts the old lines back into stock, takes the new ones out, and turns the difference into a collection, a refund, or a change to the customer's balance. Lowering a total counts as a return and needs the *Return items / refund* permission (Admin and Manager by default). A cash refund comes out of the open drawer. Each change is kept with its reason under *Changes after checkout*.
- **Old drawers.** A drawer still open from an earlier day shows a warning on the POS, the drawer page and the top bar until it is closed.
- **Pricing.** `app/Services/Pricing.php` is the source of truth. `resources/js/lib/pricing.ts` mirrors it so the POS can price as you type. The server reprices every sale and rejects it if the total no longer matches what the cashier saw.

## Page access

Staff access is managed in **Users & access** with a checkbox matrix. Each page has an "Open page" box, plus create, edit and delete boxes and extras such as *Give discounts*, *Void orders*, *Collect balances* and *Adjust stock*.

Each ticked box is a spatie/laravel-permission permission named `{page}.{action}`, and the list of pages lives in `app/Support/Access.php`. Unticked pages are hidden from the sidebar and blocked by the `page:` route middleware, which returns 403. Admins and the superadmin always have full access. The **Billing** page has *Open page* and *Pay bills* boxes; anyone at a locked branch can pay its bill.

## Receipts and documents

### Thermal receipts

**Print receipt** sends an HTML receipt sized for 58 mm or 80 mm paper straight to the browser's printer, with no PDF step. Pick the paper width in **Settings > Receipt printer**. With *Print as soon as a sale is saved* on, the receipt prints right after checkout. Every print after the first is marked **REPRINT, COPY N** and written to the activity log.

To skip the print dialog on the counter PC, make the thermal printer the Windows default and start Chrome in kiosk-printing mode:

```text
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --app=http://127.0.0.1:8000/pos
```

### Customer files and proofs

Job orders take customer files, proofs and photos of finished work: JPG, PNG, PDF, AI, EPS, PSD, CDR, SVG, TIFF, ZIP and similar, up to 50 MB each. Files are stored privately in `storage/app/private/order-files` and only signed-in staff can open them. Uploading a proof sets the job to *Proof waiting*. The board asks before a job with an unapproved proof moves to *In production*.

### PDFs

The following PDFs are generated with dompdf:

- 80 mm receipts, as a PDF from the order menu
- A5 job tickets with a tear-off claim stub
- A4 quotations
- Customer statements
- X-read and Z-read drawer summaries
- The business report

Receipts and quotations use the business profile and logo from **Settings**.

## Backups

`php artisan shop:backup` saves the whole database (every branch) as compressed JSON in `storage/app/private/backups` and keeps the newest 14 copies. It runs every night at 9:30 PM if the Laravel scheduler is running. On Windows, create a Task Scheduler task that runs every minute:

```text
Program:   C:\xampp\php\php.exe
Arguments: artisan schedule:run
Start in:  C:\path\to\skc
```

Admins can also make and download backups from **Settings > Backups**. Branch staff can't, because a backup contains every branch. Copy one to a USB drive or cloud storage regularly.

To restore a backup, run the command below. It replaces **all** current data, so make a fresh backup first.

```bash
php artisan shop:restore storage/app/private/backups/skc-pos-2026-09-14-213000.json.gz
```

## SMS notifications

When a job moves to **Ready for pickup**, a queued job sends a text to the customer. It uses `App\Services\Sms\SmsGateway`. The default implementation only writes the message to the log. To send real texts, bind a real provider in `AppServiceProvider`.

## Tests

```bash
php artisan test
```

The feature suite runs against in-memory SQLite. It covers:

- The POS lock when no drawer is open
- A mixed product and service sale that deducts both stock and materials
- A partially paid job order and the receivable it creates
- Credit sales, settlement, and closing a drawer with a variance
- Petty cash
- Moving jobs on the board and voiding an order
- 403 enforcement for unticked pages
- PDF rendering
- Thermal receipt print counting and reprint marking
- Uploading files, approving proofs and blocking unsafe file types
- Adding items after checkout (collect) and returning items (refund, with the permission check and stock return)
- Balance updates when a customer's job changes
- A backup and restore round trip
- Branch isolation: separate catalogs, stock and document numbers, 404 on another branch's records, and validation that rejects another branch's customers and products
- Admin branch filters on the dashboard and reports, the branch picker, and switching branch when opening a record
- Monthly billing, free trials ending, overdue warnings, locking at three overdue bills, suspension and unlocking on payment
- PayMongo checkout, webhook signature checks and replayed events
- Platform pages, branch creation with a copied price list, and superadmin-only access

## Design

The interface is dark-first, built from the SKC Custom Print logo's red, charcoal and white (`public/skclogo.png`). Red is reserved for primary actions, live production and alerts. A light theme is available for bright counters and can be switched in the top bar. The design tokens and the reasoning behind them are in `docs/design-plan.md`.
