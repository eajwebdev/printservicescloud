<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\User;
use App\Support\Brand;
use Database\Seeders\AccessSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** The superadmin can rename and re-dress the whole system, and every surface picks it up. */
class BrandingTest extends TestCase
{
    use RefreshDatabase;

    private User $superadmin;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([AccessSeeder::class, SettingsSeeder::class]);
        $this->app['auth']->forgetGuards();
        $this->superadmin = User::query()->where('is_superadmin', true)->firstOrFail();
        $this->admin = User::query()->where('email', 'admin')->firstOrFail();
    }

    private function payload(array $identity = [], array $site = []): array
    {
        return [
            'business_name' => 'Lumen Print Co.',
            'brand_short' => 'Lumen',
            'tagline' => 'Bright prints, fast.',
            'brand_color' => '#1f6feb',
            ...$identity,
            'site' => array_replace(Brand::SITE, [
                'hero_line_1' => 'Print it',
                'region' => 'Cebu',
                'services' => [
                    ['title' => 'Mugs', 'body' => 'Photo mugs.', 'tags' => [' Gifts ', '', 'Photo'], 'art' => 'sublimation'],
                    ['title' => 'Signs', 'body' => '', 'tags' => [], 'art' => 'sign'],
                ],
                'show_map' => false,
            ], $site),
        ];
    }

    public function test_only_the_superadmin_opens_branding(): void
    {
        $this->actingAs($this->superadmin)->get(route('platform.branding.index'))->assertOk()
            ->assertInertia(fn ($p) => $p->component('Platform/Branding')->where('identity.business_name', 'EAJ Custom Print')->has('site.services', 10));

        $this->actingAs($this->admin)->get(route('platform.branding.index'))->assertForbidden();
        $this->actingAs($this->admin)->put(route('platform.branding.update'), $this->payload())->assertForbidden();
        $this->assertSame('EAJ Custom Print', Brand::name());
    }

    public function test_saved_branding_reaches_the_website_sign_in_and_app(): void
    {
        $this->actingAs($this->superadmin)->put(route('platform.branding.update'), $this->payload())->assertSessionHasNoErrors();

        $this->assertSame('Lumen Print Co.', Brand::name());
        $this->assertSame('#1F6FEB', Brand::color());

        $this->app['auth']->forgetGuards();
        $this->get(route('home'))->assertOk()
            ->assertSee('--brand: #1F6FEB', false)
            ->assertSee('<title inertia>Lumen Print Co.</title>', false)
            ->assertInertia(fn ($p) => $p
                ->component('Landing')
                ->where('shop.name', 'Lumen Print Co.')
                ->where('shop.short_name', 'Lumen')
                ->where('site.hero_line_1', 'Print it')
                ->where('site.region', 'Cebu')
                ->where('site.show_map', false)
                ->has('site.services', 2)
                ->where('site.services.0.tags', ['Gifts', 'Photo'])
                // Fields left out keep their defaults.
                ->where('site.closing_eyebrow', Brand::SITE['closing_eyebrow']));

        $this->get(route('login'))->assertOk()->assertInertia(fn ($p) => $p->where('shop.tagline', 'Bright prints, fast.')->where('loginBody', Brand::SITE['login_body']));
    }

    public function test_bad_branding_is_rejected(): void
    {
        $this->actingAs($this->superadmin)->put(route('platform.branding.update'), $this->payload(['brand_color' => 'red'], [
            'steps' => [['title' => 'Only one', 'body' => '', 'tag' => '']],
            'services' => [['title' => 'X', 'art' => 'rocket']],
        ]))->assertSessionHasErrors(['brand_color', 'site.steps', 'site.services.0.art']);

        $this->assertSame(Brand::COLOR, Brand::color());
    }

    public function test_logo_and_favicon_upload_and_restore(): void
    {
        Storage::fake('public');

        $this->actingAs($this->superadmin)->post(route('platform.branding.image', 'logo'), ['file' => UploadedFile::fake()->image('large-logo.png')->size(4097)])->assertSessionHasNoErrors();
        $this->actingAs($this->superadmin)->post(route('platform.branding.image', 'favicon'), ['file' => UploadedFile::fake()->image('large-icon.png')->size(1025)])->assertSessionHasNoErrors();

        $this->actingAs($this->superadmin)->post(route('platform.branding.image', 'logo'), ['file' => UploadedFile::fake()->image('logo.png', 400, 200)])->assertSessionHasNoErrors();
        $path = Setting::global('logo_path');
        Storage::disk('public')->assertExists($path);
        $this->assertStringContainsString('storage/'.$path, Brand::logoUrl());

        $this->actingAs($this->superadmin)->post(route('platform.branding.image', 'favicon'), ['file' => UploadedFile::fake()->image('icon.png', 64, 64)])->assertSessionHasNoErrors();
        $this->assertStringContainsString('storage/branding/', Brand::faviconUrl());

        $this->actingAs($this->superadmin)->post(route('platform.branding.image', 'logo'), ['file' => UploadedFile::fake()->create('logo.pdf', 10, 'application/pdf')])->assertSessionHasErrors('file');

        $this->actingAs($this->superadmin)->delete(route('platform.branding.image', 'logo'))->assertSessionHasNoErrors();
        Storage::disk('public')->assertMissing($path);
        $this->assertSame(asset('eajlogo.svg'), Brand::logoUrl());

        $this->actingAs($this->admin)->post(route('platform.branding.image', 'logo'), ['file' => UploadedFile::fake()->image('logo.png')])->assertForbidden();
    }

    public function test_reset_restores_the_default_website_text_only(): void
    {
        $this->actingAs($this->superadmin)->put(route('platform.branding.update'), $this->payload());
        $this->actingAs($this->superadmin)->post(route('platform.branding.reset'))->assertSessionHasNoErrors();

        $this->assertSame(Brand::SITE, Brand::site());
        $this->assertSame('Lumen Print Co.', Brand::name());
    }

    public function test_branch_settings_no_longer_change_the_company_name(): void
    {
        $this->useBranch('KAB');
        $values = collect(Setting::allValues())->only(array_keys(\App\Http\Controllers\SettingsController::DEFAULTS))->all();

        $this->actingAs($this->admin)->put(route('settings.update'), [
            ...\App\Http\Controllers\SettingsController::DEFAULTS,
            ...$values,
            'business_name' => 'Hijacked',
        ])->assertSessionHasNoErrors();

        $this->assertSame('EAJ Custom Print', Brand::name());
    }
}
