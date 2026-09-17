<?php

namespace App\Http\Controllers\Platform;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Support\Brand;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Superadmin: the system name, logo, colors and every line of the public website, to dress the install for any shop. */
class BrandingController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Platform/Branding', [
            'identity' => [
                'business_name' => Brand::name(),
                'brand_short' => Brand::shortName(),
                'tagline' => Brand::tagline(),
                'brand_color' => Brand::color(),
            ],
            'site' => Brand::site(),
            'defaults' => ['site' => Brand::SITE, 'color' => Brand::COLOR],
            'logoUrl' => Brand::logoUrl(),
            'faviconUrl' => Brand::faviconUrl(),
            'customLogo' => (bool) Setting::global('logo_path'),
            'customFavicon' => (bool) Setting::global('favicon_path'),
            'artOptions' => Brand::ART,
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $line = ['nullable', 'string', 'max:160'];
        $para = ['nullable', 'string', 'max:600'];
        $data = $request->validate([
            'business_name' => ['required', 'string', 'max:120'],
            'brand_short' => ['required', 'string', 'max:20'],
            'tagline' => ['nullable', 'string', 'max:160'],
            'brand_color' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'site' => ['required', 'array'],
            'site.meta_title' => $line,
            'site.meta_description' => $para,
            'site.hero_eyebrow' => $line,
            'site.hero_line_1' => ['required', 'string', 'max:40'],
            'site.hero_line_2' => ['nullable', 'string', 'max:40'],
            'site.hero_sub' => $line,
            'site.hero_body' => $para,
            'site.hero_cta' => ['nullable', 'string', 'max:40'],
            'site.region' => ['nullable', 'string', 'max:60'],
            'site.services_title_1' => $line,
            'site.services_title_2' => $line,
            'site.services_intro' => $para,
            'site.services' => ['required', 'array', 'min:1', 'max:16'],
            'site.services.*.title' => ['required', 'string', 'max:60'],
            'site.services.*.body' => ['nullable', 'string', 'max:300'],
            'site.services.*.tags' => ['nullable', 'array', 'max:6'],
            'site.services.*.tags.*' => ['nullable', 'string', 'max:30'],
            'site.services.*.art' => ['required', Rule::in(Brand::ART)],
            'site.process_title_1' => $line,
            'site.process_title_2' => $line,
            'site.steps' => ['required', 'array', 'size:4'],
            'site.steps.*.title' => ['required', 'string', 'max:40'],
            'site.steps.*.body' => ['nullable', 'string', 'max:300'],
            'site.steps.*.tag' => ['nullable', 'string', 'max:16'],
            'site.ticket_title' => $line,
            'site.ticket_note' => $line,
            'site.branches_title_1' => $line,
            'site.branches_title_2' => $line,
            'site.branches_body' => $para,
            'site.show_map' => ['boolean'],
            'site.highlights' => ['required', 'array', 'size:4'],
            'site.highlights.*.big' => ['required', 'string', 'max:14'],
            'site.highlights.*.label' => ['required', 'string', 'max:40'],
            'site.highlights.*.body' => ['nullable', 'string', 'max:200'],
            'site.closing_eyebrow' => $line,
            'site.closing_line_1' => $line,
            'site.closing_line_2' => $line,
            'site.closing_outline' => ['nullable', 'string', 'max:30'],
            'site.footer_blurb' => $para,
            'site.login_body' => $para,
        ], [
            'brand_color.regex' => 'Pick a color like #E4141B.',
            'site.steps.size' => 'The order steps board has exactly four steps.',
            'site.highlights.size' => 'The highlights strip has exactly four items.',
        ]);

        $site = collect($data['site'])->only(array_keys(Brand::SITE))->map(fn ($v) => $v ?? '')->all();
        $site['show_map'] = $request->boolean('site.show_map');
        $site['services'] = collect($data['site']['services'])->map(fn ($s) => [
            'title' => $s['title'],
            'body' => $s['body'] ?? '',
            'tags' => array_values(array_filter(array_map(fn ($tag) => trim((string) $tag), $s['tags'] ?? []))),
            'art' => $s['art'],
        ])->values()->all();
        $site['steps'] = collect($data['site']['steps'])->map(fn ($s) => ['title' => $s['title'], 'body' => $s['body'] ?? '', 'tag' => $s['tag'] ?? ''])->values()->all();
        $site['highlights'] = collect($data['site']['highlights'])->map(fn ($h) => ['big' => $h['big'], 'label' => $h['label'], 'body' => $h['body'] ?? ''])->values()->all();

        Setting::putGlobal([
            'business_name' => $data['business_name'],
            'brand_short' => $data['brand_short'],
            'tagline' => $data['tagline'] ?? '',
            'brand_color' => strtoupper($data['brand_color']),
            'site' => $site,
        ]);
        activity('settings')->causedBy($request->user())->withProperties(['business_name' => $data['business_name']])->log('Updated branding and website');

        return back()->with('success', 'Branding saved. The website, sign-in page and printouts use it now.');
    }

    /** Upload a new logo or favicon, or remove it to go back to the built-in one. */
    public function image(Request $request, string $kind): RedirectResponse
    {
        abort_unless(in_array($kind, ['logo', 'favicon'], true), 404);
        $key = $kind.'_path';

        if ($request->isMethod('delete')) {
            $this->forget($key);
            activity('settings')->causedBy($request->user())->log("Restored the default {$kind}");

            return back()->with('success', $kind === 'logo' ? 'Back to the built-in logo.' : 'Back to the built-in browser icon.');
        }

        $request->validate([
            'file' => $kind === 'logo'
                ? ['required', 'image', 'mimes:jpg,jpeg,png,webp']
                : ['required', 'file', 'mimes:png,ico,jpg,jpeg,webp'],
        ], ['file.required' => 'Choose an image.']);

        $this->forget($key);
        $path = $request->file('file')->store('branding', 'public');
        Setting::putGlobal([$key => $path]);
        // Logos uploaded per branch before branding went company-wide would otherwise linger unused.
        Setting::query()->where('key', $key)->whereNotNull('branch_id')->delete();
        Setting::flush();
        activity('settings')->causedBy($request->user())->log("Uploaded a new {$kind}");

        return back()->with('success', $kind === 'logo' ? 'Logo updated everywhere.' : 'Browser icon updated.');
    }

    /** Put the website text back to the built-in copy. The name, logo and color stay. */
    public function reset(Request $request): RedirectResponse
    {
        Setting::putGlobal(['site' => null]);
        activity('settings')->causedBy($request->user())->log('Restored the default website text');

        return back()->with('success', 'Website text restored to the defaults.');
    }

    private function forget(string $key): void
    {
        $old = Setting::global($key);
        if (is_string($old) && $old !== '') {
            Storage::disk('public')->delete($old);
        }
        Setting::putGlobal([$key => null]);
    }
}
