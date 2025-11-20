/**
 * Jest Configuration for Security Tests
 * Separate configuration with strict coverage thresholds
 */

export default {
  // Test environment
  testEnvironment: 'node',

  // Use ESM modules
  transform: {},

  // Module resolution
  moduleFileExtensions: ['mjs', 'js', 'json'],

  // Test patterns
  testMatch: [
    '**/__tests__/**/*.test.mjs',
    '**/__tests__/**/*.spec.mjs',
  ],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.mjs'],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage-security',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

  // Coverage thresholds (STRICT for security code)
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    // Security-critical middleware must have 100% coverage
    './middleware/security.mjs': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    './middleware/sessionManagement.mjs': {
      branches: 100,
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

  // Timeouts
  testTimeout: 30000, // 30 seconds for database operations

  // Verbose output
  verbose: true,

  // Detect open handles (memory leaks)
  detectOpenHandles: false, // Set to true for debugging
  forceExit: true, // Force exit after tests complete

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  resetMocks: false,

  // Error handling
  bail: false, // Run all tests even if some fail
  errorOnDeprecated: true,

  // Reporters
  reporters: ['default'],
};
