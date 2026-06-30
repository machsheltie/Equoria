// ESLint flat config
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
// Equoria-dm1i: shared inline plugin (defined under backend/, also used by
// backend/eslint.config.mjs). Registered here so the root lint pass
// (lint-staged pre-commit + any root `eslint .`) recognises the
// `equoria/no-raw-test-horse-create` rule and its eslint-disable
// directives in backend test files — otherwise
// `reportUnusedDisableDirectives: true` errors on the sentinel-negative
// test's intentional scoped disable.
// Equoria-cl5y0: shared inline plugin for no-skipped-tests sentinel.
// Equoria-d1l20: shared inline plugin for no-forward-reference-comments sentinel.
import { equoriaTestFixturePlugin } from './backend/eslint-plugins/no-raw-test-horse-create.mjs';
import { equoriaSkippedTestsPlugin } from './backend/eslint-plugins/no-skipped-tests.mjs';
import { equoriaForwardReferencesPlugin } from './backend/eslint-plugins/no-forward-reference-comments.mjs';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      '.archive/**',
      '.backups/**',
      // Equoria-h3sij: the old 'utils/agent-skills/** contains
      // parse-error-inducing template literals' blanket ignore was removed.
      // The Equoria-lq5li auditor rewrite (node-native fs walk, no shell
      // here-strings) and the Equoria-h3sij context-packager fail-loud
      // rewrite eliminated the offending literals; all three scripts
      // (auditor / context-packager / log-surgeon) now lint clean, so they
      // are intentionally NOT ignored — keeping them under the linter is
      // what catches the next silent-catch / unused-import regression.
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
      // Equoria-iy47z: a local `npm run build-storybook` leaves
      // frontend/storybook-static/ with thousands of bundled JS files; without
      // this ignore, `eslint .` lints them and takes ~50-98 min instead of ~10s.
      '**/storybook-static',
      '**/storybook-static/**',
      '**/coverage',
      '**/coverage-security',
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
      // The base `no-unused-vars` rule treats TypeScript enum members as
      // standalone variable declarations and fires "is defined but never
      // used" on every member. The @typescript-eslint variant is
      // enum-aware and is already configured above; disable the base
      // rule on TS files to avoid double-reporting / false positives.
      'no-unused-vars': 'off',
      // Equoria-rkgq9: Radix is fully retired. The 8 @radix-ui primitives
      // (dialog/tabs/tooltip/checkbox/collapsible/progress/label/slot) were
      // replaced with native in-house implementations under components/ui/*.
      // Ban any reintroduction — the door is shut at lint AND doctrine
      // (scripts/doctrine-checks/check-no-radix-imports.mjs).
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@radix-ui', '@radix-ui/*'],
              message:
                'Radix is banned (Equoria-rkgq9). Use the native in-house components/ui/* primitives — do not reintroduce @radix-ui.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'frontend/**/*.test.{ts,tsx}',
      'frontend/**/*.spec.{ts,tsx}',
      'frontend/**/__tests__/**/*.{ts,tsx}',
    ],
    plugins: {
      equoria: {
        rules: {
          ...equoriaTestFixturePlugin.rules,
          ...equoriaSkippedTestsPlugin.rules,
          ...equoriaForwardReferencesPlugin.rules,
        },
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // Equoria-efaz: flag vi.mock-of-api-client. Mocking the api-client
      // fakes the entire backend boundary so the test passes even when
      // the real API/controller/DB is broken — the exact failure mode
      // CLAUDE.md "Testing Philosophy" forbids. Set to `warn` (mirroring
      // `equoria/no-raw-test-horse-create`) so the 23 grandfathered
      // baseline files surface in review without breaking CI; the hard
      // merge-blocking gate is the doctrine-check
      // scripts/doctrine-checks/check-no-new-api-client-vi-mock.mjs which
      // freezes the baseline and fails on any NEW occurrence.
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            "CallExpression[callee.object.name='vi'][callee.property.name='mock'] > Literal.arguments:first-child[value=/api-client/]",
          message:
            'Do NOT add new vi.mock-of-API-client tests (CLAUDE.md Testing Philosophy). Mocking the api-client fakes the backend boundary so the test passes even when the real API/DB is broken. Use a Playwright E2E test against the real backend instead. Existing baseline files are grandfathered; new ones are blocked by scripts/doctrine-checks/check-no-new-api-client-vi-mock.mjs.',
        },
      ],
      // Equoria-cl5y0: Prevent skipped tests (Principle 2 — Beta is falsifiable).
      'equoria/no-skipped-tests': 'error',
      // Equoria-d1l20: Detect forward-reference comments without bd issue tracking
      'equoria/no-forward-reference-comments': 'warn',
    },
  },
  {
    // Equoria-kdduk: page modules MUST stay under 600 lines. Pages that grow
    // beyond this are split into sub-tab files in `pages/<page>-detail/` —
    // see frontend/src/pages/horse-detail/ for the canonical pattern.
    // Threshold is intentionally permissive (600 vs the 400 target for
    // individual tab files) because the page itself owns global layout +
    // tab orchestration; sub-tabs do not.
    //
    // Test files (`__tests__/`) are exempt — verbose RTL/Vitest setup
    // routinely exceeds 600 lines and the cap is about production-page
    // bloat, not test-fixture bloat.
    files: ['frontend/src/pages/**/*.tsx'],
    ignores: ['frontend/src/pages/**/__tests__/**'],
    rules: {
      'max-lines': ['error', { max: 600, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Equoria-n4ebf: the api-client barrel MUST NOT regrow into a god file.
    // It was decomposed from 2951 lines into a transport core (./http/apiClient)
    // + domain clients (./api/<domain>.ts) under Equoria-rfsml; this barrel now
    // only re-exports the transport + hosts the not-yet-migrated inline domain
    // wrappers. The 900-line cap sits above the current size (~739 effective)
    // to leave headroom for the in-flight Equoria-jog8w domain extractions while
    // firmly blocking any slide back toward the old 2951-line god file. As each
    // jog8w slice moves a domain out into ./api/<domain>.ts the barrel shrinks,
    // so the cap should ratchet DOWN over time — never up. (skipBlankLines +
    // skipComments mirror the pages rule above so the count tracks real code.)
    // The glob also covers a dedicated sentinel-plant path
    // (api-client._max_lines_doctrine_sentinel_plant.ts) so the
    // apiClientMaxLinesDoctrine sentinel can prove the rule FIRES on a planted
    // oversize file WITHOUT ever mutating the real barrel (per OPTIMAL_FIX §2:
    // a check needs a sentinel-positive test, and that test must not risk the
    // production file). The plant file does not exist in the tree at rest.
    files: [
      'frontend/src/lib/api-client.ts',
      'frontend/src/lib/api-client._max_lines_doctrine_sentinel_plant.ts',
    ],
    rules: {
      'max-lines': ['error', { max: 900, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Equoria-dm1i: keep the warn-level NULL-phenotype fixture sentinel
    // consistent across the root lint pass too (backend test files are
    // linted by both this root config and backend/eslint.config.mjs).
    // Equoria-cl5y0: also register no-skipped-tests sentinel here.
    // Registering the plugins here makes the rules resolvable so the
    // sentinel-negative test's scoped eslint-disable directives do not
    // error under reportUnusedDisableDirectives.
    files: ['backend/**/*.test.mjs', 'backend/**/*.test.js', 'backend/**/__tests__/**/*.{mjs,js}'],
    plugins: {
      equoria: {
        rules: {
          ...equoriaTestFixturePlugin.rules,
          ...equoriaSkippedTestsPlugin.rules,
        },
      },
    },
    rules: {
      // Equoria-c8ulb (2026-05-29): promoted from 'warn' to 'error' to
      // mirror backend/eslint.config.mjs. Backlog at zero per Equoria-7guhz
      // audit; hard-fail keeps the gate honest at the root lint pass
      // (lint-staged pre-commit + any root `eslint .`).
      'equoria/no-raw-test-horse-create': 'error',
      // Equoria-cl5y0: Prevent skipped tests (Principle 2 — Beta is falsifiable).
      'equoria/no-skipped-tests': 'error',
    },
  },
];
