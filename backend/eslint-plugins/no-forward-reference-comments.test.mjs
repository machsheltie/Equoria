/**
 * Sentinel coverage for the equoria/no-forward-reference-comments rule
 * (Equoria-d1l20 rule; test repaired under Equoria-4qnc4, dups Equoria-065m8).
 *
 * WHY THIS FILE WAS REWRITTEN (Equoria-4qnc4, Principle 3 — hidden test failure):
 * The original version drove the rule through ESLint's `RuleTester` with the
 * legacy top-level `parserOptions` envelope. That shape is the one ESLint 9's
 * RuleTester rejects with "Unexpected top-level property ...", and even under
 * ESLint 8 it left the suite as a bare standalone script (a trailing
 * `console.log`, no `describe`/`it`) that only incidentally ran because
 * RuleTester hijacks the ambient test globals. A refactor of the rule or an
 * ESLint major bump could silently degrade it to zero real coverage — the
 * exact false-green Principle 3 exists to prevent.
 *
 * This version drives the rule through the flat-config `Linter` API
 * (`new Linter({ configType: 'flat' })`) inside explicit jest `it()` blocks —
 * the same version-robust pattern the sibling
 * no-raw-test-horse-create.sentinelPositive.test.mjs uses. `configType: 'flat'`
 * honors `languageOptions`, so the suite runs identically on ESLint 8.57 (the
 * currently-installed version) and on ESLint 9+ — no parserOptions/
 * languageOptions fork, no RuleTester top-level-property fragility.
 *
 * The plugin is mounted under the `equoria` namespace and the rule keyed as
 * `equoria/no-forward-reference-comments`, mirroring the production
 * registration in backend/eslint.config.mjs and the repo-root eslint.config.js.
 *
 * Coverage:
 *   - SENTINEL-POSITIVE: every invalid case asserts the rule FIRES with the
 *     expected messageId — proving the check catches the real defect class,
 *     not merely that it stays quiet (OPTIMAL_FIX_DISCIPLINE §2).
 *   - SENTINEL-NEGATIVE: every valid case asserts the rule does NOT fire on a
 *     compliant comment — proving the check is not a blanket no-op / not so
 *     broad it flags tracked work.
 */

import { describe, it, expect } from '@jest/globals';
import { Linter } from 'eslint';
import { equoriaForwardReferencesPlugin } from './no-forward-reference-comments.mjs';

const RULE_ID = 'equoria/no-forward-reference-comments';

// configType: 'flat' is required so `languageOptions` is honored — the legacy
// linter API (default in ESLint 8.x) expects `parserOptions` and is the shape
// ESLint 9's RuleTester rejects with the top-level-property error this test was
// filed to fix. The flat config runs identically on 8.57 and 9+.
function lint(source) {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(
    source,
    [
      {
        plugins: { equoria: equoriaForwardReferencesPlugin },
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

describe('equoria/no-forward-reference-comments — sentinel-negative (rule stays quiet on compliant comments)', () => {
  const validCases = [
    ['plain comment', 'const x = 1; // simple comment'],
    ['descriptive comment', 'const x = 1; // increment the counter'],
    ['parenthesised bd issue id', 'const x = 1; // TODO (Equoria-abcd): refactor this'],
    ['inline bd issue id', 'const x = 1; // TODO Equoria-abc123: implement feature'],
    ['see-Equoria pointer', 'const x = 1; // See Equoria-xyz for the implementation'],
    ['bd-issue phrasing', 'const x = 1; // FIXME (bd issue abcd): fix this later'],
  ];

  it.each(validCases)('does NOT fire on: %s', (_label, source) => {
    expect(violationsOf(source)).toHaveLength(0);
  });

  // Sentinel-negative companion to the new sentinel-positive case below:
  // a compliant comment that links its forward-reference to a tracked bd
  // issue must NOT fire, proving the rule discriminates tracked from untracked.
  it('does NOT fire on a forward-reference that links a bd issue (compliant)', () => {
    expect(violationsOf('const x = 1; // TODO (Equoria-4qnc4): see the tracked follow-up')).toHaveLength(0);
  });
});

describe('equoria/no-forward-reference-comments — sentinel-positive (rule FIRES on untracked forward references)', () => {
  const invalidCases = [
    ['bare TODO', 'const x = 1; // TODO: implement this feature', 'forwardReference'],
    ['bare FIXME', 'const x = 1; // FIXME: fix the bug', 'forwardReference'],
    ['will be implemented', 'const x = 1; // Will be implemented later', 'futureImplementation'],
    ['TODO later', 'const x = 1; // TODO later: add validation', 'futureImplementation'],
    ['see PR pointer', 'const x = 1; // See PR for more details', 'forwardReference'],
    ['future support', 'const x = 1; // Future support for this', 'futureImplementation'],
    ['pending implementation', 'const x = 1; // Pending implementation', 'futureImplementation'],
  ];

  it.each(invalidCases)('FIRES on: %s', (_label, source, messageId) => {
    const violations = violationsOf(source);
    expect(violations).toHaveLength(1);
    expect(violations[0].messageId).toBe(messageId);
    expect(violations[0].severity).toBe(2); // error
  });

  // New sentinel-positive case (Equoria-4qnc4 / OPTIMAL_FIX §2): an untracked
  // "see PR #1234" pointer is the canonical forward-reference the OPTIMAL_FIX
  // examples call out. It carries no Equoria-xxxx id, so the rule MUST flag it.
  it('FIRES on an untracked "// TODO: see PR #1234" forward-reference', () => {
    const violations = violationsOf('const x = 1; // TODO: see PR #1234 for the rest');
    expect(violations).toHaveLength(1);
    expect(violations[0].messageId).toBe('forwardReference');
  });
});
