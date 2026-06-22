/**
 * Equoria-4iudq — Sentinel-positive + cross-language single-source coverage for
 * the shared Node doctrine-scan pattern module
 * (scripts/lib/doctrine-scan-patterns.mjs).
 *
 * Two guarantees are proven here (OPTIMAL_FIX_DISCIPLINE §2 sentinel-positive):
 *
 *  1. PLANTED-VIOLATION proof: for every forbidden token/pattern now sourced
 *     from the shared module, executing the REAL standalone doctrine check
 *     against a temp fixture containing that token exits NON-ZERO (the gate
 *     fires), and a clean fixture exits ZERO. This proves the refactor to the
 *     shared module did not silently weaken any check — in particular that the
 *     stricter tokens (vi.mock, seededFakePlayers, fakeMetrics, the broad
 *     backend test-dir scope, x-test-bypass-ownership) are caught.
 *
 *  2. CROSS-LANGUAGE EQUALITY guard: the bypass-header token set and the
 *     frontend-mock token set are represented in BOTH a bash regex
 *     (scripts/lib/beta-readiness-scans.sh) and the Node module. Because they
 *     cannot physically share one literal, this test asserts the two
 *     representations are token-for-token identical so they cannot drift —
 *     a duplicated-but-equality-guarded single source of truth.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { BYPASS_HEADER_TOKENS, FRONTEND_MOCK_TOKENS } from '../../../scripts/lib/doctrine-scan-patterns.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');
const LIBRARY = path.join(REPO_ROOT, 'scripts', 'lib', 'beta-readiness-scans.sh');
const CHECK_DIR = path.join(REPO_ROOT, 'scripts', 'doctrine-checks');

const libraryText = fs.readFileSync(LIBRARY, 'utf-8');

/**
 * Extract a BRE-alternation token list from a `VAR='a\|b\|c'` assignment in the
 * bash library, returning ['a', 'b', 'c'].
 */
function extractBashAlternation(varName) {
  const m = new RegExp(`${varName}='([^']*)'`).exec(libraryText);
  if (!m) {
    throw new Error(`Could not find ${varName} in ${LIBRARY}`);
  }
  return m[1].split('\\|');
}

/**
 * Run a doctrine check script (mjs via node, sh via bash) with the repo root as
 * CWD. Returns { code, output } — the process exit code AND the combined
 * stdout+stderr text the check printed. The output is what lets us attribute a
 * violation to OUR specific planted fixture rather than to any unrelated content
 * the shared scan tree happens to hold (see the Equoria-d2wbw note below).
 */
function runCheck(scriptBasename) {
  const full = path.join(CHECK_DIR, scriptBasename);
  const isShell = scriptBasename.endsWith('.sh');
  try {
    const stdout = execFileSync(isShell ? 'bash' : process.execPath, [full], {
      cwd: REPO_ROOT,
      // Merge stderr into the captured stream: the .mjs checks print their
      // violation list to stderr, the bash check to stdout. We want both.
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });
    return { code: 0, output: stdout ?? '' };
  } catch (err) {
    const output = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    return { code: typeof err.status === 'number' ? err.status : 1, output };
  }
}

// -----------------------------------------------------------------------------
// Equoria-d2wbw — attribute the verdict to OUR plant, not the whole shared tree.
// -----------------------------------------------------------------------------
//
// ROOT CAUSE of the flaky "clean after removal" failure: every check here runs
// as a SUBPROCESS that scans a SHARED REAL repo tree (the bypass check scans
// tests/e2e/ + api-client.ts; the .mjs checks scan backend/** or frontend/src).
// The old assertions used only the process EXIT CODE: "fires" was
// `code !== 0` and "clean after removal" was `code === 0`. That treats the
// exit code as a property of OUR plant, but it is actually a property of the
// ENTIRE scanned tree. In the full/sharded jest run that tree is NOT pristine:
// other sentinel suites (and this suite's own sibling tests) plant + delete
// violation-bearing fixtures in those same trees. When a FOREIGN fixture is on
// disk at the instant the "clean" subprocess scans, the check exits non-zero on
// the FOREIGN file and our `code === 0` removal-was-clean assertion fails — even
// though OUR plant was removed correctly. The check is correct; the assertion
// was attributing a tree-global signal to our local plant. (Exit-code retry
// loops do not fix this: a foreign suite that plants+deletes faster than the
// subprocess runs can keep the tree non-clean across every retry.)
//
// FIX (no weakening — it STRENGTHENS the proof): assert against the check's
// OUTPUT, which names the offending file path. We match OUR plant by its
// unique relPath, so the verdict is attributed to OUR fixture specifically and
// is immune to any foreign content elsewhere in the shared tree:
//   - FIRES   : after planting, the check is non-zero AND its output names OUR
//               plant path. (Both: a non-zero from a foreign file with no
//               mention of our path would NOT satisfy this — stricter than the
//               old bare `code !== 0`.)
//   - CLEAN   : after removing our plant, the check's output no longer names
//               OUR plant path. Foreign violations elsewhere are irrelevant to
//               whether OUR removal worked.
//   - IGNORED : with our out-of-scope plant on disk, the check's output does
//               NOT name OUR plant path (it may name foreign files; we don't
//               care — we only assert OUR out-of-scope file was not detected).
// Path matching is separator-agnostic: the bash check prints forward slashes,
// the .mjs checks print OS-native (backslash on Windows) — we normalise both
// and also fall back to the unique basename, which the plant fixtures carry.

// Does the check's printed output attribute a violation to the file at relPath?
// Separator-agnostic; also matches on the (unique) basename as a backstop.
function outputNamesPath(output, relPath) {
  const normOut = output.replace(/\\/g, '/');
  const normRel = relPath.replace(/\\/g, '/');
  if (normOut.includes(normRel)) {
    return true;
  }
  const base = normRel.slice(normRel.lastIndexOf('/') + 1);
  return base.length > 0 && normOut.includes(base);
}

// Plant a file, run a check, assert it FIRES *on our plant*, then remove the
// file and assert the check no longer reports *our plant* — robust to
// concurrent foreign fixtures in the shared scan tree (Equoria-d2wbw).
function expectFiresThenClean(relPath, contents, scriptBasename) {
  const abs = path.join(REPO_ROOT, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents, 'utf-8');
  let fired;
  try {
    fired = runCheck(scriptBasename);
  } finally {
    fs.rmSync(abs, { force: true });
  }
  // gate fired AND it fired specifically because of OUR planted violation
  expect(fired.code).not.toBe(0);
  expect(outputNamesPath(fired.output, relPath)).toBe(true);
  // After removal, the check must no longer attribute any violation to OUR
  // plant. A foreign file elsewhere in the shared tree may still make the
  // overall exit code non-zero; that is not a failure of OUR plant's removal,
  // so we assert on the output's mention of OUR path, not the exit code.
  expect(outputNamesPath(runCheck(scriptBasename).output, relPath)).toBe(false);
}

// Plant a violation at a path that is OUTSIDE the check's scope, run the check,
// and assert the check does NOT report *our* out-of-scope file — i.e. it is
// correctly IGNORED. Robust to concurrent foreign fixtures (Equoria-d2wbw): we
// assert on whether the output names OUR plant path, not on the exit code, so a
// foreign transient in the shared tree cannot be mistaken for our out-of-scope
// plant being (wrongly) detected. Cleans up the planted file (and any
// directories it had to create) afterward.
function expectIgnoredOutOfScope(relPath, contents, scriptBasename) {
  const abs = path.join(REPO_ROOT, relPath);
  // Record which ancestor directories did not exist so we can remove the ones
  // we create, leaving the real tree untouched.
  const createdDirs = [];
  let probe = path.dirname(abs);
  while (probe.startsWith(REPO_ROOT) && probe !== REPO_ROOT && !fs.existsSync(probe)) {
    createdDirs.push(probe);
    probe = path.dirname(probe);
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents, 'utf-8');
  let result;
  try {
    result = runCheck(scriptBasename);
  } finally {
    fs.rmSync(abs, { force: true });
    // Remove directories we created (deepest first), only if now empty.
    for (const d of createdDirs) {
      try {
        fs.rmdirSync(d);
      } catch {
        // not empty / already gone — leave it
      }
    }
  }
  // The out-of-scope file must not appear in the check's violation output.
  expect(outputNamesPath(result.output, relPath)).toBe(false);
}

describe('doctrine-scan-patterns shared module — cross-language equality (Equoria-4iudq)', () => {
  test('bypass-header tokens match the bash library EQUORIA_SCAN_RE_BYPASS_HEADER', () => {
    const bashTokens = extractBashAlternation('EQUORIA_SCAN_RE_BYPASS_HEADER');
    // Token-for-token identical set (order-insensitive) so the two
    // representations are a single source of truth guarded by equality.
    expect([...bashTokens].sort()).toEqual([...BYPASS_HEADER_TOKENS].sort());
  });

  test('bypass union is a strict superset: includes x-test-bypass-ownership', () => {
    expect(BYPASS_HEADER_TOKENS).toContain('x-test-bypass-ownership');
    // bypass-auth (broad) covers the narrower x-test-bypass-auth — kept.
    expect(BYPASS_HEADER_TOKENS).toContain('bypass-auth');
  });

  test('frontend-mock token superset includes the bash-library tokens + the Node extras', () => {
    const bashRe = /EQUORIA_SCAN_RE_FRONTEND_MOCK='([^']*)'/.exec(libraryText)[1];
    // The bash library's coarse ERE contains these literal substrings.
    for (const t of ['mockApi', 'MOCK_', 'allMockHorses', 'mockSummary']) {
      expect(bashRe).toContain(t);
      expect(FRONTEND_MOCK_TOKENS).toContain(t);
    }
    // The Node check is the strict superset: it ALSO forbids these.
    expect(FRONTEND_MOCK_TOKENS).toContain('seededFakePlayers');
    expect(FRONTEND_MOCK_TOKENS).toContain('fakeMetrics');
  });
});

describe('doctrine checks fire on planted violations after the shared-module refactor (Equoria-4iudq)', () => {
  // Equoria-70pb9: walkFiles() now excludes plant-artifact basenames
  // (UPPERCASE DO_NOT_COMMIT / PLANTED markers) by DEFAULT. The Node checks
  // below walk via walkFiles() and invoke the REAL check as a subprocess, so
  // they cannot pass walkFiles()'s includePlantArtifacts:true opt-in. Their
  // planted fixtures therefore use a NON-marker scratch basename
  // (`__doctrine_jest_plant_70pb9__`) so the default exclusion does not hide
  // the violation — the proof still exercises real detection on a normally
  // named file, which is the production-realistic case (real violations are
  // not named DO_NOT_COMMIT). The fixtures are removed in expectFiresThenClean's
  // finally block, exactly as the 75odq/ej9k1 sentinels (which already plant
  // non-marker `planted.test.mjs` / `plantedService.mjs`) do.
  test('check-no-bypass-headers.sh catches EVERY canonical bypass token', () => {
    for (const tok of BYPASS_HEADER_TOKENS) {
      // Use a token guaranteed to match: bypass-auth is a substring of
      // x-test-bypass-auth, so plant the literal token itself.
      expectFiresThenClean(
        'tests/e2e/__doctrine_jest_plant_70pb9__.ts',
        `const h = { '${tok}': '1' };\n`,
        'check-no-bypass-headers.sh',
      );
    }
  });

  test('check-no-db-mocks.mjs catches vi.mock of prisma in a backend MODULE __tests__ dir (broad scope)', () => {
    expectFiresThenClean(
      'backend/modules/horses/__tests__/__doctrine_jest_plant_70pb9__.test.mjs',
      "vi.mock('../../../packages/database/prismaClient.mjs');\n", // doctrine-allow: prisma-mock — fixture data planted into a temp file, not a real mock in this suite
      'check-no-db-mocks.mjs',
    );
  });

  test('check-no-db-mocks.mjs catches jest.unstable_mockModule of prisma', () => {
    expectFiresThenClean(
      'backend/__tests__/__doctrine_jest_plant_70pb9__.test.mjs',
      "jest.unstable_mockModule('../../packages/database/prismaClient.mjs', () => ({}));\n", // doctrine-allow: prisma-mock — fixture data planted into a temp file, not a real mock in this suite
      'check-no-db-mocks.mjs',
    );
  });

  test('check-no-frontend-mocks.mjs catches seededFakePlayers and fakeMetrics', () => {
    for (const tok of ['seededFakePlayers', 'fakeMetrics', 'allMockHorses', 'mockApi', 'MOCK_HORSES']) {
      expectFiresThenClean(
        'frontend/src/__doctrine_jest_plant_70pb9__.ts',
        `export const v = ${tok};\n`,
        'check-no-frontend-mocks.mjs',
      );
    }
  });

  test('check-no-cleanup-routes.mjs catches a /test/cleanup route', () => {
    expectFiresThenClean(
      'backend/routes/__doctrine_jest_plant_70pb9__.mjs',
      "router.delete('/test/cleanup', (req, res) => res.end());\n",
      'check-no-cleanup-routes.mjs',
    );
  });
});

// =============================================================================
// Equoria-ml7jj — scope-preservation proof for the SHARED walkFiles mechanism
// =============================================================================
//
// The 3 Node doctrine checks now share a single recursive-walk MECHANISM
// (walkFiles in scripts/lib/doctrine-scan-patterns.mjs) while each supplies its
// OWN per-check skip/include predicates. The risk of mechanism-sharing is that a
// check's effective file-SET silently widens or narrows. These tests prove the
// opposite for each check: an IN-SCOPE planted violation is still caught, and an
// OUT-OF-SCOPE planted violation (in a dir/file the check is supposed to skip)
// is still IGNORED. This is the EDGE_CASE_FIX_DISCIPLINE no-scope-change /
// OPTIMAL_FIX_DISCIPLINE §2 sentinel guarantee that the share changed no verdict.
const CLEANUP_ROUTE = "router.delete('/test/cleanup', (req, res) => res.end());\n";
const DB_MOCK = "vi.mock('../packages/database/prismaClient.mjs');\n"; // doctrine-allow: prisma-mock — fixture data planted into a temp file, not a real mock in this suite
const FRONTEND_MOCK = 'export const v = mockApi;\n';

describe('shared walkFiles preserves each check scope (Equoria-ml7jj)', () => {
  // ---- check-no-cleanup-routes.mjs (roots: backend/routes, backend/modules) ----
  test('cleanup-routes: in-scope route under backend/routes is caught', () => {
    expectFiresThenClean('backend/routes/__ml7jj_inscope_70pb9__.mjs', CLEANUP_ROUTE, 'check-no-cleanup-routes.mjs');
  });
  test('cleanup-routes: in-scope route under backend/modules is caught', () => {
    expectFiresThenClean(
      'backend/modules/__ml7jj_inscope_70pb9__/routes/r.mjs',
      CLEANUP_ROUTE,
      'check-no-cleanup-routes.mjs',
    );
  });
  test('cleanup-routes: route inside an __tests__ dir is IGNORED (out of scope)', () => {
    expectIgnoredOutOfScope(
      'backend/routes/__tests__/__ml7jj_oos_70pb9__.mjs',
      CLEANUP_ROUTE,
      'check-no-cleanup-routes.mjs',
    );
  });
  test('cleanup-routes: route inside a tests dir is IGNORED (out of scope)', () => {
    expectIgnoredOutOfScope(
      'backend/routes/tests/__ml7jj_oos_70pb9__.mjs',
      CLEANUP_ROUTE,
      'check-no-cleanup-routes.mjs',
    );
  });
  test('cleanup-routes: route in a .test file is IGNORED (out of scope)', () => {
    expectIgnoredOutOfScope(
      'backend/routes/__ml7jj_oos_70pb9__.test.mjs',
      CLEANUP_ROUTE,
      'check-no-cleanup-routes.mjs',
    );
  });

  // ---- check-no-db-mocks.mjs (root: backend; ONLY .test/.spec files) ----
  test('db-mocks: in-scope prisma mock in a backend .test file is caught', () => {
    expectFiresThenClean('backend/__tests__/__ml7jj_inscope_70pb9__.test.mjs', DB_MOCK, 'check-no-db-mocks.mjs');
  });
  test('db-mocks: prisma mock in a NON-test backend file is IGNORED (out of scope)', () => {
    expectIgnoredOutOfScope('backend/__ml7jj_oos_70pb9__.mjs', DB_MOCK, 'check-no-db-mocks.mjs');
  });
  test('db-mocks: prisma mock under backend/node_modules is IGNORED (out of scope)', () => {
    expectIgnoredOutOfScope('backend/node_modules/__ml7jj_oos_70pb9__.test.mjs', DB_MOCK, 'check-no-db-mocks.mjs');
  });

  // ---- check-no-frontend-mocks.mjs (root: frontend/src) ----
  test('frontend-mocks: in-scope mockApi in frontend/src is caught', () => {
    expectFiresThenClean('frontend/src/__ml7jj_inscope_70pb9__.ts', FRONTEND_MOCK, 'check-no-frontend-mocks.mjs');
  });
  test('frontend-mocks: mockApi inside an __tests__ dir is IGNORED (out of scope)', () => {
    expectIgnoredOutOfScope(
      'frontend/src/__tests__/__ml7jj_oos_70pb9__.ts',
      FRONTEND_MOCK,
      'check-no-frontend-mocks.mjs',
    );
  });
  test('frontend-mocks: mockApi inside a tests dir is IGNORED (out of scope)', () => {
    expectIgnoredOutOfScope('frontend/src/tests/__ml7jj_oos_70pb9__.ts', FRONTEND_MOCK, 'check-no-frontend-mocks.mjs');
  });
  test('frontend-mocks: mockApi in a .stories file is IGNORED (out of scope)', () => {
    expectIgnoredOutOfScope(
      'frontend/src/__ml7jj_oos_70pb9__.stories.tsx',
      FRONTEND_MOCK,
      'check-no-frontend-mocks.mjs',
    );
  });
  test('frontend-mocks: mockApi in a .test file is IGNORED (out of scope)', () => {
    expectIgnoredOutOfScope('frontend/src/__ml7jj_oos_70pb9__.test.ts', FRONTEND_MOCK, 'check-no-frontend-mocks.mjs');
  });
});
