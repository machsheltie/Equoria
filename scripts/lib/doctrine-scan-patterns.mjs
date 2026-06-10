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

// -----------------------------------------------------------------------------
// Shared directory-walk MECHANISM (Equoria-ml7jj)
// -----------------------------------------------------------------------------
//
// Follow-up to Equoria-4iudq, which deliberately left each check's walk LOCAL
// because "the skip rules differ subtly per check; unifying risks behavior
// change." ml7jj shares only the COMMON MECHANISM (recursive readdir, directory
// recursion, file collection) while every per-check DIFFERENCE — root(s),
// extension filter, which dirs to skip, which files to skip — is passed in as a
// PREDICATE. The shared code therefore changes NO check's effective file-set:
// each check still decides its own scope via the predicates it supplies.
//
// EDGE_CASE_FIX_DISCIPLINE: this is a pure mechanism extraction. It must not
// widen or narrow any check's scanned file-set. The per-check predicates below
// (in each check file) reproduce that check's original skip/include logic
// verbatim, so the union of files visited is identical pre- and post-refactor.
// The scope-preservation sentinel
// (backend/__tests__/scripts/doctrineScanPatterns.sentinel.test.mjs) proves an
// in-scope planted violation is still caught AND an out-of-scope planted
// violation is still ignored, for every check.
//
// Parameters (all required; no implicit defaults — a check must state its scope
// explicitly so scope can never silently change):
//   roots        : string[]            — absolute directory roots to scan
//   skipDir      : (name, fullPath) => boolean
//                  return true to NOT recurse into this subdirectory
//   includeFile  : (name, fullPath) => boolean
//                  return true to collect this file for scanning
//
// Returns: string[] of absolute file paths (in readdir traversal order, matching
// the original per-check walks which used the same fs.readdirSync ordering).
import fs from 'node:fs';
import path from 'node:path';

export function walkFiles(roots, { skipDir, includeFile }) {
  if (typeof skipDir !== 'function' || typeof includeFile !== 'function') {
    throw new TypeError('walkFiles requires { skipDir, includeFile } functions');
  }
  const out = [];
  for (const root of roots) {
    walkInto(root, out, skipDir, includeFile);
  }
  return out;
}

function walkInto(dir, out, skipDir, includeFile) {
  // existsSync guard: every original walk either guarded inside the walk
  // (cleanup-routes, db-mocks) or guarded the root before calling
  // (frontend-mocks). Guarding here is equivalent for all three — a missing
  // directory contributes zero files in every case.
  if (!fs.existsSync(dir)) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    // Equoria-q7lqz: a directory can vanish between existsSync and readdirSync
    // when concurrent jest sentinel suites plant + delete temp scaffolding
    // mid-scan. Tolerate ONLY ENOENT, loudly (a vanished dir contributes zero
    // files, same as the existsSync guard above). Anything else — EACCES,
    // EMFILE, … — is a real environment fault and MUST crash the check.
    if (err && err.code === 'ENOENT') {
      console.error(`[doctrine-scan] notice: skipped vanished directory ${dir}`);
      return;
    }
    throw err;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipDir(entry.name, full)) continue;
      walkInto(full, out, skipDir, includeFile);
    } else if (entry.isFile()) {
      if (includeFile(entry.name, full)) out.push(full);
    }
  }
}

// -----------------------------------------------------------------------------
// Vanished-file tolerance + sentinel-plant exclusion (Equoria-q7lqz)
// -----------------------------------------------------------------------------
//
// During a concurrent jest run, sentinel suites plant and delete temp files
// (e.g. backend/__tests__/__doctrine_jest_plant_DO_NOT_COMMIT__.test.mjs).
// A doctrine check that enumerated such a file and then readFileSync'd it
// after deletion crashed with ENOENT (the Equoria-q7lqz incident, at
// check-no-new-silent-cleanup-catch.mjs countSilentCatches → main).
//
// Two layered defenses:
//
//   1. isPlantArtifactBasename() — files whose basename contains the
//      UPPERCASE markers DO_NOT_COMMIT or PLANTED are sentinel plant
//      artifacts by repo convention and are excluded from the walks of the
//      baseline-delta checks (silent-cleanup-catch, rethrow-after-log,
//      api-client-vi-mock). The match is deliberately CASE-SENSITIVE:
//      the 75odq/ej9k1 doctrine sentinels plant lowercase `planted.test.mjs`
//      / `plantedService.mjs` and REQUIRE their check to fire on them — a
//      case-insensitive match would blind those gates.
//
//      NOTE: this exclusion is deliberately NOT applied inside walkFiles()
//      below. The shared-walk consumers (check-no-cleanup-routes,
//      check-no-db-mocks, check-no-frontend-mocks) have sentinel-positive
//      tests (doctrineScanPatterns.sentinel.test.mjs, Equoria-4iudq/ml7jj)
//      that plant `*_DO_NOT_COMMIT_*` violations and assert the check FIRES
//      on them — excluding plants at walkFiles level would silently disarm
//      those proofs. Each check opts in via its includeFile predicate /
//      local walk instead.
//
//   2. readScannedFileSyncTolerant() — even with the exclusion, ANY
//      transient file can vanish between enumeration and read. Reads of
//      walked files tolerate ONLY ENOENT (logging a one-line notice and
//      returning null so the caller skips the file); every other error
//      (EACCES, EISDIR, …) is rethrown. This is NOT a silent catch: the
//      tolerated path is narrow (one errno) and loud (notice per file).

export function isPlantArtifactBasename(name) {
  return name.includes('DO_NOT_COMMIT') || name.includes('PLANTED');
}

export function readScannedFileSyncTolerant(filePath, checkLabel) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      console.error(`[${checkLabel}] notice: skipped vanished file ${filePath}`);
      return null;
    }
    throw err; // not ENOENT — a real fault; the check must crash, not skip
  }
}

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
