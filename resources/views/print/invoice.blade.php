@php
    $fmt = fn ($n) => number_format((float) $n, 2);
    $status = $invoice->displayStatus();
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{ $invoice->number }}</title>
<style>
    @page { size: A4; margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, 'Segoe UI', Arial, sans-serif; color: #12151b; font-size: 13px; line-height: 1.45; background: #fff; }
    .sheet { max-width: 760px; margin: 24px auto; padding: 0 16px; }
    .bar { height: 5px; background: {{ \App\Support\Brand::head()['color'] }}; margin-bottom: 18px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
    .logo { height: 64px; width: auto; }
    .muted { color: #5b6472; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { text-align: left; font-size: 11px; color: #5b6472; font-weight: 500; padding: 8px; border-bottom: 1px solid #12151b; }
    td { padding: 10px 8px; border-bottom: 1px solid #e6e7e3; vertical-align: top; }
    .r { text-align: right; }
    .total td { font-size: 17px; font-weight: 700; border-top: 1px solid #12151b; border-bottom: 0; }
    .stamp { display: inline-block; padding: 3px 10px; border: 2px solid; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; font-size: 12px; }
    .paid { color: #1a8f5a; } .overdue { color: #c21016; } .unpaid { color: #9a6b00; } .void { color: #5b6472; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 20px; }
    .box { border: 1px solid #e6e7e3; padding: 10px 12px; }
    .screen-bar { font-family: system-ui, sans-serif; background: #0c0e12; color: #eceef2; padding: 10px; text-align: center; font-size: 13px; }
    .screen-bar button { font: inherit; margin: 0 4px; padding: 6px 14px; border: 0; border-radius: 2px; background: {{ \App\Support\Brand::head()['color'] }}; color: #fff; cursor: pointer; }
    @media print { .screen-bar { display: none; } .sheet { margin: 0; padding: 0; } }
</style>
</head>
<body>
<div class="screen-bar">Bill {{ $invoice->number }} <button type="button" onclick="window.print()">Print</button></div>
<div class="sheet">
    <div class="bar"></div>
    <div class="head">
        <div>
            <img class="logo" src="{{ $logo }}" alt="{{ $brand }}">
            <p class="muted" style="margin: 6px 0 0;">Point-of-sale subscription by {{ $provider }}</p>
        </div>
        <div class="r">
            <h1>Statement of account</h1>
            <div class="muted">{{ $invoice->number }}</div>
            <div style="margin-top: 8px;"><span class="stamp {{ $status }}">{{ $status }}</span></div>
        </div>
    </div>

    <div class="grid">
        <div class="box">
            <div class="muted">Billed to</div>
            <strong>{{ $invoice->branch->name }}, {{ $brand }}</strong><br>
            @if ($invoice->branch->address){{ $invoice->branch->address }}<br>@endif
            @if ($invoice->branch->phone){{ $invoice->branch->phone }}@endif
        </div>
        <div class="box">
            <div class="muted">Bill date</div><strong>{{ $invoice->issued_on->format('F j, Y') }}</strong><br>
            <div class="muted" style="margin-top: 4px;">Due date</div><strong class="{{ $status === 'overdue' ? 'overdue' : '' }}">{{ $invoice->due_on->format('F j, Y') }}</strong>
        </div>
    </div>

    <table>
        <tr><th>Description</th><th>Service period</th><th class="r">Amount</th></tr>
        <tr>
            <td>{{ $invoice->description ?? 'POS subscription' }}<br><span class="muted">Branch code {{ $invoice->branch->code }}</span></td>
            <td>{{ $invoice->periodLabel() }}</td>
            <td class="r">₱{{ $fmt($invoice->amount) }}</td>
        </tr>
        <tr class="total"><td colspan="2">{{ $invoice->status === 'paid' ? 'Amount paid' : 'Amount due' }}</td><td class="r">₱{{ $fmt($invoice->amount) }}</td></tr>
    </table>

    @if ($invoice->status === 'paid')
        <p class="paid" style="margin-top: 16px;">
            Paid {{ $invoice->paid_at?->timezone(config('app.timezone'))->format('F j, Y g:i A') }}
            @if ($invoice->payment)
                via {{ $invoice->payment->channel === 'paymongo' ? 'PayMongo' : 'recorded payment' }}{{ $invoice->payment->method ? ' ('.$invoice->payment->method.')' : '' }}{{ $invoice->payment->reference ? ', ref '.$invoice->payment->reference : '' }}.
            @endif
        </p>
    @elseif ($invoice->status === 'unpaid')
        <p class="muted" style="margin-top: 16px;">Pay online from the Billing page in the app (GCash, Maya, cards and more). Branches with several overdue bills are locked until they are paid.</p>
    @endif
    @if ($invoice->notes)<p class="muted">{{ $invoice->notes }}</p>@endif
</div>
</body>
</html>
