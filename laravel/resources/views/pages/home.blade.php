<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $page->projectName }}</title>
    <style>
        :root {
            color-scheme: light;
            --background: #f7f4ed;
            --surface: #fffdf8;
            --border: #d9cfbb;
            --text: #1f2a1f;
            --muted: #5f6458;
            --accent: #3f6d52;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            font-family: "Iowan Old Style", "Palatino Linotype", serif;
            background:
                radial-gradient(circle at top left, rgba(63, 109, 82, 0.12), transparent 30%),
                linear-gradient(180deg, #fbf9f3 0%, var(--background) 100%);
            color: var(--text);
        }

        main {
            max-width: 920px;
            margin: 0 auto;
            padding: 56px 20px 80px;
        }

        section {
            background: rgba(255, 253, 248, 0.92);
            border: 1px solid var(--border);
            border-radius: 24px;
            padding: 28px;
            box-shadow: 0 18px 40px rgba(31, 42, 31, 0.08);
        }

        h1 {
            margin: 0 0 12px;
            font-size: clamp(2.4rem, 6vw, 4.4rem);
            line-height: 0.96;
            letter-spacing: -0.05em;
        }

        p {
            margin: 0;
            color: var(--muted);
            line-height: 1.6;
        }

        .meta {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin: 24px 0 32px;
        }

        .badge {
            border: 1px solid var(--border);
            border-radius: 999px;
            padding: 8px 14px;
            color: var(--accent);
            background: rgba(63, 109, 82, 0.07);
            font-size: 0.92rem;
        }

        ul {
            margin: 28px 0 0;
            padding-left: 20px;
        }

        li + li {
            margin-top: 10px;
        }

        footer {
            margin-top: 24px;
            font-size: 0.95rem;
            color: var(--muted);
        }
    </style>
</head>
<body>
<main>
    <section>
        <h1>{{ $page->projectName }}</h1>
        <p>{{ $page->tagline }}</p>

        <div class="meta">
            <span class="badge">Environment: {{ $page->environment->label() }}</span>
            <span class="badge">Support: {{ $page->supportEmail }}</span>
        </div>

        <p>이 템플릿은 Prelik 쇼핑몰에서 정리한 코드 레벨 규약만 분리해서 재사용 가능하게 만든 Laravel 시작점이다.</p>

        <ul>
            @foreach ($page->standards as $standard)
                <li>{{ $standard }}</li>
            @endforeach
        </ul>

        <footer>새 프로젝트는 `php artisan make:endpoint`, `php artisan make:action`, Pest, PHPStan, Pint 기준으로 바로 시작할 수 있다.</footer>
    </section>
</main>
</body>
</html>
