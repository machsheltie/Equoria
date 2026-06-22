/**
 * ESLint Configuration for Equoria Backend
 *
 * This configuration provides comprehensive linting rules for the Node.js/Express backend
 * with ES modules, ensuring code quality and consistency across the project.
 */

import js from '@eslint/js';
// Equoria-dm1i: shared inline plugin (also imported by the repo-root
// eslint.config.js) providing the error-level no-raw-test-horse-create
// sentinel for the NULL-phenotype fixture defect class (promoted from
// warn to error under Equoria-c8ulb, 2026-05-29; see the rule config
// below and the plugin file's doc-comment for the full rationale).
import { equoriaTestFixturePlugin } from './eslint-plugins/no-raw-test-horse-create.mjs';
// Equoria-cl5y0: shared inline plugin (also imported by the repo-root
// eslint.config.js) providing error-level no-skipped-tests sentinel for
// Principle 2 (Beta is falsifiable) enforcement. See the plugin file's
// doc-comment for the full rationale.
import { equoriaSkippedTestsPlugin } from './eslint-plugins/no-skipped-tests.mjs';
// Equoria-d1l20: shared inline plugin (also imported by the repo-root
// eslint.config.js) providing warn-level no-forward-reference-comments
// sentinel for Principle 4 (Substance over appearance) enforcement. Forward-reference
// comments without bd issue tracking rot silently and produce false confidence.
// See the plugin file's doc-comment for the full rationale.
import { equoriaForwardReferencesPlugin } from './eslint-plugins/no-forward-reference-comments.mjs';

// ---------------------------------------------------------------------------
// Equoria-v8l96.4 — module public-API barrel boundary enforcement.
//
// The 21 top-level domain modules under backend/modules/ each ship an
// index.mjs barrel that IS their public API (CONTRIBUTING.md § "Module public
// API boundaries"). Cross-module imports MUST go through that barrel; reaching
// into another module's internals (controllers/services/routes/models/data/…)
// is forbidden. Same-module deep imports (a horses controller importing
// `../services/x.mjs`) remain ALLOWED — the barrier is BETWEEN modules, never
// within one.
//
// Why per-module override blocks (not one global pattern):
// `no-restricted-imports` `group` globs match the import-SPECIFIER STRING as
// written, regardless of the importing file's location. A single global glob
// like `**/horses/services/**` therefore CANNOT distinguish a cross-module
// reach (`../../horses/services/x.mjs` from inside `competition`) from a
// same-module deep import (`../services/x.mjs` from inside `horses`, whose
// specifier doesn't even contain `horses/`). The discrimination has to come
// from the IMPORTER's location — i.e. the `files:` scope. So for each module
// M we emit a block scoped to `modules/M/**` that forbids reaching into every
// OTHER module N≠M, and never forbids M's own internals. The prior global
// `Equoria-fy2tx` block (a flat `**/modules/<x>/<subdir>/**` list) was a
// no-op: real cross-module specifiers are written `../../<N>/...` and never
// contain the literal segment `modules/`, so it matched nothing. This replaces
// it with an enforcement that actually fires.
//
// Glob shape: `**/<N>/*/**` blocks a DEEP import (`<N>/services/x.mjs`,
// `<N>/tackShop/controllers/x.mjs`) — the `*/` requires at least one
// sub-directory segment after the module name — while ALLOWING the barrel
// (`<N>/index.mjs` has no sub-dir segment, so it is never matched). This also
// makes the rule future-proof against new internal sub-dirs: any sub-dir under
// another module is blocked without enumerating sub-dir names. (Note: ESLint
// 8's `no-restricted-imports` uses the `ignore` library for these globs, which
// does NOT do brace expansion — `{a,b}` is a literal, so a single `*/` segment
// matcher is the correct primitive here.)
//
// economy is the discrimination canary: its sub-domains (farrier/feedShop/
// inventory/tackShop/vet) are NESTED inside the economy module, so an
// economy/inventory file importing `../../tackShop/controllers/x.mjs` is a
// SAME-module import and stays allowed (tackShop is not a top-level module,
// hence never on any other module's forbidden list).
// ---------------------------------------------------------------------------
const BARREL_MODULES = [
  'admin',
  'auth',
  'bank',
  'breeding',
  'community',
  'competition',
  'crafting',
  'docs',
  'economy',
  'events',
  'grooms',
  'health',
  'horses',
  'labs',
  'leaderboards',
  'marketplace',
  'riders',
  'trainers',
  'training',
  'traits',
  'users',
];

// The shared global `no-restricted-imports` patterns (test-only scanner,
// deep @prisma node_modules, the removed db/index shim, the dissolved
// modules/services junk-drawer). Defined once here so the per-module barrel
// blocks below can re-assert them — flat-config rule overrides REPLACE (not
// merge) the whole rule value per file, so a per-module block that set ONLY
// the cross-module patterns would silently drop these shared bans for module
// files. Keeping them in one const is the single source of truth.
const SHARED_RESTRICTED_IMPORT_PATTERNS = [
  {
    group: ['**/requestBodySecurity*', '**/middleware/requestBodySecurity.mjs'],
    importNames: ['__TESTING_ONLY_JsonScanner'],
    message:
      '__TESTING_ONLY_JsonScanner is a test-only export. Production code must use verifyJsonBody / rejectPollutedRequestBody / requestBodySecurityErrorHandler. See backend/middleware/requestBodySecurity.mjs for context.',
  },
  {
    group: ['**/node_modules/@prisma/client/**', '**/packages/database/node_modules/**'],
    message:
      "Do not import @prisma/client via deep-relative node_modules paths. Use `import prisma from '../../packages/database/prismaClient.mjs'` (shared singleton) or the bare specifier `@prisma/client` (standalone scripts). See Equoria-4qjo for context.",
  },
  {
    group: ['**/db/index.mjs', '**/db/index'],
    message:
      'The `backend/db/index.mjs` Prisma re-export shim was removed (Equoria-4wl0r). Import the singleton from `packages/database/prismaClient.mjs` instead. Dual import paths caused cross-realm `instanceof Date` failures (Equoria-s20o) and double-pool risk.',
  },
  {
    group: [
      '**/modules/services/controllers/**',
      '**/modules/services/routes/**',
      '**/modules/services/data/**',
    ],
    message:
      'modules/services/ is a deleted junk-drawer (Equoria-r9we2). Import from the proper domain: bank → modules/bank/, crafting → modules/crafting/, tackShop/feedShop/farrier/vet/inventory → modules/economy/{domain}/.',
  },
];

// The routes-layer Prisma-client ban (Equoria-becrm) — route files must not
// import the Prisma client directly. Defined here so the per-module ROUTE
// blocks can carry it alongside the cross-module patterns (same flat-config
// replace-not-merge reason as above).
const ROUTES_PRISMA_RESTRICTED_PATTERN = {
  group: ['**/packages/database/prismaClient.mjs', '**/prismaClient.mjs', '**/db/index.mjs'],
  message:
    'Routes layer must not import the Prisma client. Move the data access into a service (modules/<x>/services/<y>.mjs) and call it from the route. See Equoria-becrm for context.',
};

// Build the per-module cross-module-deep-import patterns for module `self`:
// forbid reaching into every OTHER module's internals (a sub-dir under it),
// while leaving `self`'s own internals and every module's `index.mjs` barrel
// reachable. See the header block above for the `**/<other>/*/**` rationale.
function crossModulePatternsFor(self) {
  return BARREL_MODULES.filter(other => other !== self).map(other => ({
    group: [`**/${other}/*/**`],
    message:
      `Cross-module deep import: reach module '${other}' through its barrel ` +
      `('../../${other}/index.mjs'), not its internals. The barrel is the public API ` +
      '(Equoria-v8l96 / CONTRIBUTING.md § "Module public API boundaries"). ' +
      'Same-module deep imports remain allowed.',
  }));
}

// Per-module flat-config blocks enforcing the barrel boundary. For each module
// we emit TWO blocks, ordered general-then-routes so the routes block wins for
// route files (flat-config last-match-per-rule-key semantics):
//
//   1. GENERAL (modules/<M>/**): shared global bans + cross-module patterns.
//      Covers controllers/services/data/models/test files. These re-assert the
//      SHARED patterns (which a bare per-module block would otherwise drop) and
//      add cross-module enforcement. Test files are INCLUDED — the deep-import
//      migration cleaned them (Equoria-v8l96.3) — so this sits AFTER the
//      test-files override (which set `no-restricted-imports: 'off'`) and
//      re-enables enforcement for module test files.
//
//   2. ROUTES (modules/<M>/routes/**): routes-Prisma ban + cross-module
//      patterns. Route files do NOT get the SHARED patterns' generic surface
//      (the routes-layer block historically scoped to just the Prisma ban);
//      they DO get the Prisma ban plus cross-module enforcement. Emitted AFTER
//      the general block for the same module so it wins for route files.
const crossModuleBarrelBoundaryConfigs = BARREL_MODULES.flatMap(self => [
  {
    files: [`modules/${self}/**/*.mjs`, `modules/${self}/**/*.js`],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...SHARED_RESTRICTED_IMPORT_PATTERNS, ...crossModulePatternsFor(self)] },
      ],
    },
  },
  {
    files: [`modules/${self}/routes/**/*.mjs`, `modules/${self}/routes/**/*.js`],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [ROUTES_PRISMA_RESTRICTED_PATTERN, ...crossModulePatternsFor(self)] },
      ],
    },
  },
]);

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
    plugins: {
      // Equoria-dm1i, Equoria-cl5y0, Equoria-d1l20: shared inline plugins
      equoria: {
        rules: {
          ...equoriaTestFixturePlugin.rules,
          ...equoriaSkippedTestsPlugin.rules,
          ...equoriaForwardReferencesPlugin.rules,
        },
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
      // The shared bans live in SHARED_RESTRICTED_IMPORT_PATTERNS (top of file):
      // the test-only `__TESTING_ONLY_JsonScanner` export (21R-SEC-3-FOLLOW-1 /
      // Equoria-ixqg), deep-relative `@prisma/client` node_modules imports
      // (Equoria-4qjo), the removed `db/index.mjs` shim (Equoria-4wl0r), and the
      // dissolved `modules/services/{controllers,routes,data}` junk-drawer
      // (Equoria-r9we2). They are factored into a const so the per-module
      // barrel-boundary blocks (crossModuleBarrelBoundaryConfigs, appended to the
      // export array below) can re-assert them — flat-config rule overrides
      // REPLACE the whole rule value per file, so a per-module block setting only
      // the cross-module patterns would otherwise drop these shared bans.
      //
      // Equoria-v8l96.4: the module-barrel boundary (cross-module deep imports
      // must go through `<module>/index.mjs`) is enforced by those per-module
      // override blocks, NOT here. The prior no-op Equoria-fy2tx flat-glob list
      // — whose `**/modules/<x>/<subdir>/**` patterns matched the import-
      // SPECIFIER string and so never fired (real cross-module specifiers are
      // written `../../<N>/...` and never contain the literal segment
      // `modules/`) — was removed. The per-module blocks scope by the IMPORTER's
      // location and thus can distinguish a cross-module reach from a same-module
      // deep import.
      'no-restricted-imports': ['error', { patterns: SHARED_RESTRICTED_IMPORT_PATTERNS }],

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

      // Equoria-d1l20: Detect forward-reference comments without bd issue tracking
      'equoria/no-forward-reference-comments': 'warn',
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

      // Equoria-dm1i: NULL-phenotype fixture defect-class sentinel.
      // Equoria-c8ulb (2026-05-29): promoted from 'warn' to 'error'. The
      // Equoria-7guhz audit (2026-05-29) confirmed zero unmigrated raw
      // create() calls in the backend test tree — the bulk migration is
      // structurally complete. 'error' hard-fails the lint gate on any
      // new test that ships without `...fixtureColor()` /
      // createTestHorse(), preventing regression of the NULL-phenotype
      // canonical-DB pollution defect.
      'equoria/no-raw-test-horse-create': 'error',
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
      // NOTE (Equoria-v8l96.4): this `'off'` governs test files OUTSIDE
      // modules/ (backend/__tests__/, tests/). Test files INSIDE a module
      // (modules/<M>/**) are re-covered by the per-module barrel-boundary
      // blocks (crossModuleBarrelBoundaryConfigs, appended after this block in
      // the export array) so the cross-module deep-import ban applies to module
      // tests too — the v8l96.3 migration already cleaned them, and the barrier
      // must not have a test-shaped hole. Those module tests do not import
      // __TESTING_ONLY_JsonScanner (that export is consumed only by
      // backend/__tests__/), so re-enabling the shared bans for them is safe.
      'no-restricted-imports': 'off',

      // Equoria-cl5y0: Prevent skipped tests (Principle 2 — Beta is falsifiable).
      // Skipped tests hide broken code and produce false confidence.
      // If a test is flaky or slow, fix the underlying issue instead of skipping it.
      // The rule forbids test.skip, it.skip, describe.skip, test.todo, it.todo.
      'equoria/no-skipped-tests': 'error',

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
    //
    // NOTE (Equoria-v8l96.4): this block still SOLELY governs top-level
    // `backend/routes/**` route files. For module route files
    // (`modules/<M>/routes/**`) the per-module barrel-boundary routes block
    // (crossModuleBarrelBoundaryConfigs, appended after this block) overrides
    // `no-restricted-imports` to carry this SAME ROUTES_PRISMA_RESTRICTED_PATTERN
    // PLUS the cross-module deep-import ban — so module routes keep the Prisma
    // ban and additionally cannot deep-import another module's internals.
    files: ['modules/**/routes/**/*.mjs', 'routes/**/*.mjs'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [ROUTES_PRISMA_RESTRICTED_PATTERN] }],
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
  // Equoria-v8l96.4: module public-API barrel boundary enforcement. Generated
  // per-module (see crossModuleBarrelBoundaryConfigs + its header at the top of
  // this file). Placed near the END of the export array so these blocks win the
  // flat-config last-match-per-rule-key resolution for module files — re-enabling
  // `no-restricted-imports` over the test-files `'off'` for module test files,
  // and layering the cross-module ban on top of the routes-layer Prisma ban for
  // module route files. The capstone of the v8l96 epic: the barrel boundary is
  // now ENFORCED by lint, not convention.
  ...crossModuleBarrelBoundaryConfigs,
  {
    // Equoria-ke6ob: ignore gitignored runtime artifact dirs. The doctrine
    // ESLINT check (scripts/doctrine-checks/check-backend-lint-and-format.mjs)
    // runs `eslint . --quiet` from cwd=backend/ and, unlike git, does NOT
    // consult any .gitignore — so without these flat-config `ignores` globs a
    // local load/test/coverage run drops machine-emitted JS/JSON into these
    // dirs and turns the LOCAL doctrine suite red on never-shipped artifacts,
    // while CI (clean checkout, no artifact files) stays green — a
    // false-positive on shipped code. Each dir is confirmed gitignored
    // (load-results/, test-results/, .jest-cache/ at the repo root; the
    // coverage-* siblings in backend/.gitignore) and is NEVER committed.
    // Mirrors the backend/.prettierignore exclusions (Equoria-pfn3p) so the
    // ESLINT and PRETTIER arms of the doctrine gate ignore the same tree.
    // Source dirs (services/, modules/, utils/, etc.) are NOT listed and
    // remain fully linted. Flat-config ignores are globs, hence the `/**`.
    ignores: [
      'node_modules/**',
      'coverage/**',
      'coverage-partial/**',
      'coverage-temp/**',
      'coverage-security/**',
      'load-results/**',
      'test-results/**',
      '.jest-cache/**',
      'dist/**',
      'build/**',
      '*.min.js',
    ],
  },
];
