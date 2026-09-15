<?php

namespace App\Services;

use App\Models\CashierSession;
use App\Models\CashMovement;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The cash drawer. Anything that puts cash in or takes it out posts a signed
 * CashMovement against the cashier's open session, inside the caller's transaction.
 */
class DrawerService
{
    public function open(User $user, float $openingFloat, ?string $note = null): CashierSession
    {
        return DB::transaction(function () use ($user, $openingFloat, $note) {
            User::query()->whereKey($user->id)->lockForUpdate()->first();

            if ($user->cashierSessions()->where('status', 'open')->exists()) {
                throw ValidationException::withMessages(['opening_float' => 'Your drawer is already open. Close it before opening a new one.']);
            }

            $session = $user->cashierSessions()->create([
                'opening_float' => round($openingFloat, 2),
                'status' => 'open',
                'opened_at' => now(),
                'opening_note' => $note,
            ]);

            activity('drawer')->performedOn($session)->causedBy($user)
                ->withProperties(['opening_float' => $session->opening_float])
                ->log('Opened drawer');

            return $session;
        });
    }

    public function close(CashierSession $session, float $counted, ?string $note, User $by): CashierSession
    {
        return DB::transaction(function () use ($session, $counted, $note, $by) {
            $session = CashierSession::query()->whereKey($session->id)->lockForUpdate()->firstOrFail();
            if (! $session->isOpen()) {
                throw ValidationException::withMessages(['closing_counted' => 'This drawer was already closed.']);
            }

            $expected = $session->liveExpectedCash();
            $session->update([
                'expected_cash' => $expected,
                'closing_counted' => round($counted, 2),
                'variance' => round($counted - $expected, 2),
                'status' => 'closed',
                'closed_at' => now(),
                'closing_note' => $note,
            ]);

            activity('drawer')->performedOn($session)->causedBy($by)
                ->withProperties(['expected' => $expected, 'counted' => $counted, 'variance' => $session->variance])
                ->log('Closed drawer');

            return $session;
        });
    }

    /** The user's open session, locked, or a friendly validation error. */
    public function requireOpen(User $user, string $field = 'session'): CashierSession
    {
        $session = CashierSession::query()
            ->where('user_id', $user->id)
            ->where('status', 'open')
            ->lockForUpdate()
            ->first();

        if (! $session) {
            throw ValidationException::withMessages([$field => 'Open your drawer to start selling. Cash can only move through an open session.']);
        }

        return $session;
    }

    public function post(CashierSession $session, string $type, float $amount, ?Model $source = null, ?string $note = null, ?int $userId = null): CashMovement
    {
        return $session->movements()->create([
            'type' => $type,
            'amount' => round($amount, 2),
            'source_type' => $source?->getMorphClass(),
            'source_id' => $source?->getKey(),
            'note' => $note,
            'user_id' => $userId ?? auth()->id(),
        ]);
    }

    /** Totals used by the X/Z read and the session page. */
    public function summary(CashierSession $session): array
    {
        $movements = $session->movements()->selectRaw('type, SUM(amount) as total, COUNT(*) as n')->groupBy('type')->get()->keyBy('type');
        $payments = $session->payments()->where('kind', '!=', 'refund')
            ->selectRaw('method, kind, SUM(amount) as total, COUNT(*) as n')->groupBy('method', 'kind')->get();
        $orders = $session->orders();

        $byMethod = [];
        foreach (['cash', 'gcash', 'bank', 'credit'] as $method) {
            $byMethod[$method] = round((float) $payments->where('method', $method)->sum('total'), 2);
        }

        $lines = [];
        foreach (CashMovement::LABELS as $type => $label) {
            $lines[] = ['type' => $type, 'label' => $label, 'amount' => round((float) ($movements[$type]->total ?? 0), 2), 'count' => (int) ($movements[$type]->n ?? 0)];
        }

        $expected = $session->isOpen() ? $session->liveExpectedCash() : (float) $session->expected_cash;

        return [
            'opening_float' => (float) $session->opening_float,
            'movements' => $lines,
            'by_method' => $byMethod,
            'collections_by_method' => $payments->where('kind', 'settlement')->groupBy('method')->map(fn ($g) => round((float) $g->sum('total'), 2)),
            'order_count' => (clone $orders)->where('status', '!=', 'voided')->count(),
            'voided_count' => (clone $orders)->where('status', 'voided')->count(),
            'gross_sales' => round((float) (clone $orders)->where('status', '!=', 'voided')->sum('total'), 2),
            'discounts' => round((float) (clone $orders)->where('status', '!=', 'voided')->sum('discount_total')
                + (float) DB::table('order_items')->join('orders', 'orders.id', '=', 'order_items.order_id')
                    ->where('orders.cashier_session_id', $session->id)->where('orders.status', '!=', 'voided')
                    ->sum('order_items.discount_amount'), 2),
            'expected_cash' => $expected,
            'closing_counted' => $session->closing_counted !== null ? (float) $session->closing_counted : null,
            'variance' => $session->variance !== null ? (float) $session->variance : null,
        ];
    }
}
