@extends('pdf._base', ['margin' => '34px 40px', 'fontSize' => '9.5px'])

@php
    $fmt = fn ($n) => number_format((float) $n, 2);
    $s = $r['summary'];
@endphp

@section('style')
    .kpi td { border: 1px solid #DCDDD8; padding: 8px 10px; width: 25%; }
    .kpi .v { font-size: 15px; font-weight: bold; }
    h3 { font-size: 11px; margin: 18px 0 6px; }
@endsection

@section('body')
    <div class="bar"></div>
    <table style="margin-top: 12px;">
        <tr>
            <td><div style="font-size: 16px;"><b>{{ $shop['name'] }}</b></div><div class="muted">Business report, {{ $scope }}</div></td>
            <td class="right"><b>{{ $from->format('M j, Y') }} to {{ $to->format('M j, Y') }}</b><br><span class="muted">Generated {{ now()->format('M j, Y g:i A') }}</span></td>
        </tr>
    </table>

    <table class="kpi" style="margin-top: 14px;">
        <tr>
            <td><span class="muted">Sales</span><div class="v">₱{{ $fmt($s['sales']) }}</div>{{ $s['orders'] }} orders</td>
            <td><span class="muted">Gross profit</span><div class="v">₱{{ $fmt($s['gross_profit']) }}</div>after materials and goods</td>
            <td><span class="muted">Expenses</span><div class="v">₱{{ $fmt($s['expenses']) }}</div>all sources</td>
            <td><span class="muted">Net</span><div class="v {{ $s['net'] < 0 ? 'red' : '' }}">₱{{ $fmt($s['net']) }}</div>{{ $s['margin'] !== null ? $s['margin'].'% margin' : '' }}</td>
        </tr>
    </table>

    @if (count($r['byBranch']) > 1)
        <h3>Branch comparison</h3>
        <table class="lines">
            <tr><th>Branch</th><th class="right">Orders</th><th class="right">Sales</th><th class="right">Share</th><th class="right">Gross profit</th><th class="right">Expenses</th><th class="right">Net</th><th class="right">Collected</th><th class="right">Owed now</th></tr>
            @foreach ($r['byBranch'] as $b)
                <tr><td>{{ $b['name'] }}</td><td class="right">{{ $b['orders'] }}</td><td class="right">{{ $fmt($b['sales']) }}</td><td class="right">{{ $b['share'] }}%</td><td class="right">{{ $fmt($b['gross_profit']) }}</td><td class="right">{{ $fmt($b['expenses']) }}</td><td class="right {{ $b['net'] < 0 ? 'red' : '' }}">{{ $fmt($b['net']) }}</td><td class="right">{{ $fmt($b['collected']) }}</td><td class="right">{{ $fmt($b['receivables']) }}</td></tr>
            @endforeach
        </table>
    @endif

    <table class="kpi" style="margin-top: 10px;">
        <tr>
            <td><span class="muted">Money collected</span><div class="v">{{ $fmt($s['collected']) }}</div>{{ $fmt($s['settlements']) }} old balances</td>
            <td><span class="muted">Customers owe</span><div class="v">{{ $fmt($s['receivables']) }}</div>{{ $fmt($s['credit_sales']) }} sold on credit</td>
            <td><span class="muted">Discounts</span><div class="v">{{ $fmt($s['discounts']) }}</div>senior/PWD {{ $fmt($s['senior_pwd']) }}</td>
            <td><span class="muted">Voids and refunds</span><div class="v">{{ $s['voided'] }}</div>{{ $fmt($s['voided_total']) }} voided, {{ $fmt($s['refunds']) }} refunded</td>
        </tr>
    </table>

    <h3>Sales by payment method</h3>
    <table class="lines">
        <tr><th>Method</th><th class="right">Amount</th></tr>
        @foreach ($r['byMethod'] as $m)<tr><td>{{ strtoupper($m['method']) }}</td><td class="right">{{ $fmt($m['total']) }}</td></tr>@endforeach
    </table>

    <h3>Sales by category</h3>
    <table class="lines">
        <tr><th>Category</th><th class="right">Revenue</th></tr>
        @foreach ($r['byCategory'] as $c)<tr><td>{{ $c['category'] }}</td><td class="right">{{ $fmt($c['revenue']) }}</td></tr>@endforeach
    </table>

    <h3>Staff performance</h3>
    <table class="lines">
        <tr><th>Staff</th><th>Branch</th><th class="right">Orders</th><th class="right">Sales</th><th class="right">Discounts</th><th class="right">Voids</th><th class="right">Over/short</th></tr>
        @forelse ($r['staff'] as $x)
            <tr><td>{{ $x['name'] }}</td><td>{{ $x['branches'] }}</td><td class="right">{{ $x['orders'] }}</td><td class="right">{{ $fmt($x['sales']) }}</td><td class="right">{{ $fmt($x['discounts']) }}</td><td class="right">{{ $x['voids'] }}</td><td class="right {{ $x['variance'] < 0 ? 'red' : '' }}">{{ $fmt($x['variance']) }}</td></tr>
        @empty
            <tr><td colspan="7" class="muted">No sales by staff in this range.</td></tr>
        @endforelse
    </table>

    <h3>Production</h3>
    <table class="lines">
        <tr><th class="right">Jobs taken</th><th class="right">Released</th><th class="right">Avg turnaround</th><th class="right">On time</th><th class="right">Open now</th><th class="right">Late now</th></tr>
        <tr>
            <td class="right">{{ $r['production']['taken'] }}</td>
            <td class="right">{{ $r['production']['released'] }}</td>
            <td class="right">{{ $r['production']['avg_turnaround_hours'] !== null ? $r['production']['avg_turnaround_hours'].' h' : '-' }}</td>
            <td class="right">{{ $r['production']['on_time_rate'] !== null ? $r['production']['on_time_rate'].'%' : '-' }}</td>
            <td class="right">{{ $r['production']['open_now'] }}</td>
            <td class="right {{ $r['production']['overdue_now'] > 0 ? 'red' : '' }}">{{ $r['production']['overdue_now'] }}</td>
        </tr>
    </table>

    <h3>Top customers</h3>
    <table class="lines">
        <tr><th>Customer</th><th class="right">Orders</th><th class="right">Sales</th><th class="right">Owes now</th></tr>
        @forelse ($r['topCustomers'] as $c)
            <tr><td>{{ $c['name'] }}{{ $c['branch'] && count($r['byBranch']) > 1 ? ' ('.$c['branch'].')' : '' }}</td><td class="right">{{ $c['orders'] }}</td><td class="right">{{ $fmt($c['sales']) }}</td><td class="right">{{ $fmt($c['balance']) }}</td></tr>
        @empty
            <tr><td colspan="4" class="muted">No named customers in this range.</td></tr>
        @endforelse
    </table>

    <h3>Top services and products</h3>
    <table class="lines">
        <tr><th>Item</th><th class="right">Qty</th><th class="right">Revenue</th><th class="right">Cost</th></tr>
        @foreach ($r['topItems'] as $i)<tr><td>{{ $i['name'] }}</td><td class="right">{{ $i['qty'] }}</td><td class="right">{{ $fmt($i['revenue']) }}</td><td class="right">{{ $fmt($i['cost']) }}</td></tr>@endforeach
    </table>

    <h3>Expenses by category</h3>
    <table class="lines">
        <tr><th>Category</th><th class="right">Amount</th></tr>
        @foreach ($r['expenseCategories'] as $e)<tr><td>{{ $e['category'] }}</td><td class="right">{{ $fmt($e['total']) }}</td></tr>@endforeach
    </table>

    <h3>Receivables aging</h3>
    <table class="lines">
        <tr>@foreach ($r['aging']['buckets'] as $b)<th class="right">{{ $b['bucket'] }} days</th>@endforeach<th class="right">Total</th></tr>
        <tr>@foreach ($r['aging']['buckets'] as $b)<td class="right">{{ $fmt($b['total']) }}</td>@endforeach<td class="right"><b>{{ $fmt($r['aging']['total']) }}</b></td></tr>
    </table>

    <h3>Voids and refunds</h3>
    <table class="lines">
        <tr><th>When</th><th>Order</th><th>What</th><th>By</th><th>Reason</th><th class="right">Amount</th></tr>
        @forelse ($r['voids'] as $v)
            <tr><td>{{ \Illuminate\Support\Carbon::parse($v['at'])->timezone(config('app.timezone'))->format('M j g:i A') }}</td><td>{{ $v['order_no'] }}{{ $v['branch'] && count($r['byBranch']) > 1 ? ' ('.$v['branch'].')' : '' }}</td><td>{{ $v['kind'] }}</td><td>{{ $v['user'] }}</td><td>{{ $v['reason'] }}</td><td class="right">{{ $fmt($v['amount']) }}</td></tr>
        @empty
            <tr><td colspan="6" class="muted">Nothing voided or refunded.</td></tr>
        @endforelse
    </table>

    <h3>Drawer sessions</h3>
    <table class="lines">
        <tr><th>#</th><th>Branch</th><th>Cashier</th><th>Opened</th><th class="right">Expected</th><th class="right">Counted</th><th class="right">Over/short</th></tr>
        @foreach ($r['sessions'] as $x)
            <tr>
                <td>{{ $x['id'] }}</td><td>{{ $x['branch'] }}</td><td>{{ $x['cashier'] }}</td>
                <td>{{ \Illuminate\Support\Carbon::parse($x['opened_at'])->timezone(config('app.timezone'))->format('M j g:i A') }}</td>
                <td class="right">{{ $x['expected_cash'] !== null ? $fmt($x['expected_cash']) : 'Open' }}</td>
                <td class="right">{{ $x['closing_counted'] !== null ? $fmt($x['closing_counted']) : '' }}</td>
                <td class="right {{ ($x['variance'] ?? 0) < 0 ? 'red' : '' }}">{{ $x['variance'] !== null ? $fmt($x['variance']) : '' }}</td>
            </tr>
        @endforeach
    </table>
@endsection
