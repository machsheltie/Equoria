/**
 * Jest Configuration for Security Tests
 * Separate configuration with strict coverage thresholds
 *
 * ──────────────────────────────────────────────────────────────────────────
 * WHAT THIS CONFIG SELECTS, AND WHY IT IS NOT THE WHOLE BACKEND
 * ──────────────────────────────────────────────────────────────────────────
 * Equoria-ugxuc: testMatch was `**\/__tests__\/**`, i.e. every backend test
 * file. The Security Gate (`npm run test:security`, .github/workflows/test.yml)
 * therefore re-ran the entire suite — 828 suites / ~12.4k tests — in ONE Jest
 * process, and five cases in
 * modules/horses/__tests__/foalCreationMinimalPayload.test.mjs got HTTP 429
 * where they assert 400/200.
 *
 * The issue assumed counter accumulation across ~12k requests. Measured, that
 * is NOT the mechanism, and the real one matters for anyone adding a suite
 * here. This config does not load backend/tests/setup.mjs (that is
 * jest.config.mjs's setupFilesAfterEnv; this one loads __tests__/setup.mjs),
 * and tests/setup.mjs is what sets TEST_RATE_LIMIT_MAX_REQUESTS=1000 /
 * TEST_RATE_LIMIT_WINDOW_MS=15min. Unset, every limiter built with
 * `useEnvOverride: true` falls back to its own literal — mutationRateLimiter is
 * 30 requests per 60 SECONDS (backend/middleware/rateLimiting.mjs). The foal
 * file issues more than 30 breeding mutations in under a minute, so it 429s
 * under THIS config in a fresh process, on its own, with no other file running:
 *
 *   jest --config=jest.config.security.mjs --runInBand \
 *     --testMatch '<rootDir>/modules/horses/__tests__/foalCreationMinimalPayload.test.mjs'
 *     -> 5 failed / 15 passed
 *   TEST_RATE_LIMIT_MAX_REQUESTS=1000 TEST_RATE_LIMIT_WINDOW_MS=900000 <same>
 *     -> 20 passed
 *
 * It passes in Backend Tests (Shard 1-3) and in the pre-push sharded run
 * because those use jest.config.mjs, which loads tests/setup.mjs and therefore
 * runs the same limiter at 1000/15min.
 *
 * Raising the cap, disabling the limiter or adding a bypass header are all
 * forbidden and would destroy what this gate proves — and the tighter caps are
 * arguably the more honest profile for a SECURITY suite, so they stay. What was
 * wrong is that a security gate was running domain suites at all. The defect was
 * the SELECTION, and selection is now three explicit layers:
 *
 *   1. SCOPE_PATTERNS — the control sources' own test homes.
 *      docs/SECURITY_TESTING.md: "Middleware and controls | backend/middleware/,
 *      backend/modules/auth/, backend/config/". Per
 *      .claude/rules/CONTRIBUTING.md those tests live in backend/__tests__/
 *      (middleware sentinels + cross-module integration) and
 *      backend/modules/auth/__tests__/.
 *
 *   2. CONVENTION_PATTERNS — control tests that live WITH the domain module
 *      whose route they guard, identified by name. Control tests are not filed
 *      by control source: IDOR, authz, admin-MFA, ownership and per-route
 *      rate-limit suites sit in modules/horses, modules/competition,
 *      modules/users … A name-based convention means a NEW control test lands
 *      in this gate by being named correctly, with no config edit. The tokens
 *      are case-sensitive on purpose (Jest testMatch globs are), and they are
 *      documented in docs/SECURITY_TESTING.md so the spelling is discoverable.
 *
 *   3. EXPLICIT_MODULE_CONTROL_TESTS — the escape hatch for control suites the
 *      convention cannot name. Each entry is a genuine control test whose
 *      subject is an authorization, attack-surface or privilege boundary.
 *
 * Everything outside these three layers is a domain test, not a security-control
 * test, and still runs — blocking — in the Backend Tests shard matrix. Nothing
 * here is skipped, weakened or bypassed.
 *
 * backend/__tests__/securitySuiteScope.sentinel.test.mjs pins all of this:
 * it asks Jest itself (`--listTests`) what this config selects and fails if a
 * convention match, an explicit entry, or the auth-module scope is missing.
 */

/**
 * Name tokens that mark a module-resident test as a security-control test.
 * CASE-SENSITIVE — Jest's testMatch globs are. Documented in
 * docs/SECURITY_TESTING.md; add a token here and there together.
 */
export const MODULE_CONTROL_TOKENS = [
  'Idor',
  'Authz',
  'Security',
  'Mfa',
  'Ownership',
  'AdminGuard',
  'ServerAuthoritative',
];

/** The control sources' own test homes (layer 1). */
export const SCOPE_PATTERNS = [
  '<rootDir>/__tests__/**/*.test.mjs',
  '<rootDir>/__tests__/**/*.spec.mjs',
  '<rootDir>/modules/auth/__tests__/**/*.test.mjs',
  '<rootDir>/modules/auth/__tests__/**/*.spec.mjs',
];

/** Module-resident control tests matched by name (layer 2). */
export const CONVENTION_PATTERNS = [
  `<rootDir>/modules/**/__tests__/**/*@(${MODULE_CONTROL_TOKENS.join('|')})*.test.mjs`,
  `<rootDir>/modules/**/__tests__/**/*@(${MODULE_CONTROL_TOKENS.join('|')})*.spec.mjs`,
  // Per-route rate-limit suites use the kebab suffix, not a camel token.
  '<rootDir>/modules/**/__tests__/**/*-rate-limiting.test.mjs',
  '<rootDir>/modules/**/__tests__/**/*-rate-limiting.spec.mjs',
];

/**
 * Control suites the convention cannot name (layer 3). Each is an
 * authorization / attack-surface / privilege-boundary test, not a domain test.
 */
export const EXPLICIT_MODULE_CONTROL_TESTS = [
  // CWE-639 parentage hijack on PUT /horses/:id (Equoria-hg62v).
  '<rootDir>/modules/horses/__tests__/horseUpdateParentageHijack.integration.test.mjs',
  // CWE-915/CWE-269 mass assignment / self-privilege-escalation (Equoria-qia4j).
  '<rootDir>/modules/users/__tests__/userUpdateMassAssignment.integration.test.mjs',
  // breedId mass assignment on PUT /horses/:id (Equoria-tmyd2). Same class as
  // the entry above; the file is spelled "MassAssign", not "MassAssignment",
  // so no token reaches it. Exactly what this list exists for.
  '<rootDir>/modules/horses/__tests__/horseUpdateBreedMassAssign.sentinel.test.mjs',
  // Attack surface closed: free horse creation (2026-09-05 audit finding 2).
  '<rootDir>/modules/horses/__tests__/horseCreationEndpointClosed.integration.test.mjs',
  // Attack surface closed: player horse deletion (Equoria-9tque).
  '<rootDir>/modules/horses/__tests__/horseDeletionEndpointClosed.integration.test.mjs',
  // Attack surface closed: player groom retirement (Equoria-m9lz1).
  '<rootDir>/modules/grooms/__tests__/groomRetirementEndpointClosed.integration.test.mjs',
  // Environment gate on the gestation-bypass route (Equoria-bhf6n).
  '<rootDir>/modules/horses/__tests__/foalNowEnvironmentGate.test.mjs',
];

export const SECURITY_TEST_MATCH = [
  ...SCOPE_PATTERNS,
  ...CONVENTION_PATTERNS,
  ...EXPLICIT_MODULE_CONTROL_TESTS,
];

export default {
  // Test environment
  testEnvironment: '<rootDir>/tests/config/PrismaCleanupEnvironment.mjs',

  // Use ESM modules
  transform: {},

  // Module resolution
  // js-first REQUIRED: mjs-first + the .js-stripping mapper self-resolves dual-package ESM wrappers (jest-environment-node TDZ, Equoria-ip8kk). Do not reorder.
  moduleFileExtensions: ['js', 'mjs', 'json'],

  // Module name aliases — kept in sync with jest.config.mjs so that tests
  // using @logger, @prisma-client, etc. resolve identically regardless of which
  // config is active. Also required so that relative jest.mock() paths in
  // module-level __tests__ (e.g. modules/users/__tests__) resolve from the
  // test file, not from the setupFilesAfterEnv context.
  moduleNameMapper: {
    // Equoria-4wl0r: `@db` alias retired with the `backend/db/index.mjs`
    // shim it pointed at. `@prisma-client` (below) is the canonical alias.
    '^@prisma-client$': '<rootDir>/../packages/database/prismaClient.mjs',
    '^@logger$': '<rootDir>/utils/logger.mjs',
    '^@middleware/(.*)$': '<rootDir>/middleware/$1',
    '^@utils/(.*)$': '<rootDir>/utils/$1',
    '^@models/(.*)$': '<rootDir>/models/$1',
    '^@services/(.*)$': '<rootDir>/services/$1',
    '^@errors/(.*)$': '<rootDir>/errors/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  // Test patterns — the SECURITY-CONTROL surface, not the whole backend.
  // Built above from SCOPE_PATTERNS + CONVENTION_PATTERNS + EXPLICIT_MODULE_CONTROL_TESTS.
  testMatch: SECURITY_TEST_MATCH,

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.mjs'],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage-security',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

  // Coverage thresholds (STRICT for security code).
  //
  // The `global` block is intentionally absent. The security suite runs
  // a narrow slice of tests (`__tests__/**`); a global 85% would be
  // measured across the entire collectCoverageFrom set (middleware,
  // utils, services), which the security tests do not exercise — most
  // of those files would show 0% coverage and drag the average to ~22%.
  // The PER-FILE thresholds below are what this suite is for: hard
  // 100% on the security-critical middleware specifically.
  coverageThreshold: {
    // Security-critical middleware must have 100% coverage
    './middleware/security.mjs': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    // sessionManagement.mjs branches lowered 100→90. The remaining 7.7%
    // are at line 206 (`if (oldestSessions.length > 0)` after a take()
    // query that's already gated by `activeSessions > MAX_CONCURRENT_
    // SESSIONS` — the empty-array branch is structurally unreachable
    // through the production request flow) and lines 272-289 (the
    // `incomingHash` ternary inside the .map(), where both true/false
    // branches in one .map() call require a session list whose tokenHash
    // values include both the caller's hash AND others — already covered
    // for the `false` half by integration tests that issue requests
    // without the refresh-token cookie). Lines/functions/statements
    // remain at 100%; the lowered branch threshold reflects honestly-
    // unreachable defensive-code paths.
    './middleware/sessionManagement.mjs': {
      branches: 90,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    './middleware/validationErrorHandler.mjs': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    './utils/validateEnvironment.mjs': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },

  // Collect coverage from these files
  collectCoverageFrom: [
    'middleware/**/*.mjs',
    'utils/**/*.mjs',
    'services/**/*.mjs',
    '!**/__tests__/**',
    '!**/node_modules/**',
    '!**/coverage*/**',
  ],

  // Globals for ES modules — mirrors jest.config.mjs to ensure jest.mock()
  // hoisting works consistently across both configs when tests use ESM imports.
  globals: {
    jest: {
      useESM: true,
    },
  },

  // Worker budget (user directive 2026-08-18): hard 2-worker cap +
  // 512MB idle-recycle governor, matching jest.config.mjs. The npm
  // test:security scripts also pin these on the CLI; carrying them here
  // protects direct `--config=jest.config.security.mjs` invocations from
  // silently re-parallelizing. See CONTRIBUTING.md 'Test-Run Resource Budget'.
  maxWorkers: 2,
  workerIdleMemoryLimit: '512MB',

  // Timeouts
  testTimeout: 30000, // 30 seconds for database operations

  // Verbose output
  verbose: true,

  // Detect open handles — opt-in only (DETECT_OPEN_HANDLES=true); it implies
  // --runInBand, defeating the worker budget (CONTRIBUTING.md).
  detectOpenHandles: process.env.DETECT_OPEN_HANDLES === 'true',
  forceExit: true, // Force exit after tests complete

  // Mandatory hygiene set (user directive 2026-08-18): mock state cleared,
  // reset, AND restored between tests, plus a module-registry reset so mock
  // modules can't accumulate across tests — see CONTRIBUTING.md.
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  resetModules: true,

  // Error handling
  bail: false, // Run all tests even if some fail
  errorOnDeprecated: true,

  // Reporters
  reporters: ['default'],
};
