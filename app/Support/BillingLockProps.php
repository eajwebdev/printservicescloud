<?php

namespace App\Support;

use App\Models\Branch;
use App\Models\User;
use App\Services\Billing\BillingService;
use App\Services\Billing\PayMongo;

/** Props for the locked-branch bill screen, shared by the middleware and the billing controller. */
class BillingLockProps
{
    public static function for(Branch $branch, array $state, User $user): array
    {
        return [
            'branch' => ['id' => $branch->id, 'name' => $branch->name, 'code' => $branch->code],
            'state' => $state,
            'canSwitch' => $user->canAccessAllBranches(),
            'onlineReady' => app(PayMongo::class)->configured(),
            'provider' => app(BillingService::class)->setting('billing.provider_name'),
        ];
    }
}
