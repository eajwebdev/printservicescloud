<?php

namespace App\Http\Controllers;

use App\Http\Requests\CashMovementRequest;
use App\Http\Requests\CloseSessionRequest;
use App\Http\Requests\OpenSessionRequest;
use App\Models\CashierSession;
use App\Models\CashMovement;
use App\Services\DrawerService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class SessionController extends Controller
{
    public function __construct(private DrawerService $drawer) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $open = $user->openSession;
        $seeAll = $user->can('session.edit');

        $history = CashierSession::query()->with('user:id,name')
            ->when(! $seeAll, fn ($q) => $q->where('user_id', $user->id))
            ->latest('opened_at')->paginate(15)->withQueryString()
            ->through(fn (CashierSession $s) => self::sessionRow($s));

        return Inertia::render('Session/Index', [
            'current' => $open ? $this->detail($open) : null,
            'history' => $history,
            'suggestedFloat' => (float) (CashierSession::query()->where('user_id', $user->id)->where('status', 'closed')->latest('closed_at')->value('opening_float') ?? 1000),
        ]);
    }

    public function show(Request $request, CashierSession $cashierSession): Response
    {
        $this->guard($request, $cashierSession);

        return Inertia::render('Session/Show', ['session' => $this->detail($cashierSession)]);
    }

    public function open(OpenSessionRequest $request): RedirectResponse
    {
        $this->drawer->open($request->user(), (float) $request->validated('opening_float'), $request->validated('note'));

        return redirect()->to($request->input('return_to') === 'pos' ? route('pos.index') : route('session.index'))
            ->with('success', 'Drawer open. You can start selling.');
    }

    public function close(CloseSessionRequest $request): RedirectResponse
    {
        $session = $request->user()->openSession;
        if (! $session) {
            return back()->with('error', 'There is no open drawer to close.');
        }
        $session = $this->drawer->close($session, (float) $request->validated('closing_counted'), $request->validated('note'), $request->user());

        $variance = (float) $session->variance;
        $message = abs($variance) < 0.01
            ? 'Drawer closed and balanced to the peso.'
            : 'Drawer closed. '.($variance < 0 ? 'Short' : 'Over').' by ₱'.number_format(abs($variance), 2).'.';

        return redirect()->route('session.show', $session)->with('success', $message);
    }

    public function movement(CashMovementRequest $request): RedirectResponse
    {
        $data = $request->validated();
        DB::transaction(function () use ($request, $data) {
            $session = $this->drawer->requireOpen($request->user(), 'amount');
            $sign = $data['direction'] === 'out' ? -1 : 1;
            if ($data['type'] !== 'adjustment') {
                $sign = -1; // paid-outs and cash drops always leave the drawer
            }
            $this->drawer->post($session, $data['type'], $sign * (float) $data['amount'], null, $data['note'], $request->user()->id);
            activity('drawer')->performedOn($session)->causedBy($request->user())->withProperties($data)->log('Recorded '.CashMovement::LABELS[$data['type']]);
        });

        return back()->with('success', 'Recorded in the drawer.');
    }

    public function pdf(Request $request, CashierSession $cashierSession)
    {
        $this->guard($request, $cashierSession);
        $detail = $this->detail($cashierSession);

        return Pdf::loadView('pdf.session', ['s' => $detail, 'shop' => \App\Support\Shop::profile()])
            ->setPaper([0, 0, 226.77, 700])
            ->stream("drawer-{$cashierSession->id}.pdf");
    }

    private function guard(Request $request, CashierSession $session): void
    {
        abort_unless($session->user_id === $request->user()->id || $request->user()->can('session.edit'), 403, 'You can only view your own drawer sessions.');
    }

    public static function sessionRow(CashierSession $s): array
    {
        return [
            'id' => $s->id,
            'cashier' => $s->user?->name,
            'status' => $s->status,
            'opened_at' => $s->opened_at->toIso8601String(),
            'closed_at' => $s->closed_at?->toIso8601String(),
            'opening_float' => (float) $s->opening_float,
            'expected_cash' => $s->expected_cash !== null ? (float) $s->expected_cash : null,
            'closing_counted' => $s->closing_counted !== null ? (float) $s->closing_counted : null,
            'variance' => $s->variance !== null ? (float) $s->variance : null,
        ];
    }

    private function detail(CashierSession $session): array
    {
        $session->loadMissing('user:id,name');

        return self::sessionRow($session) + [
            'opening_note' => $session->opening_note,
            'closing_note' => $session->closing_note,
            'summary' => $this->drawer->summary($session),
            'movements' => $session->movements()->with('user:id,name')->latest()->limit(200)->get()->map(fn (CashMovement $m) => [
                'id' => $m->id,
                'type' => $m->type,
                'label' => CashMovement::LABELS[$m->type],
                'amount' => (float) $m->amount,
                'note' => $m->note,
                'user' => $m->user?->name,
                'at' => $m->created_at->toIso8601String(),
            ]),
        ];
    }
}
