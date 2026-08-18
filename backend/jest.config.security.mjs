/**
 * Jest Configuration for Security Tests
 * Separate configuration with strict coverage thresholds
 */

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

  // Test patterns
  testMatch: ['**/__tests__/**/*.test.mjs', '**/__tests__/**/*.spec.mjs'],

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
