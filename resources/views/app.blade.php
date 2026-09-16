@php($brand = \App\Support\Brand::head())
<!DOCTYPE html>
<html lang="en" data-theme="dark">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="theme-color" content="#0C0E12">
        <link rel="icon" href="{{ $brand['favicon'] }}">
        <title inertia>{{ $brand['name'] }}</title>
        <script>window.__brand = @json(['name' => $brand['name'], 'color' => $brand['color']]);</script>
        <script>
            (function () {
                try {
                    var t = localStorage.getItem('pr-theme');
                    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
                } catch (e) {}
            })();
        </script>
        @routes
        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        @inertiaHead
        {{-- After the stylesheet so it wins: the brand color feeds every accent token in app.css. Validated as #RRGGBB when saved. --}}
        <style>:root { --brand: {{ $brand['color'] }}; }</style>
    </head>
    <body>
        @inertia
    </body>
</html>
