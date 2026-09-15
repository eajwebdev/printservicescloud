<?php

namespace Tests;

use App\Models\Branch;
use App\Support\BranchContext;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Work inside one branch: direct model queries in the test see only that branch,
     * and admins signed in during the test have it picked.
     */
    protected function useBranch(string $code = 'KAB'): Branch
    {
        $branch = Branch::query()->where('code', $code)->firstOrFail();
        BranchContext::current()->set($branch->id);
        $this->withSession(['branch_id' => $branch->id]);

        return $branch;
    }
}
