<?php

declare(strict_types=1);

namespace App\Enums;

enum DeployEnvironment: string
{
    case Local = 'local';
    case Testing = 'testing';
    case Staging = 'staging';
    case Production = 'production';
    case Unknown = 'unknown';

    public static function fromAppEnvironment(string $environment): self
    {
        return match ($environment) {
            'local' => self::Local,
            'testing' => self::Testing,
            'staging' => self::Staging,
            'production' => self::Production,
            default => self::Unknown,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Local => 'Local',
            self::Testing => 'Testing',
            self::Staging => 'Staging',
            self::Production => 'Production',
            self::Unknown => 'Unknown',
        };
    }
}
