/**
 * Jest Configuration for Equoria Monorepo
 *
 * Configures Jest to handle both backend (Node.js/ES modules) and frontend (React/JSX) tests
 * with appropriate transformations and environment settings.
 */

export default {
  // Projects configuration for monorepo
  projects: [
    // Backend tests configuration
    {
      displayName: 'backend',
      testMatch: ['<rootDir>/backend/**/*.test.{js,mjs}', '<rootDir>/tests/**/*.test.{js,mjs}'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.mjs'],
      preset: null,

      transform: {},
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
      globals: {
        jest: {
          useESM: true,
        },
      },
      clearMocks: true,
      restoreMocks: true,
      errorOnDeprecated: true,
      testPathIgnorePatterns: ['/node_modules/', '/coverage/', '/dist/', '/build/'],
      watchPathIgnorePatterns: ['/node_modules/', '/coverage/', '/dist/', '/build/'],
      detectOpenHandles: true,
    },
    // Frontend tests configuration
    {
      displayName: 'frontend',
      testMatch: ['<rootDir>/frontend/**/*.test.{js,jsx}'],
      testEnvironment: 'jsdom',
      transform: {
        '^.+\\.(js|jsx|mjs)$': 'babel-jest',
      },
      moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        'react-native': '<rootDir>/frontend/__mocks__/react-native.js',
        'expo-linear-gradient': '<rootDir>/frontend/__mocks__/expo-linear-gradient.js',
      },
      setupFilesAfterEnv: ['<rootDir>/frontend/jest.setup.js'],
      transformIgnorePatterns: [
        'node_modules/(?!(react-native|@react-native|expo-linear-gradient)/)',
      ],
      clearMocks: true,
      restoreMocks: true,
    },
    // Unit tests configuration
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.{js,mjs}'],
      testEnvironment: 'node',
      preset: null,

      transform: {},
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
      globals: {
        jest: {
          useESM: true,
        },
      },
      clearMocks: true,
      restoreMocks: true,
    }
  ],

  // Global configuration
  collectCoverage: false,
  collectCoverageFrom: [
    '**/*.{js,mjs,jsx}',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/tests/**',
    '!**/examples/**',
    '!**/docs/**',
    '!**/migrations/**',
    '!**/seed/**',
    '!jest.config.js',
    '!babel.config.js',
    '!eslint.config.mjs',
    '!**/server.mjs',
  ],

  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
