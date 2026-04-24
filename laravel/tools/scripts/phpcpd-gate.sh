#!/usr/bin/env bash
# PHP Copy-Paste Detector (jscpd) — 중복 코드 블록 감지
set -euo pipefail

echo "▶ 중복 코드(jscpd) 검사..."

OUTPUT=$(npx --no jscpd app/ \
    --min-lines 6 \
    --min-tokens 80 \
    --reporters console \
    --ignore "app/Filament/**" 2>&1)

echo "$OUTPUT"

if echo "$OUTPUT" | grep -q "Found [^0] clones"; then
    echo "❌  중복 코드 감지. 리팩터링 후 커밋하세요."
    exit 1
fi

echo "✅  중복 코드 검사 통과"
