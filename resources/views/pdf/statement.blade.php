@extends('pdf._base', ['margin' => '36px 42px', 'fontSize' => '10px'])

@php $fmt = fn ($n) => number_format((float) $n, 2); @endphp

@section('body')
    <div class="bar"></div>
    <table style="margin-top: 14px;">
        <tr>
            <td style="width: 96px;">@if ($shop['logo_path'])<img src="{{ $shop['logo_path'] }}" style="width: 86px;">@endif</td>
            <td><div style="font-size: 14px;"><b>{{ $shop['name'] }}</b></div>@if (!empty($shop['branch']))<div class="muted">{{ $shop['branch'] }}</div>@endif<div class="muted">{{ $shop['address'] }}<br>{{ $shop['phone'] }}</div></td>
            <td class="right"><div style="font-size: 20px;"><b>Statement of account</b></div><div class="muted">As of {{ now()->format('F j, Y') }}</div></td>
        </tr>
    </table>

    <div class="hair" style="margin: 16px 0 10px;"></div>
    <table>
        <tr>
            <td><span class="muted">Account</span><br><b style="font-size: 13px;">{{ $customer->name }}</b><br>{{ collect([$customer->business_name, $customer->phone, $customer->address])->filter()->implode(' / ') }}</td>
            <td class="right"><span class="muted">Amount due</span><br><b style="font-size: 20px;" class="{{ (float) $customer->credit_balance > 0 ? 'red' : '' }}">₱{{ $fmt($customer->credit_balance) }}</b></td>
        </tr>
    </table>

    <table class="lines" style="margin-top: 16px;">
        <tr><th style="width: 80px;">Date</th><th style="width: 110px;">Reference</th><th>Description</th><th class="right">Charges</th><th class="right">Payments</th><th class="right">Balance</th></tr>
        @forelse ($lines as $l)
            <tr>
                <td>{{ \Illuminate\Support\Carbon::parse($l['date'])->timezone(config('app.timezone'))->format('M j, Y') }}</td>
                <td class="mono">{{ $l['ref'] }}</td>
                <td>{{ $l['description'] }}</td>
                <td class="right">{{ $l['charge'] ? $fmt($l['charge']) : '' }}</td>
                <td class="right">{{ $l['payment'] ? $fmt($l['payment']) : '' }}</td>
                <td class="right"><b>{{ $fmt($l['balance']) }}</b></td>
            </tr>
        @empty
            <tr><td colspan="6" class="center muted">No charges on this account.</td></tr>
        @endforelse
    </table>

    @if ($shop['gcash'] || $shop['bank'])
        <div style="margin-top: 18px;"><span class="muted">Pay by</span><br>
            @if ($shop['gcash'])GCash {{ $shop['gcash'] }}<br>@endif
            @if ($shop['bank'])Bank {{ $shop['bank'] }}@endif
        </div>
    @endif
@endsection
