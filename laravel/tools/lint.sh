#!/usr/bin/env bash
set -euo pipefail

composer validate --strict >/dev/null

while IFS= read -r -d '' file; do
    php -l "$file" >/dev/null
done < <(find app bootstrap config database routes tests tools -name '*.php' -print0 | sort -z)

if grep -R --line-number --exclude-dir=vendor 'TODO: replace template placeholder' app config resources routes tests stubs >/dev/null; then
    echo 'template placeholder TODO detected'
    exit 1
fi

if grep -R --line-number -E 'Route::(resource|apiResource|singleton|apiSingleton)\(' routes app >/dev/null; then
    echo 'resource routes are disallowed; use explicit routes to invokable controllers'
    exit 1
fi
