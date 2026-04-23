#!/usr/bin/env bash
# Detect hardcoded values that must live in config/env
set -euo pipefail

ERRORS=0

# 1. $_ENV / $_SERVER 직접 접근 — env() 헬퍼 사용해야 함
echo '▶ $_ENV / $_SERVER 직접 접근 검사...'
if grep -rn '\$_ENV\[' app/ 2>/dev/null | grep -v '\.blade\.php'; then
    echo '❌  $_ENV 직접 접근 금지. env() 헬퍼를 사용하세요.'
    ERRORS=$((ERRORS + 1))
fi
if grep -rn '\$_SERVER\[' app/ 2>/dev/null | grep -v '\.blade\.php'; then
    echo '❌  $_SERVER 직접 접근 금지. env() 또는 Request를 사용하세요.'
    ERRORS=$((ERRORS + 1))
fi

# 2. 하드코딩된 IP 주소 (루프백/사설망)
echo '▶ 하드코딩 IP 주소 검사...'
if grep -rEn '"(127\.0\.0\.1|0\.0\.0\.0|localhost|10\.[0-9]+\.[0-9]+\.[0-9]+|192\.168\.[0-9]+\.[0-9]+)"' \
    app/ 2>/dev/null | grep -v '\.blade\.php'; then
    echo '❌  하드코딩 IP/localhost 금지. config/env 변수를 사용하세요.'
    ERRORS=$((ERRORS + 1))
fi

# 3. 하드코딩 외부 URL — 문자열 리터럴 내 http(s):// 로 시작하는 도메인
echo '▶ 하드코딩 외부 URL 검사...'
if grep -rEn '"https?://[a-zA-Z0-9]' app/ 2>/dev/null \
    | grep -v '\.blade\.php' \
    | grep -v '//' ; then
    echo '❌  하드코딩 URL 금지. config/env 변수를 사용하세요.'
    ERRORS=$((ERRORS + 1))
fi

if [ "$ERRORS" -gt 0 ]; then
    echo ""
    echo "하드코딩 위반 ${ERRORS}건 발견. 커밋을 중단합니다."
    exit 1
fi

echo '✅  하드코딩 검사 통과'
