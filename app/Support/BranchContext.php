<?php

namespace App\Support;

use App\Models\Branch;

/**
 * The branch the current request (or console task) works in.
 *
 * Branch staff are always pinned to their own branch. Admins and the superadmin pick a
 * branch, or leave it empty to read across every branch at once. Every branch-owned model
 * filters on this through the BelongsToBranch scope, so a branch never sees another's data.
 */
class BranchContext
{
    private ?int $id = null;

    private ?Branch $branch = null;

    public static function current(): self
    {
        return app(self::class);
    }

    /** The selected branch id, or null for "all branches". */
    public function id(): ?int
    {
        return $this->id;
    }

    public function isAll(): bool
    {
        return $this->id === null;
    }

    public function branch(): ?Branch
    {
        if ($this->id === null) {
            return null;
        }
        if ($this->branch?->id !== $this->id) {
            $this->branch = Branch::withTrashed()->find($this->id);
        }

        return $this->branch;
    }

    public function set(?int $id): void
    {
        $this->id = $id ?: null;
        if ($this->branch?->id !== $this->id) {
            $this->branch = null;
        }
    }

    /**
     * Run a callback inside a branch (or across all branches with null), then put the old one back.
     *
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public function run(?int $id, callable $callback): mixed
    {
        $previous = $this->id;
        $this->set($id);
        try {
            return $callback();
        } finally {
            $this->set($previous);
        }
    }
}
