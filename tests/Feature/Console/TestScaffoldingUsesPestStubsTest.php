<?php

declare(strict_types=1);

use Illuminate\Support\Facades\File;

it('테스트 생성 스텁이 pest 스타일을 사용한다', function (): void {
    $featurePath = base_path('tests/Feature/Billing/CreateInvoiceTest.php');
    $unitPath = base_path('tests/Unit/Billing/InvoiceNumberTest.php');

    File::delete($featurePath);
    File::delete($unitPath);
    File::deleteDirectory(base_path('tests/Feature/Billing'));
    File::deleteDirectory(base_path('tests/Unit/Billing'));

    try {
        $this->artisan('make:test', ['name' => 'Billing/CreateInvoiceTest'])
            ->assertExitCode(0);

        $this->artisan('make:test', ['name' => 'Billing/InvoiceNumberTest', '--unit' => true])
            ->assertExitCode(0);

        $featureContents = File::get($featurePath);
        $unitContents = File::get($unitPath);

        expect($featureContents)->toContain('declare(strict_types=1);');
        expect($featureContents)->toContain("it('페이지가 정상 응답을 반환한다'");
        expect($featureContents)->not->toContain('final class');

        expect($unitContents)->toContain('declare(strict_types=1);');
        expect($unitContents)->toContain("it('기본 단언이 동작한다'");
        expect($unitContents)->not->toContain('final class');
    } finally {
        File::delete($featurePath);
        File::delete($unitPath);
        File::deleteDirectory(base_path('tests/Feature/Billing'));
        File::deleteDirectory(base_path('tests/Unit/Billing'));
    }
});
