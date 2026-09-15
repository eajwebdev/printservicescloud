<?php

namespace App\Services;

use App\Models\Setting;
use App\Support\BranchContext;
use Illuminate\Support\Facades\DB;

/**
 * Human document numbers from a format such as "{BR}-{YYMM}-{#####}".
 * Tokens: {BR} (branch code) {YYYY} {YY} {MM} {DD} {YYMM} and a run of # for the zero-padded counter.
 * Each branch has its own counters, and a counter resets whenever the date part of the format changes.
 */
class Sequence
{
    public const DEFAULT_FORMATS = [
        'order' => '{BR}-{YYMM}-{####}',
        'quotation' => 'QT-{BR}-{YYMM}-{###}',
        'purchase' => 'PO-{BR}-{YYYY}-{###}',
    ];

    public static function next(string $name): string
    {
        $branch = BranchContext::current()->branch();
        $branchId = $branch?->id;
        $format = (string) Setting::get("{$name}_no_format", self::DEFAULT_FORMATS[$name] ?? strtoupper($name).'-{#####}');
        $dated = self::fill($format, $branch?->code ?? 'HQ');
        $period = substr(md5(preg_replace('/\{#+\}/', '', $dated)), 0, 20);

        $value = DB::transaction(function () use ($name, $period, $branchId) {
            $row = DB::table('sequences')->where(['branch_id' => $branchId, 'name' => $name, 'period' => $period])->lockForUpdate()->first();
            if (! $row) {
                DB::table('sequences')->insert(['branch_id' => $branchId, 'name' => $name, 'period' => $period, 'last_value' => 1]);

                return 1;
            }
            DB::table('sequences')->where('id', $row->id)->update(['last_value' => $row->last_value + 1]);

            return $row->last_value + 1;
        });

        return preg_replace_callback('/\{(#+)\}/', fn ($m) => str_pad((string) $value, strlen($m[1]), '0', STR_PAD_LEFT), $dated);
    }

    /** Replace the branch and date tokens, leaving the counter. */
    public static function fill(string $format, string $branchCode): string
    {
        $now = now();

        return strtr($format, [
            '{BR}' => $branchCode,
            '{YYYY}' => $now->format('Y'),
            '{YYMM}' => $now->format('ym'),
            '{YY}' => $now->format('y'),
            '{MM}' => $now->format('m'),
            '{DD}' => $now->format('d'),
        ]);
    }
}
