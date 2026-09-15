<?php

namespace App\Support;

use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;
use Illuminate\Validation\Rules\Unique;

/** Validation rules that only see the current branch's rows. */
class BranchRules
{
    public static function exists(string $table, string $column = 'id'): Exists
    {
        $rule = Rule::exists($table, $column);
        $branchId = BranchContext::current()->id();

        return $branchId ? $rule->where('branch_id', $branchId) : $rule;
    }

    public static function unique(string $table, string $column): Unique
    {
        return Rule::unique($table, $column)->where('branch_id', BranchContext::current()->id());
    }

    /** Staff who work in this branch, plus the all-branch admins. */
    public static function staff(): Exists
    {
        $branchId = BranchContext::current()->id();

        return Rule::exists('users', 'id')->where(fn ($q) => $branchId
            ? $q->where(fn ($w) => $w->where('branch_id', $branchId)->orWhere('is_owner', true)->orWhere('is_superadmin', true))
            : $q);
    }
}
