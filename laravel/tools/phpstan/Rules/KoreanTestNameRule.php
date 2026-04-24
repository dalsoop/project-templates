<?php

declare(strict_types=1);

namespace Tools\PHPStan\Rules;

use PhpParser\Node;
use PhpParser\Node\Expr\FuncCall;
use PhpParser\Node\Name;
use PhpParser\Node\Scalar\String_;
use PHPStan\Analyser\Scope;
use PHPStan\Rules\IdentifierRuleError;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleErrorBuilder;

/**
 * @implements Rule<FuncCall>
 */
final class KoreanTestNameRule implements Rule
{
    /** @var list<string> */
    private const TEST_FUNCTIONS = ['it', 'test', 'describe'];

    public function getNodeType(): string
    {
        return FuncCall::class;
    }

    /**
     * @return list<IdentifierRuleError>
     */
    public function processNode(Node $node, Scope $scope): array
    {
        if (! $node->name instanceof Name) {
            return [];
        }

        $functionName = $node->name->toLowerString();
        if (! \in_array($functionName, self::TEST_FUNCTIONS, true)) {
            return [];
        }

        $file = $scope->getFile();
        if (! str_contains($file, '/tests/')) {
            return [];
        }

        $args = $node->getArgs();
        if ($args === []) {
            return [];
        }

        $firstArg = $args[0]->value;
        if (! $firstArg instanceof String_) {
            return [];
        }

        if (preg_match('/[\x{AC00}-\x{D7A3}]/u', $firstArg->value) === 1) {
            return [];
        }

        return [
            RuleErrorBuilder::message(\sprintf(
                '%s() 테스트 설명은 한글을 포함해야 합니다 — 받은 값: "%s"',
                $functionName,
                $firstArg->value,
            ))
                ->identifier('prelik.koreanTestName')
                ->build(),
        ];
    }
}
