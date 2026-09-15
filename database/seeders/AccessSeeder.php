<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\User;
use App\Support\Access;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class AccessSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(BranchSeeder::class);
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (Access::allPermissionNames() as $name) {
            Permission::findOrCreate($name, 'web');
        }
        foreach (array_keys(Access::roleTemplates()) as $role) {
            Role::findOrCreate($role, 'web');
        }

        // The system provider: subscriptions, free trials and PayMongo. Sees every branch.
        $superadmin = User::query()->updateOrCreate(['email' => 'superadmin@skc.test'], [
            'name' => 'System Provider',
            'phone' => '0917 555 0001',
            'password' => 'password',
            'is_superadmin' => true,
            'is_owner' => false,
            'branch_id' => null,
            'active' => true,
        ]);
        $superadmin->syncRoles(['Admin']);
        $superadmin->syncPermissions(Access::allPermissionNames());

        // SKC's owner: every branch, every page.
        $owner = User::query()->updateOrCreate(['email' => 'admin@skc.test'], [
            'name' => 'SKC Owner',
            'phone' => '0917 555 0101',
            'password' => 'password',
            'is_owner' => true,
            'branch_id' => null,
            'active' => true,
        ]);
        $owner->syncRoles(['Admin']);
        $owner->syncPermissions(Access::allPermissionNames());

        $branches = Branch::query()->pluck('id', 'code');
        $staff = [
            ['email' => 'manager@skc.test', 'name' => 'Carla Ybañez', 'phone' => '0920 555 0133', 'role' => 'Manager', 'branch' => 'KAB'],
            ['email' => 'cashier@skc.test', 'name' => 'Joy Sarmiento', 'phone' => '0918 555 0142', 'role' => 'Cashier', 'branch' => 'KAB'],
            ['email' => 'production@skc.test', 'name' => 'Renz Mabini', 'phone' => '0919 555 0177', 'role' => 'Production', 'branch' => 'KAB'],
            ['email' => 'bacolod.manager@skc.test', 'name' => 'Paolo Lacson', 'phone' => '0917 555 0233', 'role' => 'Manager', 'branch' => 'BCD'],
            ['email' => 'bacolod.cashier@skc.test', 'name' => 'Bea Montelibano', 'phone' => '0917 555 0242', 'role' => 'Cashier', 'branch' => 'BCD'],
            ['email' => 'bacolod.production@skc.test', 'name' => 'Jun Gatuslao', 'phone' => '0917 555 0277', 'role' => 'Production', 'branch' => 'BCD'],
            ['email' => 'dumaguete.manager@skc.test', 'name' => 'Paula Teves', 'phone' => '0917 555 0333', 'role' => 'Manager', 'branch' => 'DGT'],
            ['email' => 'dumaguete.cashier@skc.test', 'name' => 'Rica Tan', 'phone' => '0917 555 0342', 'role' => 'Cashier', 'branch' => 'DGT'],
            ['email' => 'dumaguete.production@skc.test', 'name' => 'Carlo Villegas', 'phone' => '0917 555 0377', 'role' => 'Production', 'branch' => 'DGT'],
        ];

        foreach ($staff as $row) {
            $user = User::query()->updateOrCreate(['email' => $row['email']], [
                'name' => $row['name'],
                'phone' => $row['phone'],
                'password' => 'password',
                'branch_id' => $branches[$row['branch']] ?? null,
                'active' => true,
            ]);
            $user->syncRoles([$row['role']]);
            $user->syncPermissions(Access::roleTemplates()[$row['role']]);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
