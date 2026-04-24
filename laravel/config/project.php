<?php

declare(strict_types=1);

return [
    'tagline' => env('PROJECT_TAGLINE', 'Ship strict, reviewable Laravel code.'),
    'support_email' => env('PROJECT_SUPPORT_EMAIL', 'dev@example.com'),
    'security_headers' => [
        'X-Frame-Options' => 'SAMEORIGIN',
        'X-Content-Type-Options' => 'nosniff',
        'Referrer-Policy' => 'strict-origin-when-cross-origin',
        'Permissions-Policy' => 'camera=(), microphone=(), geolocation=()',
    ],
    'standards' => [
        'declare(strict_types=1)',
        'final class by default',
        'Invokable action and controller',
        'Pest + PHPStan + Pint in CI',
        'Custom PHPStan rules for config, file size, and naming',
    ],
];
