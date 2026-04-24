<?php

declare(strict_types=1);

namespace Tools\PHPStan\Rules;

use PhpParser\Node;
use PhpParser\Node\Expr\FuncCall;
use PhpParser\Node\Name;
use PHPStan\Analyser\Scope;
use PHPStan\Rules\IdentifierRuleError;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleErrorBuilder;

/**
 * @implements Rule<FuncCall>
 */
final class NoConfigDefaultRule implements Rule
{
    /** @var list<string> */
    private const FORBIDDEN_FUNCTIONS = [
        'config',
        'env',
        'data_get',
        'array_get',
        'old',
    ];

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
        if (! \in_array($functionName, self::FORBIDDEN_FUNCTIONS, true)) {
            return [];
        }

        if (\count($node->getArgs()) < 2) {
            return [];
        }

        return [
            RuleErrorBuilder::message(\sprintf(
                '%s() 두 번째 인자(기본값) 금지 — 값은 enum / 클래스 const 로 승격하세요.',
                $functionName,
            ))
                ->identifier('prelik.noConfigDefault')
                ->build(),
        ];
    }
}
