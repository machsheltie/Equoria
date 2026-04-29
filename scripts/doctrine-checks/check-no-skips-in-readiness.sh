#!/usr/bin/env bash
# Doctrine: no it.skip / test.skip / describe.skip / test.fixme in any
# beta-readiness Playwright spec.
# Source: CLAUDE.md "21R Beta Readiness Doctrine" — "No graceful skips".

set -uo pipefail

READINESS_PATHS=(
  tests/e2e/readiness
  tests/e2e/beta-readiness
)

PATTERN='\.skip\s*(\|\.fixme\s*('

existing=()
for p in "${READINESS_PATHS[@]}"; do
  [ -d "$p" ] && existing+=("$p")
done

if [ ${#existing[@]} -eq 0 ]; then
  exit 0
fi

matches=$(grep -rn -E '(it|test|describe)\.skip *\(|(it|test)\.fixme *\(' "${existing[@]}" 2>/dev/null | grep -v '^Binary' || true)

if [ -n "$matches" ]; then
  echo
  echo "Skipped tests found in beta-readiness paths (forbidden by 21R doctrine):"
  echo "$matches"
  exit 1
fi

exit 0
