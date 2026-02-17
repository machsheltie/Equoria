// ESLint flat config
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
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
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
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
    rules: {},
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
