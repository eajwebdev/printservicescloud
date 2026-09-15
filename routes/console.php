<?php

use App\Services\BackupService;
use App\Services\Billing\BillingService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('shop:backup {--keep=14 : How many backups to keep}', function (BackupService $backups) {
    $name = $backups->create();
    $pruned = $backups->prune((int) $this->option('keep'));
    $this->info("Backup saved: storage/app/private/{$name}");
    if ($pruned) {
        $this->line("Removed {$pruned} older backup(s).");
    }
})->purpose('Save a full backup of the shop data');

Artisan::command('shop:restore {file : Backup file name or path} {--force : Skip the confirmation}', function (BackupService $backups) {
    $file = (string) $this->argument('file');
    $path = is_file($file) ? $file : $backups->path($file);

    if (! $this->option('force') && ! $this->confirm("Replace ALL current shop data with {$path}? Take a fresh backup first if unsure.")) {
        $this->warn('Restore cancelled.');

        return 1;
    }

    $counts = $backups->restore($path);
    $this->info('Restored '.array_sum($counts).' rows across '.count($counts).' tables.');

    return 0;
})->purpose('Replace the shop data with a backup');

Artisan::command('billing:run', function (BillingService $billing) {
    $result = $billing->run();
    if ($result['paused'] ?? false) {
        $this->warn('Billing is paused: the master key is on.');

        return;
    }
    $this->info("Issued {$result['invoices']} bill(s); ended {$result['trials_ended']} free trial(s).");
})->purpose('Issue monthly branch bills and end finished free trials');

// Nightly after closing. On Windows, run `php artisan schedule:run` every minute from Task Scheduler.
Schedule::command('shop:backup')->dailyAt('21:30');
// Bills go out early in the morning, before branches open.
Schedule::command('billing:run')->dailyAt('00:15')->withoutOverlapping();
