@extends('pdf._base', ['margin' => '14px 12px', 'fontSize' => '8.5px'])

@php
    $fmt = fn ($n) => number_format((float) $n, 2);
    $qty = fn ($n) => rtrim(rtrim(number_format((float) $n, 3, '.', ''), '0'), '.');
    $sales = $order->payments->where('kind', '!=', 'refund');
    $change = $order->payments->where('method', 'cash')->sum(fn ($p) => max(0, (float) $p->tendered - (float) $p->amount));
@endphp

@section('body')
    <div class="center">
        @if ($shop['logo_path'])
            <img src="{{ $shop['logo_path'] }}" style="width: 100px;">
        @endif
        <h2 style="font-size: 12px; margin-top: 4px;">{{ $shop['name'] }}</h2>@if (!empty($shop['branch']))<div class="muted">{{ $shop['branch'] }}</div>@endif
        <div class="muted">{{ $shop['tagline'] }}</div>
        <div>{{ $shop['address'] }}</div>
        @if ($shop['phone'])<div>{{ $shop['phone'] }}</div>@endif
        @if ($shop['tin'])<div>TIN {{ $shop['tin'] }}</div>@endif
    </div>

    <div class="dash" style="margin: 8px 0 6px;"></div>

    <table>
        <tr><td>{{ $order->type === 'job' ? 'JOB ORDER' : 'SALES RECEIPT' }}</td><td class="right mono"><b>{{ $order->order_no }}</b></td></tr>
        <tr><td class="muted">Date</td><td class="right">{{ $order->created_at->format('M j, Y g:i A') }}</td></tr>
        <tr><td class="muted">Customer</td><td class="right">{{ $order->customer?->name ?? 'Walk-in' }}</td></tr>
        <tr><td class="muted">Cashier</td><td class="right">{{ $order->cashier?->name }}</td></tr>
        @if ($order->type === 'job' && $order->due_at)
            <tr><td class="muted">Pickup</td><td class="right"><b>{{ $order->due_at->format('D, M j g:i A') }}</b></td></tr>
        @endif
    </table>

    <div class="dash" style="margin: 6px 0;"></div>

    <table>
        @foreach ($order->items as $item)
            <tr>
                <td colspan="2"><b>{{ $item->name }}</b>
                    @if (!empty($item->spec['width']))
                        <span class="muted">{{ $qty($item->spec['width']) }}×{{ $qty($item->spec['height']) }} {{ $item->spec['unit'] }} ({{ $qty($item->spec['sqft']) }} sqft)</span>
                    @endif
                    @if (!empty($item->spec['options']))
                        <br><span class="muted">+ {{ collect($item->spec['options'])->pluck('name')->implode(', ') }}</span>
                    @endif
                    @if (!empty($item->spec['rush']))<br><span class="red">RUSH</span>@endif
                </td>
            </tr>
            <tr>
                <td class="muted" style="padding-bottom: 4px;">{{ $qty($item->qty) }} × {{ $fmt($item->unit_price) }}@if ((float) $item->discount_amount > 0) &nbsp;less {{ $fmt($item->discount_amount) }}@endif</td>
                <td class="right" style="padding-bottom: 4px;">{{ $fmt($item->line_total) }}</td>
            </tr>
        @endforeach
    </table>

    <div class="dash" style="margin: 4px 0 4px;"></div>

    <table class="totals">
        <tr><td>Subtotal</td><td class="right">{{ $fmt($order->subtotal) }}</td></tr>
        @if ((float) $order->discount_total - (float) $order->senior_pwd_discount > 0)
            <tr><td>Discount</td><td class="right">-{{ $fmt((float) $order->discount_total - (float) $order->senior_pwd_discount) }}</td></tr>
        @endif
        @if ($order->senior_pwd)
            <tr><td>Senior / PWD discount</td><td class="right">-{{ $fmt($order->senior_pwd_discount) }}</td></tr>
        @endif
        @if ((float) $order->tax_total > 0)
            <tr><td>VAT {{ $shop['tax_mode'] === 'inclusive' ? '(included)' : '' }}</td><td class="right">{{ $fmt($order->tax_total) }}</td></tr>
        @endif
        <tr class="grand"><td>TOTAL</td><td class="right">₱{{ $fmt($order->total) }}</td></tr>
    </table>

    <table class="totals" style="margin-top: 4px;">
        @foreach ($sales as $p)
            <tr>
                <td>{{ strtoupper($p->method) }}@if ($p->kind === 'settlement') (balance)@endif @if ($p->reference)<span class="muted mono"> {{ $p->reference }}</span>@endif</td>
                <td class="right">{{ $p->method === 'cash' && $p->tendered ? $fmt($p->tendered) : $fmt($p->amount) }}</td>
            </tr>
        @endforeach
        @if ($change > 0)
            <tr><td>Change</td><td class="right">{{ $fmt($change) }}</td></tr>
        @endif
        @if ((float) $order->balance > 0)
            <tr><td><b class="red">BALANCE DUE</b></td><td class="right"><b class="red">₱{{ $fmt($order->balance) }}</b></td></tr>
        @endif
        @if ($order->status === 'voided')
            <tr><td colspan="2" class="center red"><b>VOIDED: {{ $order->void_reason }}</b></td></tr>
        @endif
    </table>

    <div class="dash" style="margin: 8px 0 6px;"></div>
    @if ((float) $order->balance > 0 && ($shop['gcash'] || $shop['bank']))
        <div class="center muted">Pay the balance by GCash {{ $shop['gcash'] }}</div>
    @endif
    <div class="center">{{ $shop['receipt_footer'] }}</div>
    <div class="center muted" style="margin-top: 4px;">This is not an official receipt.</div>
@endsection
