<?php

declare(strict_types=1);

namespace Tools\PHPStan\Rules;

use PhpParser\Node;
use PHPStan\Analyser\Scope;
use PHPStan\Node\InClassNode;
use PHPStan\Rules\IdentifierRuleError;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleErrorBuilder;
use ReflectionMethod;

/**
 * @implements Rule<InClassNode>
 */
final class SingleInvokeOnlyRule implements Rule
{
    /**
     * @param  list<string>  $enforcedNamespacePrefixes
     */
    public function __construct(private readonly array $enforcedNamespacePrefixes) {}

    public function getNodeType(): string
    {
        return InClassNode::class;
    }

    /**
     * @return list<IdentifierRuleError>
     */
    public function processNode(Node $node, Scope $scope): array
    {
        $classReflection = $node->getClassReflection();
        $className = $classReflection->getName();

        $matched = false;
        foreach ($this->enforcedNamespacePrefixes as $prefix) {
            if (str_starts_with($className, $prefix)) {
                $matched = true;
                break;
            }
        }

        if (! $matched) {
            return [];
        }

        if ($classReflection->isAbstract() || $classReflection->isInterface() || $classReflection->isTrait()) {
            return [];
        }

        $native = $classReflection->getNativeReflection();
        $violations = [];

        foreach ($native->getMethods(ReflectionMethod::IS_PUBLIC) as $method) {
            if ($method->getDeclaringClass()->getName() !== $className) {
                continue;
            }

            $name = $method->getName();
            if ($method->isConstructor() || $method->isDestructor()) {
                continue;
            }

            if ($name === '__invoke') {
                continue;
            }

            $violations[] = $name.'()';
        }

        if ($violations === []) {
            return [];
        }

        return [
            RuleErrorBuilder::message(\sprintf(
                '"%s" 는 public 메서드로 __invoke 하나만 허용됩니다. 위반: %s',
                $className,
                implode(', ', $violations),
            ))
                ->identifier('prelik.singleInvokeOnly')
                ->build(),
        ];
    }
}
