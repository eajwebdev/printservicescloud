@php
    $fmt = fn ($n) => number_format((float) $n, 2);
    $qty = fn ($n) => rtrim(rtrim(number_format((float) $n, 3, '.', ''), '0'), '.');
    $change = $order->payments->where('method', 'cash')->sum(fn ($p) => max(0, (float) $p->tendered - (float) $p->amount));
    $width = $paper === 58 ? '48mm' : '72mm';
    $refunds = $order->payments->where('kind', 'refund');
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{ $order->order_no }}</title>
<style>
    @page { size: {{ $paper }}mm auto; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    body { font-family: 'Consolas', 'Courier New', monospace; font-size: {{ $paper === 58 ? '10.5px' : '12px' }}; line-height: 1.35; }
    .sheet { width: {{ $width }}; margin: 0 auto; padding: 3mm 0 6mm; }
    .c { text-align: center; }
    .r { text-align: right; }
    .b { font-weight: 700; }
    .big { font-size: 1.45em; font-weight: 700; }
    .muted { color: #333; }
    .rule { border-top: 1px dashed #000; margin: 5px 0; }
    .row { display: flex; justify-content: space-between; gap: 6px; }
    .row span:last-child { white-space: nowrap; }
    .item { margin-bottom: 3px; }
    .logo { width: 34mm; height: auto; display: block; margin: 0 auto 2px; filter: grayscale(1) contrast(1.4); }
    .reprint { border: 1px solid #000; padding: 1px 4px; display: inline-block; margin: 3px 0; font-weight: 700; }
    .cut { border-top: 1px dashed #000; margin: 10px 0 6px; text-align: center; font-size: .85em; }
    .screen-bar { font-family: system-ui, sans-serif; background: #0c0e12; color: #eceef2; padding: 10px; text-align: center; font-size: 13px; }
    .screen-bar button { font: inherit; margin: 0 4px; padding: 6px 14px; border: 0; border-radius: 2px; background: {{ \App\Support\Brand::head()['color'] }}; color: #fff; cursor: pointer; }
    @media print { .screen-bar { display: none; } }
</style>
</head>
<body>
<div class="screen-bar">
    Receipt {{ $order->order_no }}, {{ $paper }}mm paper.
    <button type="button" onclick="window.print()">Print</button>
</div>
<div class="sheet">
    <img class="logo" src="{{ $logo }}" alt="">
    <div class="c b" style="font-size: 1.2em">{{ $shop['name'] }}</div>
    @if (!empty($shop['branch']))<div class="c">{{ $shop['branch'] }}</div>@endif
    <div class="c muted">{{ $shop['tagline'] }}</div>
    @if ($shop['address'])<div class="c">{{ $shop['address'] }}</div>@endif
    @if ($shop['phone'])<div class="c">{{ $shop['phone'] }}</div>@endif
    @if ($shop['tin'])<div class="c">TIN {{ $shop['tin'] }}</div>@endif

    @if ($copy > 1)
        <div class="c"><span class="reprint">REPRINT, COPY {{ $copy }}</span></div>
    @endif

    <div class="rule"></div>
    <div class="row b"><span>{{ $order->type === 'job' ? 'JOB ORDER' : 'SALES RECEIPT' }}</span><span>{{ $order->order_no }}</span></div>
    <div class="row"><span>Date</span><span>{{ $order->created_at->format('M j, Y g:i A') }}</span></div>
    <div class="row"><span>Customer</span><span>{{ \Illuminate\Support\Str::limit($order->customer?->name ?? 'Walk-in', 24) }}</span></div>
    <div class="row"><span>Cashier</span><span>{{ $order->cashier?->name }}</span></div>
    @if ($order->type === 'job' && $order->due_at)
        <div class="row b"><span>Pickup</span><span>{{ $order->due_at->format('D M j, g:i A') }}</span></div>
    @endif
    <div class="rule"></div>

    @foreach ($order->items as $item)
        <div class="item">
            <div class="b">{{ $item->name }}@if (!empty($item->spec['rush'])) RUSH @endif</div>
            @if (!empty($item->spec['width']))
                <div class="muted">{{ $qty($item->spec['width']) }}x{{ $qty($item->spec['height']) }} {{ $item->spec['unit'] }} = {{ $qty($item->spec['sqft']) }} sqft</div>
            @endif
            @if (!empty($item->spec['options']))
                <div class="muted">+ {{ collect($item->spec['options'])->pluck('name')->implode(', ') }}</div>
            @endif
            <div class="row"><span>{{ $qty($item->qty) }} x {{ $fmt($item->unit_price) }}@if ((float) $item->discount_amount > 0) less {{ $fmt($item->discount_amount) }}@endif</span><span>{{ $fmt($item->line_total) }}</span></div>
        </div>
    @endforeach

    <div class="rule"></div>
    <div class="row"><span>Subtotal</span><span>{{ $fmt($order->subtotal) }}</span></div>
    @if ((float) $order->discount_total - (float) $order->senior_pwd_discount > 0)
        <div class="row"><span>Discount</span><span>-{{ $fmt((float) $order->discount_total - (float) $order->senior_pwd_discount) }}</span></div>
    @endif
    @if ($order->senior_pwd)
        <div class="row"><span>Senior/PWD</span><span>-{{ $fmt($order->senior_pwd_discount) }}</span></div>
    @endif
    @if ((float) $order->tax_total > 0)
        <div class="row"><span>VAT{{ $shop['tax_mode'] === 'inclusive' ? ' (incl.)' : '' }}</span><span>{{ $fmt($order->tax_total) }}</span></div>
    @endif
    <div class="row big"><span>TOTAL</span><span>P{{ $fmt($order->total) }}</span></div>

    @foreach ($order->payments->where('kind', '!=', 'refund') as $p)
        <div class="row"><span>{{ strtoupper($p->method) }}@if ($p->kind === 'settlement') (bal)@endif @if ($p->reference) {{ \Illuminate\Support\Str::limit($p->reference, 14, '') }}@endif</span><span>{{ $p->method === 'cash' && $p->tendered ? $fmt($p->tendered) : $fmt($p->amount) }}</span></div>
    @endforeach
    @foreach ($refunds as $p)
        <div class="row"><span>REFUND {{ strtoupper($p->method) }}</span><span>{{ $fmt($p->amount) }}</span></div>
    @endforeach
    @if ($change > 0)
        <div class="row"><span>Change</span><span>{{ $fmt($change) }}</span></div>
    @endif
    @if ((float) $order->balance > 0)
        <div class="row big"><span>BALANCE</span><span>P{{ $fmt($order->balance) }}</span></div>
    @endif
    @if ($order->status === 'voided')
        <div class="c big">*** VOIDED ***</div>
    @endif

    <div class="rule"></div>
    @if ((float) $order->balance > 0 && $shop['gcash'])
        <div class="c">Pay balance via GCash<br>{{ $shop['gcash'] }}</div>
    @endif
    <div class="c">{{ $shop['receipt_footer'] }}</div>
    <div class="c muted" style="margin-top: 3px">This is not an official receipt.</div>

    @if ($claimStub)
        <div class="cut">- - - cut here - - -</div>
        <div class="c b">CLAIM STUB</div>
        <div class="c big">{{ $order->order_no }}</div>
        <div class="row"><span>Customer</span><span>{{ \Illuminate\Support\Str::limit($order->customer?->name ?? 'Walk-in', 22) }}</span></div>
        @if ($order->due_at)<div class="row"><span>Pickup</span><span>{{ $order->due_at->format('M j, g:i A') }}</span></div>@endif
        <div class="row"><span>Items</span><span>{{ $order->items->count() }}</span></div>
        <div class="row b"><span>{{ (float) $order->balance > 0 ? 'Balance' : 'Paid' }}</span><span>{{ (float) $order->balance > 0 ? 'P'.$fmt($order->balance) : 'in full' }}</span></div>
        <div class="c muted" style="margin-top: 3px">Present this stub when claiming.</div>
    @endif
</div>
@if ($autoPrint)
<script>
    // Print as soon as the logo has loaded; close the tab afterwards if it was opened on its own.
    window.addEventListener('load', function () {
        setTimeout(function () { window.print(); }, 150);
    });
    window.addEventListener('afterprint', function () {
        if (window.self === window.top && window.opener) window.close();
    });
</script>
@endif
</body>
</html>
