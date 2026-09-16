/**
 * Equoria-ugxuc — the Security Gate's selection must stay a SCOPE, and must
 * keep every security-control suite inside it.
 *
 * jest.config.security.mjs once carried a bare recursive __tests__ glob, so
 * `npm run test:security` re-ran the whole backend suite — including domain
 * suites — and five cases in
 * modules/horses/__tests__/foalCreationMinimalPayload.test.mjs got HTTP 429
 * where they assert 400/200. The measured mechanism is not counter
 * accumulation: this config does not load backend/tests/setup.mjs, so the
 * TEST_RATE_LIMIT_* knobs are unset and mutationRateLimiter runs at its literal
 * 30-per-60-seconds instead of 1000/15min. The foal file 429s under this config
 * alone, in a fresh process. See the header of jest.config.security.mjs for the
 * two commands that prove it.
 *
 * Nothing in Jest or in YAML ties the selection to the reasons it is shaped
 * this way, and it can drift in BOTH directions:
 *
 *   - Re-broadened     -> the 429 cascade returns with no local signal.
 *   - Further narrowed -> a security-control suite silently leaves the gate
 *     that is named for it. The first version of this sentinel did not catch
 *     that: deleting both modules/auth patterns passed every case.
 *
 * So this file asks JEST ITSELF what the config selects (`--listTests` against
 * jest.config.security.mjs — the same resolution the gate runs, not a glob
 * re-implementation and not a substring grep) and pins both directions. It pins
 * no file count: files may come and go.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import securityConfig, {
  MODULE_CONTROL_TOKENS,
  SCOPE_PATTERNS,
  CONVENTION_PATTERNS,
  EXPLICIT_MODULE_CONTROL_TESTS,
} from '../jest.config.security.mjs';

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Patterns may only reach the backend's own test trees, never the whole repo. */
const ALLOWED_PATTERN_ROOTS = ['<rootDir>/__tests__/', '<rootDir>/modules/'];

/** The auth module is control source, not a domain module: its scope is pinned. */
const REQUIRED_SCOPE_PATTERNS = [
  '<rootDir>/__tests__/**/*.test.mjs',
  '<rootDir>/modules/auth/__tests__/**/*.test.mjs',
  '<rootDir>/modules/auth/__tests__/**/*.spec.mjs',
];

/**
 * Module-resident control suites that MUST be in the gate, pinned INDEPENDENTLY
 * of the config.
 *
 * The convention check below derives its expectation from
 * MODULE_CONTROL_TOKENS, so it is self-referential: deleting a token removes
 * the file from both sides of the comparison and the case still passes. This
 * list is the answer to that — it names the files, so dropping 'Idor' from the
 * convention, or renaming a pattern so it stops matching, fails here.
 *
 * Every entry is a control test: IDOR scope, route authz, admin-MFA
 * enforcement, assignment ownership, admin guards, per-route rate limiting,
 * server-authoritative award, or a deliberately closed attack surface. If one is
 * genuinely renamed or retired, update this list in the same commit and say why
 * — never to make a red gate green.
 */
const REQUIRED_MODULE_CONTROL_TESTS = [
  'modules/competition/__tests__/competition-rate-limiting.test.mjs',
  'modules/competition/__tests__/showExecuteAdminMfaEnforcement.integration.test.mjs',
  'modules/crafting/__tests__/craftingRouteSecurityPipeline.integration.test.mjs',
  'modules/grooms/__tests__/groomRetirementEndpointClosed.integration.test.mjs',
  'modules/horses/__tests__/breedCreateAdminMfaEnforcement.integration.test.mjs',
  'modules/horses/__tests__/breedRoutesAuthz.integration.test.mjs',
  'modules/horses/__tests__/foalNowEnvironmentGate.test.mjs',
  'modules/horses/__tests__/horse-rate-limiting.test.mjs',
  'modules/horses/__tests__/horseCompetitionHistoryIdor.integration.test.mjs',
  'modules/horses/__tests__/horseCreationEndpointClosed.integration.test.mjs',
  'modules/horses/__tests__/horseDeletionEndpointClosed.integration.test.mjs',
  'modules/horses/__tests__/horseListIdorScope.integration.test.mjs',
  'modules/horses/__tests__/horsePersonalityImpactIdor.integration.test.mjs',
  'modules/horses/__tests__/horseUpdateBreedMassAssign.sentinel.test.mjs',
  'modules/horses/__tests__/horseUpdateParentageHijack.integration.test.mjs',
  'modules/horses/__tests__/horseXpAwardServerAuthoritative.integration.test.mjs',
  'modules/labs/__tests__/memoryAdminGuard.integration.test.mjs',
  'modules/labs/__tests__/telemetryAdminGuard.integration.test.mjs',
  'modules/riders/__tests__/riderAssignmentOwnership.integration.test.mjs',
  'modules/users/__tests__/user-rate-limiting.test.mjs',
  'modules/users/__tests__/userSearchSecurity.integration.test.mjs',
  'modules/users/__tests__/userUpdateMassAssignment.integration.test.mjs',
];

const LIST_TESTS_TIMEOUT_MS = 180_000;

const toPosixRelative = absolute => path.relative(BACKEND, absolute).split(path.sep).join('/');

/**
 * What the security config actually selects, resolved by Jest. Cached: the
 * child process costs a few seconds and every case wants the same answer.
 */
let selectedCache = null;
function selectedTests() {
  if (selectedCache) {
    return selectedCache;
  }
  const stdout = execFileSync(
    process.execPath,
    [
      '--experimental-vm-modules',
      path.join(BACKEND, 'node_modules/jest/bin/jest.js'),
      '--config=jest.config.security.mjs',
      '--listTests',
    ],
    {
      cwd: BACKEND,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    },
  );
  selectedCache = stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /\.(test|spec)\.mjs$/.test(line))
    .map(toPosixRelative)
    .sort();
  return selectedCache;
}

/** Every module-resident test file on disk, outside the auth module. */
function moduleTestFilesOnDisk() {
  const files = [];
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(test|spec)\.mjs$/.test(entry.name)) {
        files.push(toPosixRelative(full));
      }
    }
  };
  walk(path.join(BACKEND, 'modules'));
  return files.filter(file => file.includes('/__tests__/') && !file.startsWith('modules/auth/'));
}

/** Disk files the NAMING CONVENTION claims, computed independently of Jest. */
function conventionMatchesOnDisk() {
  return moduleTestFilesOnDisk().filter(file => {
    const base = path.basename(file);
    return MODULE_CONTROL_TOKENS.some(token => base.includes(token)) || base.includes('-rate-limiting');
  });
}

const explicitListAsPaths = () => EXPLICIT_MODULE_CONTROL_TESTS.map(pattern => pattern.replace('<rootDir>/', ''));

describe('security suite scope sentinel (Equoria-ugxuc)', () => {
  test(
    'the selection is non-empty and is exactly the three declared layers',
    () => {
      expect(securityConfig.testMatch).toEqual([
        ...SCOPE_PATTERNS,
        ...CONVENTION_PATTERNS,
        ...EXPLICIT_MODULE_CONTROL_TESTS,
      ]);
      // An empty selection would exit 1 anyway (passWithNoTests is unset), but a
      // gate that proves nothing must fail HERE, with a readable reason.
      expect(selectedTests().length).toBeGreaterThan(0);
    },
    LIST_TESTS_TIMEOUT_MS,
  );

  test('every testMatch pattern is rooted in the backend test trees', () => {
    expect(Array.isArray(securityConfig.testMatch)).toBe(true);

    const strays = securityConfig.testMatch.filter(
      pattern => !ALLOWED_PATTERN_ROOTS.some(root => pattern.startsWith(root)),
    );

    // A bare '**/__tests__/**' lands here — the exact re-broadening regression.
    expect(strays).toEqual([]);
  });

  test(
    'the auth module scope is present — narrowing is guarded too',
    () => {
      // Deleting these silently drops the whole auth control surface from the
      // gate while every other case still passes. That is the unsafe direction.
      for (const required of REQUIRED_SCOPE_PATTERNS) {
        expect(SCOPE_PATTERNS).toContain(required);
      }

      const authSelected = selectedTests().filter(file => file.startsWith('modules/auth/__tests__/'));
      expect(authSelected.length).toBeGreaterThan(0);
    },
    LIST_TESTS_TIMEOUT_MS,
  );

  test(
    'every pinned module-resident control suite is actually selected',
    () => {
      const selected = new Set(selectedTests());
      const missed = REQUIRED_MODULE_CONTROL_TESTS.filter(file => !selected.has(file));

      // Independent of the config: this fires when a convention token is
      // dropped, a pattern stops matching, or a control suite is quietly
      // excluded. The one-way ratchet the first sentinel lacked.
      expect(missed).toEqual([]);
    },
    LIST_TESTS_TIMEOUT_MS,
  );

  test(
    'every naming-convention match on disk is actually selected',
    () => {
      const expected = conventionMatchesOnDisk();
      expect(expected.length).toBeGreaterThan(0);

      const selected = new Set(selectedTests());
      const missed = expected.filter(file => !selected.has(file));

      // If this fails, a control test was named by the documented convention
      // (docs/SECURITY_TESTING.md) and the gate still did not run it.
      expect(missed).toEqual([]);
    },
    LIST_TESTS_TIMEOUT_MS,
  );

  test(
    'every explicitly listed control suite is actually selected',
    () => {
      expect(EXPLICIT_MODULE_CONTROL_TESTS.length).toBeGreaterThan(0);

      const selected = new Set(selectedTests());
      const missed = explicitListAsPaths().filter(file => !selected.has(file));

      // A typo in the list is otherwise invisible: Jest matches nothing and says
      // nothing, and the suite silently shrinks by one control.
      expect(missed).toEqual([]);
    },
    LIST_TESTS_TIMEOUT_MS,
  );

  test(
    'the selection does not sweep the domain suites back in',
    () => {
      const selected = selectedTests();

      // The file whose five cases the old whole-suite selection 429'd. It is not
      // a security-control test and still runs, blocking, in the shard matrix.
      expect(selected).not.toContain('modules/horses/__tests__/foalCreationMinimalPayload.test.mjs');

      // Outside modules/auth, the gate runs EXACTLY the convention matches plus
      // the explicit list — nothing broader, nothing incidental.
      const expectedModuleSelection = [...new Set([...conventionMatchesOnDisk(), ...explicitListAsPaths()])].sort();
      const actualModuleSelection = selected
        .filter(file => file.startsWith('modules/') && !file.startsWith('modules/auth/'))
        .sort();

      expect(actualModuleSelection).toEqual(expectedModuleSelection);
    },
    LIST_TESTS_TIMEOUT_MS,
  );

  test(
    'every coverage-thresholded control still has a test inside the selection',
    () => {
      const controls = Object.keys(securityConfig.coverageThreshold);
      expect(controls.length).toBeGreaterThan(0);

      const sources = selectedTests().map(file => readFileSync(path.join(BACKEND, file), 'utf8'));
      const missing = controls.filter(control => {
        const needle = control.replace(/^\.\//, '').replace(/\.mjs$/, '');
        return !sources.some(source => source.includes(needle));
      });

      // Not a coverage fact — the per-file 100% thresholds are that, and they
      // run in the same job. This is the readable early failure.
      expect(missing).toEqual([]);
    },
    LIST_TESTS_TIMEOUT_MS,
  );
});
