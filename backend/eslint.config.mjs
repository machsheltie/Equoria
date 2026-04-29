/**
 * ESLint Configuration for Equoria Backend
 *
 * This configuration provides comprehensive linting rules for the Node.js/Express backend
 * with ES modules, ensuring code quality and consistency across the project.
 */

import js from '@eslint/js';

export default [
  {
    files: ['**/*.mjs', '**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
        fetch: 'readonly', // Node.js 18+ global
        URL: 'readonly', // Node.js global
        performance: 'readonly', // Node.js global
      },
    },
    rules: {
      ...js.configs.recommended.rules,

      // Code Quality
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-console': 'off', // Allow console for server logging
      'no-debugger': 'error',
      'no-alert': 'error',

      // 21R-SEC-3-FOLLOW-1 (Equoria-ixqg): the `__TESTING_ONLY_JsonScanner`
      // export from requestBodySecurity.mjs exists so the integration tests
      // can monkey-patch the scanner to inject controlled non-AppError
      // throws. Production code MUST NOT import it — its presence in a
      // production import path is a code smell that suggests someone is
      // bypassing the public API (`verifyJsonBody` / `rejectPollutedRequestBody`
      // / `requestBodySecurityErrorHandler`). The test-files override block
      // below disables this rule for paths under __tests__/ and tests/.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/requestBodySecurity*', '**/middleware/requestBodySecurity.mjs'],
              importNames: ['__TESTING_ONLY_JsonScanner'],
              message:
                '__TESTING_ONLY_JsonScanner is a test-only export. Production code must use verifyJsonBody / rejectPollutedRequestBody / requestBodySecurityErrorHandler. See backend/middleware/requestBodySecurity.mjs for context.',
            },
          ],
        },
      ],

      // Best Practices
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-return-assign': 'error',
      'no-sequences': 'error',
      'no-throw-literal': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unused-expressions': 'error',
      'no-useless-call': 'error',
      'no-useless-concat': 'error',
      'no-useless-return': 'error',
      'prefer-promise-reject-errors': 'error',

      // Variables
      'no-delete-var': 'error',
      'no-undef': 'error',
      'no-undef-init': 'error',
      'no-undefined': 'off',

      // Stylistic Issues
      'array-bracket-spacing': ['error', 'never'],
      'block-spacing': ['error', 'always'],
      'brace-style': ['error', '1tbs', { allowSingleLine: true }],
      'comma-dangle': ['error', 'always-multiline'],
      'comma-spacing': ['error', { before: false, after: true }],
      'comma-style': ['error', 'last'],
      'computed-property-spacing': ['error', 'never'],
      'eol-last': ['error', 'always'],
      'func-call-spacing': ['error', 'never'],
      // `indent` disabled: conflicts with Prettier for nested object/ternary
      // expressions (e.g. `opts ? { \n  foo: 1\n }` — eslint's indent rule
      // and Prettier disagree on the inner indent level). Prettier runs via
      // lint-staged and is the source of truth for whitespace.
      indent: 'off',
      'key-spacing': ['error', { beforeColon: false, afterColon: true }],
      'keyword-spacing': ['error', { before: true, after: true }],
      'linebreak-style': 'off', // Disabled for Windows compatibility (git handles line endings)
      'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
      'no-trailing-spaces': 'error',
      'object-curly-spacing': ['error', 'always'],
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],
      'semi-spacing': ['error', { before: false, after: true }],
      'space-before-blocks': ['error', 'always'],
      'space-before-function-paren': [
        'error',
        {
          anonymous: 'always',
          named: 'never',
          asyncArrow: 'always',
        },
      ],
      'space-in-parens': ['error', 'never'],
      'space-infix-ops': 'error',
      'space-unary-ops': ['error', { words: true, nonwords: false }],

      // ES6+
      'arrow-spacing': ['error', { before: true, after: true }],
      'constructor-super': 'error',
      'no-class-assign': 'error',
      'no-const-assign': 'error',
      'no-dupe-class-members': 'error',
      'no-duplicate-imports': 'error',
      'no-new-symbol': 'error',
      'no-this-before-super': 'error',
      'no-useless-computed-key': 'error',
      'no-useless-constructor': 'error',
      'no-useless-rename': 'error',
      'no-var': 'error',
      'object-shorthand': ['error', 'always'],
      'prefer-arrow-callback': 'error',
      'prefer-const': 'error',
      'prefer-destructuring': 'off', // Too many false positives, consider 'warn' later
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'prefer-template': 'error',
      'rest-spread-spacing': ['error', 'never'],
      'template-curly-spacing': ['error', 'never'],
    },
  },
  {
    files: [
      '**/*.test.mjs',
      '**/*.test.js',
      '__tests__/**/*.mjs',
      '__tests__/**/*.js',
      'tests/**/*.mjs',
      'tests/**/*.js',
    ],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
        __ENV: 'readonly', // k6 load testing
        __VU: 'readonly', // k6 load testing
        suspiciousActivityCache: 'readonly', // Test helper
      },
    },
    rules: {
      // Relax some rules for test files
      'no-unused-expressions': 'off',
      'prefer-arrow-callback': 'off',
      // Test files may legitimately import the test-only exports from
      // requestBodySecurity.mjs to set up monkey-patches and contract
      // sentinels. The production-block rule blocks them everywhere else.
      'no-restricted-imports': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'coverage-security/**',
      'dist/**',
      'build/**',
      '*.min.js',
    ],
  },
];
