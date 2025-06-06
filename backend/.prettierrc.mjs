/**
 * Prettier Configuration for Equoria Backend
 *
 * This configuration ensures consistent code formatting across the project,
 * working in harmony with ESLint rules for optimal code quality.
 */

export default {
  // Basic formatting
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',

  // Trailing commas
  trailingComma: 'all',

  // Brackets and spacing
  bracketSpacing: true,
  bracketSameLine: false,

  // Arrow functions
  arrowParens: 'avoid',

  // Line endings
  endOfLine: 'lf',

  // Embedded language formatting
  embeddedLanguageFormatting: 'auto',

  // HTML whitespace sensitivity
  htmlWhitespaceSensitivity: 'css',

  // Prose wrapping
  proseWrap: 'preserve',

  // Vue files
  vueIndentScriptAndStyle: false,

  // Override for specific file types
  overrides: [
    {
      files: '*.json',
      options: {
        printWidth: 80,
        tabWidth: 2,
      },
    },
    {
      files: '*.md',
      options: {
        printWidth: 80,
        proseWrap: 'always',
      },
    },
    {
      files: ['*.test.mjs', '*.test.js'],
      options: {
        printWidth: 120, // Allow longer lines in tests for readability
      },
    },
  ],
};
