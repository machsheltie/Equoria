/**
 * Equoria-vb48u — jest.config.security.mjs must keep `js` BEFORE `mjs` in
 * moduleFileExtensions (Equoria-ip8kk follow-up).
 *
 * THE DEFECT THIS PREVENTS. Equoria-ip8kk (fix 73ca57f0b) reordered
 * moduleFileExtensions to js-first. With `mjs` first, Jest's `.js`-stripping
 * moduleNameMapper self-resolves dual-package ESM wrappers, and
 * jest-environment-node hits an ESM self-import temporal-dead-zone error at
 * start-up. That reddens the whole Security Gate, and nothing local says why: the
 * file that broke is a config, not a test. The fix carries a "do not reorder"
 * comment, but a comment stops nobody; this test is the executable guard the
 * ip8kk spec asked for and never got.
 *
 * WHAT IT CHECKS. The ORDER of the two entries in the live config's array
 * (`js` index < `mjs` index, both present), by importing the config itself rather
 * than reading its text, so a reformat or a computed value cannot hide a
 * reorder. The detector is a pure function, and the planted cases below prove it
 * FIRES on the mjs-first order, on a config missing one of the two entries, and
 * on an absent/non-array value, so a typo in the comparison cannot leave this
 * vacuously green.
 *
 * The diagnosis referenced by the issue (docs/debugging-reports/
 * 2026-07-06-master-gate-diagnosis.md section 3) is not tracked in this tree; the
 * mechanism is recorded in the config's own comment at the moduleFileExtensions
 * line and in Equoria-ip8kk.
 *
 * Runs under the default Jest config (backend/jest.config.mjs, `__tests__/**`),
 * so it executes in CI shards, not only in the Security Gate.
 */

import { describe, it, expect } from '@jest/globals';
import securityConfig from '../jest.config.security.mjs';

/**
 * @param {unknown} moduleFileExtensions
 * @returns {string[]} human-readable problems; empty when the order is safe
 */
function findModuleFileExtensionsOrderProblems(moduleFileExtensions) {
  if (!Array.isArray(moduleFileExtensions)) {
    return ['moduleFileExtensions is not an array'];
  }
  const jsIndex = moduleFileExtensions.indexOf('js');
  const mjsIndex = moduleFileExtensions.indexOf('mjs');
  const problems = [];
  if (jsIndex === -1) {
    problems.push("'js' is missing from moduleFileExtensions");
  }
  if (mjsIndex === -1) {
    problems.push("'mjs' is missing from moduleFileExtensions");
  }
  if (jsIndex !== -1 && mjsIndex !== -1 && mjsIndex < jsIndex) {
    problems.push(`'mjs' (index ${mjsIndex}) precedes 'js' (index ${jsIndex}); js-first is required (Equoria-ip8kk)`);
  }
  return problems;
}

describe('Equoria-vb48u: moduleFileExtensions js-before-mjs sentinel', () => {
  it('jest.config.security.mjs lists js before mjs', () => {
    expect(findModuleFileExtensionsOrderProblems(securityConfig.moduleFileExtensions)).toEqual([]);
  });

  it('the detector FIRES on a planted mjs-first order (sentinel-positive)', () => {
    const problems = findModuleFileExtensionsOrderProblems(['mjs', 'js', 'json']);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/'mjs' \(index 0\) precedes 'js' \(index 1\)/);
  });

  it('the detector FIRES when js or mjs is missing, or the value is not an array', () => {
    expect(findModuleFileExtensionsOrderProblems(['mjs', 'json'])).toEqual([
      "'js' is missing from moduleFileExtensions",
    ]);
    expect(findModuleFileExtensionsOrderProblems(['js', 'json'])).toEqual([
      "'mjs' is missing from moduleFileExtensions",
    ]);
    expect(findModuleFileExtensionsOrderProblems(undefined)).toEqual(['moduleFileExtensions is not an array']);
  });

  it('the detector passes the current js-first order and unrelated entries in between', () => {
    expect(findModuleFileExtensionsOrderProblems(['js', 'mjs', 'json'])).toEqual([]);
    expect(findModuleFileExtensionsOrderProblems(['json', 'js', 'ts', 'mjs'])).toEqual([]);
  });
});
