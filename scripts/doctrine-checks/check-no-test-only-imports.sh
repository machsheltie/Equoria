#!/usr/bin/env bash
# Doctrine: no production code imports a __TESTING_ONLY_* binding.
#
# Test-only exports (named `__TESTING_ONLY_*`) are escape hatches added so
# integration tests can monkey-patch internal classes/functions to inject
# controlled failures (e.g., stubbing `JsonScanner.prototype.scan` to throw
# RangeError to prove the silent-catch fix in 21R-SEC-3-FOLLOW-1). They
# expose internal references that production code MUST NOT use — doing so
# bypasses the public API of the module and creates a path for an attacker
# (or a careless contributor) to disable a security gate at runtime.
#
# This check is broader than the ESLint `no-restricted-imports` rule in
# backend/eslint.config.mjs:
#   - The lint rule blocks specific exact `importNames` (one entry per
#     known test-only export). New `__TESTING_ONLY_*` exports added later
#     are NOT covered until a maintainer remembers to update the rule.
#   - This grep matches the convention itself (`__TESTING_ONLY_` prefix),
#     catching any future export that follows the convention.
#
# Source: .claude/rules/OPTIMAL_FIX_DISCIPLINE.md §3 (adjacent-locations
# check) — when a defense uses a naming convention as part of its safety
# story, the convention itself must be enforced, not the individual
# instances.

# Patch #27 (review hardening): -e ensures the script aborts on
# unexpected command failures (e.g., grep returning a permissions
# error before the `|| true`). Combined with -uo pipefail, this
# closes the "infrastructure error → silent green pass" hole.
set -euo pipefail

# Paths to scan (production code only).
PRODUCTION_PATHS=(
  backend
  frontend/src
)

# Patch #6 (review hardening): positive sentinel. Without this, a CI
# misconfiguration that runs the script from the wrong working
# directory (or a worktree that lacks `backend/`/`frontend/src` for
# any reason) silently passed with exit 0 — the script would emit
# "no paths to scan" and pretend everything was fine. Now the
# script EXITS NON-ZERO if neither expected production path exists,
# forcing the operator to investigate rather than trust a green light.
existing=()
for p in "${PRODUCTION_PATHS[@]}"; do
  [ -d "$p" ] && existing+=("$p")
done

if [ ${#existing[@]} -eq 0 ]; then
  echo "doctrine-check: ERROR — neither '${PRODUCTION_PATHS[0]}' nor '${PRODUCTION_PATHS[1]}' exists relative to the working directory ($(pwd))." >&2
  echo "doctrine-check: this almost certainly means the script is being run from the wrong directory." >&2
  echo "doctrine-check: refusing to silently pass — re-run from the repo root." >&2
  exit 2
fi

# Only check JS/TS source files. Also filter out test paths in the grep
# pipeline below (--exclude-dir for directories, post-filter for filename
# patterns like *.test.*).
TEST_DIR_EXCLUDES=(
  --exclude-dir=__tests__
  --exclude-dir=tests
  --exclude-dir=node_modules
  --exclude-dir=coverage
  --exclude-dir=coverage-security
  --exclude-dir=dist
  --exclude-dir=build
)

PATTERN='__TESTING_ONLY_'

# Match only ACTUAL import statements (not arbitrary string mentions).
# The two single-line forms covered:
#   import { __TESTING_ONLY_X } from '...';
#   const { __TESTING_ONLY_X } = require('...');   // ban via import/no-commonjs anyway
# Multi-line imports across newlines are not caught by line-level grep —
# accept this limitation; tracked as Equoria-tie0 (21R-SEC-3-FOLLOW-11)
# for AST-based replacement. The ESLint rule in backend/eslint.config.mjs
# covers multi-line imports of the specific known names as a partial
# stop-gap.
#
# Filters applied in order:
#   1. include only JS/TS source files
#   2. exclude test directories and node_modules-equivalent caches
#   3. exclude test-named files (*.test.*, *.spec.*)
#   4. exclude requestBodySecurity.mjs by PATH (patch #25): a global
#      basename exclude (--exclude='requestBodySecurity.mjs') would also
#      hide a same-named file that someone created elsewhere. Path-
#      anchored exclude only hides the canonical defining file.
#   5. exclude lint/build configs that reference the name as config data
#      (eslint.config.*, .eslintrc.*) — these are not imports
#   6. require the line to LOOK like an import statement: contains both
#      `import` (or `require`) and the __TESTING_ONLY_ token. Pure string
#      mentions in comments/code that don't match this shape are allowed.
#
# Note: with `set -e` enabled, the trailing `|| true` is REQUIRED to
# prevent a "no matches found" (grep exit 1) from aborting the script.
matches=$(
  grep -rn "$PATTERN" \
    --include='*.mjs' --include='*.js' \
    --include='*.ts' --include='*.tsx' \
    --exclude='eslint.config.*' \
    --exclude='.eslintrc.*' \
    "${TEST_DIR_EXCLUDES[@]}" \
    "${existing[@]}" 2>/dev/null \
    | grep -v -E '/[^/]+\.(test|spec)\.[a-z]+:' \
    | grep -v -E '^backend/middleware/requestBodySecurity\.mjs:' \
    | grep -E '(import|require)' \
    || true
)

if [ -n "$matches" ]; then
  echo
  echo "Production code imports a __TESTING_ONLY_* binding (forbidden):"
  echo "$matches"
  echo
  echo "Test-only exports (prefix __TESTING_ONLY_) are runtime-gated escape"
  echo "hatches for tests. Production code must use the module's public API."
  echo "If you genuinely need access from production, refactor the module to"
  echo "expose a proper public API for that use case — do not consume the"
  echo "test-only binding."
  exit 1
fi

exit 0
