/**
 * Jest Configuration for Equoria Monorepo
 *
 * Configures Jest to handle both backend (Node.js/ES modules) and frontend (React/JSX) tests
 * with appropriate transformations and environment settings.
 */

import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Absolute, forward-slash, glob-safe form of a directory, for use inside
 * testMatch globs INSTEAD of `<rootDir>`.
 *
 * Why not `<rootDir>`: on Windows Jest builds the glob as the backslash
 * rootDir with its separators rewritten by replacePathSepForGlob, which
 * deliberately keeps a backslash that precedes a regex-special character
 * (`.` included). A dot-prefixed path segment such as `.claude/worktrees`
 * therefore turns `/.claude` into a backslash-dot pair: an escaped dot with the separator
 * swallowed. Every `<rootDir>/...` glob then matches nothing, and a run that
 * resolves zero test files looks like a run that passed (Equoria-beqsp,
 * Equoria-9zd7g, Equoria-43y7o). Forward slashes carry no escape for Jest to
 * mangle, and picomatch is already configured with `dot: true`.
 *
 * Glob metacharacters that Jest's own rewrite would corrupt (`[ ] ! *`) make
 * this throw rather than silently select nothing.
 */
export function toGlobRoot(directory) {
  const posix = directory.split(path.sep).join('/');
  if (/[[\]!*]/.test(posix)) {
    throw new Error(
      `jest.config.js: cannot build a test glob under a path containing [ ] ! or *: ${posix}`
    );
  }
  return posix.replace(/[(){}]/g, (match) => `\\${match}`);
}

const REPO_GLOB_ROOT = toGlobRoot(realpathSync(path.dirname(fileURLToPath(import.meta.url))));

const BACKEND_PROJECT_IGNORE_PATTERNS = [
  '<rootDir>/../.archive/',
  '<rootDir>/../.agent/',
  '<rootDir>/../.agents/',
  '<rootDir>/../.claude/',
  '<rootDir>/../.gemini/',
  '<rootDir>/../.playwright-mcp/',
  '<rootDir>/../_bmad/',
];

const ROOT_PROJECT_IGNORE_PATTERNS = [
  '<rootDir>/.archive/',
  '<rootDir>/.agent/',
  '<rootDir>/.agents/',
  '<rootDir>/.claude/',
  '<rootDir>/.gemini/',
  '<rootDir>/.playwright-mcp/',
  '<rootDir>/_bmad/',
];

export default {
  // Projects configuration for monorepo
  projects: [
    // Backend tests configuration
    {
      displayName: 'backend',
      rootDir: '<rootDir>/backend',
      // Absolute globs, not <rootDir>/...: see toGlobRoot above.
      testMatch: [
        `${REPO_GLOB_ROOT}/backend/**/*.test.{js,mjs}`,
        `${REPO_GLOB_ROOT}/tests/*.test.{js,mjs}`,
        `${REPO_GLOB_ROOT}/tests/models/**/*.test.{js,mjs}`,
        `${REPO_GLOB_ROOT}/tests/services/**/*.test.{js,mjs}`,
        `${REPO_GLOB_ROOT}/tests/unit/**/*.test.{js,mjs}`,
      ],
      testEnvironment: '<rootDir>/tests/config/PrismaCleanupEnvironment.mjs',
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
        jest: {
          useESM: true,
        },
      },
      maxWorkers: 1,
      testTimeout: 60000,
      // Mandatory hygiene set (user directive 2026-08-18) — see
      // CONTRIBUTING.md 'Test-Run Resource Budget'.
      clearMocks: true,
      resetMocks: true,
      restoreMocks: true,
      resetModules: true,
      errorOnDeprecated: true,
      testPathIgnorePatterns: [
        '/node_modules/',
        '/coverage/',
        '/dist/',
        '/build/',
        '<rootDir>/../.archive/',
        '<rootDir>/tests/load/',
        '<rootDir>/../tests/integration/',
      ],
      watchPathIgnorePatterns: [
        '/node_modules/',
        '/coverage/',
        '/dist/',
        '/build/',
        '<rootDir>/../.archive/',
        '<rootDir>/tests/load/',
      ],
      // Opt-in only (DETECT_OPEN_HANDLES=true): it implies --runInBand,
      // defeating the worker budget (CONTRIBUTING.md 'Test-Run Resource
      // Budget'); enforced by check-jest-memory-budget.mjs.
      detectOpenHandles: process.env.DETECT_OPEN_HANDLES === 'true',
    },
    // Unit tests configuration
    {
      displayName: 'unit',
      roots: ['<rootDir>/tests/unit'],
      testMatch: [`${REPO_GLOB_ROOT}/tests/unit/**/*.test.{js,mjs}`],
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
      resetMocks: true,
      restoreMocks: true,
      resetModules: true,
    },
  ],

  // Global configuration
  // Process-level budget knobs (global-only jest options; user directive
  // 2026-08-18): 2 workers max, 512MB worker recycling, hard exit so no
  // worker outlives the run.
  maxWorkers: 2,
  workerIdleMemoryLimit: '512MB',
  forceExit: true,
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
