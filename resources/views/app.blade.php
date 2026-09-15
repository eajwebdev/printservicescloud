<!DOCTYPE html>
<html lang="en" data-theme="dark">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="theme-color" content="#0C0E12">
        <link rel="icon" type="image/png" href="{{ asset('favicon.png') }}">
        <title inertia>{{ config('app.name', 'SKC Custom Print') }}</title>
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
    </head>
    <body>
        @inertia
    </body>
</html>
