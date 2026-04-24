<?php

declare(strict_types=1);

namespace App\Support\App;

use App\Enums\DeployEnvironment;

final readonly class HomePageData
{
    /**
     * @param  list<string>  $standards
     */
    public function __construct(
        public string $projectName,
        public string $tagline,
        public DeployEnvironment $environment,
        public array $standards,
        public string $supportEmail,
    ) {}
}
