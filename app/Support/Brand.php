<?php

namespace App\Support;

use App\Models\Setting;
use Throwable;

/**
 * The system's identity and public website copy, all editable by the superadmin under
 * Platform > Branding & website, so the same install can be dressed for any print shop.
 *
 * Text fields accept tokens, filled in on the page: {brand} {short} {region} {branches}
 * {branch_list} {services} {year}. Wrap words in *asterisks* to print them in the brand color.
 */
class Brand
{
    public const COLOR = '#E4141B';

    public const SHORT = 'EAJ';

    /** Service illustrations the landing page can draw, by key. */
    public const ART = ['sublimation', 'dtf', 'shirt', 'tarp', 'sign', 'sticker', 'logo', 'decal', 'laser', 'blueprint'];

    public const SITE = [
        'meta_title' => 'Custom sublimation, DTF, signage and laser cutting',
        'meta_description' => '{brand}: full sublimation, DTF, shirts, tarpaulin, signages, stickers, logo, decals, laser cutting and 3D/CAD/blueprint printing in {branch_list}.',
        'hero_eyebrow' => 'Custom print house · {branches} branches across {region}',
        'hero_line_1' => 'From jerseys',
        'hero_line_2' => 'to blueprints.',
        'hero_sub' => 'Printed right, *made to be seen.*',
        'hero_body' => 'Full sublimation, DTF, shirts, tarpaulins, signages, stickers, decals, laser cutting and 3D, CAD and blueprint work. Designed, proofed and produced in-house.',
        'hero_cta' => 'See what we make',
        'region' => 'Negros',
        'services_title_1' => 'Ten ways to',
        'services_title_2' => 'put your name *out there.*',
        'services_intro' => 'One shop floor for fabric, film, vinyl, acrylic, wood and paper. Bring a finished file, a sketch or just the idea.',
        'services' => [
            ['title' => 'Full Sublimation', 'body' => 'Edge-to-edge jerseys, polos and mugs. The color is dyed into the fabric, so it won’t crack or peel.', 'tags' => ['Jerseys', 'Polo shirts', 'Mugs'], 'art' => 'sublimation'],
            ['title' => 'DTF', 'body' => 'Direct-to-film transfers in full color for cotton and blends, sharp even on dark shirts.', 'tags' => ['Transfers', 'Shirt prints'], 'art' => 'dtf'],
            ['title' => 'Shirts', 'body' => 'Team, event and one-off shirts in DTF, sublimation or heat transfer vinyl.', 'tags' => ['Events', 'Uniforms'], 'art' => 'shirt'],
            ['title' => 'Tarpaulin', 'body' => 'From a birthday greeting to a full fiesta street run, finished with eyelets, rope or frames.', 'tags' => ['Banners', 'Backdrops'], 'art' => 'tarp'],
            ['title' => 'Signages', 'body' => 'Sintra boards and laser-cut acrylic signs with LED backlight, built and installed.', 'tags' => ['Acrylic', 'Sintra', 'LED'], 'art' => 'sign'],
            ['title' => 'Stickers', 'body' => 'Die-cut, clear and laminated stickers for products, packaging and labels.', 'tags' => ['Die-cut', 'Labels'], 'art' => 'sticker'],
            ['title' => 'Logo', 'body' => 'New logos and redraws, delivered as clean vectors that print sharp at any size.', 'tags' => ['Design', 'Vector'], 'art' => 'logo'],
            ['title' => 'Decals', 'body' => 'Cut and reflective vinyl for cars, motorcycles, trucks and storefront glass.', 'tags' => ['Vehicles', 'Reflective'], 'art' => 'decal'],
            ['title' => 'Laser Cutting', 'body' => 'Clean cuts and engraving on acrylic and plywood: keychains, plaques and letters.', 'tags' => ['Acrylic', 'Wood', 'Engraving'], 'art' => 'laser'],
            ['title' => '3D / CAD / Blueprint', 'body' => 'Plan and blueprint printing, CAD drafting, 3D modeling and PLA prints.', 'tags' => ['Plans', 'CAD', '3D print'], 'art' => 'blueprint'],
        ],
        'process_title_1' => 'No guesswork',
        'process_title_2' => 'between order and pickup.',
        'steps' => [
            ['title' => 'Brief & quote', 'body' => 'Tell us what you need at any branch. You get an itemized quote before anything is ordered.', 'tag' => 'QUOTED'],
            ['title' => 'Proof approval', 'body' => 'We send the layout for your go-ahead. Nothing goes to print until you approve the proof.', 'tag' => 'PROOF OK'],
            ['title' => 'Production', 'body' => 'Your job gets a ticket and moves through our production board, with a rush lane when time is short.', 'tag' => 'PRINTING'],
            ['title' => 'Ready for pickup', 'body' => 'We text you when it’s done. Collect with your receipt and claim stub, balance settled at the counter.', 'tag' => 'READY'],
        ],
        'ticket_title' => '15× Full sublimation jerseys',
        'ticket_note' => 'Name & number, league set',
        'branches_title_1' => 'Same standard,',
        'branches_title_2' => '*{branches}* shops on {region}.',
        'branches_body' => 'Walk in, send your file, or call ahead. Every branch runs the same price list, the same proofing and the same job tracking.',
        'show_map' => true,
        'highlights' => [
            ['big' => '{services}', 'label' => 'Print disciplines', 'body' => 'Fabric, film, vinyl, acrylic, wood and paper under one roof.'],
            ['big' => '{branches}', 'label' => 'Branches', 'body' => '{branch_list}, on one system.'],
            ['big' => 'Proof', 'label' => 'Before print', 'body' => 'You approve the layout first. No surprises on the finished piece.'],
            ['big' => 'OR', 'label' => 'Every order', 'body' => 'An official receipt and a job ticket you can follow up on.'],
        ],
        'closing_eyebrow' => 'Start a job',
        'closing_line_1' => 'Got a design in mind?',
        'closing_line_2' => 'Bring it to the *nearest {short}.*',
        'closing_outline' => '{short} CUSTOM',
        'footer_blurb' => 'Full sublimation, DTF, shirts, tarpaulin, signages, stickers, logo, decals, laser cutting and 3D/CAD/blueprint.',
        'login_body' => 'Counter sales, job orders, stock and reports for every {brand} branch.',
    ];

    public static function name(): string
    {
        return (string) (Setting::global('business_name') ?: Shop::BRAND);
    }

    /** The short mark, like "EAJ": branch names start with it and the site uses it in headlines. */
    public static function shortName(): string
    {
        return (string) (Setting::global('brand_short') ?: self::SHORT);
    }

    public static function tagline(): string
    {
        return (string) (Setting::global('tagline') ?? Shop::TAGLINE);
    }

    public static function color(): string
    {
        $color = (string) Setting::global('brand_color', self::COLOR);

        return preg_match('/^#[0-9a-fA-F]{6}$/', $color) ? strtoupper($color) : self::COLOR;
    }

    /** Website copy: saved values over the defaults. Lists are replaced whole. */
    public static function site(): array
    {
        $saved = Setting::global('site');

        return array_replace(self::SITE, is_array($saved) ? array_intersect_key($saved, self::SITE) : []);
    }

    /** File path for PDFs (dompdf reads from disk). */
    public static function logoPath(): ?string
    {
        $uploaded = Setting::global('logo_path');
        if ($uploaded && is_file($path = storage_path('app/public/'.$uploaded))) {
            return $path;
        }

        return is_file(public_path(Shop::LOGO)) ? public_path(Shop::LOGO) : null;
    }

    public static function logoUrl(): string
    {
        $uploaded = Setting::global('logo_path');

        return $uploaded ? asset('storage/'.$uploaded) : asset(Shop::LOGO);
    }

    public static function faviconUrl(): string
    {
        $uploaded = Setting::global('favicon_path');

        return $uploaded ? asset('storage/'.$uploaded) : asset('eaj-favicon.svg');
    }

    /** For the HTML shell and print views, which must render even when the database is down. */
    public static function head(): array
    {
        try {
            return ['name' => self::name(), 'color' => self::color(), 'favicon' => self::faviconUrl(), 'logo' => self::logoUrl()];
        } catch (Throwable) {
            return ['name' => Shop::BRAND, 'color' => self::COLOR, 'favicon' => asset('eaj-favicon.svg'), 'logo' => asset(Shop::LOGO)];
        }
    }
}
