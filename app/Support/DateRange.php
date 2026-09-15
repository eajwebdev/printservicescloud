<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/** A from/to date filter read from the query string, as whole days. */
class DateRange
{
    /**
     * @param  int  $defaultDays  how many days back from today when no dates are given (0 = today only)
     * @return array{0: Carbon, 1: Carbon}
     */
    public static function fromRequest(Request $request, int $defaultDays = 0): array
    {
        $to = self::parse($request->query('to')) ?? Carbon::today();
        $from = self::parse($request->query('from')) ?? $to->copy()->subDays($defaultDays);
        if ($from->gt($to)) {
            [$from, $to] = [$to, $from];
        }

        return [$from->startOfDay(), $to->endOfDay()];
    }

    private static function parse(mixed $value): ?Carbon
    {
        // Reject impossible dates like 2026-02-31 rather than letting them roll into the next month.
        if (! is_string($value) || ! preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $m) || ! checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
            return null;
        }

        try {
            return Carbon::createFromFormat('Y-m-d', $value)->startOfDay();
        } catch (\Throwable) {
            return null;
        }
    }
}
