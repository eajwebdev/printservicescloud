<?php

namespace App\Http\Controllers;

use App\Http\Requests\ExpenseRequest;
use App\Http\Requests\ExpenseUpdateRequest;
use App\Models\Expense;
use App\Services\ExpenseService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class ExpenseController extends Controller
{
    public function index(Request $request): Response
    {
        $from = $request->date('from') ?? Carbon::now()->startOfMonth();
        $to = $request->date('to') ?? Carbon::now();
        $filters = ['from' => $from->toDateString(), 'to' => $to->toDateString()] + $request->only(['category', 'source', 'q']);

        $base = Expense::query()
            ->whereBetween('expense_date', [$from->toDateString(), $to->toDateString()])
            ->when($filters['category'] ?? null, fn ($q, $c) => $q->where('category', $c))
            ->when($filters['source'] ?? null, fn ($q, $s) => $q->where('source', $s))
            ->when($filters['q'] ?? null, fn ($q, $t) => $q->where(fn ($w) => $w->where('payee', 'like', "%{$t}%")->orWhere('notes', 'like', "%{$t}%")));

        $expenses = (clone $base)->with('user:id,name')->latest('expense_date')->latest('id')->paginate(50)->withQueryString()
            ->through(fn (Expense $e) => [
                'id' => $e->id, 'expense_date' => $e->expense_date->toDateString(), 'category' => $e->category,
                'amount' => (float) $e->amount, 'payee' => $e->payee, 'notes' => $e->notes, 'source' => $e->source,
                'receipt_url' => $e->receipt_path ? asset('storage/'.$e->receipt_path) : null,
                'user' => $e->user?->name, 'created_at' => $e->created_at->toIso8601String(),
            ]);

        return Inertia::render('Expenses/Index', [
            'expenses' => $expenses,
            'filters' => $filters,
            'categories' => Expense::CATEGORIES,
            'totals' => [
                'all' => round((float) (clone $base)->sum('amount'), 2),
                'by_category' => (clone $base)->selectRaw('category, SUM(amount) as total')->groupBy('category')->pluck('total', 'category')->map(fn ($v) => round((float) $v, 2)),
                'by_source' => (clone $base)->selectRaw('source, SUM(amount) as total')->groupBy('source')->pluck('total', 'source')->map(fn ($v) => round((float) $v, 2)),
            ],
        ]);
    }

    public function store(ExpenseRequest $request, ExpenseService $service): RedirectResponse
    {
        $data = collect($request->validated())->except('receipt')->all();
        if ($request->hasFile('receipt')) {
            $data['receipt_path'] = $request->file('receipt')->store('receipts', 'public');
        }
        $expense = $service->record($data, $request->user());

        $where = ['drawer' => ' from your drawer', 'petty' => ' from petty cash', 'bank' => ' via bank'][$expense->source];

        return back()->with('success', 'Recorded ₱'.number_format((float) $expense->amount, 2).$where.'.');
    }

    public function update(ExpenseUpdateRequest $request, Expense $expense): RedirectResponse
    {
        $data = collect($request->validated())->except('receipt')->all();
        if ($request->hasFile('receipt')) {
            $data['receipt_path'] = $request->file('receipt')->store('receipts', 'public');
        }
        $expense->update($data);

        return back()->with('success', 'Expense updated. The amount and source stay locked so the cash math holds.');
    }

    public function destroy(Request $request, Expense $expense, ExpenseService $service): RedirectResponse
    {
        $service->delete($expense, $request->user());

        return back()->with('success', 'Expense deleted and the money put back where it came from.');
    }
}
