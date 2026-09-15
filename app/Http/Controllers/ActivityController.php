<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\User;
use App\Support\BranchContext;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Activitylog\Models\Activity;

class ActivityController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->only(['user', 'log', 'q', 'date', 'branch']);
        $branchId = BranchContext::current()->id();
        $user = $request->user();
        $branchNames = Branch::withTrashed()->pluck('name', 'id');

        $activities = Activity::query()->with(['causer', 'subject'])
            // Inside a branch: that branch's history. On "All branches" an admin can narrow to one.
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->when(! $branchId && ($filters['branch'] ?? null), fn ($q) => $q->where('branch_id', $filters['branch']))
            // Subscription notes from the system provider stay with the superadmin.
            ->when(! $user->is_superadmin, fn ($q) => $q->where(fn ($w) => $w->where('log_name', '!=', 'billing')->orWhere('causer_id', $user->id)))
            ->when($filters['user'] ?? null, fn ($q, $u) => $q->where('causer_type', 'user')->where('causer_id', $u))
            ->when($filters['log'] ?? null, fn ($q, $l) => $q->where('log_name', $l))
            ->when($filters['q'] ?? null, fn ($q, $t) => $q->where('description', 'like', "%{$t}%"))
            ->when($filters['date'] ?? null, fn ($q, $d) => $q->whereDate('created_at', $d))
            ->latest()->latest('id')->paginate(40)->withQueryString()
            ->through(fn (Activity $a) => [
                'id' => $a->id,
                'log' => $a->log_name,
                'description' => $a->description,
                'event' => $a->event,
                'subject' => $this->subjectLabel($a),
                'causer' => $a->causer?->name ?? 'System',
                'branch' => $branchNames[$a->branch_id] ?? null,
                'properties' => $a->properties?->toArray() ?: null,
                'at' => $a->created_at->toIso8601String(),
            ]);

        return Inertia::render('Activity/Index', [
            'activities' => $activities,
            'filters' => $filters,
            'branches' => $branchId ? [] : Branch::query()->orderBy('name')->get(['id', 'name']),
            'users' => User::query()
                ->when($branchId, fn ($q) => $q->where(fn ($w) => $w->where('branch_id', $branchId)->orWhere('is_owner', true)))
                ->when(! $user->is_superadmin, fn ($q) => $q->where('is_superadmin', false))
                ->orderBy('name')->get(['id', 'name']),
            'logs' => Activity::query()->distinct()->orderBy('log_name')->pluck('log_name'),
        ]);
    }

    private function subjectLabel(Activity $a): ?string
    {
        if (! $a->subject_type) {
            return null;
        }
        $type = ucfirst(str_replace('_', ' ', $a->subject_type));
        $subject = $a->subject;
        $name = $subject ? ($subject->order_no ?? $subject->po_no ?? $subject->quote_no ?? $subject->name ?? null) : null;

        return $name ? "{$type}: {$name}" : "{$type} #{$a->subject_id}";
    }
}
