/**
 * Sentinel coverage for the equoria/no-skipped-tests rule
 * (Equoria-cl5y0 rule; test added under Equoria-zx22f).
 *
 * WHY THIS FILE EXISTS (Equoria-zx22f, CLAUDE.md Principle 3 — hidden test
 * failure / placebo check):
 * The no-skipped-tests rule shipped in commit 993ef6d01 with NO test file at
 * all. A CI-relied-upon ESLint rule with zero verification is exactly the
 * false-green Principle 3 exists to prevent: the rule could be silently
 * degraded to a no-op by a refactor or an ESLint major bump and nothing would
 * catch it. The rule's whole job is to FAIL when a skipped test is committed;
 * a rule that never fires produces a green signal without exercising the real
 * failure mode — defeating the gate.
 *
 * This drives the rule through the flat-config `Linter` API
 * (`new Linter({ configType: 'flat' })`), the same version-robust pattern the
 * sibling no-forward-reference-comments.test.mjs uses. `configType: 'flat'`
 * honors `languageOptions`, so the suite runs identically on ESLint 8.57 (the
 * currently-installed version) and on ESLint 9+ — no parserOptions/
 * languageOptions fork, no RuleTester top-level-property fragility.
 *
 * The plugin is mounted under the `equoria` namespace and the rule keyed as
 * `equoria/no-skipped-tests`, mirroring the production registration in
 * backend/eslint.config.mjs and the repo-root eslint.config.js.
 *
 * Coverage (matched to what the rule ACTUALLY implements — see
 * no-skipped-tests.mjs: property name `skip` or `todo` on object name `test`,
 * `it`, or `describe`):
 *   - SENTINEL-POSITIVE: every (object × property) combination the rule flags
 *     asserts the rule FIRES with the expected messageId — proving the check
 *     catches the real defect class, not merely that it stays quiet
 *     (OPTIMAL_FIX_DISCIPLINE §2). A no-op rule yields 0 violations and fails
 *     these.
 *   - SENTINEL-NEGATIVE: normal test()/it()/describe() calls, plus constructs
 *     the rule deliberately does NOT cover (.fixme, xit, xdescribe), assert the
 *     rule does NOT fire — proving the check is scoped, not a blanket no-op.
 */

import { describe, it, expect } from '@jest/globals';
import { Linter } from 'eslint';
import { equoriaSkippedTestsPlugin } from './no-skipped-tests.mjs';

const RULE_ID = 'equoria/no-skipped-tests';

// configType: 'flat' is required so `languageOptions` is honored — the legacy
// linter API (default in ESLint 8.x) expects `parserOptions` and is the shape
// ESLint 9's RuleTester rejects with a top-level-property error. The flat
// config runs identically on 8.57 and 9+.
function lint(source) {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(
    source,
    [
      {
        plugins: { equoria: equoriaSkippedTestsPlugin },
        rules: { [RULE_ID]: 'error' },
        languageOptions: {
          ecmaVersion: 'latest',
          sourceType: 'module',
        },
      },
    ],
    'synthetic.test.mjs',
  );
}

function violationsOf(source) {
  return lint(source).filter(m => m.ruleId === RULE_ID);
}

describe('equoria/no-skipped-tests — sentinel-positive (rule FIRES on skipped/todo tests)', () => {
  // One case per (object × property) combination the rule actually flags:
  // property === 'skip' || 'todo'  AND  object === 'test' || 'it' || 'describe'.
  // (no-skipped-tests.mjs lines 50-53). Each MUST fire — a no-op rule fails here.
  const invalidCases = [
    ['test.skip', "test.skip('x', () => {})"],
    ['it.skip', "it.skip('x', () => {})"],
    ['describe.skip', "describe.skip('x', () => {})"],
    ['test.todo', "test.todo('x')"],
    ['it.todo', "it.todo('x')"],
    ['describe.todo', "describe.todo('x', () => {})"],
  ];

  it.each(invalidCases)('FIRES on: %s', (_label, source) => {
    const violations = violationsOf(source);
    expect(violations).toHaveLength(1);
    expect(violations[0].messageId).toBe('skipped');
    expect(violations[0].severity).toBe(2); // error (fail-closed)
  });
});

describe('equoria/no-skipped-tests — sentinel-negative (rule stays quiet on normal/uncovered constructs)', () => {
  const validCases = [
    // Normal, non-skipped test definitions must never fire.
    ['plain test()', "test('x', () => {})"],
    ['plain it()', "it('x', () => {})"],
    ['plain describe()', "describe('x', () => {})"],
    // The rule keys on object name test/it/describe — an unrelated object with
    // a .skip property must not fire.
    ['unrelated .skip', "myArray.skip('x')"],
    // Constructs the rule deliberately does NOT cover (not skip/todo property
    // on test/it/describe). Asserting these stay quiet documents the rule's
    // true scope — it does not claim coverage it lacks.
    ['test.fixme (not covered)', "test.fixme('x', () => {})"],
    ['xit (not covered)', "xit('x', () => {})"],
    ['xdescribe (not covered)', "xdescribe('x', () => {})"],
    ['test.only (not covered)', "test.only('x', () => {})"],
  ];

  it.each(validCases)('does NOT fire on: %s', (_label, source) => {
    expect(violationsOf(source)).toHaveLength(0);
  });
});
