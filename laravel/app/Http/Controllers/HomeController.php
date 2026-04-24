<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\App\BuildHomePageData;
use Illuminate\Contracts\View\View;

final class HomeController extends Controller
{
    public function __construct(private readonly BuildHomePageData $buildHomePageData) {}

    public function __invoke(): View
    {
        return view('pages.home', [
            'page' => ($this->buildHomePageData)(),
        ]);
    }
}
