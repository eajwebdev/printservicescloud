@extends('pdf._base', ['margin' => '14px 12px', 'fontSize' => '8.5px'])

@php
    $fmt = fn ($n) => number_format((float) $n, 2);
    $sum = $s['summary'];
    $closed = $s['status'] === 'closed';
@endphp

@section('body')
    <div class="center">
        <h2 style="font-size: 12px;">{{ $shop['name'] }}</h2>@if (!empty($shop['branch']))<div class="muted">{{ $shop['branch'] }}</div>@endif
        <div style="margin-top: 2px;"><b>{{ $closed ? 'Z-READ, DRAWER CLOSED' : 'X-READ, DRAWER OPEN' }}</b></div>
        <div class="muted">Session #{{ $s['id'] }}, {{ $s['cashier'] }}</div>
    </div>
    <div class="dash" style="margin: 6px 0;"></div>
    <table class="totals">
        <tr><td class="muted">Opened</td><td class="right">{{ \Illuminate\Support\Carbon::parse($s['opened_at'])->timezone(config('app.timezone'))->format('M j, Y g:i A') }}</td></tr>
        @if ($closed)<tr><td class="muted">Closed</td><td class="right">{{ \Illuminate\Support\Carbon::parse($s['closed_at'])->timezone(config('app.timezone'))->format('M j, Y g:i A') }}</td></tr>@endif
        <tr><td class="muted">Printed</td><td class="right">{{ now()->format('M j, Y g:i A') }}</td></tr>
    </table>

    <div class="dash" style="margin: 6px 0;"></div>
    <div><b>Sales</b></div>
    <table class="totals">
        <tr><td>Orders</td><td class="right">{{ $sum['order_count'] }}</td></tr>
        <tr><td>Voided</td><td class="right">{{ $sum['voided_count'] }}</td></tr>
        <tr><td>Gross sales</td><td class="right">{{ $fmt($sum['gross_sales']) }}</td></tr>
        <tr><td>Discounts given</td><td class="right">{{ $fmt($sum['discounts']) }}</td></tr>
        @foreach ($sum['by_method'] as $method => $amount)
            <tr><td>&nbsp;&nbsp;{{ strtoupper($method) }}</td><td class="right">{{ $fmt($amount) }}</td></tr>
        @endforeach
    </table>

    <div class="dash" style="margin: 6px 0;"></div>
    <div><b>Cash drawer</b></div>
    <table class="totals">
        <tr><td>Opening float</td><td class="right">{{ $fmt($sum['opening_float']) }}</td></tr>
        @foreach ($sum['movements'] as $m)
            @if ($m['count'] > 0)
                <tr><td>{{ $m['label'] }} ({{ $m['count'] }})</td><td class="right">{{ $fmt($m['amount']) }}</td></tr>
            @endif
        @endforeach
        <tr class="grand"><td>Expected cash</td><td class="right">{{ $fmt($sum['expected_cash']) }}</td></tr>
        @if ($closed)
            <tr><td>Counted</td><td class="right">{{ $fmt($sum['closing_counted']) }}</td></tr>
            <tr>
                <td><b>{{ $sum['variance'] < 0 ? 'SHORT' : ($sum['variance'] > 0 ? 'OVER' : 'BALANCED') }}</b></td>
                <td class="right {{ $sum['variance'] < 0 ? 'red' : 'ok' }}"><b>{{ $fmt($sum['variance']) }}</b></td>
            </tr>
        @endif
    </table>

    @if ($s['closing_note'])
        <div class="dash" style="margin: 6px 0;"></div>
        <div class="muted">Note: {{ $s['closing_note'] }}</div>
    @endif

    <table style="margin-top: 26px;">
        <tr>
            <td style="width: 46%;"><div class="rule"></div><span class="muted">Cashier</span></td>
            <td></td>
            <td style="width: 46%;"><div class="rule"></div><span class="muted">Checked by</span></td>
        </tr>
    </table>
@endsection
