/**
 * Equoria-75odq doctrine-check sentinel.
 *
 * Proves the containment check fires when a NEW silent-cleanup-catch is
 * planted in a fresh test file. Without this sentinel, a future regex
 * narrowing or scope shrinkage could silently let new silent catches slip
 * past — exactly the "test that doesn't really test" pattern the
 * constitution rejects.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CHECK = path.join(REPO_ROOT, 'scripts/doctrine-checks/check-no-new-silent-cleanup-catch.mjs');
const PLANT_DIR = path.join(REPO_ROOT, 'backend/__tests__/_silent_catch_doctrine_sentinel');

afterEach(() => {
  // Best-effort cleanup of the planted scaffold so a test crash doesn't poison
  // the next run of the doctrine check on master.
  try {
    fs.rmSync(PLANT_DIR, { recursive: true, force: true });
  } catch {
    // intentional: cleanup is best-effort, surfacing rm errors would be noise
  }
});

function runCheck() {
  return spawnSync('node', [CHECK], { cwd: REPO_ROOT, encoding: 'utf8' });
}

describe('check-no-new-silent-cleanup-catch.mjs (Equoria-75odq)', () => {
  it('passes when nothing has been added beyond the baseline', () => {
    const res = runCheck();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/silent-cleanup-catch.*OK/);
  });

  it('SENTINEL: fails when a NEW silent .catch is planted in a fresh test file', () => {
    fs.mkdirSync(PLANT_DIR, { recursive: true });
    const planted = path.join(PLANT_DIR, 'planted.test.mjs');
    // The doctrine pattern matches a dot-catch with an empty arrow-fn body.
    // Build the planted shape from concatenation so the SOURCE of THIS
    // sentinel file does not itself contain the literal pattern (which
    // would otherwise trigger the doctrine check on the sentinel itself
    // and break the "baseline still clean" test above).
    const DOT = '.';
    // Assemble the closing arrow-fn token via a variable (not a literal `+`
    // concat) so the SOURCE of THIS sentinel file does not itself contain
    // the literal doctrine pattern, and so no-useless-concat does not fire.
    const ARROW = '=> {})';
    const PLANTED_PATTERN = `Promise${DOT}reject(new Error("x"))${DOT}catch(() ${ARROW}`;
    fs.writeFileSync(
      planted,
      [
        '// PLANTED by silentCleanupCatchDoctrine.sentinel.test.mjs — Equoria-75odq.',
        '// If this file is checked into git you have a bigger problem than this test.',
        "import { test } from '@jest/globals';",
        "test('placeholder', async () => {",
        `  await ${PLANTED_PATTERN};`,
        '});',
        '',
      ].join('\n'),
    );

    const res = runCheck();
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/silent-cleanup-catch.*FAIL/);
    expect(res.stderr).toMatch(/planted\.test\.mjs/);
  });

  // Equoria-fv6dp: the detector strips comments before counting, so the
  // literal pattern appearing inside a // line comment or a /* block comment
  // is NOT counted as a residual silent catch. These two cases prove BOTH
  // directions together with the CODE case above:
  //   (a) above — a real `.catch(() => {})` in CODE still COUNTS (gate FAILS).
  //   (b) here  — the same literal inside a comment does NOT count (gate OK).
  // Build the literal from concatenation so the SOURCE of THIS file never
  // contains the bare pattern (which would trip the gate on this file itself).
  const DOT = '.';
  const ARROW = '=> {})';
  const SILENT_LITERAL = `${DOT}catch(() ${ARROW}`; // ".catch(() => {})"

  it('SENTINEL: the literal inside a // LINE comment is NOT counted (fv6dp fix)', () => {
    fs.mkdirSync(PLANT_DIR, { recursive: true });
    const planted = path.join(PLANT_DIR, 'planted.test.mjs');
    fs.writeFileSync(
      planted,
      [
        "import { test } from '@jest/globals';",
        "test('placeholder', () => {",
        // The literal appears ONLY inside an explanatory line comment — this
        // is the exact false-positive class fv6dp fixes. No real code here.
        `  // migrated a silent ${SILENT_LITERAL} arm to a logged handler`,
        '});',
        '',
      ].join('\n'),
    );

    const res = runCheck();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/silent-cleanup-catch.*OK/);
  });

  it('SENTINEL: the literal inside a /* */ BLOCK comment is NOT counted (fv6dp fix)', () => {
    fs.mkdirSync(PLANT_DIR, { recursive: true });
    const planted = path.join(PLANT_DIR, 'planted.test.mjs');
    fs.writeFileSync(
      planted,
      [
        "import { test } from '@jest/globals';",
        '/*',
        ` * Historical note: this suite used to use ${SILENT_LITERAL} for`,
        ' * cleanup before it was replaced with a logged handler.',
        ' */',
        "test('placeholder', () => {",
        '  // no real catch here',
        '});',
        '',
      ].join('\n'),
    );

    const res = runCheck();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/silent-cleanup-catch.*OK/);
  });

  it('SENTINEL: a real catch in CODE on the same line as a trailing comment STILL counts', () => {
    // Guards the fix against over-reach: stripping the trailing comment must
    // not also remove the real silent catch that precedes it on the line.
    fs.mkdirSync(PLANT_DIR, { recursive: true });
    const planted = path.join(PLANT_DIR, 'planted.test.mjs');
    fs.writeFileSync(
      planted,
      [
        "import { test } from '@jest/globals';",
        "test('placeholder', async () => {",
        `  await Promise${DOT}reject(new Error('x'))${SILENT_LITERAL}; // trailing comment`,
        '});',
        '',
      ].join('\n'),
    );

    const res = runCheck();
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/silent-cleanup-catch.*FAIL/);
    expect(res.stderr).toMatch(/planted\.test\.mjs/);
  });
});
