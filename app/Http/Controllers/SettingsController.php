<?php

namespace App\Http\Controllers;

use App\Http\Requests\LogoRequest;
use App\Http\Requests\SettingsRequest;
use App\Models\Setting;
use App\Services\BackupService;
use App\Services\Sequence;
use App\Support\BranchContext;
use App\Support\Shop;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class SettingsController extends Controller
{
    public const DEFAULTS = [
        'business_name' => Shop::BRAND,
        'tagline' => Shop::TAGLINE,
        'address' => '',
        'phone' => '',
        'email' => '',
        'tin' => '',
        'receipt_footer' => 'Thank you! Please keep this receipt for pickup and warranty claims.',
        'quotation_terms' => "50% downpayment to start production. Balance on pickup.\nPrices valid until the date shown.\nFile layout changes after approval may add a design fee.",
        'quotation_valid_days' => 15,
        'tax_mode' => 'none',
        'tax_rate' => 12,
        'senior_pwd_percent' => 20,
        'rush_fee_percent' => 30,
        'credit_terms_days' => 30,
        'order_no_format' => Sequence::DEFAULT_FORMATS['order'],
        'quotation_no_format' => Sequence::DEFAULT_FORMATS['quotation'],
        'purchase_no_format' => Sequence::DEFAULT_FORMATS['purchase'],
        'gcash_name' => '',
        'gcash_number' => '',
        'bank_name' => '',
        'bank_account_name' => '',
        'bank_account_number' => '',
        'sms_ready_enabled' => true,
        'receipt_paper' => 80,
        'auto_print' => true,
        'print_claim_stub' => true,
    ];

    public function index(): Response
    {
        $values = collect(self::DEFAULTS)->mapWithKeys(fn ($default, $key) => [$key => Setting::get($key, $default)]);

        return Inertia::render('Settings/Index', [
            'settings' => $values,
            'logoUrl' => Shop::logoUrl(),
            'branch' => BranchContext::current()->branch()?->only(['id', 'name', 'code']),
            'canEditBrand' => request()->user()->canAccessAllBranches(),
            'preview' => [
                'order' => $this->previewNumber((string) $values['order_no_format']),
            ],
            // A backup holds every branch's data, so only all-branch admins see or make them.
            'backups' => request()->user()->canAccessAllBranches() ? app(BackupService::class)->list() : null,
        ]);
    }

    public function update(SettingsRequest $request): RedirectResponse
    {
        $values = $request->validated();
        // The company name and tagline are shared by every branch; only an admin changes them.
        if (! $request->user()->canAccessAllBranches()) {
            $values = collect($values)->except(Setting::GLOBAL_ONLY)->all();
        }
        Setting::put($values);
        activity('settings')->causedBy($request->user())->withProperties(array_keys($request->validated()))->log('Updated shop settings');

        return back()->with('success', 'Settings saved. Receipts and quotes use them from now on.');
    }

    public function logo(LogoRequest $request): RedirectResponse
    {
        $path = $request->file('logo')->store('branding', 'public');
        Setting::put(['logo_path' => $path]);

        return back()->with('success', 'Logo updated.');
    }

    public function createBackup(BackupService $backups): RedirectResponse
    {
        abort_unless(auth()->user()->canAccessAllBranches(), 403, 'Backups cover every branch, so only an admin can make them.');
        $name = $backups->create();
        $backups->prune();
        activity('settings')->causedBy(auth()->user())->log('Made a backup');

        return back()->with('success', 'Backup saved as '.basename($name).'.');
    }

    public function downloadBackup(string $name, BackupService $backups): BinaryFileResponse
    {
        abort_unless(auth()->user()->canAccessAllBranches(), 403, 'Backups cover every branch, so only an admin can download them.');
        try {
            $path = $backups->path($name);
        } catch (\RuntimeException) {
            abort(404, 'That backup no longer exists.');
        }
        activity('settings')->causedBy(auth()->user())->withProperties(['file' => $name])->log('Downloaded a backup');

        return response()->download($path, basename($path), ['Content-Type' => 'application/gzip']);
    }

    private function previewNumber(string $format): string
    {
        $code = BranchContext::current()->branch()?->code ?? 'HQ';

        return preg_replace_callback('/\{(#+)\}/', fn ($m) => str_pad('1', strlen($m[1]), '0', STR_PAD_LEFT), Sequence::fill($format, $code));
    }
}
