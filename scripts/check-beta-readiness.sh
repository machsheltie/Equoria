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
#   bash scripts/check-beta-readiness.sh                  # all gates
#   bash scripts/check-beta-readiness.sh --skip-e2e       # skip E2E (CI without server)
#
# Signoff process (after all gates pass):
#   1. Record the commit hash and gate run date in docs/beta-signoff.yaml
#   2. Get explicit human approval (project lead) to mark beta-deployment-readiness
#   3. Update _bmad-output/implementation-artifacts/sprint-status.yaml as appropriate
# =============================================================================

set -euo pipefail

SKIP_E2E=false
if [[ "${1:-}" == "--skip-e2e" ]]; then
  SKIP_E2E=true
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

gate_skip() {
  local name="$1"
  REPORT_LINES+=("${YELLOW}  SKIP${RESET}  $name")
  ((SKIPPED++)) || true
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
# GATE 1 — Backend lint
# ---------------------------------------------------------------------------
echo "${BOLD}[1/8] Backend Lint${RESET}"
# Run lint:fix first (auto-fixes indent/formatting issues), then verify zero errors remain.
# ESLint exits 0 with no output when clean; exits non-zero with error output when issues remain.
run_gate "Backend ESLint (no errors)" bash -c "cd backend && npm run lint:fix > /dev/null 2>&1; npm run lint"

# ---------------------------------------------------------------------------
# GATE 2 — Frontend typecheck
# ---------------------------------------------------------------------------
echo "${BOLD}[2/8] Frontend Typecheck${RESET}"
run_gate "Frontend tsc --noEmit" bash -c "cd frontend && npx tsc --noEmit 2>&1"

# ---------------------------------------------------------------------------
# GATE 3 — Backend tests (routes + integration)
# ---------------------------------------------------------------------------
echo "${BOLD}[3/8] Backend Tests — Routes + Integration${RESET}"
run_gate "Routes tests" bash -c "npm test -- --testPathPattern='backend/tests/routes' --forceExit 2>&1"
run_gate "Integration tests" bash -c "npm test -- --testPathPattern='backend/tests/integration' --maxWorkers=1 --forceExit 2>&1"

# ---------------------------------------------------------------------------
# GATE 4 — E2E beta critical path
# ---------------------------------------------------------------------------
echo "${BOLD}[4/8] E2E Smoke Tests — Beta Critical Path${RESET}"
if [ "$SKIP_E2E" = true ]; then
  gate_skip "E2E beta-critical-path.spec.ts (--skip-e2e passed)"
else
  run_gate "Playwright beta-critical-path.spec.ts" bash -c "npx playwright test tests/e2e/beta-critical-path.spec.ts 2>&1"
fi

# ---------------------------------------------------------------------------
# GATE 5 — Security scan: no HTTP test-cleanup routes
# ---------------------------------------------------------------------------
echo "${BOLD}[5/8] Security Scan — No HTTP Cleanup Routes${RESET}"
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
# GATE 6 — Mock scan: no DB mocks in integration tests
# ---------------------------------------------------------------------------
echo "${BOLD}[6/8] Mock Scan — Integration Tests${RESET}"
printf "  Running: Check integration tests for DB mocks ...\n"
if grep -rn \
    "jest\.unstable_mockModule.*prisma\|jest\.unstable_mockModule.*db/\|jest\.mock.*prisma\|jest\.mock.*db/" \
    backend/tests/integration/ \
    2>/dev/null | grep -v "^Binary" | grep -q .; then
  gate_fail "No DB mocks in integration tests" "found jest.mock of prisma/db in integration/ — run 21R-5"
else
  gate_pass "No DB mocks in integration tests"
fi

# ---------------------------------------------------------------------------
# GATE 7 — Bypass header scan: no auth bypass in E2E tests
# ---------------------------------------------------------------------------
echo "${BOLD}[7/8] Bypass Header Scan — E2E Tests${RESET}"
printf "  Running: Check E2E specs for auth bypass headers ...\n"
if grep -rn "bypass-auth\|x-test-user\|x-bypass" tests/e2e/ --exclude-dir=readiness 2>/dev/null | grep -q .; then
  gate_fail "No auth bypass headers in E2E" "found bypass header — violates 21R-3 production-parity policy"
else
  gate_pass "No auth bypass headers in E2E"
fi

# ---------------------------------------------------------------------------
# GATE 8 — Skip scan: no test.skip on beta-critical E2E path
# ---------------------------------------------------------------------------
echo "${BOLD}[8/8] Skip Scan — Beta Critical E2E Path${RESET}"
printf "  Running: Check beta-critical-path.spec.ts for unconditional test.skip / test.fixme ...\n"
# Allow test.skip(true, ...) inside credential-guard if-blocks (infrastructure guards, not permanent skips).
# Exclude comment lines (JSDoc * and // comments) and credential-guard in-body skips.
# Flag only permanent/unconditional skips: test.skip('name', fn) or test.fixme('name', fn).
if grep -n "test\.skip\|test\.fixme" tests/e2e/beta-critical-path.spec.ts 2>/dev/null \
    | grep -v "^\s*[0-9]*:\s*\*\|^\s*[0-9]*:\s*//" \
    | grep -v "test\.skip(true," \
    | grep -q .; then
  gate_fail "No test.skip on beta-critical paths" "found unconditional skip annotation in beta-critical-path.spec.ts"
else
  gate_pass "No test.skip on beta-critical paths"
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
echo "  Passed : $PASS"
echo "  Failed : $FAIL"
echo "  Skipped: $SKIPPED"
echo "  Time   : ${ELAPSED}s"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo "${GREEN}${BOLD}ALL GATES PASSED${RESET}"
  echo ""
  echo "  To complete beta readiness signoff:"
  echo "  1. Record this run in docs/beta-signoff.yaml:"
  echo "     commit: $GIT_COMMIT"
  echo "     date:   $RUN_DATE"
  echo "     gates:  $PASS passed, $SKIPPED skipped"
  echo "  2. Get explicit approval from project lead."
  echo "  3. Deploy to beta testers."
  exit 0
else
  echo "${RED}${BOLD}GATES FAILED — not ready for beta deployment${RESET}"
  echo ""
  echo "  Fix the failing gates before retrying."
  exit 1
fi
