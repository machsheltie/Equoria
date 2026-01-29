/**
 * Jest Configuration for Performance Tests
 *
 * Separate configuration for running performance benchmarks
 * with appropriate timeouts and resource limits.
 */

export default {
  // Test environment
  testEnvironment: 'node',

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.mjs'],

  // Test file patterns - only performance tests
  testMatch: ['**/__tests__/performance/**/*.test.mjs'],

  // ES modules support
  preset: null,
  transform: {},

  // Module resolution
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^ioredis$': '<rootDir>/__mocks__/ioredis.js',
  },

  // Coverage disabled for performance tests
  collectCoverage: false,

  // Longer timeout for performance tests (2 minutes)
  testTimeout: 120000,

  // Run tests sequentially (no parallel for accurate performance measurement)
  maxWorkers: 1,

  // Don't bail on failures
  bail: 0,

  // Cache for faster subsequent runs
  cache: true,
  cacheDirectory: '.jest-cache-performance',

  // Globals for ES modules
  globals: {
    jest: {
      useESM: true,
    },
  },

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Verbose output for performance metrics
  verbose: true,

  // Error handling
  errorOnDeprecated: false,

  // Test patterns to ignore
  testPathIgnorePatterns: ['/node_modules/', '/coverage/', '/dist/', '/build/'],

  // Force exit after tests complete
  forceExit: true,

  // Detect open handles
  detectOpenHandles: true,

  // Force close after tests
  openHandlesTimeout: 2000,

  // Custom reporter for performance metrics
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: './test-results',
        outputName: 'performance-junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true,
      },
    ],
  ],
};
