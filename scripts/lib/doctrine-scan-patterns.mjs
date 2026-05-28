// =============================================================================
// Equoria Doctrine Scan Patterns — SINGLE SOURCE OF TRUTH for the Node checks
// (Equoria-4iudq)
// =============================================================================
//
// A bash library (scripts/lib/beta-readiness-scans.sh) cannot be `source`d by
// Node, so the three Node doctrine checks cannot share their pattern/token/scope
// data with the bash heavy-path consumers via that file. This module is the
// canonical Node-side single source: the three Node checks IMPORT their data
// from here instead of each embedding their own literals.
//
//   - scripts/doctrine-checks/check-no-cleanup-routes.mjs
//   - scripts/doctrine-checks/check-no-db-mocks.mjs
//   - scripts/doctrine-checks/check-no-frontend-mocks.mjs
//
// Design contract:
//   - Every set/array here is the STRICT SUPERSET of what each consumer needs.
//     A change here must keep every consumer EQUAL-OR-STRICTER — never weaker
//     (EDGE_CASE_FIX_DISCIPLINE: no regex narrowing, no scope shrinking).
//   - The structural SCAN LOGIC stays in each check (route-string parsing,
//     mock-call detection, comment skipping). Only the DATA (patterns, tokens,
//     directory scopes, exemption markers) is shared.
//   - Where a token list is conceptually shared with the bash library
//     (the frontend-mock token set, the bypass-header token set), a
//     cross-language equality sentinel test asserts byte-equivalence so the two
//     representations cannot silently drift (see
//     backend/__tests__/scripts/doctrineScanPatterns.sentinel.test.mjs).
// =============================================================================

// -----------------------------------------------------------------------------
// 1. HTTP cleanup-route scan (check-no-cleanup-routes.mjs)
// -----------------------------------------------------------------------------

// Path-string fragments that mark a route as test-cleanup infrastructure.
// Matched against the route path captured by ROUTE_RE below.
export const FORBIDDEN_CLEANUP_PATH_PATTERNS = [
  /\/test\/cleanup/i,
  /\/cleanup-tests?\b/i,
  /\/__cleanup/i,
  /\/test-reset\b/i,
];

// Match: router.<method>('<path>' OR app.<method>('<path>'
// A factory (not a shared mutable RegExp) so each call site gets a fresh
// lastIndex — the /g flag is stateful and sharing one instance across files
// would corrupt iteration order.
export function makeRouteRegex() {
  return /\b(?:router|app)\s*\.\s*(?:get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/g;
}

// -----------------------------------------------------------------------------
// 2. Backend DB-mock scan (check-no-db-mocks.mjs)
// -----------------------------------------------------------------------------

// Mock-call invocation forms that are forbidden when their first string-literal
// argument refers to prisma/db. Superset: includes jest.mock,
// jest.unstable_mockModule, AND vi.mock (Vitest) — broader than the bash
// library's coarse grep which omits vi.mock.
export function makeDbMockCallRegex() {
  return /\b(?:jest\.unstable_mockModule|jest\.mock|vi\.mock)\s*\(/;
}

// String literal on the same line that targets prisma. /g + /i — factory so the
// stateful lastIndex is not shared across files.
export function makeDbMockTargetRegex() {
  return /['"`]([^'"`]*prisma[^'"`]*)['"`]/gi;
}

export const DB_MOCK_EXEMPTION_MARKER = 'doctrine-allow: prisma-mock';

// -----------------------------------------------------------------------------
// 3. Frontend mock-data scan (check-no-frontend-mocks.mjs)
// -----------------------------------------------------------------------------

// Forbidden frontend mock tokens. Superset of the bash library's
// EQUORIA_SCAN_RE_FRONTEND_MOCK (mockApi / MOCK_ / allMockHorses / mockSummary)
// PLUS the structural extras seededFakePlayers / fakeMetrics that only the
// Node check carries. Each entry is the human-readable token name; the matching
// RegExp is produced by makeFrontendMockRegexes() so the literal list stays
// auditable and cross-language-comparable.
export const FRONTEND_MOCK_TOKENS = [
  'MOCK_',
  'mockApi',
  'allMockHorses',
  'mockSummary',
  'seededFakePlayers',
  'fakeMetrics',
];

// Produce the RegExps used by the frontend-mock scan, preserving the exact
// matching semantics the standalone check used (MOCK_ is a CONSTANT-prefix
// match \bMOCK_[A-Z][A-Z0-9_]*; the rest are word-boundary literal matches).
export function makeFrontendMockRegexes() {
  return [
    /\bMOCK_[A-Z][A-Z0-9_]*/,
    /\bmockApi\b/,
    /\ballMockHorses\b/,
    /\bmockSummary\b/,
    /\bseededFakePlayers\b/,
    /\bfakeMetrics\b/,
  ];
}

export const FRONTEND_MOCK_EXEMPTION_MARKER = 'doctrine-allow: frontend-mock-storybook';

// NOTE: the directory-walk + file-skip logic is intentionally NOT shared here.
// It differs subtly per check (the db-mock scan REQUIRES test files; the route
// and frontend scans SKIP them; the frontend scan also skips .stories files;
// the route scan skips a `tests` regex while the frontend scan skips a literal
// `tests` dir name). Unifying it risks a behavior change, so it stays local to
// each check. Sharing the walk logic is filed as a follow-up (see issue notes).

// -----------------------------------------------------------------------------
// Cross-language bypass-header token set.
// -----------------------------------------------------------------------------
//
// The canonical bypass-header tokens live primarily in the bash library
// (EQUORIA_SCAN_RE_BYPASS_HEADER). No Node doctrine check currently scans for
// bypass headers (that is the bash check-no-bypass-headers.sh). This array is
// exported ONLY so the cross-language equality sentinel can assert the bash
// regex and this list stay in lockstep should a future Node consumer need it.
// Superset includes x-test-bypass-ownership (added in Equoria-4iudq).
export const BYPASS_HEADER_TOKENS = [
  'x-test-bypass-rate-limit',
  'x-test-skip-csrf',
  'bypass-auth',
  'x-test-user',
  'x-test-bypass-ownership',
  'x-bypass',
  'VITE_E2E_TEST',
];
