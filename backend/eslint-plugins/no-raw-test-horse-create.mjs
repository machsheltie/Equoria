/**
 * Equoria-dm1i — shared inline ESLint plugin: raw-test-horse-create sentinel.
 *
 * Flags `prisma.horse.create({ data: { ... } })` in test files when the
 * `data` object literal contains NO spread element. The canonical fix for
 * the NULL-phenotype fixture defect class (Equoria-lfj5 / g9sa / dm1i) is
 * to spread `...fixtureColor()` (from backend/tests/helpers/fixtureColor.mjs)
 * or use `createTestHorse()` (backend/__tests__/helpers/createTestHorse.mjs)
 * which itself spreads it. Both produce a SpreadElement in the `data`
 * object, so a create WITHOUT a spread is the unmigrated, leak-prone form.
 *
 * Severity is wired to `warn` in the consuming config (backend
 * eslint.config.mjs test-files block) — NOT here — because ~206 legacy
 * suites still use the raw form and have no active leak (their cleanup
 * currently works). `warn` makes the tech debt visible to new
 * contributors and CI logs without failing the lint gate
 * (`npm run lint` = `eslint .`, no `--max-warnings`). A NEW test added
 * without the spread will also warn, nudging it onto the helper.
 *
 * This lives in a shared module (imported by BOTH backend/eslint.config.mjs
 * and the repo-root eslint.config.js) so the rule definition exists in
 * every ESLint context that lints backend test files — otherwise the
 * `// eslint-disable-next-line equoria/no-raw-test-horse-create` directive
 * in the sentinel-negative test would error as an unknown rule under
 * `reportUnusedDisableDirectives` in the root config.
 *
 * It is a dedicated rule, not an entry in the error-level
 * `no-restricted-syntax` array, because ESLint severity is per-rule (not
 * per-selector): folding a warn-level check into that array would have
 * downgraded the Equoria-ip82 / Equoria-4qjo error-level selectors to warn.
 */

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Test fixture horses must be created with a colorGenotype+phenotype spread to avoid NULL-phenotype canonical-DB pollution (Equoria-dm1i).',
    },
    schema: [],
    messages: {
      rawCreate:
        'Raw prisma.horse.create() in a test produces a NULL-phenotype fixture. Spread `...fixtureColor()` (backend/tests/helpers/fixtureColor.mjs) into the `data` object, or use `createTestHorse()` (backend/__tests__/helpers/createTestHorse.mjs). See Equoria-dm1i / .claude/rules/CONTRIBUTING.md (Test Fixtures).',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        // Match `<x>.horse.create(...)` — `<x>` is typically a prisma
        // client or tx handle; match the `.horse.create` member chain
        // (not the root identifier) so `prisma`, `tx`, `db`, etc. all
        // count.
        if (
          callee.type !== 'MemberExpression' ||
          callee.property?.name !== 'create' ||
          callee.object?.type !== 'MemberExpression' ||
          callee.object.property?.name !== 'horse'
        ) {
          return;
        }
        const arg = node.arguments[0];
        if (!arg || arg.type !== 'ObjectExpression') {
          return;
        }
        const dataProp = arg.properties.find(
          p =>
            p.type === 'Property' &&
            !p.computed &&
            ((p.key.type === 'Identifier' && p.key.name === 'data') ||
              (p.key.type === 'Literal' && p.key.value === 'data')),
        );
        if (!dataProp || dataProp.value.type !== 'ObjectExpression') {
          return;
        }
        const hasSpread = dataProp.value.properties.some(
          p => p.type === 'SpreadElement' || p.type === 'ExperimentalSpreadProperty',
        );
        if (!hasSpread) {
          context.report({ node, messageId: 'rawCreate' });
        }
      },
    };
  },
};

/**
 * Inline ESLint plugin object. Register under the `equoria` namespace:
 *   plugins: { equoria: equoriaTestFixturePlugin }
 *   rules:   { 'equoria/no-raw-test-horse-create': 'warn' }
 */
export const equoriaTestFixturePlugin = {
  rules: {
    'no-raw-test-horse-create': rule,
  },
};

export default equoriaTestFixturePlugin;
