<?php

declare(strict_types=1);

namespace Tools\PHPStan\Rules;

use PhpParser\Node;
use PHPStan\Analyser\Scope;
use PHPStan\Node\FileNode;
use PHPStan\Rules\IdentifierRuleError;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleErrorBuilder;

/**
 * @implements Rule<FileNode>
 */
final class MaxFileLinesRule implements Rule
{
    public function __construct(private readonly int $maxLines) {}

    public function getNodeType(): string
    {
        return FileNode::class;
    }

    /**
     * @return list<IdentifierRuleError>
     */
    public function processNode(Node $node, Scope $scope): array
    {
        $file = $scope->getFile();
        if (! is_readable($file)) {
            return [];
        }

        $contents = file_get_contents($file);
        if ($contents === false) {
            return [];
        }

        $lineCount = substr_count($contents, "\n") + 1;
        if ($lineCount <= $this->maxLines) {
            return [];
        }

        return [
            RuleErrorBuilder::message(\sprintf(
                '파일이 %d 줄을 초과합니다 (%d 줄). 책임을 분리해서 파일을 쪼개세요.',
                $this->maxLines,
                $lineCount,
            ))
                ->identifier('prelik.maxFileLines')
                ->file($file)
                ->line(1)
                ->build(),
        ];
    }
}
