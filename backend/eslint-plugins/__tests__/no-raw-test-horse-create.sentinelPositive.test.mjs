/**
 * Sentinel-positive coverage for the equoria/no-raw-test-horse-create
 * rule (Equoria-c8ulb).
 *
 * Equoria-c8ulb promoted this rule from `warn` to `error` in both
 * backend/eslint.config.mjs and the repo-root eslint.config.js. With
 * zero current violations across the backend test tree (Equoria-7guhz
 * audit, 2026-05-29), promotion hard-fails the lint gate on any new
 * test that ships a raw `prisma.horse.create({ data: { ... } })`
 * without the canonical `...fixtureColor()` / createTestHorse()
 * spread.
 *
 * This sentinel pins the rule's behaviour by exercising the ESLint
 * Linter API directly against synthetic source strings — so a refactor
 * that silently broadens the detection (false positives) or narrows
 * it (false negatives) fails this test loudly, independent of any
 * real backend test file.
 *
 * Five cases:
 *   1. Raw create with bare data object → FIRES (the bug class).
 *   2. Create with `...fixtureColor()` spread → DOES NOT fire.
 *   3. Create via createTestHorse() helper (no .horse.create chain) → DOES NOT fire.
 *   4. Raw create with a template-literal name → STILL FIRES (the
 *      name shape is irrelevant; the missing spread is the defect).
 *   5. Raw create with `// eslint-disable-next-line equoria/no-raw-test-horse-create`
 *      → DOES NOT fire (the disable directive is honored, which the
 *      sentinel-negative test in the existing codebase relies on).
 */

import { describe, it, expect } from '@jest/globals';
import { Linter } from 'eslint';
import { equoriaTestFixturePlugin } from '../no-raw-test-horse-create.mjs';

function lint(source) {
  // configType: 'flat' is required so `languageOptions` is honored — the
  // legacy linter API (default in ESLint 8.x) expects parserOptions and
  // does not understand the modern `languageOptions` envelope. Without
  // this, the verify() call returns a fatal "Unexpected token function"
  // parse error and the rule never runs.
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(
    source,
    [
      {
        plugins: { equoria: equoriaTestFixturePlugin },
        rules: { 'equoria/no-raw-test-horse-create': 'error' },
        languageOptions: {
          ecmaVersion: 'latest',
          sourceType: 'module',
        },
      },
    ],
    'synthetic-test.test.mjs',
  );
}

describe('equoria/no-raw-test-horse-create — sentinel-positive (Equoria-c8ulb)', () => {
  it('FIRES on raw prisma.horse.create({ data: { ... } }) without a spread', () => {
    const source = `
      async function setup() {
        await prisma.horse.create({
          data: {
            name: 'TestFixture-noSpread',
            sex: 'Mare',
            dateOfBirth: new Date(),
          },
        });
      }
    `;
    const messages = lint(source);
    const violations = messages.filter(m => m.ruleId === 'equoria/no-raw-test-horse-create');
    expect(violations).toHaveLength(1);
    expect(violations[0].severity).toBe(2); // error
  });

  it('DOES NOT fire when data contains a ...fixtureColor() spread', () => {
    const source = `
      async function setup() {
        await prisma.horse.create({
          data: {
            ...fixtureColor(),
            name: 'TestFixture-withSpread',
            sex: 'Mare',
            dateOfBirth: new Date(),
          },
        });
      }
    `;
    const messages = lint(source);
    expect(messages.filter(m => m.ruleId === 'equoria/no-raw-test-horse-create')).toHaveLength(0);
  });

  it('DOES NOT fire on createTestHorse() helper calls (no .horse.create chain)', () => {
    const source = `
      async function setup() {
        const horse = await createTestHorse(prisma, {
          name: 'TestFixture-helper',
          sex: 'Mare',
          dateOfBirth: new Date(),
          userId: user.id,
        }, created);
      }
    `;
    const messages = lint(source);
    expect(messages.filter(m => m.ruleId === 'equoria/no-raw-test-horse-create')).toHaveLength(0);
  });

  it('FIRES on raw create with template-literal name (name shape is irrelevant)', () => {
    const source = `
      async function setup() {
        const tag = 'abc';
        await prisma.horse.create({
          data: {
            name: \`TestFixture-tpl-\${tag}\`,
            sex: 'Stallion',
            dateOfBirth: new Date(),
          },
        });
      }
    `;
    const messages = lint(source);
    const violations = messages.filter(m => m.ruleId === 'equoria/no-raw-test-horse-create');
    expect(violations).toHaveLength(1);
  });

  it('DOES NOT fire when a scoped eslint-disable-next-line directive is present', () => {
    const source = `
      async function setup() {
        // eslint-disable-next-line equoria/no-raw-test-horse-create -- sentinel-negative requires raw form
        await prisma.horse.create({
          data: {
            name: 'TestFixture-disable',
            sex: 'Mare',
            dateOfBirth: new Date(),
          },
        });
      }
    `;
    const messages = lint(source);
    expect(messages.filter(m => m.ruleId === 'equoria/no-raw-test-horse-create')).toHaveLength(0);
  });
});
