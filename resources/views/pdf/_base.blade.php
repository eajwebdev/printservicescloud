<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    @page { margin: {{ $margin ?? '28px 32px' }}; }
    * { box-sizing: border-box; }
    body { font-family: DejaVu Sans, sans-serif; color: #12151B; font-size: {{ $fontSize ?? '10px' }}; line-height: 1.4; margin: 0; }
    h1, h2, h3 { margin: 0; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; }
    .muted { color: #5B6472; }
    .red { color: #C21016; }
    .ok { color: #1a8f5a; }
    .right { text-align: right; }
    .center { text-align: center; }
    .mono { font-family: DejaVu Sans Mono, monospace; }
    .rule { border-top: 1px solid #12151B; }
    .hair { border-top: 1px solid #DCDDD8; }
    .dash { border-top: 1px dashed #9AA2B1; }
    .bar { height: 4px; background: #E4141B; }
    .lines th { text-align: left; font-size: 8.5px; color: #5B6472; font-weight: normal; padding: 6px 6px; border-bottom: 1px solid #12151B; }
    .lines td { padding: 7px 6px; border-bottom: 1px solid #E6E7E3; vertical-align: top; }
    .totals td { padding: 3px 6px; }
    .grand td { font-size: 1.35em; font-weight: bold; border-top: 1px solid #12151B; padding-top: 6px; }
    .crop { position: absolute; width: 14px; height: 14px; border-color: #9AA2B1; border-style: solid; }
    @yield('style')
</style>
</head>
<body>
@yield('body')
</body>
</html>
