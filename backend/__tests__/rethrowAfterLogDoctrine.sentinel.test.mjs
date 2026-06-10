/**
 * Equoria-ej9k1 doctrine-check sentinel.
 *
 * Proves the containment check fires when a NEW rethrow-after-log catch
 * block is planted in a fresh service file. Without this sentinel, a
 * future regex narrowing or scope shrinkage could silently let new
 * occurrences slip past — exactly the "test that doesn't really test"
 * pattern the constitution rejects.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CHECK = path.join(REPO_ROOT, 'scripts/doctrine-checks/check-no-new-rethrow-after-log.mjs');
const PLANT_DIR = path.join(REPO_ROOT, 'backend/services/_rethrow_doctrine_sentinel_plant');

afterEach(() => {
  try {
    fs.rmSync(PLANT_DIR, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
});

function runCheck() {
  return spawnSync('node', [CHECK], { cwd: REPO_ROOT, encoding: 'utf8' });
}

describe('check-no-new-rethrow-after-log.mjs (Equoria-ej9k1)', () => {
  it('passes when nothing has been added beyond the baseline', () => {
    const res = runCheck();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/rethrow-after-log.*OK/);
  });

  it('SENTINEL: fails when a NEW catch+log+throw is planted in a fresh service file', () => {
    fs.mkdirSync(PLANT_DIR, { recursive: true });
    const planted = path.join(PLANT_DIR, 'plantedService.mjs');
    // Build the source from concat so this sentinel file itself doesn't
    // contain the literal pattern (the doctrine check would otherwise flag
    // this test file as a violation and break the baseline-clean test
    // above).
    const OPEN = '{';
    const CLOSE = '}';
    const SEMI = ';';
    const KEYWORDS = ['try', 'catch', 'throw'];
    const planted_src = [
      '// PLANTED by rethrowAfterLogDoctrine.sentinel.test.mjs — Equoria-ej9k1.',
      "import logger from '../../utils/logger.mjs';",
      `export async function plantedFn() ${OPEN}`,
      `  ${KEYWORDS[0]} ${OPEN} await Promise.resolve()${SEMI} ${CLOSE}`,
      `  ${KEYWORDS[1]} (error) ${OPEN}`,
      `    logger.error('[planted.fn] something went wrong')${SEMI}`,
      `    ${KEYWORDS[2]} error${SEMI}`,
      `  ${CLOSE}`,
      CLOSE,
      '',
    ].join('\n');
    fs.writeFileSync(planted, planted_src);

    const res = runCheck();
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/rethrow-after-log.*FAIL/);
    expect(res.stderr).toMatch(/plantedService\.mjs/);
  });

  // Equoria-08aav: the detector strips comments before counting, so the
  // literal log-then-rethrow pattern appearing inside a // line comment or a
  // /* block comment is NOT counted as a residual occurrence. These three
  // cases prove BOTH directions:
  //   (a) the literal inside a // line comment does NOT count (gate OK);
  //   (b) the literal inside a /* */ block comment does NOT count (gate OK);
  //   (c) a real log-then-rethrow in CODE STILL counts (gate FAILS).
  // The literal is assembled from tokens so the SOURCE of THIS file never
  // contains the bare pattern (which would otherwise trip the gate on this
  // file itself — though it is a .test.mjs and the detector skips those, the
  // concat keeps parity with the planted-violation test above and is robust
  // to any future scope-widening of the gate).
  const OPEN = '{';
  const CLOSE = '}';
  const SEMI = ';';
  // The exact shape PATTERN matches: catch (e) { logger.error(...); throw e; }
  const buildRethrowLiteral = () => `catch (e) ${OPEN} logger.error('boom')${SEMI} throw e${SEMI} ${CLOSE}`;

  it('SENTINEL: the literal inside a // LINE comment is NOT counted (08aav fix)', () => {
    fs.mkdirSync(PLANT_DIR, { recursive: true });
    const planted = path.join(PLANT_DIR, 'plantedService.mjs');
    fs.writeFileSync(
      planted,
      [
        "import logger from '../../utils/logger.mjs';",
        'export function plantedFn() {',
        // The pattern appears ONLY inside an explanatory line comment — this
        // is the exact false-positive class 08aav fixes. No real catch here.
        `  // removed a ${buildRethrowLiteral()} arm in favour of the global handler`,
        '  return logger;',
        '}',
        '',
      ].join('\n'),
    );

    const res = runCheck();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/rethrow-after-log.*OK/);
  });

  it('SENTINEL: the literal inside a /* */ BLOCK comment is NOT counted (08aav fix)', () => {
    fs.mkdirSync(PLANT_DIR, { recursive: true });
    const planted = path.join(PLANT_DIR, 'plantedService.mjs');
    fs.writeFileSync(
      planted,
      [
        "import logger from '../../utils/logger.mjs';",
        '/*',
        ' * Historical note: this service used to wrap calls in a',
        ` * ${buildRethrowLiteral()} block before the global error handler`,
        ' * made it redundant.',
        ' */',
        'export function plantedFn() {',
        '  return logger;',
        '}',
        '',
      ].join('\n'),
    );

    const res = runCheck();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/rethrow-after-log.*OK/);
  });

  it('SENTINEL: a real log-then-rethrow in CODE STILL counts (08aav guards against over-reach)', () => {
    // Guards the fix against over-reach: stripping comments must not also
    // remove the real log-then-rethrow that constitutes a genuine violation.
    fs.mkdirSync(PLANT_DIR, { recursive: true });
    const planted = path.join(PLANT_DIR, 'plantedService.mjs');
    fs.writeFileSync(
      planted,
      [
        "import logger from '../../utils/logger.mjs';",
        'export async function plantedFn() {',
        '  try { await Promise.resolve(); }',
        // Real code with an interleaved trailing comment — the catch body
        // MUST still match after comments are stripped to the ~ sentinel.
        `  ${buildRethrowLiteral()} // trailing comment after a real violation`,
        '}',
        '',
      ].join('\n'),
    );

    const res = runCheck();
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/rethrow-after-log.*FAIL/);
    expect(res.stderr).toMatch(/plantedService\.mjs/);
  });
});
