<?php

namespace App\Providers;

use App\Models\BillingPayment;
use App\Models\Branch;
use App\Models\CashierSession;
use App\Models\CashMovement;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\InventoryItem;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PettyCashTransaction;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\Quotation;
use App\Models\Service;
use App\Models\Supplier;
use App\Models\User;
use App\Services\Sms\LogSmsGateway;
use App\Services\Sms\SmsGateway;
use App\Support\BranchContext;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use Spatie\Activitylog\Models\Activity;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(SmsGateway::class, LogSmsGateway::class);
        $this->app->singleton(BranchContext::class);
    }

    public function boot(): void
    {
        Relation::enforceMorphMap([
            'product' => Product::class,
            'inventory' => InventoryItem::class,
            'service' => Service::class,
            'order' => Order::class,
            'payment' => Payment::class,
            'expense' => Expense::class,
            'petty_tx' => PettyCashTransaction::class,
            'purchase' => Purchase::class,
            'quotation' => Quotation::class,
            'customer' => Customer::class,
            'user' => User::class,
            'cash_movement' => CashMovement::class,
            'cashier_session' => CashierSession::class,
            'supplier' => Supplier::class,
            'branch' => Branch::class,
            'invoice' => Invoice::class,
            'billing_payment' => BillingPayment::class,
        ]);

        // Stamp every activity-log row with its branch so each branch sees only its own history.
        Activity::creating(function (Activity $activity) {
            if ($activity->getAttribute('branch_id')) {
                return;
            }
            $subject = $activity->subject;
            $activity->setAttribute('branch_id', match (true) {
                $subject instanceof Branch => $subject->id,
                $subject !== null && $subject->getAttribute('branch_id') => $subject->getAttribute('branch_id'),
                default => BranchContext::current()->id(),
            });
        });

        // The shop owner can never lock themselves out.
        Gate::before(fn (User $user) => $user->canAccessAllBranches() ? true : null);

        Vite::prefetch(concurrency: 3);
    }
}
