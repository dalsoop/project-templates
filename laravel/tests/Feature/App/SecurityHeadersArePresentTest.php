<?php

declare(strict_types=1);

it('기본 응답에 보안 헤더를 추가한다', function (): void {
    $response = $this->get(route('home'));

    $response->assertHeader('X-Frame-Options', 'SAMEORIGIN');
    $response->assertHeader('X-Content-Type-Options', 'nosniff');
    $response->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
});
