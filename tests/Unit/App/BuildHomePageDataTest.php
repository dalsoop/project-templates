<?php

declare(strict_types=1);

use App\Actions\App\BuildHomePageData;
use App\Enums\DeployEnvironment;

it('홈 페이지 데이터 액션이 설정과 환경을 조합한다', function (): void {
    config()->set('app.name', 'Template App');
    config()->set('project.tagline', '규약을 먼저 고정하는 Laravel 템플릿');
    config()->set('project.support_email', 'hello@example.com');

    $data = app(BuildHomePageData::class)();

    expect($data->projectName)->toBe('Template App');
    expect($data->tagline)->toBe('규약을 먼저 고정하는 Laravel 템플릿');
    expect($data->supportEmail)->toBe('hello@example.com');
    expect($data->environment)->toBe(DeployEnvironment::Testing);
    expect($data->standards)->toContain('Invokable action and controller');
});
