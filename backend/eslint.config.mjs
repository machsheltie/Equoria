/**
 * ESLint Configuration for Equoria Backend
 *
 * This configuration provides comprehensive linting rules for the Node.js/Express backend
 * with ES modules, ensuring code quality and consistency across the project.
 */

import js from '@eslint/js';
// Equoria-dm1i: shared inline plugin (also imported by the repo-root
// eslint.config.js) providing the warn-level no-raw-test-horse-create
// sentinel for the NULL-phenotype fixture defect class. See the plugin
// file's doc-comment for the full rationale.
import { equoriaTestFixturePlugin } from './eslint-plugins/no-raw-test-horse-create.mjs';

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
            // Equoria-4qjo (21R-SEC-3-REVIEW-7-FOLLOW): forbid the deep-relative
            // `node_modules/@prisma/client/index.js` import pattern. Production
            // code must either (a) use the project's shared prismaClient
            // singleton via `import prisma from '../../packages/database/prismaClient.mjs'`
            // or (b) use the bare specifier `@prisma/client` for standalone
            // scripts. Deep-relative-into-node_modules is fragile (breaks when
            // workspace layout changes) and the `.js` extension violates the ES
            // Modules doctrine (CLAUDE.md / ES_MODULES_REQUIREMENTS.md).
            {
              group: ['**/node_modules/@prisma/client/**', '**/packages/database/node_modules/**'],
              message:
                "Do not import @prisma/client via deep-relative node_modules paths. Use `import prisma from '../../packages/database/prismaClient.mjs'` (shared singleton) or the bare specifier `@prisma/client` (standalone scripts). See Equoria-4qjo for context.",
            },
            // Equoria-4wl0r: forbid imports of the deprecated
            // `backend/db/index.mjs` re-export shim. The shim is deleted in
            // this commit; the canonical Prisma singleton path is
            // `packages/database/prismaClient.mjs`. This pattern catches any
            // future reintroduction (e.g. a contributor re-adds the shim or a
            // codemod regression). Matches `**/db/index.mjs` and `**/db/index`
            // at any nesting depth — the only legitimate `db/index.mjs`-like
            // file in this tree was the shim, so a flat `**` glob is safe.
            {
              group: ['**/db/index.mjs', '**/db/index'],
              message:
                'The `backend/db/index.mjs` Prisma re-export shim was removed (Equoria-4wl0r). Import the singleton from `packages/database/prismaClient.mjs` instead. Dual import paths caused cross-realm `instanceof Date` failures (Equoria-s20o) and double-pool risk.',
            },
            // Equoria-r9we2: forbid imports of `modules/services/controllers`,
            // `modules/services/routes`, or `modules/services/data` — those
            // subdirs have been dissolved into proper domain modules:
            // - bank      → modules/bank/
            // - crafting  → modules/crafting/
            // - tackShop, feedShop, farrier, vet, inventory → modules/economy/{x}/
            // The empty parent subdirs are deleted in this commit; this rule
            // catches any contributor who re-creates them or re-introduces an
            // import path under those segments. The `__tests__/` subtree of
            // modules/services/ is intentionally NOT in this pattern — it
            // still holds ~120 orphan platform tests pending relocation under
            // a separate follow-up bd issue.
            {
              group: [
                '**/modules/services/controllers/**',
                '**/modules/services/routes/**',
                '**/modules/services/data/**',
              ],
              message:
                'modules/services/ is a deleted junk-drawer (Equoria-r9we2). Import from the proper domain: bank → modules/bank/, crafting → modules/crafting/, tackShop/feedShop/farrier/vet/inventory → modules/economy/{domain}/.',
            },
          ],
        },
      ],

      // Equoria-4qjo: forbid `.js` extension in import paths anywhere in
      // backend/. ES Modules doctrine requires `.mjs` for ESM source files;
      // bare specifiers and JSON imports are unaffected (JSON uses `.json`).
      // AST selector matches `ImportDeclaration` whose `source.value` is a
      // string ending in `.js`. Re-uses the no-restricted-syntax slot but as
      // a distinct rule entry merged with the test-file sentinel (Equoria-ip82).
      //
      // Equoria-rv3fd: forbid the verbose-error-response leak pattern in
      // controllers/routes:
      //   error: process.env.NODE_ENV !== 'production' ? error.message : 'fallback'
      // The project explicitly uses `beta` and `beta-readiness` NODE_ENV
      // values for tester-facing deployments — `!== 'production'` is true in
      // BOTH, so raw error.message (incl. Prisma column/table names and
      // validation paths) flows to clients. Safe shape: gate on
      // `=== 'development'` instead, or route through errorHandler.mjs.
      // The selector matches the canonical leak shape (BinaryExpression with
      // `!==` against the literal `'production'`, used as the test of a
      // ConditionalExpression whose consequent is a MemberExpression ending
      // in `.message`). Non-error gating (e.g. `if (NODE_ENV !== 'production')
      // { return mockSendMail(); }`) is unaffected — that pattern doesn't
      // produce a ConditionalExpression-with-error.message consequent.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportDeclaration[source.value=/\\.js$/]',
          message:
            'Imports must use `.mjs` extension or bare specifiers. The `.js` extension is reserved for legacy CommonJS modules in node_modules. See Equoria-4qjo / CLAUDE.md ES_MODULES_REQUIREMENTS.md.',
        },
        {
          selector:
            'ConditionalExpression[test.type="BinaryExpression"][test.operator="!=="][test.right.value="production"] > MemberExpression.consequent[property.name="message"]',
          message:
            "Verbose-error-response leak: `NODE_ENV !== 'production' ? <x>.message : ...` exposes raw error/Prisma internals in beta and beta-readiness envs. Use `=== 'development'` or route through errorHandler.mjs. See Equoria-rv3fd / SECURITY.md A09.",
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
    plugins: {
      // Equoria-dm1i: inline plugin providing the warn-level
      // no-raw-test-horse-create sentinel (defined at top of this file).
      equoria: equoriaTestFixturePlugin,
    },
    rules: {
      // Relax some rules for test files
      'no-unused-expressions': 'off',
      'prefer-arrow-callback': 'off',

      // Equoria-dm1i: NULL-phenotype fixture defect-class sentinel.
      // `warn` so the ~206 legacy raw-create suites do not break the lint
      // gate, while making the tech debt visible and nudging NEW tests
      // onto fixtureColor()/createTestHorse(). See plugin doc-comment.
      'equoria/no-raw-test-horse-create': 'warn',
      // Equoria-jw471: debug console.log in test files pollutes CI output
      // and hides real signals. `warn` so a handful of legitimate
      // status-prints in globalSetup/teardown and load-test scaffolding
      // do not break the lint gate, while making future drive-by debug
      // logs visible. `console.warn`/`console.error` remain allowed for
      // genuine test-time diagnostics. Three suites cleaned up in
      // Equoria-jw471: training-complete.test.mjs (3) and
      // traitDiscoveryIntegration.test.mjs (5).
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      // Test files may legitimately import the test-only exports from
      // requestBodySecurity.mjs to set up monkey-patches and contract
      // sentinels. The production-block rule blocks them everywhere else.
      'no-restricted-imports': 'off',

      // Equoria-ip82: fixture-ID regression guard. Equoria-3gti's flake fix
      // removed Date.now()+Math.random().toString(36) collision-prone fixture
      // identifiers from test files (replaced with randomBytes(8).toString('hex')).
      // Without this rule, a new contributor can silently reintroduce the
      // pattern and the flake returns when Jest test scheduling shifts.
      //
      // The AST selector matches template literals containing BOTH a
      // `Date.now()` call AND a `Math.random()` call — the canonical
      // signature of the collision-prone construction
      // `` `fixture_${Date.now()}_${Math.random().toString(36).slice(2)}` ``.
      // Single-call uses of either are not matched (legitimate timing/seed
      // utilities).
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'TemplateLiteral:has(CallExpression[callee.object.name="Date"][callee.property.name="now"]):has(CallExpression[callee.object.name="Math"][callee.property.name="random"])',
          message:
            "Date.now()+Math.random() fixture-IDs are collision-prone and re-introduce the Equoria-3gti flake. Use `randomBytes(8).toString('hex')` from node:crypto instead. See Equoria-ip82 for context.",
        },
        // Equoria-4qjo: same .js-extension import ban applies to test files.
        // Test fixtures that import from a deep-relative `.js` path in
        // node_modules will rot when workspace layout shifts; the canonical
        // pattern is `import prisma from
        // '../../packages/database/prismaClient.mjs'` or a bare specifier
        // (Equoria-4wl0r: the prior `../db/index.mjs` shim was removed).
        {
          selector: 'ImportDeclaration[source.value=/\\.js$/]',
          message:
            'Imports must use `.mjs` extension or bare specifiers. The `.js` extension is reserved for legacy CommonJS modules in node_modules. See Equoria-4qjo / CLAUDE.md ES_MODULES_REQUIREMENTS.md.',
        },
      ],
    },
  },
  {
    // Equoria-becrm: routes layer must never import the Prisma client.
    // Routes own validation + response formatting; data-access lives in
    // services. Adding a `prisma.xxx` call to a routes file means either:
    //   (a) the call should move into an existing service helper, or
    //   (b) a thin new service helper should be added next to the route
    //       module (modules/<x>/services/<y>.mjs).
    // The pattern matches both `packages/database/prismaClient.mjs` (the
    // canonical singleton) and the deleted `db/index.mjs` shim (the latter
    // is also banned globally by the rule a few blocks up — this duplicate
    // explicitly names it so any future contributor sees the routes-layer
    // intent without needing to chase the broader ban).
    files: ['modules/**/routes/**/*.mjs', 'routes/**/*.mjs'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/packages/database/prismaClient.mjs',
                '**/prismaClient.mjs',
                '**/db/index.mjs',
              ],
              message:
                'Routes layer must not import the Prisma client. Move the data access into a service (modules/<x>/services/<y>.mjs) and call it from the route. See Equoria-becrm for context.',
            },
          ],
        },
      ],
      // Equoria-y8u2j: routes-layer god-file sentinel. Any single route file
      // > 800 lines is forbidden — split it into sub-routers by sub-domain
      // (e.g. horseFeedRoutes / horseBreedingRoutes / horseHistoryRoutes) or
      // by lifecycle (CRUD vs. derived), and extract any inline business
      // logic into a service. The horseRoutes.mjs split (Equoria-y8u2j) is
      // the worked example: 1977 → 594 lines via 6 sub-router extractions
      // and 2 service extractions. Blank lines and standalone comments are
      // excluded so cleanup-comments at the top of the file are not penalised.
      'max-lines': ['error', { max: 800, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Equoria-xod8b (child A of Equoria-mh937): controllers-layer god-file
    // sentinel. Any single controller file > 800 lines is forbidden — carve
    // it by domain into sibling controllers in the same directory (e.g.
    // horseOverviewController / horseConformationController / horseGeneticsController
    // / horseStudController / horseFoalingController) and keep the original
    // <module>Controller.mjs as a re-export barrel so existing import sites
    // resolve unchanged. The horseController.mjs split (Equoria-xod8b) is the
    // worked example: 1574 → 64 lines via 5 sibling-controller extractions
    // and a barrel re-export. Blank lines and standalone comments are
    // excluded so jsdoc/header banners are not penalised. Same threshold +
    // semantics as the routes-layer rule above (Equoria-y8u2j) for parity.
    files: ['modules/**/controllers/**/*.mjs', 'controllers/**/*.mjs'],
    rules: {
      'max-lines': ['error', { max: 800, skipBlankLines: true, skipComments: true }],
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
