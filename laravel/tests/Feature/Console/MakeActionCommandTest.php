<?php

declare(strict_types=1);

use Illuminate\Support\Facades\File;

it('액션 생성 커맨드가 invokable 액션 클래스를 만든다', function (): void {
    $target = app_path('Actions/Billing/SyncBillingPortal.php');

    File::delete($target);
    File::deleteDirectory(app_path('Actions/Billing'));

    try {
        $this->artisan('make:action', ['name' => 'Billing/SyncBillingPortal'])
            ->assertExitCode(0);

        expect(File::exists($target))->toBeTrue();

        $contents = File::get($target);

        expect($contents)->toContain('final class SyncBillingPortal');
        expect($contents)->toContain('public function __invoke(): void');
    } finally {
        File::delete($target);
        File::deleteDirectory(app_path('Actions/Billing'));
    }
});
