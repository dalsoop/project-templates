<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Filesystem\Filesystem;
use Illuminate\Support\Str;
use Symfony\Component\Console\Attribute\AsCommand;

#[AsCommand(name: 'make:endpoint')]
final class MakeEndpointCommand extends Command
{
    protected $signature = 'make:endpoint {name : Endpoint base name, e.g. Billing/StoreInvoice} {--test : Generate a Pest feature test}';

    protected $description = 'Create an action + invokable controller endpoint pair';

    public function __construct(private readonly Filesystem $files)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $name = trim((string) $this->argument('name'));
        $segments = array_values(array_filter(
            explode('/', str_replace('\\', '/', $name)),
            static fn (string $segment): bool => $segment !== '',
        ));

        if ($segments === []) {
            $this->components->error('Endpoint name is required.');

            return self::FAILURE;
        }

        $classBase = array_pop($segments);
        if (! \is_string($classBase) || $classBase === '') {
            $this->components->error('Endpoint class name is invalid.');

            return self::FAILURE;
        }

        $relativePath = implode('/', $segments);
        $namespaceSuffix = $segments === [] ? '' : '\\'.implode('\\', $segments);

        $actionClass = $classBase;
        $controllerClass = $classBase.'Controller';

        $actionPath = app_path('Actions'.($relativePath === '' ? '' : '/'.$relativePath).'/'.$actionClass.'.php');
        $controllerPath = app_path('Http/Controllers'.($relativePath === '' ? '' : '/'.$relativePath).'/'.$controllerClass.'.php');
        $testPath = base_path('tests/Feature'.($relativePath === '' ? '' : '/'.$relativePath).'/'.$controllerClass.'Test.php');

        $targets = [$actionPath, $controllerPath];
        if ((bool) $this->option('test')) {
            $targets[] = $testPath;
        }

        foreach ($targets as $target) {
            if ($this->files->exists($target)) {
                $this->components->error("File already exists: {$target}");

                return self::FAILURE;
            }
        }

        $this->writeFile(
            $actionPath,
            $this->renderStub('endpoint-action.stub', [
                '{{ namespace }}' => 'App\\Actions'.$namespaceSuffix,
                '{{ class }}' => $actionClass,
            ]),
        );

        $this->writeFile(
            $controllerPath,
            $this->renderStub('endpoint-controller.stub', [
                '{{ namespace }}' => 'App\\Http\\Controllers'.$namespaceSuffix,
                '{{ class }}' => $controllerClass,
                '{{ actionNamespace }}' => 'App\\Actions'.$namespaceSuffix.'\\'.$actionClass,
                '{{ actionClass }}' => $actionClass,
                '{{ actionVariable }}' => Str::camel($actionClass),
            ]),
        );

        if ((bool) $this->option('test')) {
            $this->writeFile(
                $testPath,
                $this->renderStub('endpoint-test.stub', [
                    '{{ controllerClass }}' => $controllerClass,
                ]),
            );
        }

        $this->components->info("Endpoint created: {$controllerClass}");

        return self::SUCCESS;
    }

    /**
     * @param  array<string, string>  $replacements
     */
    private function renderStub(string $stubName, array $replacements): string
    {
        $stub = $this->files->get(base_path('stubs/'.$stubName));

        return str_replace(array_keys($replacements), array_values($replacements), $stub);
    }

    private function writeFile(string $path, string $contents): void
    {
        $directory = \dirname($path);
        $this->files->ensureDirectoryExists($directory);
        $this->files->put($path, $contents);
    }
}
