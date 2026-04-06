/**
 * Jest Configuration for Equoria Monorepo
 *
 * Configures Jest to handle both backend (Node.js/ES modules) and frontend (React/JSX) tests
 * with appropriate transformations and environment settings.
 */

const BACKEND_PROJECT_IGNORE_PATTERNS = [
  '<rootDir>/../.archive/',
  '<rootDir>/../.backups/',
  '<rootDir>/../.agent/',
  '<rootDir>/../.agents/',
  '<rootDir>/../.claude/',
  '<rootDir>/../.gemini/',
  '<rootDir>/../.playwright-mcp/',
  '<rootDir>/../_bmad/',
  '<rootDir>/../_bmad-output/',
];

const ROOT_PROJECT_IGNORE_PATTERNS = [
  '<rootDir>/.archive/',
  '<rootDir>/.backups/',
  '<rootDir>/.agent/',
  '<rootDir>/.agents/',
  '<rootDir>/.claude/',
  '<rootDir>/.gemini/',
  '<rootDir>/.playwright-mcp/',
  '<rootDir>/_bmad/',
  '<rootDir>/_bmad-output/',
];

export default {
  // Projects configuration for monorepo
  projects: [
    // Backend tests configuration
    {
      displayName: 'backend',
      rootDir: '<rootDir>/backend',
      testMatch: [
        '<rootDir>/**/*.test.{js,mjs}',
        '<rootDir>/../tests/*.test.{js,mjs}',
        '<rootDir>/../tests/models/**/*.test.{js,mjs}',
        '<rootDir>/../tests/services/**/*.test.{js,mjs}',
        '<rootDir>/../tests/unit/**/*.test.{js,mjs}',
      ],
      testEnvironment: 'node',
      roots: ['<rootDir>', '<rootDir>/../tests'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.mjs'],
      globalTeardown: '<rootDir>/tests/teardown.mjs',
      preset: null,
      // Do not transform backend ESM files; run them natively via Node ESM
      transform: {},
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
      modulePathIgnorePatterns: BACKEND_PROJECT_IGNORE_PATTERNS,
      moduleDirectories: ['node_modules', '<rootDir>/node_modules', '<rootDir>/../node_modules'],
      globals: {
        'ts-jest': {
          useESM: true,
        },
        jest: {
          useESM: true,
        },
      },
      maxWorkers: 1,
      clearMocks: true,
      restoreMocks: true,
      errorOnDeprecated: true,
      testPathIgnorePatterns: [
        '/node_modules/',
        '/coverage/',
        '/dist/',
        '/build/',
        '<rootDir>/../.archive/',
        '<rootDir>/../.backups/',
        '<rootDir>/tests/load/',
        '<rootDir>/../tests/integration/',
      ],
      watchPathIgnorePatterns: [
        '/node_modules/',
        '/coverage/',
        '/dist/',
        '/build/',
        '<rootDir>/../.archive/',
        '<rootDir>/../.backups/',
        '<rootDir>/tests/load/',
      ],
      detectOpenHandles: true,
    },
    // Unit tests configuration
    {
      displayName: 'unit',
      roots: ['<rootDir>/tests/unit'],
      testMatch: ['<rootDir>/tests/unit/**/*.test.{js,mjs}'],
      testEnvironment: 'node',
      preset: null,

      transform: {},
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
      modulePathIgnorePatterns: ROOT_PROJECT_IGNORE_PATTERNS,
      globals: {
        jest: {
          useESM: true,
        },
      },
      clearMocks: true,
      restoreMocks: true,
    },
  ],

  // Global configuration
  collectCoverage: false,
  collectCoverageFrom: [
    '**/*.{js,mjs,jsx}',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/tests/**',
    '!**/test/**',
    '!**/examples/**',
    '!**/docs/**',
    '!**/migrations/**',
    '!**/seed/**',
    '!**/scripts/**',
    '!**/dist/**',
    '!**/build/**',
    '!jest.config.js',
    '!jest.setup.mjs',
    '!babel.config.js',
    '!eslint.config.mjs',
    '!**/server.mjs',
    '!**/*.test.{js,mjs}',
    '!**/*.spec.{js,mjs}',
  ],

  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html', 'json', 'json-summary', 'cobertura'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 85,
      statements: 85,
    },
    './backend/controllers/': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './backend/services/': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './backend/utils/': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
};
