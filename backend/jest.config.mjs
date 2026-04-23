/**
 * Jest Configuration for Equoria Backend
 *
 * Configures Jest for testing the Node.js/Express backend with ES modules support.
 * Includes setup for database testing, mocking, and comprehensive test coverage.
 */

export default {
  // Test environment
  testEnvironment: 'node',

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.mjs'],
  globalSetup: '<rootDir>/tests/globalSetup.mjs',
  globalTeardown: '<rootDir>/tests/teardown.mjs',

  // Test file patterns
  testMatch: ['**/*.test.mjs', '**/*.test.js'],

  // ES modules support
  preset: null,
  transform: {},

  // Module resolution
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  // Coverage configuration
  collectCoverage: false, // Enable with --coverage flag
  collectCoverageFrom: [
    '**/*.{js,mjs}',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/tests/**',
    '!**/examples/**',
    '!**/docs/**',
    '!**/migrations/**',
    '!**/seed/**',
    '!jest.config.mjs',
    '!eslint.config.mjs',
    '!server.mjs', // Server startup file
  ],

  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  // Test timeout
  testTimeout: 60000, // 60 seconds for database operations (handles system load variance)

  // Parallel execution for performance
  maxWorkers: '50%', // Use 50% of available CPU cores for parallel test execution

  // Bail on N failures (0 = don't bail, useful for CI)
  bail: 0,

  // Cache for faster subsequent runs
  cache: true,
  cacheDirectory: '.jest-cache',

  // Globals for ES modules
  globals: {
    jest: {
      useESM: true,
    },
  },

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Verbose output
  verbose: false,

  // Error handling
  errorOnDeprecated: true,

  // Test patterns to ignore
  testPathIgnorePatterns: ['/node_modules/', '/coverage/', '/dist/', '/build/', '/tests/load/'],

  // Watch mode configuration
  watchPathIgnorePatterns: ['/node_modules/', '/coverage/', '/dist/', '/build/'],

  // Force exit after tests complete
  forceExit: true,

  // Detect open handles (opt-in; jest docs: "significant performance penalty,
  // should only be used for debugging" — it serialises execution and tracks
  // every handle across all test files, which OOMs the full suite under
  // --runInBand. Enable via `DETECT_OPEN_HANDLES=true npm test` when needed.)
  detectOpenHandles: process.env.DETECT_OPEN_HANDLES === 'true',

  // Force close after tests
  openHandlesTimeout: 1000,
};
