<?php

namespace App\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Whole-shop backups as compressed JSON, kept on the private disk.
 * Portable across MySQL, MariaDB and SQLite, and restorable with `php artisan shop:restore`.
 */
class BackupService
{
    public const DIR = 'backups';

    public const APP = 'eaj-pos';

    /** Parents before children so a restore never trips a foreign key. */
    public const TABLES = [
        'branches', 'settings', 'sequences', 'users', 'roles', 'permissions', 'model_has_roles', 'model_has_permissions', 'role_has_permissions',
        'customers', 'suppliers', 'inventory_items', 'products', 'service_categories', 'services', 'service_options', 'service_materials',
        'stock_movements', 'purchases', 'purchase_items', 'cashier_sessions', 'cash_movements', 'quotations', 'quotation_items',
        'orders', 'order_items', 'order_files', 'order_revisions', 'receivables', 'payments', 'petty_cash_funds', 'expenses',
        'petty_cash_transactions', 'held_carts', 'billing_payments', 'invoices', 'activity_log',
    ];

    public function create(): string
    {
        $data = ['app' => self::APP, 'version' => 2, 'created_at' => now()->toIso8601String(), 'tables' => []];
        foreach (self::TABLES as $table) {
            if (Schema::hasTable($table)) {
                $data['tables'][$table] = DB::table($table)->get()->map(fn ($row) => (array) $row)->all();
            }
        }

        $name = self::DIR.'/eaj-pos-'.now()->format('Y-m-d-His').'.json.gz';
        Storage::disk('local')->put($name, gzencode(json_encode($data, JSON_UNESCAPED_UNICODE), 6));

        return $name;
    }

    /** Keep the newest N backups. */
    public function prune(int $keep = 14): int
    {
        $files = collect(Storage::disk('local')->files(self::DIR))->filter(fn ($f) => str_ends_with($f, '.json.gz'))->sort()->values();
        $old = $files->slice(0, max(0, $files->count() - $keep));
        Storage::disk('local')->delete($old->all());

        return $old->count();
    }

    /** @return array<int, array{name: string, size: int, created_at: string}> */
    public function list(): array
    {
        return collect(Storage::disk('local')->files(self::DIR))
            ->filter(fn ($f) => str_ends_with($f, '.json.gz'))
            ->sortDesc()
            ->values()
            ->map(fn ($f) => [
                'name' => basename($f),
                'size' => Storage::disk('local')->size($f),
                'created_at' => Carbon::createFromTimestamp(Storage::disk('local')->lastModified($f))->toIso8601String(),
            ])
            ->all();
    }

    public function path(string $name): string
    {
        $name = basename($name);
        if (! preg_match('/^(eaj-pos|skc-pos|print-request)-[\d-]+\.json\.gz$/', $name) || ! Storage::disk('local')->exists(self::DIR.'/'.$name)) {
            throw new RuntimeException("No backup called {$name}.");
        }

        return Storage::disk('local')->path(self::DIR.'/'.$name);
    }

    /** Replace every table with the backup's contents. Returns rows restored per table. */
    public function restore(string $file): array
    {
        $raw = @file_get_contents($file);
        if ($raw === false) {
            throw new RuntimeException("Can't read {$file}.");
        }
        $json = str_ends_with($file, '.gz') ? gzdecode($raw) : $raw;
        $data = json_decode((string) $json, true);
        if (! in_array($data['app'] ?? null, [self::APP, 'print-request'], true) || ! is_array($data['tables'] ?? null)) {
            throw new RuntimeException('That file is not a backup from this system.');
        }

        $counts = [];
        Schema::disableForeignKeyConstraints();
        try {
            DB::transaction(function () use ($data, &$counts) {
                foreach (array_reverse(self::TABLES) as $table) {
                    if (Schema::hasTable($table) && array_key_exists($table, $data['tables'])) {
                        DB::table($table)->delete();
                    }
                }
                foreach (self::TABLES as $table) {
                    if (! Schema::hasTable($table) || ! array_key_exists($table, $data['tables'])) {
                        continue;
                    }
                    $columns = Schema::getColumnListing($table);
                    $rows = array_map(fn ($r) => array_intersect_key($r, array_flip($columns)), $data['tables'][$table]);
                    foreach (array_chunk($rows, 200) as $chunk) {
                        DB::table($table)->insert($chunk);
                    }
                    $counts[$table] = count($rows);
                }
            });
        } finally {
            Schema::enableForeignKeyConstraints();
        }

        cache()->flush();

        return $counts;
    }
}
