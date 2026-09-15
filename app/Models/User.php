<?php

namespace App\Models;

use App\Support\Access;
use App\Support\ActivityText;
use App\Support\BranchContext;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, LogsActivity, Notifiable;

    protected $fillable = ['branch_id', 'name', 'email', 'phone', 'password', 'is_owner', 'is_superadmin', 'active', 'last_login_at'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'is_owner' => 'boolean',
            'is_superadmin' => 'boolean',
            'active' => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logOnly(['name', 'email', 'active', 'branch_id', 'is_owner'])->logOnlyDirty()->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn (string $event) => ActivityText::event($event, $this));
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class)->withTrashed();
    }

    /** Admins (owner accounts) and the superadmin work across every branch; everyone else is pinned to one. */
    public function canAccessAllBranches(): bool
    {
        return $this->is_superadmin || $this->is_owner;
    }

    public function canAccessBranch(?int $branchId): bool
    {
        return $this->canAccessAllBranches() || ($branchId !== null && $this->branch_id === $branchId);
    }

    /** People who can be picked for work in the current branch: its staff plus the all-branch admins. */
    public function scopeWorkingHere(Builder $query): Builder
    {
        $branchId = BranchContext::current()->id();

        return $query->where('is_superadmin', false)
            ->when($branchId, fn ($q) => $q->where(fn ($w) => $w->where('branch_id', $branchId)->orWhere('is_owner', true)));
    }

    /** "Superadmin", "Admin", or the role label from the checkboxes. */
    public function roleLabel(): string
    {
        if ($this->is_superadmin) {
            return 'Superadmin';
        }

        return $this->getRoleNames()->first() ?? ($this->is_owner ? 'Admin' : 'Staff');
    }

    public function cashierSessions(): HasMany
    {
        return $this->hasMany(CashierSession::class);
    }

    public function openSession(): HasOne
    {
        return $this->hasOne(CashierSession::class)->where('status', 'open')->latestOfMany('opened_at');
    }

    /** Page keys this user may open, e.g. ['pos', 'orders']. */
    public function pageKeys(): array
    {
        return collect(Access::pages())
            ->keys()
            ->filter(fn (string $page) => $this->can("{$page}.view"))
            ->values()
            ->all();
    }

    /** Every permission name this user holds (the owner holds all of them). */
    public function permissionNames(): array
    {
        if ($this->canAccessAllBranches()) {
            return Access::allPermissionNames();
        }

        return $this->getAllPermissions()->pluck('name')->values()->all();
    }
}
