<?php

namespace App\Services;

use App\Models\CashMovement;
use App\Models\Expense;
use App\Models\PettyCashTransaction;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ExpenseService
{
    public function __construct(
        private DrawerService $drawer,
        private PettyCashService $petty,
    ) {}

    public function record(array $data, User $by): Expense
    {
        return DB::transaction(function () use ($data, $by) {
            $session = $data['source'] === 'drawer' ? $this->drawer->requireOpen($by, 'source') : null;

            $expense = Expense::query()->create($data + [
                'cashier_session_id' => $session?->id,
                'user_id' => $by->id,
            ]);

            $label = Expense::CATEGORIES[$expense->category].($expense->payee ? " / {$expense->payee}" : '');

            if ($session) {
                $this->drawer->post($session, 'expense', -(float) $expense->amount, $expense, $label, $by->id);
            }
            if ($expense->source === 'petty') {
                $this->petty->disburse((float) $expense->amount, $label, 'EXP-'.$expense->id, $by, $expense->id);
            }

            return $expense;
        });
    }

    /** Delete with the money put back where it came from. Closed drawers can't be reopened, so those stay. */
    public function delete(Expense $expense, User $by): void
    {
        DB::transaction(function () use ($expense, $by) {
            if ($expense->source === 'drawer') {
                $movement = CashMovement::query()->where('source_type', $expense->getMorphClass())->where('source_id', $expense->id)->with('session')->first();
                if ($movement && ! $movement->session->isOpen()) {
                    throw ValidationException::withMessages(['expense' => 'This came out of a drawer that is already closed. Record a correcting entry instead of deleting it.']);
                }
                $movement?->delete();
            }

            if ($expense->source === 'petty' && PettyCashTransaction::query()->where('expense_id', $expense->id)->exists()) {
                $this->petty->topUp((float) $expense->amount, 'owner', 'EXP-'.$expense->id, 'Reversed deleted expense', $by);
                PettyCashTransaction::query()->where('expense_id', $expense->id)->update(['expense_id' => null]);
            }

            activity('expenses')->performedOn($expense)->causedBy($by)
                ->withProperties($expense->only(['category', 'amount', 'source', 'payee']))
                ->log('Deleted expense');
            $expense->delete();
        });
    }
}
