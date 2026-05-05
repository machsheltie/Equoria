#!/usr/bin/env bash
# Doctrine: no stale `.js` extension imports inside backend app code.
# Source: ES_MODULES_REQUIREMENTS.md — backend is `.mjs`-only. A `.js`
# extension in a static or dynamic import resolves to a non-existent file
# under Node.js ESM (no extension fallback), failing at module-load or
# at the moment the dynamic import runs.
#
# Equoria-lk81 (21R-SEC-3-REVIEW-7): sentinel-positive sweep test. Without
# this check, regressions can land that only fail when a specific route
# is hit or a specific test shard runs (CI may green if the affected
# path isn't exercised that run).
#
# What this checks:
#   - import('...js') and require('...js') in dynamic-import position
#   - from '...js' in static-import position
# What this allows:
#   - Imports of real `.js` files in node_modules (e.g. @prisma/client)
#   - Imports of supertest's index.js
#   - Marker `// doctrine-allow: stale-js-extension` for the rare cases
#     where a true `.js` import is intentional inside app code (none today)
#
# Exit code: 0 if clean, 1 if any stale `.js` import is found.

set -uo pipefail

PATTERN='from[[:space:]]\+["'"'"'][^"'"'"']*\.js["'"'"']\|import(["'"'"'][^"'"'"']*\.js["'"'"'])\|require(["'"'"'][^"'"'"']*\.js["'"'"'])'
MARKER='doctrine-allow: stale-js-extension'

PATHS=(
  backend/modules
  backend/services
  backend/middleware
  backend/controllers
  backend/routes
  backend/utils
  backend/seed
  backend/tests
  backend/__tests__
  backend/app.mjs
  backend/server.mjs
)

existing=()
for p in "${PATHS[@]}"; do
  [ -e "$p" ] && existing+=("$p")
done

if [ ${#existing[@]} -eq 0 ]; then
  exit 0
fi

# grep returns 1 when no matches; do not let pipefail kill us on the
# success-no-match case.
matches=$(
  grep -rn --include='*.mjs' --include='*.js' "$PATTERN" "${existing[@]}" 2>/dev/null \
    | grep -v 'node_modules/' \
    | grep -v -F "$MARKER" \
    || true
)

if [ -n "$matches" ]; then
  echo
  echo "Stale .js extension imports found in backend app code (forbidden by ES_MODULES_REQUIREMENTS):"
  echo "$matches"
  echo
  echo "Replace .js with .mjs to match the actual file. Backend is .mjs-only."
  echo "If a .js import is genuinely intentional, add a same-line comment marker:"
  echo "    // $MARKER"
  exit 1
fi

exit 0
