#!/usr/bin/env bash
# =============================================================================
# Equoria Beta Deployment Readiness Gate
# =============================================================================
#
# Runs all gates required before deploying to beta testers. Every gate must
# pass before a human signoff is valid.
#
# Prerequisites:
#   - Database running and migrations applied
#   - Backend + frontend dev server running (for E2E gate)
#   - Dependencies installed: npm install at root, frontend, and packages/database
#
# Usage:
#   bash scripts/check-beta-readiness.sh                  # all gates (required for signoff)
#   bash scripts/check-beta-readiness.sh --no-signoff-write  # dry-run: full report, no YAML write
#
# The only supported flag is --no-signoff-write, which suppresses the automatic
# rewrite of the last_gate_run block in docs/beta-signoff.yaml. Use this in CI
# jobs or local test runs where you want the full pass/fail report without
# touching the signoff record.
#
# Gate skips are NOT supported. Beta readiness is not valid unless every gate
# passes. If an environment cannot run the full gate (e.g., a CI runner without
# Playwright browsers or a database), that environment cannot produce
# beta-readiness signoff and must run a different, clearly-labelled static
# check job instead.
#
# Signoff process (after all gates pass):
#   1. docs/beta-signoff.yaml last_gate_run block is auto-updated by this script
#      (unless --no-signoff-write was passed).
#   2. Get explicit human approval (project lead) to mark beta-deployment-readiness
#      by filling in signoff.signed_off_by and signoff.signed_off_date.
#   3. Update _bmad-output/implementation-artifacts/sprint-status.yaml as appropriate
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Flag parsing — only --no-signoff-write is accepted
# ---------------------------------------------------------------------------
NO_SIGNOFF_WRITE=0
for arg in "$@"; do
  case "$arg" in
    --no-signoff-write)
      NO_SIGNOFF_WRITE=1
      ;;
    *)
      echo "ERROR: Unknown argument: $arg" >&2
      echo "Usage: bash scripts/check-beta-readiness.sh [--no-signoff-write]" >&2
      echo "  --no-signoff-write  Suppress auto-write of docs/beta-signoff.yaml (dry-run/CI mode)" >&2
      exit 2
      ;;
  esac
done

# Detect Claude Code worktrees: Jest testMatch globs break when the CWD path
# contains \.claude because Node/Jest path normalization corrupts the segment
# (backslash-dot is treated as a regex escape), producing mixed-slash globs
# that micromatch cannot match. Zero test files are discovered.
TOPLEVEL="$(git rev-parse --show-toplevel 2>/dev/null || echo '')"
if [[ "$TOPLEVEL" == */.claude/worktrees/* ]]; then
  echo "ERROR: check-beta-readiness.sh must be run from the main project checkout." >&2
  echo "  Current worktree: $TOPLEVEL" >&2
  echo "  Switch to the main checkout and run:" >&2
  echo "    bash scripts/check-beta-readiness.sh" >&2
  exit 2
fi

PASS=0
FAIL=0
SKIPPED=0
REPORT_LINES=()

# Colour codes (disabled if not a tty)
if [ -t 1 ]; then
  GREEN='\033[0;32m'
  RED='\033[0;31m'
  YELLOW='\033[1;33m'
  RESET='\033[0m'
  BOLD='\033[1m'
else
  GREEN='' RED='' YELLOW='' RESET='' BOLD=''
fi

GATE_START=$(date +%s)
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
RUN_DATE=$(date '+%Y-%m-%d %H:%M:%S')

gate_pass() {
  local name="$1"
  REPORT_LINES+=("${GREEN}  PASS${RESET}  $name")
  ((PASS++)) || true
}

gate_fail() {
  local name="$1"
  local detail="${2:-}"
  REPORT_LINES+=("${RED}  FAIL${RESET}  $name${detail:+ — $detail}")
  ((FAIL++)) || true
}

run_gate() {
  local name="$1"
  shift
  printf "  Running: %s ...\n" "$name"
  if "$@" > /tmp/gate_out 2>&1; then
    gate_pass "$name"
  else
    local excerpt
    excerpt=$(tail -5 /tmp/gate_out 2>/dev/null | tr '\n' ' ')
    gate_fail "$name" "$excerpt"
  fi
}

echo ""
echo "${BOLD}====================================================${RESET}"
echo "${BOLD} EQUORIA BETA DEPLOYMENT READINESS GATE${RESET}"
echo "${BOLD}====================================================${RESET}"
echo "  Commit : $GIT_COMMIT"
echo "  Date   : $RUN_DATE"
echo ""

# ---------------------------------------------------------------------------
# GATE 1 — Doctrine checks (machine-enforced CLAUDE.md compliance)
# ---------------------------------------------------------------------------
echo "${BOLD}[1/10] Doctrine Checks${RESET}"
run_gate "Doctrine-checks suite (run-all.sh)" bash scripts/doctrine-checks/run-all.sh

# ---------------------------------------------------------------------------
# GATE 2 — Backend lint
# ---------------------------------------------------------------------------
echo "${BOLD}[2/10] Backend Lint${RESET}"
# Run lint:fix first (auto-fixes indent/formatting issues), then verify zero errors remain.
# ESLint exits 0 with no output when clean; exits non-zero with error output when issues remain.
run_gate "Backend ESLint (no errors)" bash -c "cd backend && npm run lint:fix > /dev/null 2>&1; npm run lint"

# ---------------------------------------------------------------------------
# GATE 3 — Frontend typecheck
# ---------------------------------------------------------------------------
echo "${BOLD}[3/10] Frontend Typecheck${RESET}"
run_gate "Frontend tsc --noEmit" bash -c "cd frontend && npx tsc --noEmit 2>&1"

# ---------------------------------------------------------------------------
# GATE 4 — Backend tests (routes + integration)
# ---------------------------------------------------------------------------
echo "${BOLD}[4/10] Backend Tests — Routes + Integration${RESET}"
run_gate "Routes tests" bash -c "cd backend && npm test -- --testPathPattern='tests/routes' --forceExit 2>&1"
run_gate "Integration tests" bash -c "cd backend && npm test -- --testPathPattern='tests/integration' --maxWorkers=1 --forceExit 2>&1"

# ---------------------------------------------------------------------------
# GATE 4b — Backend module-colocated tests (backend/modules/**/__tests__/)
# ---------------------------------------------------------------------------
# Commit 0d4c313a migrated 353+ tests to backend/modules/**/__tests__/. This
# gate ensures those module-colocated tests are included in the readiness check.
echo "${BOLD}[4b/10] Backend Tests — Module-Colocated (__tests__ dirs)${RESET}"
run_gate "Module tests (backend/modules/*/__tests__)" bash -c "cd backend && npm test -- --testPathPattern='modules/.*/__tests__/' --maxWorkers=2 --forceExit 2>&1"

# ---------------------------------------------------------------------------
# GATE 5 — E2E beta readiness route coverage (production-parity)
# ---------------------------------------------------------------------------
echo "${BOLD}[5/10] E2E Readiness Gate — Full Beta Route Coverage${RESET}"
run_gate "Playwright beta-readiness suite" bash -c "npm run test:e2e:beta-readiness 2>&1"

# ---------------------------------------------------------------------------
# GATE 6 — Security scan: no HTTP test-cleanup routes
# ---------------------------------------------------------------------------
echo "${BOLD}[6/10] Security Scan — No HTTP Cleanup Routes${RESET}"
printf "  Running: Check for test/cleanup routes in backend modules ...\n"
if grep -rn "test/cleanup\|testCleanup\|test-cleanup" \
    backend/modules/*/routes/ \
    backend/routes/ \
    2>/dev/null | grep -v "^Binary" | grep -q .; then
  gate_fail "No HTTP test/cleanup routes" "found test cleanup route in HTTP layer — run 21R-4"
else
  gate_pass "No HTTP test/cleanup routes"
fi

# ---------------------------------------------------------------------------
# GATE 7 — Mock scan: no DB mocks in integration tests + no frontend mocks
# ---------------------------------------------------------------------------
echo "${BOLD}[7/10] Mock Scan — Integration Tests + Frontend${RESET}"
printf "  Running: Check integration tests for DB mocks ...\n"
if grep -rn \
    "jest\.unstable_mockModule.*prisma\|jest\.unstable_mockModule.*db/\|jest\.mock.*prisma\|jest\.mock.*db/" \
    backend/tests/integration/ \
    2>/dev/null | grep -v "^Binary" | grep -q .; then
  gate_fail "No DB mocks in integration tests" "found jest.mock of prisma/db in integration/ — run 21R-5"
else
  gate_pass "No DB mocks in integration tests"
fi

printf "  Running: Check frontend production code for mock data ...\n"
if grep -rn "mockApi\|MOCK_\|allMockHorses\|mockSummary" \
    frontend/src/ \
    --include="*.tsx" --include="*.ts" \
    2>/dev/null | grep -v "__tests__\|\.test\.\|\.spec\." | grep -v "^Binary" | grep -q .; then
  gate_fail "No mock data in frontend production code" "found mock patterns in frontend/src — run 21R-2"
else
  gate_pass "No mock data in frontend production code"
fi

# ---------------------------------------------------------------------------
# GATE 8 — Bypass header scan: no test bypass headers in E2E or api-client
# ---------------------------------------------------------------------------
echo "${BOLD}[8/10] Bypass Header Scan — E2E Tests + API Client${RESET}"
printf "  Running: Check E2E specs and api-client for bypass headers ...\n"
# Guard files (tests/e2e/readiness/support/prodParity.ts and
# production-parity.guard.spec.ts) intentionally contain bypass-header
# literals as data — they enforce those strings don't appear elsewhere.
# Each such line carries '// doctrine-allow: bypass-header-literal'.
# The grep -v below filters those markers so the guard itself doesn't
# trip the gate. Equoria-sgu8 (21R-CI-3).
if grep -rn "x-test-bypass-rate-limit\|x-test-skip-csrf\|bypass-auth\|x-test-user\|x-bypass\|VITE_E2E_TEST" \
    tests/e2e/ frontend/src/lib/api-client.ts \
    2>/dev/null | grep -v "^Binary" | grep -v "doctrine-allow: bypass-header-literal" | grep -q .; then
  gate_fail "No bypass headers in E2E/api-client" "found bypass header — violates 21R-3 production-parity policy"
else
  gate_pass "No bypass headers in E2E/api-client"
fi

# ---------------------------------------------------------------------------
# GATE 9 — Skip scan: no test.skip on beta-critical E2E path
# ---------------------------------------------------------------------------
# NOTE (Equoria-o8z2): beta-critical-path.spec.ts lives in tests/e2e/ and is
# executed by the general playwright.config.ts (npm run test:e2e), NOT by the
# beta-readiness config (playwright.beta-readiness.config.ts whose testDir is
# tests/e2e/readiness/).  The beta-readiness suite (Gate 5) covers the same
# critical-path scenarios in tests/e2e/readiness/route-families.spec.ts and
# tests/e2e/readiness/auth-onboarding.spec.ts.
#
# This gate is therefore a static structural check: it verifies that no
# permanent/unconditional skip annotations have been added to
# beta-critical-path.spec.ts.  A skip in that file, even though the file is
# not run by Gate 5, would indicate a deliberate suppression of general E2E
# coverage for beta-relevant paths and must be flagged.
#
# The check does NOT execute the file; it scans for forbidden annotations only.
# Allow test.skip(true, ...) inside credential-guard if-blocks (infrastructure
# guards, not permanent skips).  Exclude JSDoc/comment lines.  Flag only
# permanent/unconditional skips: test.skip('name', fn) or test.fixme('name', fn).
echo "${BOLD}[9/10] Skip Scan — Beta Critical E2E Path (structural check)${RESET}"
printf "  Running: Check beta-critical-path.spec.ts for unconditional test.skip / test.fixme ...\n"
if [ ! -f tests/e2e/beta-critical-path.spec.ts ]; then
  gate_fail "No test.skip on beta-critical paths" "tests/e2e/beta-critical-path.spec.ts missing — file must exist"
elif grep -n "test\.skip\|test\.fixme" tests/e2e/beta-critical-path.spec.ts 2>/dev/null \
    | grep -v "^\s*[0-9]*:\s*\*\|^\s*[0-9]*:\s*//" \
    | grep -v "test\.skip(true," \
    | grep -q .; then
  gate_fail "No test.skip on beta-critical paths" "found unconditional skip annotation in beta-critical-path.spec.ts"
else
  gate_pass "No test.skip on beta-critical paths (structural check: file exists, no unconditional skips)"
fi

# ---------------------------------------------------------------------------
# REPORT
# ---------------------------------------------------------------------------
GATE_END=$(date +%s)
ELAPSED=$((GATE_END - GATE_START))

echo ""
echo "${BOLD}====================================================${RESET}"
echo "${BOLD} GATE RESULTS — commit $GIT_COMMIT${RESET}"
echo "${BOLD}====================================================${RESET}"
for line in "${REPORT_LINES[@]}"; do
  echo -e "$line"
done
echo ""
echo "  Passed  : $PASS"
echo "  Failed  : $FAIL"
echo "  Skipped : $SKIPPED"
echo "  Time    : ${ELAPSED}s"
echo ""

if [ "$FAIL" -eq 0 ] && [ "$SKIPPED" -eq 0 ]; then
  echo "${GREEN}${BOLD}ALL GATES PASSED${RESET}"
  echo ""

  # -------------------------------------------------------------------------
  # Auto-rewrite last_gate_run block in docs/beta-signoff.yaml
  # (Equoria-r1kl / Story 21S-6 AC-7)
  #
  # Rewrites only the last_gate_run: block (from that key up to the blank line
  # before previous_gate_run:) while preserving the file header comment and
  # the signoff: trailer verbatim.  Uses awk so no temp-file race conditions
  # and no reliance on GNU sed -i portability.
  #
  # Skipped when --no-signoff-write was passed (Equoria-mdoz dry-run flag).
  # Refused when gates_skipped > 0 (AC-6: a partial run must not overwrite a
  # clean record — enforced above by the SKIPPED==0 check on this branch).
  # -------------------------------------------------------------------------
  SIGNOFF_YAML="docs/beta-signoff.yaml"

  # Build the gate_detail table from REPORT_LINES.  Each entry is mapped to a
  # canonical YAML key using a simple slug: lower-case, spaces→underscores,
  # parens/brackets stripped, trailing punctuation removed.
  DETAIL_LINES=()
  for entry in "${REPORT_LINES[@]}"; do
    # Strip ANSI colour codes
    clean=$(printf '%b' "$entry" | sed 's/\x1b\[[0-9;]*m//g')
    # Extract pass/fail marker and gate name
    if [[ "$clean" =~ ^[[:space:]]*(PASS|FAIL)[[:space:]]+(.*) ]]; then
      marker="${BASH_REMATCH[1]}"
      gate_label="${BASH_REMATCH[2]}"
      # Slug: lower, spaces→_, strip parens/brackets/slashes/dots, collapse __
      slug=$(printf '%s' "$gate_label" \
        | tr '[:upper:]' '[:lower:]' \
        | sed 's/[()\/\.]/_/g; s/[^a-z0-9_]/_/g; s/__*/_/g; s/^_//; s/_$//')
      DETAIL_LINES+=("    ${slug}: ${marker}")
    fi
  done

  if [ "$NO_SIGNOFF_WRITE" -eq 1 ]; then
    echo "  ${YELLOW}(--no-signoff-write: skipping auto-update of $SIGNOFF_YAML)${RESET}"
  elif [ ! -f "$SIGNOFF_YAML" ]; then
    echo "  ${YELLOW}WARNING: $SIGNOFF_YAML not found — skipping auto-update.${RESET}"
  else
    # Build the replacement last_gate_run block as a shell variable
    NEW_BLOCK="last_gate_run:
  commit: $GIT_COMMIT
  date: '$RUN_DATE'
  gates_passed: $PASS
  gates_failed: $FAIL
  duration_seconds: $ELAPSED
  gate_detail:"
    for dl in "${DETAIL_LINES[@]}"; do
      NEW_BLOCK="${NEW_BLOCK}
${dl}"
    done

    # Use awk to replace the last_gate_run: block.
    # State machine:
    #   0 = before last_gate_run block  → print as-is
    #   1 = inside last_gate_run block  → suppress until next top-level key
    #   2 = after block injected        → print as-is
    # A "top-level key" line is one that starts with a non-space, non-#
    # character followed by a colon (YAML mapping key at column 0).
    # A blank line between the old block and the next top-level key is also
    # suppressed (state==1) and replaced by a single blank line emitted
    # just before the next key is printed.
    awk -v new_block="$NEW_BLOCK" '
      BEGIN { state=0; injected=0 }
      /^last_gate_run:/ {
        if (!injected) {
          print new_block
          injected=1
          state=1
          next
        }
      }
      state==1 {
        # Detect next top-level key (col-0, non-comment, has colon)
        if (/^[^[:space:]#].*:/) {
          print ""
          state=2
          print
        }
        # else suppress lines belonging to the old block (including blank lines)
        next
      }
      { print }
    ' "$SIGNOFF_YAML" > "${SIGNOFF_YAML}.tmp" && mv "${SIGNOFF_YAML}.tmp" "$SIGNOFF_YAML"

    echo "  ${GREEN}docs/beta-signoff.yaml last_gate_run updated.${RESET}"
    echo "  Next step: fill in signoff.signed_off_by + signoff.signed_off_date for human approval."
  fi

  echo ""
  echo "  To complete beta readiness signoff:"
  echo "  1. Edit docs/beta-signoff.yaml — set signoff.signed_off_by and signoff.signed_off_date."
  echo "  2. Get explicit approval from project lead."
  echo "  3. Deploy to beta testers."
  exit 0
elif [ "$FAIL" -eq 0 ] && [ "$SKIPPED" -gt 0 ]; then
  echo "${YELLOW}${BOLD}ALL GATES PASSED BUT $SKIPPED GATE(S) WERE SKIPPED${RESET}"
  echo ""
  echo "  docs/beta-signoff.yaml was NOT updated (skipped gates invalidate signoff)."
  echo "  Re-run without --skip flags to produce a valid signoff record."
  exit 1
else
  echo "${RED}${BOLD}GATES FAILED — not ready for beta deployment${RESET}"
  echo ""
  echo "  Fix the failing gates before retrying."
  exit 1
fi
