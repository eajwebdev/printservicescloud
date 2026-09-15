@extends('pdf._base', ['margin' => '26px 28px', 'fontSize' => '10px'])

@php
    $qty = fn ($n) => rtrim(rtrim(number_format((float) $n, 3, '.', ''), '0'), '.');
@endphp

@section('style')
    .box { border: 1px solid #12151B; padding: 10px 12px; }
    .label { font-size: 8px; color: #5B6472; }
    .big { font-size: 20px; font-weight: bold; }
    .cut { border-top: 1px dashed #5B6472; margin: 18px 0 12px; position: relative; }
    .cut span { position: absolute; top: -7px; left: 0; background: #fff; padding-right: 6px; font-size: 8px; color: #5B6472; }
@endsection

@section('body')
    <div class="bar"></div>
    <table style="margin-top: 10px;">
        <tr>
            <td>
                <div class="label">JOB TICKET</div>
                <div class="big mono">{{ $order->order_no }}</div>
            </td>
            <td class="right">
                @if ($order->rush)<div class="big red">RUSH</div>@endif
                <div class="label">DUE</div>
                <div style="font-size: 13px;"><b>{{ $order->due_at?->format('D, M j, g:i A') ?? 'No due date' }}</b></div>
            </td>
        </tr>
    </table>

    <table style="margin-top: 10px;">
        <tr>
            <td style="width: 50%;"><div class="label">CUSTOMER</div>{{ $order->customer?->name ?? 'Walk-in' }}<br><span class="muted">{{ $order->customer?->phone }}</span></td>
            <td><div class="label">ASSIGNED TO</div>{{ $order->assignee?->name ?? 'Unassigned' }}</td>
        </tr>
    </table>

    <table class="lines" style="margin-top: 12px;">
        <tr><th style="width: 34px;">Qty</th><th>Item and spec</th><th style="width: 70px;">Done</th></tr>
        @foreach ($order->items as $item)
            <tr>
                <td class="mono"><b>{{ $qty($item->qty) }}</b></td>
                <td>
                    <b>{{ $item->name }}</b>
                    @if (!empty($item->spec['width']))
                        <br>Size: {{ $qty($item->spec['width']) }} × {{ $qty($item->spec['height']) }} {{ $item->spec['unit'] }} ({{ $qty($item->spec['sqft']) }} sqft each)
                    @endif
                    @if (!empty($item->spec['options']))
                        <br>Finishing: {{ collect($item->spec['options'])->pluck('name')->implode(', ') }}
                    @endif
                    @if ($item->note)<br><i>{{ $item->note }}</i>@endif
                </td>
                <td style="border-left: 1px solid #E6E7E3;"></td>
            </tr>
        @endforeach
    </table>

    @if ($order->notes)
        <div class="box" style="margin-top: 10px;"><div class="label">NOTES</div>{{ $order->notes }}</div>
    @endif

    <div class="cut"><span>CUT HERE, CUSTOMER CLAIM STUB</span></div>

    <table>
        <tr>
            <td>
                <div style="font-size: 12px;"><b>{{ $shop['name'] }}</b></div>@if (!empty($shop['branch']))<div class="muted">{{ $shop['branch'] }}</div>@endif
                <div class="muted">{{ $shop['phone'] }}</div>
            </td>
            <td class="right">
                <div class="label">CLAIM NO.</div>
                <div class="big mono">{{ $order->order_no }}</div>
            </td>
        </tr>
    </table>
    <table style="margin-top: 8px;">
        <tr>
            <td>{{ $order->customer?->name ?? 'Walk-in' }}<br><span class="muted">Pickup {{ $order->due_at?->format('D, M j, g:i A') }}</span></td>
            <td class="right">Total ₱{{ number_format((float) $order->total, 2) }}<br>
                @if ((float) $order->balance > 0)<b class="red">Balance ₱{{ number_format((float) $order->balance, 2) }}</b>@else<b>Fully paid</b>@endif
            </td>
        </tr>
    </table>
    <div class="muted" style="margin-top: 6px;">Present this stub when claiming. Unclaimed items after 30 days may be disposed of.</div>
@endsection
