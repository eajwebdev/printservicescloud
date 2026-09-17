<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Customer;
use App\Models\InventoryItem;
use App\Models\Product;
use App\Models\Service;
use App\Models\ServiceCategory;
use App\Models\Supplier;
use App\Models\User;
use App\Services\StockService;
use App\Support\BranchContext;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * EAJ Custom Print's price list: full sublimation, DTF, shirts, tarpaulin, signages, stickers,
 * logo work, decals, laser cutting and 3D/CAD/blueprint. Every branch starts with the same list.
 */
class CatalogSeeder extends Seeder
{
    public const CATEGORIES = [
        'Full Sublimation', 'DTF Printing', 'Shirts & Apparel', 'Tarpaulin', 'Signages', 'Stickers & Decals',
        'Logo & Layout', 'Laser Cutting', '3D / CAD / Blueprint',
    ];

    /** Every branch gets the same starting price list, materials and regular customers. */
    public function run(StockService $stock): void
    {
        foreach (Branch::query()->orderBy('id')->get() as $branch) {
            if (Service::withoutGlobalScope('branch')->where('branch_id', $branch->id)->exists()) {
                continue;
            }
            BranchContext::current()->run($branch->id, fn () => $this->seedBranch($stock));
        }
    }

    private function seedBranch(StockService $stock): void
    {
        Carbon::setTestNow(Carbon::today()->subDays(20)->setTime(9, 0));
        $owner = User::query()->where('is_owner', true)->first();
        auth()->setUser($owner);

        $suppliers = collect([
            ['name' => 'Negros Print Supply', 'contact_person' => 'Mark Villaflor', 'phone' => '0917 555 0210', 'address' => 'Lacson St., Bacolod City', 'terms' => '30 days'],
            ['name' => 'Visayas Sign Materials', 'contact_person' => 'Grace Lim', 'phone' => '0922 555 0348', 'address' => 'Mandaue City, Cebu', 'terms' => 'COD'],
            ['name' => 'InkPro Philippines', 'contact_person' => 'Liza Ramos', 'phone' => '0998 555 0456', 'address' => 'Quezon City', 'terms' => 'Prepaid'],
            ['name' => 'Cebu Apparel & Fabric Hub', 'contact_person' => 'Dennis Tan', 'phone' => '032 555 0181', 'address' => 'Colon St., Cebu City', 'terms' => '15 days'],
            ['name' => 'Metro Acrylic & Wood', 'contact_person' => 'Joel Sy', 'phone' => '0917 555 0612', 'address' => 'Mandaue City, Cebu', 'terms' => 'COD'],
        ])->mapWithKeys(fn ($s) => [$s['name'] => Supplier::query()->create($s)]);

        // name => [sku, category, unit, opening stock, cost, reorder, supplier]
        $materials = [
            'Tarpaulin 13oz (Korean)' => ['TARP-13', 'Tarpaulin', 'sqft', 1800, 4.50, 400, 'Visayas Sign Materials'],
            'Tarpaulin 10oz (budget)' => ['TARP-10', 'Tarpaulin', 'sqft', 900, 3.20, 300, 'Visayas Sign Materials'],
            'Eco-solvent ink, CMYK' => ['INK-ECO', 'Ink', 'ml', 4500, 1.60, 1000, 'InkPro Philippines'],
            'Plotter ink, blueprint' => ['INK-PLT', 'Ink', 'ml', 2000, 0.90, 500, 'InkPro Philippines'],
            'Sublimation ink, CMYK' => ['INK-SUB', 'Ink', 'ml', 3000, 1.20, 800, 'InkPro Philippines'],
            'DTF ink, CMYK + white' => ['INK-DTF', 'Ink', 'ml', 3000, 1.80, 800, 'InkPro Philippines'],
            'Sublimation paper roll' => ['SUB-PPR', 'Sublimation', 'sqft', 1500, 1.80, 400, 'InkPro Philippines'],
            'Polyester jersey fabric' => ['FAB-POLY', 'Sublimation', 'm', 400, 95.00, 100, 'Cebu Apparel & Fabric Hub'],
            'Sublimation mug 11oz, blank' => ['MUG-11', 'Sublimation', 'pc', 60, 55.00, 24, 'Negros Print Supply'],
            'DTF film roll' => ['DTF-FILM', 'DTF', 'sqft', 800, 6.00, 200, 'InkPro Philippines'],
            'DTF hot-melt powder' => ['DTF-PWD', 'DTF', 'g', 10000, 0.35, 2000, 'InkPro Philippines'],
            'Cotton shirt, blank' => ['SHIRT-CTN', 'Apparel', 'pc', 150, 120.00, 40, 'Cebu Apparel & Fabric Hub'],
            'Dri-fit shirt, blank' => ['SHIRT-DRI', 'Apparel', 'pc', 120, 110.00, 40, 'Cebu Apparel & Fabric Hub'],
            'Vinyl sticker, glossy' => ['VNL-GLS', 'Vinyl', 'sqft', 420, 9.00, 100, 'Visayas Sign Materials'],
            'Clear vinyl sticker' => ['VNL-CLR', 'Vinyl', 'sqft', 180, 11.00, 60, 'Visayas Sign Materials'],
            'Cut vinyl, Oracal' => ['VNL-CUT', 'Vinyl', 'sqft', 300, 14.00, 80, 'Visayas Sign Materials'],
            'Reflective vinyl' => ['VNL-REF', 'Vinyl', 'sqft', 120, 22.00, 40, 'Visayas Sign Materials'],
            'Heat transfer vinyl' => ['VNL-HTV', 'Vinyl', 'sqft', 150, 18.00, 40, 'Visayas Sign Materials'],
            'Lamination film, A4' => ['LAM-A4', 'Lamination', 'pc', 60, 3.50, 100, 'Negros Print Supply'],
            'Sintra board 3mm' => ['SNT-3', 'Boards', 'sqft', 160, 18.00, 64, 'Metro Acrylic & Wood'],
            'Acrylic sheet 3mm, clear' => ['ACR-3', 'Boards', 'sqft', 96, 65.00, 24, 'Metro Acrylic & Wood'],
            'Marine plywood 1/4 in' => ['PLY-6', 'Boards', 'sqft', 128, 12.00, 32, 'Metro Acrylic & Wood'],
            'Engineering bond, 36 in roll' => ['ENG-36', 'Blueprint', 'sqft', 1500, 1.50, 300, 'Negros Print Supply'],
            'PLA filament' => ['PLA', '3D printing', 'g', 5000, 1.40, 1000, 'Metro Acrylic & Wood'],
            'Eyelets / grommets' => ['EYE-10', 'Hardware', 'pc', 2000, 0.35, 500, 'Visayas Sign Materials'],
            'Double-sided tape' => ['TAPE-DS', 'Hardware', 'roll', 12, 35.00, 5, 'Negros Print Supply'],
        ];

        $items = [];
        foreach ($materials as $name => [$sku, $category, $unit, $opening, $cost, $reorder, $supplier]) {
            $item = InventoryItem::query()->create([
                'name' => $name, 'sku' => $sku, 'category' => $category, 'unit' => $unit, 'cost' => $cost,
                'reorder_level' => $reorder, 'supplier_id' => $suppliers[$supplier]->id, 'active' => true,
            ]);
            $stock->move($item, $opening, 'in', ['reason' => 'opening_stock', 'ref' => 'Opening stock', 'unit_cost' => $cost, 'user_id' => $owner->id]);
            $items[$sku] = $item;
        }

        $categories = collect(self::CATEGORIES)->mapWithKeys(fn ($n, $i) => [$n => ServiceCategory::query()->create(['name' => $n, 'sort' => $i])]);

        // [category, name, code, pricing model, price, cost, min charge, unit, job?, lead hours, options, recipe, tiers]
        $services = [
            // Full sublimation
            ['Full Sublimation', 'Full sublimation jersey, shirt', 'SUBJ', 'tiered', 450, 0, 0, 'pc', true, 72, [
                ['Name & number', 'per_piece', 50], ['Polo or V-neck collar', 'per_piece', 60], ['Matching shorts', 'per_piece', 280],
            ], [['FAB-POLY', 1.2, 'per_piece'], ['SUB-PPR', 12, 'per_piece'], ['INK-SUB', 6, 'per_piece']], [[1, 450], [10, 400], [30, 360]]],
            ['Full Sublimation', 'Full sublimation polo shirt', 'SUBP', 'tiered', 550, 0, 0, 'pc', true, 72, [
                ['Embroidered logo patch', 'per_piece', 80],
            ], [['FAB-POLY', 1.4, 'per_piece'], ['SUB-PPR', 14, 'per_piece'], ['INK-SUB', 7, 'per_piece']], [[1, 550], [10, 500], [30, 450]]],
            ['Full Sublimation', 'Mug sublimation, 11oz', 'MUG', 'tiered', 180, 0, 0, 'pc', true, 48, [
                ['Gift box', 'per_piece', 25],
            ], [['MUG-11', 1, 'per_piece'], ['SUB-PPR', 0.5, 'per_piece'], ['INK-SUB', 0.4, 'per_piece']], [[1, 180], [12, 160], [50, 140]]],
            // DTF
            ['DTF Printing', 'DTF transfer, per sq ft (film only)', 'DTF-SQFT', 'per_sqft', 55, 0, 60, 'sqft', false, 0, [
                ['Rush heat-press service', 'per_sqft', 15],
            ], [['DTF-FILM', 1.05, 'per_sqft'], ['INK-DTF', 2, 'per_sqft'], ['DTF-PWD', 25, 'per_sqft']]],
            ['DTF Printing', 'DTF shirt, A4 front print (shirt included)', 'DTF-SHIRT', 'tiered', 350, 0, 0, 'pc', true, 24, [
                ['Back print, A4', 'per_piece', 150], ['Sleeve print', 'per_piece', 60],
            ], [['SHIRT-CTN', 1, 'per_piece'], ['DTF-FILM', 1, 'per_piece'], ['INK-DTF', 2, 'per_piece'], ['DTF-PWD', 25, 'per_piece']], [[1, 350], [12, 320], [50, 290]]],
            // Shirts
            ['Shirts & Apparel', 'Custom shirt, heat transfer vinyl', 'SHIRT-HTV', 'per_piece', 280, 0, 0, 'pc', true, 24, [
                ['Back print', 'per_piece', 120], ['Name on back', 'per_piece', 50],
            ], [['SHIRT-CTN', 1, 'per_piece'], ['VNL-HTV', 0.6, 'per_piece']]],
            ['Shirts & Apparel', 'Event dri-fit shirt, sublimated front', 'DRI-EVT', 'tiered', 250, 0, 0, 'pc', true, 48, [
                ['Sublimated back', 'per_piece', 80],
            ], [['SHIRT-DRI', 1, 'per_piece'], ['SUB-PPR', 2, 'per_piece'], ['INK-SUB', 1, 'per_piece']], [[1, 250], [20, 220], [50, 199]]],
            // Tarpaulin
            ['Tarpaulin', 'Tarpaulin print, 13oz', 'TARP', 'per_sqft', 15, 0, 120, 'sqft', true, 24, [
                ['Eyelets (4 corners)', 'per_piece', 20], ['Rope & sticks', 'per_piece', 35], ['Wooden frame', 'per_sqft', 12],
            ], [['TARP-13', 1, 'per_sqft'], ['INK-ECO', 1.2, 'per_sqft'], ['EYE-10', 0, 'per_piece']]],
            ['Tarpaulin', 'Budget tarpaulin, 10oz', 'TARPB', 'per_sqft', 10, 0, 100, 'sqft', true, 24, [
                ['Eyelets (4 corners)', 'per_piece', 20],
            ], [['TARP-10', 1, 'per_sqft'], ['INK-ECO', 1.1, 'per_sqft']]],
            // Signages
            ['Signages', 'Sintra board signage, 3mm', 'SINTRA', 'per_sqft', 65, 0, 300, 'sqft', true, 48, [
                ['Aluminum frame', 'per_sqft', 45], ['Mounting tape', 'flat', 50],
            ], [['SNT-3', 1, 'per_sqft'], ['VNL-GLS', 1, 'per_sqft'], ['INK-ECO', 1, 'per_sqft']]],
            ['Signages', 'Acrylic signage, laser-cut letters', 'ACR-SIGN', 'per_sqft', 180, 0, 800, 'sqft', true, 72, [
                ['LED backlight', 'per_sqft', 120], ['Stand-off bolts', 'flat', 250], ['Installation', 'flat', 500],
            ], [['ACR-3', 1.1, 'per_sqft'], ['VNL-CUT', 0.5, 'per_sqft']]],
            // Stickers & decals
            ['Stickers & Decals', 'Vinyl sticker, die-cut', 'VINYL', 'per_sqft', 45, 0, 60, 'sqft', true, 24, [
                ['Matte lamination', 'per_sqft', 10], ['Contour cutting', 'percent', 15],
            ], [['VNL-GLS', 1.1, 'per_sqft'], ['INK-ECO', 1, 'per_sqft']]],
            ['Stickers & Decals', 'Clear sticker, die-cut', 'CLEAR', 'per_sqft', 55, 0, 80, 'sqft', true, 24, [
                ['Contour cutting', 'percent', 15],
            ], [['VNL-CLR', 1.1, 'per_sqft'], ['INK-ECO', 1, 'per_sqft']]],
            ['Stickers & Decals', 'Vehicle decal, cut vinyl', 'DECAL', 'per_sqft', 85, 0, 250, 'sqft', true, 24, [
                ['Reflective vinyl', 'per_sqft', 40], ['Installation', 'flat', 300],
            ], [['VNL-CUT', 1.1, 'per_sqft']]],
            ['Stickers & Decals', 'Sticker lamination, A4 sheet', 'LAM-A4', 'per_piece', 40, 0, 0, 'sheet', false, 0, [], [['LAM-A4', 1, 'per_piece']]],
            // Logo & layout
            ['Logo & Layout', 'Logo design, 3 concepts', 'LOGO', 'fixed', 1500, 0, 0, 'job', true, 72, [
                ['Brand guide PDF', 'flat', 1000], ['Extra revision', 'flat', 300],
            ], []],
            ['Logo & Layout', 'Logo vectorizing / redraw', 'VECTOR', 'fixed', 350, 0, 0, 'job', true, 24, [], []],
            ['Logo & Layout', 'Layout & design, simple', 'LAYOUT-S', 'fixed', 150, 0, 0, 'job', false, 0, [], []],
            ['Logo & Layout', 'Layout & design, full', 'LAYOUT-F', 'fixed', 500, 0, 0, 'job', true, 24, [
                ['Extra revision', 'flat', 100],
            ], []],
            // Laser cutting
            ['Laser Cutting', 'Laser cutting, acrylic 3mm', 'LASER-ACR', 'per_sqft', 150, 0, 200, 'sqft', true, 24, [
                ['Engraving', 'per_sqft', 50],
            ], [['ACR-3', 1.15, 'per_sqft']]],
            ['Laser Cutting', 'Laser cutting & engraving, plywood', 'LASER-WOOD', 'per_sqft', 90, 0, 150, 'sqft', true, 24, [], [['PLY-6', 1.15, 'per_sqft']]],
            ['Laser Cutting', 'Acrylic keychain, custom shape', 'KEYCHAIN', 'tiered', 45, 0, 0, 'pc', true, 48, [
                ['Printed both sides', 'per_piece', 10],
            ], [['ACR-3', 0.03, 'per_piece']], [[1, 45], [50, 35], [100, 28]]],
            // 3D / CAD / blueprint
            ['3D / CAD / Blueprint', 'Blueprint / plan printing, 24x36 in', 'BLUEPRINT', 'tiered', 120, 0, 0, 'sheet', false, 0, [], [['ENG-36', 6, 'per_piece'], ['INK-PLT', 3, 'per_piece']], [[1, 120], [10, 100], [30, 85]]],
            ['3D / CAD / Blueprint', 'CAD drafting, floor plan', 'CAD', 'fixed', 2500, 0, 0, 'job', true, 120, [
                ['Revision', 'flat', 500], ['3D render view', 'flat', 1500],
            ], []],
            ['3D / CAD / Blueprint', '3D printing, PLA (per gram)', '3DPRINT', 'per_piece', 8, 0, 0, 'g', true, 48, [
                ['Sanding & primer', 'percent', 30],
            ], [['PLA', 1.1, 'per_piece']]],
            ['3D / CAD / Blueprint', '3D modeling, simple part', '3DMODEL', 'fixed', 1200, 0, 0, 'job', true, 72, [], []],
        ];

        foreach ($services as $row) {
            [$cat, $name, $code, $model, $price, $cost, $min, $unit, $isJob, $lead, $options, $bom] = $row;
            $service = Service::query()->create([
                'service_category_id' => $categories[$cat]->id, 'name' => $name, 'code' => $code, 'pricing_model' => $model,
                'base_price' => $price, 'cost' => $cost, 'min_charge' => $min, 'unit_label' => $unit, 'is_job' => $isJob,
                'lead_time_hours' => $lead, 'active' => true,
                'tiers' => isset($row[12]) ? collect($row[12])->map(fn ($t) => ['min_qty' => $t[0], 'price' => $t[1]])->all() : null,
            ]);
            foreach ($options as $i => [$oName, $oType, $oPrice]) {
                $service->options()->create(['name' => $oName, 'price_type' => $oType, 'price' => $oPrice, 'sort' => $i]);
            }
            foreach ($bom as [$sku, $qty, $basis]) {
                if ($qty > 0) {
                    $service->materials()->create(['inventory_item_id' => $items[$sku]->id, 'qty_per_unit' => $qty, 'basis' => $basis]);
                }
            }
        }

        // Ready-made items sold over the counter.
        // name => [sku, barcode, category, price, cost, stock, reorder, supplier]
        $products = [
            'EAJ logo sticker, 2 in' => ['STK-LOGO', '4800016640017', 'Stickers', 12, 5, 90, 24, 'Negros Print Supply'],
            'Dri-fit shirt, sublimation-ready' => ['SHR-DRI', '4800016640024', 'Apparel', 160, 110, 10, 4, 'Cebu Apparel & Fabric Hub'],
            'Cotton shirt, white' => ['SHR-CTN', '4800016640031', 'Apparel', 180, 120, 40, 10, 'Cebu Apparel & Fabric Hub'],
            'Sublimation mug, blank 11oz' => ['MUG-BLK', '4800016640048', 'Blanks', 95, 55, 24, 10, 'Negros Print Supply'],
            'Sublimation tumbler 20oz, blank' => ['TMB-20', '4800016640055', 'Blanks', 280, 180, 12, 6, 'Negros Print Supply'],
            'Acrylic keychain blank' => ['KEY-BLK', '4800016640062', 'Blanks', 25, 12, 60, 20, 'Metro Acrylic & Wood'],
            'Sublimation lanyard' => ['LANY-SUB', '4800016640079', 'Blanks', 45, 22, 50, 15, 'Negros Print Supply'],
            'Trucker cap, blank' => ['CAP-TRK', '4800016640086', 'Apparel', 150, 90, 20, 6, 'Cebu Apparel & Fabric Hub'],
            'Motorcycle decal set, ready-made' => ['DECAL-MC', '4800016640093', 'Decals', 350, 150, 8, 3, 'Visayas Sign Materials'],
            'Transfer tape, 12 in roll' => ['TAPE-TR', '4800016640109', 'Supplies', 180, 110, 6, 10, 'Visayas Sign Materials'],
        ];

        foreach ($products as $name => [$sku, $barcode, $category, $price, $cost, $opening, $reorder, $supplier]) {
            $product = Product::query()->create([
                'name' => $name, 'sku' => $sku, 'barcode' => $barcode, 'category' => $category, 'price' => $price,
                'cost' => $cost, 'reorder_level' => $reorder, 'supplier_id' => $suppliers[$supplier]->id, 'active' => true,
            ]);
            $stock->move($product, $opening, 'in', ['reason' => 'opening_stock', 'ref' => 'Opening stock', 'unit_cost' => $cost, 'user_id' => $owner->id]);
        }

        // A raw material sold by the square foot: its stock is the inventory item's stock.
        Product::query()->create([
            'name' => 'Vinyl sticker, uncut per sq ft', 'sku' => 'RES-VNL', 'category' => 'Stickers', 'price' => 25, 'cost' => 9,
            'reorder_level' => 0, 'supplier_id' => $suppliers['Visayas Sign Materials']->id, 'inventory_item_id' => $items['VNL-GLS']->id, 'active' => true,
        ]);

        $customers = [
            ['name' => 'Maria Lourdes Villanueva', 'phone' => '0917 555 1123'],
            ['name' => 'JM Bakeshop', 'business_name' => 'JM Bakeshop & Cafe', 'phone' => '0928 555 4410', 'credit_limit' => 5000],
            ['name' => 'Riverside NHS, SSG', 'business_name' => 'Riverside National High School', 'phone' => '034 555 2231', 'credit_limit' => 30000],
            ['name' => 'Rodel Dela Cruz', 'phone' => '0995 555 7812'],
            ['name' => 'Negros Riders Club', 'business_name' => 'Negros Riders Motorcycle Club', 'phone' => '0917 555 6630', 'credit_limit' => 8000],
            ['name' => 'Espinosa Construction', 'business_name' => 'Espinosa Builders & Design', 'phone' => '0918 555 3309', 'email' => 'espinosa.builders@example.test', 'credit_limit' => 15000],
            ['name' => 'Ana Mae Gonzaga', 'phone' => '0921 555 9054'],
            ['name' => 'Ballers United Basketball League', 'phone' => '0936 555 2147', 'credit_limit' => 12000],
            ['name' => 'Brgy. Tampalon Council', 'business_name' => 'Barangay Tampalon', 'phone' => '0917 555 8021', 'credit_limit' => 15000],
            ['name' => 'Lola Nena Santos', 'phone' => '0909 555 3380', 'is_senior_pwd' => true],
            ['name' => 'Kyle Tolentino', 'phone' => '0966 555 1275'],
            ['name' => 'Kape Negrense', 'business_name' => 'Kape Negrense Coffee Bar', 'phone' => '034 555 7710', 'credit_limit' => 6000],
        ];
        foreach ($customers as $c) {
            Customer::query()->create($c);
        }

        Carbon::setTestNow();
    }
}
