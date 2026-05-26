# shellcheck shell=bash
# =============================================================================
# Equoria Beta-Readiness Static Scans — SINGLE SOURCE OF TRUTH (Equoria-iffbt)
# =============================================================================
#
# This library is the ONE canonical definition of the four cheap static scans
# that gate beta readiness. It is SOURCED by both consumers so the scan regexes
# physically exist in exactly one place:
#
#   - scripts/check-beta-readiness.sh          (the CLAUDE.md signoff script)
#   - .github/workflows/test.yml               (beta-readiness-gate CI job)
#
# Before Equoria-iffbt the four regexes were duplicated inline in BOTH files and
# a byte-equality drift assertion
# (scripts/doctrine-checks/check-beta-readiness-scan-parity.mjs) existed solely
# to catch one-sided edits. With a single sourced library there is no second
# copy to drift against; that parity check is repurposed to assert the inline
# copies do not REAPPEAR (see ADR-010, updated for iffbt).
#
# Design contract (so this file is safe to `source` in isolation):
#   - NO `set -e` / `set -u` / `set -o pipefail` here — sourcing must not change
#     the caller's shell options.
#   - NO top-level execution — only readonly variable + function definitions.
#   - Idempotent: re-sourcing is a no-op (guard variable below).
#   - Functions print a human-readable FAIL line to stderr and RETURN non-zero
#     on violation; they do NOT call `exit` (the caller decides how to fail).
#
# The four canonical scans:
#   1. HTTP cleanup-route        (marker: test/cleanup)        → no HTTP test-cleanup routes
#   2. integration-test DB-mock  (marker: unstable_mockModule) → no jest mock of prisma/db in integration/
#   3. frontend mock-data        (marker: allMockHorses)       → no MOCK_/mockApi/allMockHorses in frontend prod
#   4. E2E/api-client bypass     (marker: x-test-skip-csrf)    → no bypass headers in E2E / api-client
# =============================================================================

# Idempotent source guard.
if [ -n "${EQUORIA_BETA_READINESS_SCANS_SH:-}" ]; then
  return 0 2>/dev/null || true
fi
EQUORIA_BETA_READINESS_SCANS_SH=1

# -----------------------------------------------------------------------------
# Canonical scan regexes — the single source of truth.
# These were previously copy-pasted into both consumers. Edit here ONLY.
# -----------------------------------------------------------------------------
# 1. HTTP cleanup-route scan (BRE alternation)
EQUORIA_SCAN_RE_HTTP_CLEANUP='test/cleanup\|testCleanup\|test-cleanup'
# 2. integration-test DB-mock scan (BRE alternation)
EQUORIA_SCAN_RE_DB_MOCK='jest\.unstable_mockModule.*prisma\|jest\.unstable_mockModule.*db/\|jest\.mock.*prisma\|jest\.mock.*db/'
# 3. frontend mock-data scan (ERE — declaration-context MOCK_ + named patterns; Equoria-veql)
EQUORIA_SCAN_RE_FRONTEND_MOCK='mockApi|\b(const|let|var|export\s+(const|let|var))\s+MOCK_[A-Z][A-Z_]*\b|allMockHorses|mockSummary'
# 4. E2E/api-client bypass-header scan (BRE alternation)
EQUORIA_SCAN_RE_BYPASS_HEADER='x-test-bypass-rate-limit\|x-test-skip-csrf\|bypass-auth\|x-test-user\|x-bypass\|VITE_E2E_TEST'

# -----------------------------------------------------------------------------
# Scan functions. Each returns 0 (clean) or 1 (violation found).
# On violation, prints a FAIL line to stderr. The first argument, when given,
# is echoed as extra remediation context.
# -----------------------------------------------------------------------------

# 1. No HTTP test-cleanup routes in the routing layer.
equoria_scan_http_cleanup_routes() {
  if grep -rn "$EQUORIA_SCAN_RE_HTTP_CLEANUP" \
      backend/modules/*/routes/ \
      backend/routes/ \
      2>/dev/null | grep -v "^Binary" | grep -q .; then
    echo "FAIL: HTTP test-cleanup routes found (run 21R-4)" >&2
    return 1
  fi
  return 0
}

# 2. No jest DB mocks (prisma / db) in backend integration tests.
equoria_scan_integration_db_mocks() {
  if grep -rn "$EQUORIA_SCAN_RE_DB_MOCK" \
      backend/tests/integration/ \
      2>/dev/null | grep -v "^Binary" | grep -q .; then
    echo "FAIL: DB mocks found in integration tests (run 21R-5)" >&2
    return 1
  fi
  return 0
}

# 3. No mock data in frontend production code (excludes test files).
equoria_scan_frontend_mock_data() {
  if grep -rEn "$EQUORIA_SCAN_RE_FRONTEND_MOCK" \
      frontend/src/ \
      --include="*.tsx" --include="*.ts" \
      2>/dev/null | grep -v "__tests__\|\.test\.\|\.spec\." | grep -v "^Binary" | grep -q .; then
    echo "FAIL: Mock data in frontend production code (run 21R-2)" >&2
    return 1
  fi
  return 0
}

# 4. No bypass headers in E2E specs or the api-client. Guard files carry a
#    '// doctrine-allow: bypass-header-literal' marker and are filtered out.
equoria_scan_bypass_headers() {
  if grep -rn "$EQUORIA_SCAN_RE_BYPASS_HEADER" \
      tests/e2e/ frontend/src/lib/api-client.ts \
      2>/dev/null | grep -v "^Binary" | grep -v "doctrine-allow: bypass-header-literal" | grep -q .; then
    echo "FAIL: Bypass headers in E2E/api-client (violates 21R-3 production-parity policy)" >&2
    return 1
  fi
  return 0
}

# -----------------------------------------------------------------------------
# Sentinel self-tests. Each plants a known violation in a path the scan covers,
# asserts the scan FIRES, then removes the planted file and asserts it no longer
# matches. Returns 0 on success, 1 if the scan failed to catch the plant or left
# residue. OPTIMAL_FIX_DISCIPLINE §2 (sentinel-positive) for each scan.
# -----------------------------------------------------------------------------

equoria_scan_sentinel_frontend_mock_data() {
  local sentinel="frontend/src/__doctrine_mock_sentinel_DO_NOT_COMMIT__.tsx"
  echo 'export const MOCK_DATA = [{ id: 1 }];' > "$sentinel"
  if equoria_scan_frontend_mock_data >/dev/null 2>&1; then
    rm -f "$sentinel"
    echo "SENTINEL FAIL: planted MOCK_DATA in $sentinel was NOT detected by the frontend mock-data scan." >&2
    return 1
  fi
  rm -f "$sentinel"
  if ! equoria_scan_frontend_mock_data >/dev/null 2>&1; then
    echo "SENTINEL FAIL: frontend mock-data scan still fails after sentinel cleanup (residual match)." >&2
    return 1
  fi
  return 0
}

equoria_scan_sentinel_bypass_headers() {
  local sentinel="tests/e2e/__doctrine_sentinel_DO_NOT_COMMIT__.txt"
  echo 'x-test-skip-csrf' > "$sentinel"
  if equoria_scan_bypass_headers >/dev/null 2>&1; then
    rm -f "$sentinel"
    echo "SENTINEL FAIL: planted violation in $sentinel was NOT detected by the bypass-header scan." >&2
    return 1
  fi
  rm -f "$sentinel"
  if ! equoria_scan_bypass_headers >/dev/null 2>&1; then
    echo "SENTINEL FAIL: bypass-header scan still fails after sentinel cleanup (residual match)." >&2
    return 1
  fi
  return 0
}
