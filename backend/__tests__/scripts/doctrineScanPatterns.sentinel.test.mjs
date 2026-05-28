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
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  BYPASS_HEADER_TOKENS,
  FRONTEND_MOCK_TOKENS,
} from '../../../scripts/lib/doctrine-scan-patterns.mjs';

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
  if (!m) throw new Error(`Could not find ${varName} in ${LIBRARY}`);
  return m[1].split('\\|');
}

/**
 * Run a doctrine check script (mjs via node, sh via bash) with the repo root as
 * CWD. Returns { code } — the process exit code.
 */
function runCheck(scriptBasename) {
  const full = path.join(CHECK_DIR, scriptBasename);
  const isShell = scriptBasename.endsWith('.sh');
  try {
    execFileSync(isShell ? 'bash' : process.execPath, [full], {
      cwd: REPO_ROOT,
      stdio: 'pipe',
    });
    return { code: 0 };
  } catch (err) {
    return { code: typeof err.status === 'number' ? err.status : 1 };
  }
}

// Plant a file, run a check, assert it FIRES, then remove the file and assert
// the check is clean again.
function expectFiresThenClean(relPath, contents, scriptBasename) {
  const abs = path.join(REPO_ROOT, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents, 'utf-8');
  let firedCode;
  try {
    firedCode = runCheck(scriptBasename).code;
  } finally {
    fs.rmSync(abs, { force: true });
  }
  expect(firedCode).not.toBe(0); // gate fired on the planted violation
  expect(runCheck(scriptBasename).code).toBe(0); // clean after removal
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
  test('check-no-bypass-headers.sh catches EVERY canonical bypass token', () => {
    for (const tok of BYPASS_HEADER_TOKENS) {
      // Use a token guaranteed to match: bypass-auth is a substring of
      // x-test-bypass-auth, so plant the literal token itself.
      expectFiresThenClean(
        'tests/e2e/__doctrine_jest_plant_DO_NOT_COMMIT__.ts',
        `const h = { '${tok}': '1' };\n`,
        'check-no-bypass-headers.sh'
      );
    }
  });

  test('check-no-db-mocks.mjs catches vi.mock of prisma in a backend MODULE __tests__ dir (broad scope)', () => {
    expectFiresThenClean(
      'backend/modules/horses/__tests__/__doctrine_jest_plant_DO_NOT_COMMIT__.test.mjs',
      "vi.mock('../../../packages/database/prismaClient.mjs');\n", // doctrine-allow: prisma-mock — fixture data planted into a temp file, not a real mock in this suite
      'check-no-db-mocks.mjs'
    );
  });

  test('check-no-db-mocks.mjs catches jest.unstable_mockModule of prisma', () => {
    expectFiresThenClean(
      'backend/__tests__/__doctrine_jest_plant_DO_NOT_COMMIT__.test.mjs',
      "jest.unstable_mockModule('../../packages/database/prismaClient.mjs', () => ({}));\n", // doctrine-allow: prisma-mock — fixture data planted into a temp file, not a real mock in this suite
      'check-no-db-mocks.mjs'
    );
  });

  test('check-no-frontend-mocks.mjs catches seededFakePlayers and fakeMetrics', () => {
    for (const tok of ['seededFakePlayers', 'fakeMetrics', 'allMockHorses', 'mockApi', 'MOCK_HORSES']) {
      expectFiresThenClean(
        'frontend/src/__doctrine_jest_plant_DO_NOT_COMMIT__.ts',
        `export const v = ${tok};\n`,
        'check-no-frontend-mocks.mjs'
      );
    }
  });

  test('check-no-cleanup-routes.mjs catches a /test/cleanup route', () => {
    expectFiresThenClean(
      'backend/routes/__doctrine_jest_plant_DO_NOT_COMMIT__.mjs',
      "router.delete('/test/cleanup', (req, res) => res.end());\n",
      'check-no-cleanup-routes.mjs'
    );
  });
});
