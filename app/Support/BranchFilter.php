<?php

namespace App\Support;

use App\Models\Branch;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * Which branches a dashboard or report covers. Inside a branch it is always that branch.
 * On "All branches" an admin can tick any mix of branches; ticking none means every branch.
 */
class BranchFilter
{
    /** @param  array<int, int>  $ids  empty = every branch */
    public function __construct(public readonly array $ids, public readonly bool $locked, public readonly Collection $available) {}

    public static function fromRequest(Request $request): self
    {
        $context = BranchContext::current();
        if ($context->id() !== null) {
            $branch = $context->branch();

            return new self([$context->id()], true, collect([$branch]));
        }

        $available = Branch::query()->orderBy('name')->get(['id', 'name', 'code']);
        $raw = $request->query('branches', []);
        $wanted = collect(is_array($raw) ? $raw : explode(',', (string) $raw))->map(fn ($v) => (int) $v)->filter();
        $ids = $available->pluck('id')->intersect($wanted)->values()->all();

        // Ticking every branch is the same as all branches.
        if (count($ids) === $available->count()) {
            $ids = [];
        }

        return new self($ids, false, $available);
    }

    /** The branches actually covered. */
    public function branches(): Collection
    {
        return $this->ids ? $this->available->whereIn('id', $this->ids)->values() : $this->available;
    }

    public function label(): string
    {
        if ($this->locked) {
            return $this->available->first()?->name ?? '';
        }

        return $this->ids ? $this->branches()->pluck('name')->implode(', ') : 'All branches';
    }

    public function toArray(): array
    {
        return [
            'selected' => $this->ids,
            'locked' => $this->locked,
            'label' => $this->label(),
            'options' => $this->locked ? [] : $this->available->map(fn ($b) => ['id' => $b->id, 'name' => $b->name, 'code' => $b->code])->values()->all(),
        ];
    }
}
