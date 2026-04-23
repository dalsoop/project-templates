#!/usr/bin/env bash
set -euo pipefail

OUT="$(vendor/bin/phpmnd app \
    --hint \
    --extensions=default_parameter,argument,return \
    --ignore-numbers=-1,0,1,2 \
    --ignore-funcs=round,sleep 2>&1)"

echo "$OUT"

TOTAL="$(echo "$OUT" | grep -oE 'Total of Magic Numbers: [0-9]+' | grep -oE '[0-9]+' | tail -1)"
TOTAL="${TOTAL:-0}"

if [[ "$TOTAL" != "0" ]]; then
    echo ""
    echo "✗ phpmnd: 매직 넘버 ${TOTAL} 개 발견 — enum / 클래스 const 로 승격하세요"
    exit 1
fi

echo "✓ phpmnd: 매직 넘버 없음"
