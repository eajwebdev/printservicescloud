<?php

namespace App\Services;

use App\Models\PettyCashFund;
use App\Models\PettyCashTransaction;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PettyCashService
{
    public function __construct(private DrawerService $drawer) {}

    /** Replenish the fund. Money taken from the sales drawer posts a petty-out on the open session. */
    public function topUp(float $amount, string $fundedFrom, ?string $ref, ?string $reason, User $by): PettyCashTransaction
    {
        return DB::transaction(function () use ($amount, $fundedFrom, $ref, $reason, $by) {
            $fund = $this->lockedFund();
            $session = $fundedFrom === 'drawer' ? $this->drawer->requireOpen($by, 'funded_from') : null;

            $tx = $this->record($fund, 'in', $amount, $reason ?: 'Fund replenished', $ref, $by, ['funded_from' => $fundedFrom]);

            if ($session) {
                $this->drawer->post($session, 'petty_out', -$amount, $tx, 'Moved to petty cash', $by->id);
            }

            return $tx;
        });
    }

    public function disburse(float $amount, string $reason, ?string $ref, User $by, ?int $expenseId = null): PettyCashTransaction
    {
        return DB::transaction(function () use ($amount, $reason, $ref, $by, $expenseId) {
            $fund = $this->lockedFund();
            if ($amount - (float) $fund->balance > 0.009) {
                throw ValidationException::withMessages(['amount' => 'Petty cash only has ₱'.number_format((float) $fund->balance, 2).'. Top up the fund first.']);
            }

            return $this->record($fund, 'out', -$amount, $reason, $ref, $by, ['expense_id' => $expenseId]);
        });
    }

    /** Set the fund to what was physically counted; the difference is logged as an adjustment. */
    public function reconcile(float $counted, ?string $note, User $by): ?PettyCashTransaction
    {
        return DB::transaction(function () use ($counted, $note, $by) {
            $fund = $this->lockedFund();
            $diff = round($counted - (float) $fund->balance, 2);
            if (abs($diff) < 0.01) {
                activity('petty_cash')->causedBy($by)->log('Counted petty cash: balanced');

                return null;
            }

            return $this->record($fund, 'adjustment', $diff, $note ?: ($diff < 0 ? 'Count short' : 'Count over'), null, $by);
        });
    }

    private function lockedFund(): PettyCashFund
    {
        PettyCashFund::main();

        return PettyCashFund::query()->oldest('id')->lockForUpdate()->firstOrFail();
    }

    private function record(PettyCashFund $fund, string $type, float $amount, string $reason, ?string $ref, User $by, array $extra = []): PettyCashTransaction
    {
        $fund->balance = round((float) $fund->balance + $amount, 2);
        $fund->save();

        $tx = $fund->transactions()->create($extra + [
            'type' => $type,
            'amount' => round($amount, 2),
            'balance_after' => $fund->balance,
            'reason' => $reason,
            'ref' => $ref,
            'user_id' => $by->id,
        ]);

        activity('petty_cash')->performedOn($tx)->causedBy($by)
            ->withProperties(['amount' => $amount, 'balance' => $fund->balance])
            ->log(match ($type) { 'in' => 'Topped up petty cash', 'out' => 'Paid from petty cash', default => 'Adjusted petty cash' });

        return $tx;
    }
}
