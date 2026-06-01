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
});
