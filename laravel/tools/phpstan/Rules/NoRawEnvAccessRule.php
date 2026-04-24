<?php

declare(strict_types=1);

namespace Tools\PHPStan\Rules;

use PhpParser\Node;
use PhpParser\Node\Expr\ArrayDimFetch;
use PhpParser\Node\Expr\Variable;
use PHPStan\Analyser\Scope;
use PHPStan\Rules\IdentifierRuleError;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleErrorBuilder;

/**
 * @implements Rule<ArrayDimFetch>
 */
final class NoRawEnvAccessRule implements Rule
{
    /** @var list<string> */
    private const FORBIDDEN_SUPERGLOBALS = ['_ENV', '_SERVER'];

    public function getNodeType(): string
    {
        return ArrayDimFetch::class;
    }

    /**
     * @return list<IdentifierRuleError>
     */
    public function processNode(Node $node, Scope $scope): array
    {
        if (! $node->var instanceof Variable) {
            return [];
        }

        $name = $node->var->name;
        if (! \is_string($name)) {
            return [];
        }

        if (! \in_array($name, self::FORBIDDEN_SUPERGLOBALS, true)) {
            return [];
        }

        return [
            RuleErrorBuilder::message(\sprintf(
                '$%s 직접 접근 금지 — env() 헬퍼 또는 Request 객체를 사용하세요.',
                $name,
            ))
                ->identifier('prelik.noRawEnvAccess')
                ->build(),
        ];
    }
}
