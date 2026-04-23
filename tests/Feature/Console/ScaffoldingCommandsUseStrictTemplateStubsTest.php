<?php

declare(strict_types=1);

use Illuminate\Support\Facades\File;

it('기본 생성 스텁이 strict types 와 final 을 포함한다', function (): void {
    $providersPath = base_path('bootstrap/providers.php');
    $originalProviders = File::get($providersPath);

    $cases = [
        [
            'command' => 'make:request',
            'arguments' => ['name' => 'Billing/StoreBillingRequest'],
            'path' => app_path('Http/Requests/Billing/StoreBillingRequest.php'),
        ],
        [
            'command' => 'make:job',
            'arguments' => ['name' => 'Billing/SyncLedger'],
            'path' => app_path('Jobs/Billing/SyncLedger.php'),
        ],
        [
            'command' => 'make:provider',
            'arguments' => ['name' => 'BillingServiceProvider'],
            'path' => app_path('Providers/BillingServiceProvider.php'),
        ],
    ];

    File::deleteDirectory(app_path('Http/Requests/Billing'));
    File::deleteDirectory(app_path('Jobs/Billing'));
    File::delete(app_path('Providers/BillingServiceProvider.php'));

    try {
        foreach ($cases as $case) {
            File::delete($case['path']);

            $this->artisan($case['command'], $case['arguments'])
                ->assertExitCode(0);

            expect(File::exists($case['path']))->toBeTrue();

            $contents = File::get($case['path']);

            expect($contents)->toContain('declare(strict_types=1);');
            expect($contents)->toContain('final class');
        }
    } finally {
        File::put($providersPath, $originalProviders);
        File::deleteDirectory(app_path('Http/Requests/Billing'));
        File::deleteDirectory(app_path('Jobs/Billing'));
        File::delete(app_path('Providers/BillingServiceProvider.php'));
    }
});
