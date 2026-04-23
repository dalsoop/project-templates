<?php

declare(strict_types=1);

namespace App\Actions\App;

use App\Enums\DeployEnvironment;
use App\Support\App\HomePageData;

final class BuildHomePageData
{
    public function __invoke(): HomePageData
    {
        $standards = config('project.standards');

        return new HomePageData(
            projectName: (string) config('app.name'),
            tagline: (string) config('project.tagline'),
            environment: DeployEnvironment::fromAppEnvironment((string) app()->environment()),
            standards: \is_array($standards) ? array_values($standards) : [],
            supportEmail: (string) config('project.support_email'),
        );
    }
}
