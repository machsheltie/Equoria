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
  testTimeout: 30000, // 30 seconds for database operations

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
  testPathIgnorePatterns: ['/node_modules/', '/coverage/', '/dist/', '/build/'],

  // Watch mode configuration
  watchPathIgnorePatterns: ['/node_modules/', '/coverage/', '/dist/', '/build/'],

  // Force exit after tests complete
  forceExit: true,

  // Detect open handles
  detectOpenHandles: true,
};
