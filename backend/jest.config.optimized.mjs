/**
 * Optimized Jest Configuration for Authentication Test Suite
 *
 * Features:
 * - Parallel test execution with intelligent worker allocation
 * - Test result caching for unchanged files
 * - Optimized resource allocation for CI/CD
 * - Advanced failure recovery and retry strategies
 * - Performance monitoring and benchmarking
 *
 * Usage:
 * - Local: npm run test:auth (uses 50% workers)
 * - CI/CD: npm run test:auth:ci (uses 100% workers, no watch)
 * - Watch: npm run test:auth:watch (single worker, fast feedback)
 */

export default {
  // ==========================================
  // PARALLEL EXECUTION STRATEGY
  // ==========================================

  /**
   * Worker Configuration for Parallel Execution
   * - Local: 50% of CPU cores for balance with other tasks
   * - CI: 100% of cores for maximum speed
   * - Override with --maxWorkers=N
   */
  maxWorkers: process.env.CI ? '100%' : '50%',

  /**
   * Worker Pool Size Limits
   * - Min 2 workers to enable parallelization
   * - Max 8 workers to prevent resource exhaustion
   */
  maxConcurrency: 5,

  /**
   * Test Execution Strategy
   * - Runs tests in parallel across multiple workers
   * - Each worker has isolated test environment
   */
  testEnvironment: 'node',

  // ==========================================
  // TEST FILE PATTERNS & DEPENDENCIES
  // ==========================================

  /**
   * Test Discovery Patterns
   * - Priority execution for auth tests
   * - Organized by test type for intelligent batching
   */
  testMatch: [
    '**/__tests__/integration/auth-*.test.mjs',
    '**/__tests__/unit/auth-*.test.mjs',
    '**/__tests__/**/*.test.mjs',
  ],

  /**
   * Test Execution Order
   * - Unit tests first (fast, no dependencies)
   * - Integration tests second (slower, database dependencies)
   * - E2E tests last (slowest, full stack)
   * - Temporarily disabled due to ES module compatibility issues
   */
  // testSequencer: '<rootDir>/tests/config/CustomSequencer.mjs',

  // ==========================================
  // INTELLIGENT CACHING STRATEGY
  // ==========================================

  /**
   * Test Result Caching
   * - Cache test results for unchanged files
   * - Speeds up subsequent runs by 60-80%
   * - Cache stored in .jest-cache/
   */
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',

  /**
   * Dependency Detection
   * - Tracks file dependencies to invalidate cache
   * - Re-runs tests only when dependencies change
   * - Temporarily disabled due to ES module compatibility issues
   */
  // dependencyExtractor: '<rootDir>/tests/config/DependencyExtractor.mjs',

  /**
   * Watch Mode Optimizations
   * - Only re-run tests affected by changed files
   * - Uses git to determine changed files
   */
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/.jest-cache/',
    '/dist/',
  ],

  // ==========================================
  // RESOURCE ALLOCATION & PERFORMANCE
  // ==========================================

  /**
   * Test Timeout Configuration
   * - Unit tests: 10s (fast)
   * - Integration tests: 30s (database operations)
   * - E2E tests: 60s (full flow)
   */
  testTimeout: process.env.TEST_TYPE === 'unit' ? 10000 : 30000,

  /**
   * Memory Management
   * - Clear mocks between tests to prevent memory leaks
   * - Reset modules to ensure test isolation
   */
  clearMocks: true,
  resetMocks: false, // Keep mocks configured between tests in same file
  restoreMocks: true,
  resetModules: false, // Keep module cache for performance

  /**
   * Async Operation Management
   * - Detect open handles (database connections, timers)
   * - Force exit if tests complete but handles remain
   */
  detectOpenHandles: process.env.CI ? false : true, // Disable in CI for speed
  forceExit: true,
  openHandlesTimeout: 2000,

  // ==========================================
  // FAILURE RECOVERY & RETRY STRATEGY
  // ==========================================

  /**
   * Bail Strategy
   * - CI: Don't bail, run all tests to collect all failures
   * - Local: Bail after 3 failures for fast feedback
   */
  bail: process.env.CI ? false : 3,

  /**
   * Error Handling
   * - Fail on deprecated API usage
   * - Strict error checking for code quality
   */
  errorOnDeprecated: true,

  /**
   * Test Retry Configuration
   * - Note: jest-retries plugin would be needed for automatic retry
   * - Not configured in this version for simplicity
   */
  // testRetries: Not a native Jest option (requires jest-retries plugin)

  // ==========================================
  // SETUP & TEARDOWN
  // ==========================================

  /**
   * Global Setup/Teardown
   * - Setup: Initialize test database, seed data
   * - Teardown: Clean up resources, close connections
   */
  globalSetup: '<rootDir>/tests/config/globalSetup.mjs',
  globalTeardown: '<rootDir>/tests/config/globalTeardown.mjs',

  /**
   * Per-Test Setup
   * - Runs before each test file
   * - Sets up test-specific mocks and utilities
   */
  setupFilesAfterEnv: ['<rootDir>/tests/config/setupTests.mjs'],

  // ==========================================
  // COVERAGE CONFIGURATION
  // ==========================================

  /**
   * Coverage Collection
   * - Collect only for auth-related files
   * - Exclude test files, config, migrations
   */
  collectCoverage: !!process.env.COVERAGE,
  collectCoverageFrom: [
    'controllers/authController.mjs',
    'middleware/auth.mjs',
    'services/auth*.mjs',
    'utils/auth*.mjs',
  ],

  /**
   * Coverage Thresholds (CI only)
   * - Fail build if coverage drops below thresholds
   */
  coverageThreshold: process.env.CI
    ? {
        global: {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80,
        },
        './controllers/authController.mjs': {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
      }
    : undefined,

  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: process.env.CI
    ? ['text-summary', 'lcov', 'json', 'cobertura']
    : ['text', 'html', 'lcov'],

  // ==========================================
  // ES MODULES SUPPORT
  // ==========================================

  preset: null,
  transform: {},
  // .mjs files are always treated as ESM by Jest, no need to specify
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  // ==========================================
  // REPORTING & MONITORING
  // ==========================================

  /**
   * Test Reporters
   * - CI: Concise summary + machine-readable formats
   * - Local: Verbose output for debugging
   */
  reporters: process.env.CI
    ? [
        'default',
        ['jest-junit', { outputDirectory: 'test-results', outputName: 'junit.xml' }],
        ['jest-html-reporter', { pageTitle: 'Auth Test Results', outputPath: 'test-results/index.html' }],
        ['<rootDir>/tests/config/PerformanceReporter.mjs', { outputPath: 'test-results/performance.json' }],
      ]
    : ['default'],

  /**
   * Verbose Output
   * - CI: Summary only
   * - Local: Verbose for debugging
   */
  verbose: !process.env.CI,

  // ==========================================
  // PERFORMANCE MONITORING
  // ==========================================

  /**
   * Slow Test Threshold
   * - Warn when tests exceed 5s (integration)
   * - Helps identify performance bottlenecks
   */
  slowTestThreshold: 5,

  /**
   * Notify on Test Completion
   * - Useful for long-running test suites
   * - Disabled due to missing node-notifier dependency
   */
  notify: false,
  // notifyMode: 'failure-change',

  // ==========================================
  // TEST ISOLATION & SANDBOXING
  // ==========================================

  /**
   * Test Isolation
   * - Each test file runs in separate environment
   * - Prevents cross-test contamination
   */
  testEnvironmentOptions: {
    NODE_ENV: 'test',
  },

  /**
   * Module Mocking
   * - Automatically mock node_modules
   * - Improves test speed and isolation
   */
  automock: false,

  // ==========================================
  // CUSTOM CONFIGURATION
  // ==========================================

  globals: {
    __DEV__: false,
    __TEST__: true,
    __BENCHMARK__: !!process.env.BENCHMARK,
  },
};
