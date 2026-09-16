<?php

namespace App\Models;

use App\Support\BranchContext;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;

/**
 * Key/value settings in two layers: company-wide values (branch_id null) and per-branch
 * overrides. Reads fall back from the current branch to the company value to the default.
 */
class Setting extends Model
{
    protected $fillable = ['branch_id', 'key', 'value'];

    protected $casts = ['value' => 'json'];

    public const CACHE_KEY = 'shop.settings';

    /** Keys that are always stored company-wide, never per branch. */
    public const GLOBAL_ONLY = ['business_name', 'tagline', 'brand_short', 'brand_color', 'logo_path', 'favicon_path', 'site'];

    /** Merged values for a branch (company values underneath its overrides). */
    public static function allValues(?int $branchId = null): array
    {
        $branchId ??= BranchContext::current()->id();
        $global = Cache::rememberForever(self::CACHE_KEY.'.global', fn () => static::query()->whereNull('branch_id')->pluck('value', 'key')->all());
        if (! $branchId) {
            return $global;
        }
        $branch = Cache::rememberForever(self::CACHE_KEY.'.branch.'.$branchId, fn () => static::query()->where('branch_id', $branchId)->pluck('value', 'key')->all());

        return array_replace($global, $branch);
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        return static::allValues()[$key] ?? $default;
    }

    /** Company-wide value only, ignoring branch overrides (platform and billing settings). */
    public static function global(string $key, mixed $default = null): mixed
    {
        return static::allValues(0)[$key] ?? $default;
    }

    /** Save to the current branch, or company-wide when no branch is picked. */
    public static function put(array $values, ?int $branchId = null): void
    {
        $branchId ??= BranchContext::current()->id();
        foreach ($values as $key => $value) {
            $scope = in_array($key, self::GLOBAL_ONLY, true) ? null : $branchId;
            static::query()->updateOrCreate(['branch_id' => $scope, 'key' => $key], ['value' => $value]);
        }
        static::flush($branchId);
    }

    public static function putGlobal(array $values): void
    {
        foreach ($values as $key => $value) {
            static::query()->updateOrCreate(['branch_id' => null, 'key' => $key], ['value' => $value]);
        }
        static::flush();
    }

    /** Secrets (API keys) are stored encrypted. */
    public static function putSecret(string $key, ?string $value): void
    {
        static::putGlobal([$key => $value === null || $value === '' ? null : Crypt::encryptString($value)]);
    }

    public static function secret(string $key): ?string
    {
        $raw = static::global($key);
        if (! is_string($raw) || $raw === '') {
            return null;
        }
        try {
            return Crypt::decryptString($raw);
        } catch (\Throwable) {
            return null;
        }
    }

    public static function flush(?int $branchId = null): void
    {
        Cache::forget(self::CACHE_KEY.'.global');
        if ($branchId) {
            Cache::forget(self::CACHE_KEY.'.branch.'.$branchId);
        } else {
            foreach (Branch::withTrashed()->pluck('id') as $id) {
                Cache::forget(self::CACHE_KEY.'.branch.'.$id);
            }
        }
    }
}
