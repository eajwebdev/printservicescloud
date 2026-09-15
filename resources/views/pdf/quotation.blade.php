@extends('pdf._base', ['margin' => '0', 'fontSize' => '10px'])

@php
    $fmt = fn ($n) => number_format((float) $n, 2);
    $qty = fn ($n) => rtrim(rtrim(number_format((float) $n, 3, '.', ''), '0'), '.');
@endphp

@section('style')
    .page { padding: 40px 46px; position: relative; }
    .label { font-size: 8px; color: #5B6472; letter-spacing: 0.3px; }
    .title { font-size: 26px; font-weight: bold; }
    .band { background: #0C0E12; color: #fff; padding: 18px 46px; }
    .band .muted { color: #9AA2B1; }
@endsection

@section('body')
    <div class="bar"></div>
    <div class="band">
        <table>
            <tr>
                <td style="width: 64px;">
                    @if ($shop['logo_path'])<img src="{{ $shop['logo_path'] }}" style="width: 96px;">@endif
                </td>
                <td>
                    <div style="font-size: 15px;"><b>{{ $shop['name'] }}</b></div>@if (!empty($shop['branch']))<div class="muted">{{ $shop['branch'] }}</div>@endif
                    <div class="muted">{{ $shop['tagline'] }}</div>
                </td>
                <td class="right muted" style="font-size: 9px;">
                    {{ $shop['address'] }}<br>{{ $shop['phone'] }} {{ $shop['email'] ? '/ '.$shop['email'] : '' }}
                    @if ($shop['tin'])<br>TIN {{ $shop['tin'] }}@endif
                </td>
            </tr>
        </table>
    </div>

    <div class="page">
        <table>
            <tr>
                <td>
                    <div class="title">Quotation</div>
                    <div class="mono" style="font-size: 12px;">{{ $q->quote_no }}</div>
                </td>
                <td class="right">
                    <div class="label">DATE</div>{{ $q->created_at->format('F j, Y') }}<br>
                    <div class="label" style="margin-top: 4px;">VALID UNTIL</div><b>{{ $q->valid_until?->format('F j, Y') ?? 'Ask for confirmation' }}</b>
                </td>
            </tr>
        </table>

        <div class="hair" style="margin: 16px 0 12px;"></div>
        <div class="label">PREPARED FOR</div>
        <div style="font-size: 13px;"><b>{{ $q->displayCustomer() }}</b></div>
        @if ($q->customer)
            <div class="muted">{{ collect([$q->customer->business_name, $q->customer->phone, $q->customer->address])->filter()->implode(' / ') }}</div>
        @endif

        <table class="lines" style="margin-top: 18px;">
            <tr>
                <th style="width: 24px;">#</th><th>Description</th><th class="right" style="width: 50px;">Qty</th>
                <th class="right" style="width: 80px;">Unit price</th><th class="right" style="width: 90px;">Amount</th>
            </tr>
            @foreach ($q->items as $i => $item)
                <tr>
                    <td class="muted">{{ $i + 1 }}</td>
                    <td>
                        <b>{{ $item->name }}</b>
                        @if (!empty($item->spec['width']))
                            <br><span class="muted">{{ $qty($item->spec['width']) }} × {{ $qty($item->spec['height']) }} {{ $item->spec['unit'] }}, {{ $qty($item->spec['sqft']) }} sqft each</span>
                        @endif
                        @if (!empty($item->spec['options']))
                            <br><span class="muted">With {{ collect($item->spec['options'])->pluck('name')->implode(', ') }}</span>
                        @endif
                        @if (!empty($item->spec['rush']))<br><span class="red">Rush production</span>@endif
                        @if ($item->note)<br><i class="muted">{{ $item->note }}</i>@endif
                    </td>
                    <td class="right">{{ $qty($item->qty) }}</td>
                    <td class="right">{{ $fmt($item->unit_price) }}</td>
                    <td class="right">
                        {{ $fmt($item->line_total) }}
                        @if ((float) $item->discount_amount > 0)<br><span class="muted">less {{ $fmt($item->discount_amount) }}</span>@endif
                    </td>
                </tr>
            @endforeach
        </table>

        <table style="margin-top: 10px;">
            <tr>
                <td style="width: 55%; vertical-align: top; padding-right: 20px;">
                    @if ($q->notes)
                        <div class="label">NOTES</div>
                        <div>{!! nl2br(e($q->notes)) !!}</div>
                    @endif
                </td>
                <td>
                    <table class="totals">
                        <tr><td>Subtotal</td><td class="right">{{ $fmt($q->subtotal) }}</td></tr>
                        @if ((float) $q->discount_total > 0)<tr><td>Discount</td><td class="right">-{{ $fmt($q->discount_total) }}</td></tr>@endif
                        @if ((float) $q->tax_total > 0)<tr><td>VAT</td><td class="right">{{ $fmt($q->tax_total) }}</td></tr>@endif
                        <tr class="grand"><td>Total</td><td class="right">₱{{ $fmt($q->total) }}</td></tr>
                    </table>
                </td>
            </tr>
        </table>

        @if ($shop['quotation_terms'])
            <div class="hair" style="margin: 22px 0 10px;"></div>
            <div class="label">TERMS</div>
            <div class="muted">{!! nl2br(e($shop['quotation_terms'])) !!}</div>
        @endif

        @if ($shop['gcash'] || $shop['bank'])
            <div style="margin-top: 12px;">
                <div class="label">HOW TO PAY</div>
                @if ($shop['gcash'])GCash: {{ $shop['gcash'] }}<br>@endif
                @if ($shop['bank'])Bank: {{ $shop['bank'] }}@endif
            </div>
        @endif

        <table style="margin-top: 42px;">
            <tr>
                <td style="width: 45%;"><div class="rule"></div>{{ $q->user?->name }}<br><span class="muted">Prepared by</span></td>
                <td></td>
                <td style="width: 45%;"><div class="rule"></div>&nbsp;<br><span class="muted">Conforme (signature over printed name)</span></td>
            </tr>
        </table>
    </div>
@endsection
