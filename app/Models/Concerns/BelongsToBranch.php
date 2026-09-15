<?php

namespace App\Models\Concerns;

use App\Models\Branch;
use App\Support\BranchContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/**
 * Rows that belong to one branch. Queries only see the current branch (all branches when
 * none is picked), and new rows are stamped with it.
 *
 * @property int|null $branch_id
 */
trait BelongsToBranch
{
    public static function bootBelongsToBranch(): void
    {
        static::addGlobalScope('branch', function (Builder $query) {
            $branchId = BranchContext::current()->id();
            if ($branchId !== null) {
                $query->where($query->getModel()->qualifyColumn('branch_id'), $branchId);
            }
        });

        static::creating(function (Model $model) {
            if (! $model->getAttribute('branch_id')) {
                $branchId = BranchContext::current()->id();
                if ($branchId === null) {
                    throw new LogicException('Pick a branch before adding '.class_basename($model).' records.');
                }
                $model->setAttribute('branch_id', $branchId);
            }
        });
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class)->withTrashed();
    }

    /** Limit a query to a set of branches; an empty list means every branch. */
    public function scopeInBranches(Builder $query, array $branchIds): Builder
    {
        return $branchIds ? $query->whereIn($this->qualifyColumn('branch_id'), $branchIds) : $query;
    }
}
