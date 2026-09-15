<?php

use App\Http\Controllers\ActivityController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\BillingController;
use App\Http\Controllers\BranchController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\LandingController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\OrderFileController;
use App\Http\Controllers\PayMongoWebhookController;
use App\Http\Controllers\PettyCashController;
use App\Http\Controllers\Platform;
use App\Http\Controllers\PosController;
use App\Http\Controllers\PrintController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\PurchaseController;
use App\Http\Controllers\QuotationController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\SessionController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

// The public site.
Route::get('/', LandingController::class)->name('home');

// PayMongo tells us when a branch has paid its bill. Verified by signature, not by session.
Route::post('webhooks/paymongo', PayMongoWebhookController::class)->name('webhooks.paymongo');

Route::middleware('guest')->group(function () {
    Route::get('login', [LoginController::class, 'show'])->name('login');
    Route::post('login', [LoginController::class, 'store'])->middleware('throttle:10,1');
});

Route::middleware('auth')->group(function () {
    Route::post('logout', [LoginController::class, 'destroy'])->name('logout');

    // Always reachable, even when a branch is locked for unpaid bills.
    Route::get('branches/pick', [BranchController::class, 'pick'])->name('branches.pick');
    Route::post('branches/switch', [BranchController::class, 'switch'])->name('branches.switch');

    Route::prefix('billing')->name('billing.')->group(function () {
        Route::get('/', [BillingController::class, 'index'])->middleware('page:billing')->name('index');
        Route::get('locked', [BillingController::class, 'locked'])->name('locked');
        Route::post('pay', [BillingController::class, 'pay'])->middleware('throttle:10,1')->name('pay');
        Route::get('payments/{billingPayment}/return', [BillingController::class, 'returned'])->name('return');
        Route::get('invoices/{invoice}/print', [BillingController::class, 'print'])->name('invoices.print');
    });

    // The system provider: branches, subscriptions, free trials, invoices and PayMongo keys.
    Route::middleware('superadmin')->prefix('platform')->name('platform.')->group(function () {
        Route::get('/', [Platform\BranchController::class, 'index'])->name('branches.index');
        Route::post('branches', [Platform\BranchController::class, 'store'])->name('branches.store');
        Route::put('branches/{branch}', [Platform\BranchController::class, 'update'])->name('branches.update');
        Route::post('branches/{branch}/trial', [Platform\BranchController::class, 'trial'])->name('branches.trial');
        Route::post('branches/{branch}/activate', [Platform\BranchController::class, 'activate'])->name('branches.activate');
        Route::post('branches/{branch}/suspend', [Platform\BranchController::class, 'suspend'])->name('branches.suspend');
        Route::post('branches/{branch}/resume', [Platform\BranchController::class, 'resume'])->name('branches.resume');
        Route::post('branches/{branch}/cancel', [Platform\BranchController::class, 'cancel'])->name('branches.cancel');
        Route::post('branches/{branch}/bill', [Platform\BranchController::class, 'bill'])->name('branches.bill');
        Route::get('invoices', [Platform\InvoiceController::class, 'index'])->name('invoices.index');
        Route::post('invoices/record-payment', [Platform\InvoiceController::class, 'recordPayment'])->name('invoices.pay');
        Route::post('invoices/{invoice}/void', [Platform\InvoiceController::class, 'void'])->name('invoices.void');
        Route::post('billing/run', [Platform\InvoiceController::class, 'run'])->name('billing.run');
        Route::get('settings', [Platform\SettingsController::class, 'index'])->name('settings.index');
        Route::put('settings', [Platform\SettingsController::class, 'update'])->name('settings.update');
    });

    Route::middleware('subscribed')->group(function () {
        Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');
        Route::get('search', SearchController::class)->name('search');

        // Pages below work inside one branch; an admin on "All branches" is asked to pick one.
        Route::middleware('branch')->group(function () {

            // Counter
            Route::middleware('page:pos')->prefix('pos')->name('pos.')->group(function () {
                Route::get('/', [PosController::class, 'index'])->name('index');
                Route::post('checkout', [PosController::class, 'checkout'])->name('checkout');
                Route::get('customers', [PosController::class, 'searchCustomers'])->name('customers.search');
                Route::post('customers', [PosController::class, 'quickCustomer'])->name('customers');
                Route::post('held', [PosController::class, 'hold'])->name('held.store');
                Route::delete('held/{heldCart}', [PosController::class, 'releaseHeld'])->name('held.destroy');
            });

            Route::middleware('page:session')->prefix('session')->name('session.')->group(function () {
                Route::get('/', [SessionController::class, 'index'])->name('index');
                Route::post('open', [SessionController::class, 'open'])->name('open');
                Route::post('close', [SessionController::class, 'close'])->name('close');
                Route::post('movements', [SessionController::class, 'movement'])->middleware('page:session,edit')->name('movements');
                Route::get('{cashierSession}', [SessionController::class, 'show'])->name('show');
                Route::get('{cashierSession}/pdf', [SessionController::class, 'pdf'])->name('pdf');
            });

            Route::middleware('page:orders')->prefix('orders')->name('orders.')->group(function () {
                Route::get('/', [OrderController::class, 'index'])->name('index');
                Route::get('{order}', [OrderController::class, 'show'])->name('show');
                Route::get('{order}/peek', [OrderController::class, 'peek'])->name('peek');
                Route::get('{order}/print', [PrintController::class, 'receipt'])->name('print');
                Route::get('{order}/change', [OrderController::class, 'change'])->middleware('page:orders,edit')->name('change');
                Route::put('{order}/items', [OrderController::class, 'saveChange'])->middleware('page:orders,edit')->name('change.save');
                Route::post('{order}/files', [OrderFileController::class, 'store'])->middleware('page:orders,edit')->name('files.store');
                Route::get('{order}/files/{file}', [OrderFileController::class, 'show'])->name('files.show');
                Route::delete('{order}/files/{file}', [OrderFileController::class, 'destroy'])->middleware('page:orders,edit')->name('files.destroy');
                Route::patch('{order}/proof', [OrderFileController::class, 'proof'])->middleware('page:orders,edit')->name('proof');
                Route::get('{order}/receipt', [OrderController::class, 'receipt'])->name('receipt');
                Route::get('{order}/ticket', [OrderController::class, 'ticket'])->name('ticket');
                Route::patch('{order}/status', [OrderController::class, 'status'])->middleware('page:orders,edit')->name('status');
                Route::patch('{order}', [OrderController::class, 'update'])->middleware('page:orders,edit')->name('update');
                Route::post('{order}/void', [OrderController::class, 'void'])->middleware('page:orders,void')->name('void');
                Route::post('{order}/collect', [OrderController::class, 'collect'])->middleware('page:customers,settle')->name('collect');
            });

            Route::middleware('page:customers')->prefix('customers')->name('customers.')->group(function () {
                Route::get('/', [CustomerController::class, 'index'])->name('index');
                Route::post('/', [CustomerController::class, 'store'])->middleware('page:customers,create')->name('store');
                Route::get('{customer}', [CustomerController::class, 'show'])->name('show');
                Route::get('{customer}/peek', [CustomerController::class, 'peek'])->name('peek');
                Route::get('{customer}/statement', [CustomerController::class, 'statement'])->name('statement');
                Route::put('{customer}', [CustomerController::class, 'update'])->middleware('page:customers,edit')->name('update');
                Route::delete('{customer}', [CustomerController::class, 'destroy'])->middleware('page:customers,delete')->name('destroy');
                Route::post('{customer}/settle', [CustomerController::class, 'settle'])->middleware('page:customers,settle')->name('settle');
            });

            Route::middleware('page:quotations')->prefix('quotations')->name('quotations.')->group(function () {
                Route::get('/', [QuotationController::class, 'index'])->name('index');
                Route::get('create', [QuotationController::class, 'create'])->middleware('page:quotations,create')->name('create');
                Route::post('/', [QuotationController::class, 'store'])->middleware('page:quotations,create')->name('store');
                Route::get('{quotation}', [QuotationController::class, 'show'])->name('show');
                Route::get('{quotation}/edit', [QuotationController::class, 'edit'])->middleware('page:quotations,edit')->name('edit');
                Route::put('{quotation}', [QuotationController::class, 'update'])->middleware('page:quotations,edit')->name('update');
                Route::patch('{quotation}/status', [QuotationController::class, 'status'])->middleware('page:quotations,edit')->name('status');
                Route::delete('{quotation}', [QuotationController::class, 'destroy'])->middleware('page:quotations,delete')->name('destroy');
                Route::get('{quotation}/pdf', [QuotationController::class, 'pdf'])->name('pdf');
                Route::post('{quotation}/convert', [QuotationController::class, 'convert'])->middleware('page:pos')->name('convert');
            });

            // Catalog & stock
            Route::middleware('page:products')->prefix('products')->name('products.')->group(function () {
                Route::get('/', [ProductController::class, 'index'])->name('index');
                Route::post('/', [ProductController::class, 'store'])->middleware('page:products,create')->name('store');
                Route::get('{product}', [ProductController::class, 'show'])->name('show');
                Route::put('{product}', [ProductController::class, 'update'])->middleware('page:products,edit')->name('update');
                Route::delete('{product}', [ProductController::class, 'destroy'])->middleware('page:products,delete')->name('destroy');
            });

            Route::middleware('page:services')->prefix('services')->name('services.')->group(function () {
                Route::get('/', [ServiceController::class, 'index'])->name('index');
                Route::get('create', [ServiceController::class, 'create'])->middleware('page:services,create')->name('create');
                Route::post('/', [ServiceController::class, 'store'])->middleware('page:services,create')->name('store');
                Route::get('{service}/edit', [ServiceController::class, 'edit'])->middleware('page:services,edit')->name('edit');
                Route::put('{service}', [ServiceController::class, 'update'])->middleware('page:services,edit')->name('update');
                Route::patch('{service}/toggle', [ServiceController::class, 'toggle'])->middleware('page:services,edit')->name('toggle');
                Route::delete('{service}', [ServiceController::class, 'destroy'])->middleware('page:services,delete')->name('destroy');
            });

            Route::middleware('page:inventory')->prefix('inventory')->name('inventory.')->group(function () {
                Route::get('/', [InventoryController::class, 'index'])->name('index');
                Route::post('/', [InventoryController::class, 'store'])->middleware('page:inventory,create')->name('store');
                Route::get('count', [InventoryController::class, 'countSheet'])->middleware('page:inventory,adjust')->name('count');
                Route::post('count', [InventoryController::class, 'saveCount'])->middleware('page:inventory,adjust')->name('count.store');
                Route::post('adjust', [InventoryController::class, 'adjust'])->middleware('page:inventory,adjust')->name('adjust');
                Route::get('{inventoryItem}', [InventoryController::class, 'show'])->name('show');
                Route::put('{inventoryItem}', [InventoryController::class, 'update'])->middleware('page:inventory,edit')->name('update');
                Route::delete('{inventoryItem}', [InventoryController::class, 'destroy'])->middleware('page:inventory,delete')->name('destroy');
            });

            Route::middleware('page:purchases')->group(function () {
                Route::prefix('purchases')->name('purchases.')->group(function () {
                    Route::get('/', [PurchaseController::class, 'index'])->name('index');
                    Route::get('create', [PurchaseController::class, 'create'])->middleware('page:purchases,create')->name('create');
                    Route::post('/', [PurchaseController::class, 'store'])->middleware('page:purchases,create')->name('store');
                    Route::get('{purchase}', [PurchaseController::class, 'show'])->name('show');
                    Route::get('{purchase}/edit', [PurchaseController::class, 'edit'])->middleware('page:purchases,edit')->name('edit');
                    Route::put('{purchase}', [PurchaseController::class, 'update'])->middleware('page:purchases,edit')->name('update');
                    Route::post('{purchase}/order', [PurchaseController::class, 'markOrdered'])->middleware('page:purchases,edit')->name('order');
                    Route::post('{purchase}/receive', [PurchaseController::class, 'receive'])->middleware('page:purchases,edit')->name('receive');
                    Route::post('{purchase}/cancel', [PurchaseController::class, 'cancel'])->middleware('page:purchases,edit')->name('cancel');
                    Route::delete('{purchase}', [PurchaseController::class, 'destroy'])->middleware('page:purchases,delete')->name('destroy');
                });
                Route::prefix('suppliers')->name('suppliers.')->group(function () {
                    Route::get('/', [SupplierController::class, 'index'])->name('index');
                    Route::post('/', [SupplierController::class, 'store'])->middleware('page:purchases,create')->name('store');
                    Route::put('{supplier}', [SupplierController::class, 'update'])->middleware('page:purchases,edit')->name('update');
                    Route::delete('{supplier}', [SupplierController::class, 'destroy'])->middleware('page:purchases,delete')->name('destroy');
                });
            });

            // Money
            Route::middleware('page:expenses')->prefix('expenses')->name('expenses.')->group(function () {
                Route::get('/', [ExpenseController::class, 'index'])->name('index');
                Route::post('/', [ExpenseController::class, 'store'])->middleware('page:expenses,create')->name('store');
                Route::put('{expense}', [ExpenseController::class, 'update'])->middleware('page:expenses,edit')->name('update');
                Route::delete('{expense}', [ExpenseController::class, 'destroy'])->middleware('page:expenses,delete')->name('destroy');
            });

            Route::middleware('page:petty_cash')->prefix('petty-cash')->name('petty.')->group(function () {
                Route::get('/', [PettyCashController::class, 'index'])->name('index');
                Route::post('top-up', [PettyCashController::class, 'topUp'])->middleware('page:petty_cash,create')->name('topup');
                Route::post('disburse', [PettyCashController::class, 'disburse'])->middleware('page:petty_cash,create')->name('disburse');
                Route::post('reconcile', [PettyCashController::class, 'reconcile'])->middleware('page:petty_cash,edit')->name('reconcile');
                Route::put('fund', [PettyCashController::class, 'updateFund'])->middleware('page:petty_cash,edit')->name('fund');
            });

            // Admin
            Route::middleware('page:settings')->prefix('settings')->name('settings.')->group(function () {
                Route::get('/', [SettingsController::class, 'index'])->name('index');
                Route::put('/', [SettingsController::class, 'update'])->middleware('page:settings,edit')->name('update');
                Route::post('logo', [SettingsController::class, 'logo'])->middleware('page:settings,edit')->name('logo');
                Route::post('backups', [SettingsController::class, 'createBackup'])->middleware('page:settings,edit')->name('backups.store');
                Route::get('backups/{name}', [SettingsController::class, 'downloadBackup'])->middleware('page:settings,edit')->name('backups.download');
            });
        }); // end branch-bound pages

        // Reports, users and the activity log also work across all branches.
        Route::middleware('page:reports')->prefix('reports')->name('reports.')->group(function () {
            Route::get('/', [ReportController::class, 'index'])->name('index');
            Route::get('export/csv', [ReportController::class, 'csv'])->middleware('page:reports,export')->name('csv');
            Route::get('export/pdf', [ReportController::class, 'pdf'])->middleware('page:reports,export')->name('pdf');
        });

        Route::middleware('page:users')->prefix('users')->name('users.')->group(function () {
            Route::get('/', [UserController::class, 'index'])->name('index');
            Route::get('create', [UserController::class, 'create'])->middleware('page:users,create')->name('create');
            Route::post('/', [UserController::class, 'store'])->middleware('page:users,create')->name('store');
            Route::get('{user}/edit', [UserController::class, 'edit'])->middleware('page:users,edit')->name('edit');
            Route::put('{user}', [UserController::class, 'update'])->middleware('page:users,edit')->name('update');
            Route::delete('{user}', [UserController::class, 'destroy'])->middleware('page:users,delete')->name('destroy');
        });

        Route::get('activity', [ActivityController::class, 'index'])->middleware('page:activity')->name('activity.index');
    }); // end subscribed
});
