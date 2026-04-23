<?php

declare(strict_types=1);

use Illuminate\Support\Facades\File;

it('엔드포인트 생성 커맨드가 액션과 컨트롤러와 테스트를 만든다', function (): void {
    $actionPath = app_path('Actions/Billing/StoreInvoice.php');
    $controllerPath = app_path('Http/Controllers/Billing/StoreInvoiceController.php');
    $testPath = base_path('tests/Feature/Billing/StoreInvoiceControllerTest.php');

    File::delete($actionPath);
    File::delete($controllerPath);
    File::delete($testPath);
    File::deleteDirectory(app_path('Actions/Billing'));
    File::deleteDirectory(app_path('Http/Controllers/Billing'));
    File::deleteDirectory(base_path('tests/Feature/Billing'));

    try {
        $this->artisan('make:endpoint', [
            'name' => 'Billing/StoreInvoice',
            '--test' => true,
        ])->assertExitCode(0);

        expect(File::exists($actionPath))->toBeTrue();
        expect(File::exists($controllerPath))->toBeTrue();
        expect(File::exists($testPath))->toBeTrue();

        $actionContents = File::get($actionPath);
        $controllerContents = File::get($controllerPath);
        $testContents = File::get($testPath);

        expect($actionContents)->toContain('declare(strict_types=1);');
        expect($actionContents)->toContain('final class StoreInvoice');
        expect($actionContents)->toContain('public function __invoke(Request $request): void');

        expect($controllerContents)->toContain('declare(strict_types=1);');
        expect($controllerContents)->toContain('final class StoreInvoiceController');
        expect($controllerContents)->toContain('use App\Http\Controllers\Controller;');
        expect($controllerContents)->toContain('public function __invoke(Request $request): Response');
        expect($controllerContents)->toContain('($this->storeInvoice)($request);');

        expect($testContents)->toContain("it('StoreInvoiceController 엔드포인트를 구현한다'");
    } finally {
        File::delete($actionPath);
        File::delete($controllerPath);
        File::delete($testPath);
        File::deleteDirectory(app_path('Actions/Billing'));
        File::deleteDirectory(app_path('Http/Controllers/Billing'));
        File::deleteDirectory(base_path('tests/Feature/Billing'));
    }
});
