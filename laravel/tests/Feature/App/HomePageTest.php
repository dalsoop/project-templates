<?php

declare(strict_types=1);

it('홈 페이지가 템플릿 규약을 노출한다', function (): void {
    config()->set('app.name', 'laravel-template');

    $response = $this->get(route('home'));

    $response->assertOk();
    $response->assertSee('laravel-template');
    $response->assertSee('declare(strict_types=1)');
    $response->assertSee('make:endpoint');
});
