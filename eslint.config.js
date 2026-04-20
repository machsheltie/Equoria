// ESLint flat config
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      '.archive/**',
      '.backups/**',
      // Contains parse-error-inducing template literals; excluded from lint.
      'utils/agent-skills/**',
      '.agent/**',
      '.agents/**',
      '.claude/**',
      '.gemini/**',
      '.playwright-mcp/**',
      '_bmad/**',
      '_bmad-output/**',
      'node_modules',
      '**/dist',
      '**/build',
      '**/coverage',
      '**/.next',
      '**/out',
      '**/*.min.js',
      '**/vendor/**',
      '**/*.d.ts',
      'backend/db/migrations/**',
      'frontend/components/**',
      'frontend/hooks/**',
      'tests/integration/**',
    ],
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    rules: {
      'prettier/prettier': 'error',
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          // Don't fail on `} catch (error) {` when the error isn't used —
          // error handlers are frequently written for side effects + logs
          // only, and renaming every one to `_error` is noise.
          caughtErrors: 'none',
        },
      ],
      'no-console': 'off',
      'no-undef': 'off',
    },
    plugins: { prettier: (await import('eslint-plugin-prettier')).default },
  },
  {
    files: ['frontend/**/*.{ts,tsx}', 'UI/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      // Frontend does not yet have a typed API layer — downgrade `any` to
      // a warning so it surfaces in reviews without blocking CI.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Downgrade the TS comment ban to a warning — some test shims use
      // the older suppression directive intentionally.
      '@typescript-eslint/ban-ts-comment': 'warn',
    },
  },
  {
    files: [
      'frontend/**/*.test.{ts,tsx}',
      'frontend/**/*.spec.{ts,tsx}',
      'frontend/**/__tests__/**/*.{ts,tsx}',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
