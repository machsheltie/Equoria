#!/usr/bin/env bash
# Doctrine: no bypass headers in E2E specs or frontend api-client.
# Source: CLAUDE.md "21R Beta Readiness Doctrine" — "No bypass evidence".
#
# This check is intentionally absolute. There is no --exclude-dir flag and
# no per-file allowlist. If a beta-readiness spec needs a bypass header,
# that spec is broken and must be rewritten to use real auth/CSRF flows.
#
# The ONLY exemption mechanism is a per-line comment marker on the same
# line:  // doctrine-allow: bypass-header-literal
# Use sparingly and only for files whose purpose is to enforce this very
# doctrine (i.e., guard specs that scan for these strings). The marker
# makes the exemption visible at the call site, not hidden in a config.

set -uo pipefail

# Single source of truth for the bypass-header token set (Equoria-4iudq).
# The pattern previously duplicated here is now defined ONCE as
# EQUORIA_SCAN_RE_BYPASS_HEADER in scripts/lib/beta-readiness-scans.sh, where it
# was strengthened to the UNION of this check's tokens and the library's
# (adding x-test-bypass-ownership). Sourcing it here removes the duplication
# WITHOUT weakening this gate — the shared var is now a superset of the old
# inline literal (the library's 'bypass-auth' already covers the narrower
# 'x-test-bypass-auth' this check used to list). The library sets no shell
# options and only defines vars + functions, so sourcing is side-effect-free.
DOCTRINE_CHECK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/beta-readiness-scans.sh
source "$DOCTRINE_CHECK_DIR/../lib/beta-readiness-scans.sh"

PATTERN="$EQUORIA_SCAN_RE_BYPASS_HEADER"
MARKER='doctrine-allow: bypass-header-literal'

PATHS=(
  tests/e2e
  frontend/src/lib/api-client.ts
)

existing=()
for p in "${PATHS[@]}"; do
  [ -e "$p" ] && existing+=("$p")
done

if [ ${#existing[@]} -eq 0 ]; then
  exit 0
fi

matches=$(grep -rn "$PATTERN" "${existing[@]}" 2>/dev/null | grep -v '^Binary' | grep -v -F "$MARKER" || true)

if [ -n "$matches" ]; then
  echo
  echo "Bypass headers found in E2E or api-client (forbidden by 21R doctrine):"
  echo "$matches"
  echo
  echo "If a line is part of a doctrine-enforcement guard, append:"
  echo "    // $MARKER"
  exit 1
fi

exit 0
