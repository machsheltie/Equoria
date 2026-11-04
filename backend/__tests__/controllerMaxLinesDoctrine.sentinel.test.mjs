/**
 * Equoria-xod8b (child A of Equoria-mh937) — controller max-lines doctrine sentinel.
 *
 * Proves the ESLint `max-lines` rule scoped to `modules/**\/controllers/**\/*.mjs`
 * fires when a NEW controller file > 800 effective lines is planted. Without
 * this sentinel, a future glob narrowing, rule downgrade, or accidental
 * `// eslint-disable max-lines` would silently let new god-files re-emerge —
 * exactly the "test that doesn't really test" pattern CLAUDE.md §3 rejects.
 *
 * Pairs with the parallel routes-layer rule (Equoria-y8u2j, line 348 of
 * backend/eslint.config.mjs) which had no sentinel-positive test of its own —
 * filing a follow-up issue would let the routes rule rot silently. Per
 * OPTIMAL_FIX §2 (sentinel-positive test required), we cover BOTH rules here
 * so the doctrine is provable end-to-end.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(HERE, '..');

const plantControllerDir = path.join(backendRoot, 'modules/horses/controllers/_maxLinesDoctrineSentinelPlant');
const plantRouteDir = path.join(backendRoot, 'modules/horses/routes/_maxLinesDoctrineSentinelPlant');

afterEach(() => {
  for (const dir of [plantControllerDir, plantRouteDir]) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
});

/**
 * Build a synthetic .mjs source whose effective line count (skipping blank
 * lines and pure-comment lines, per the rule config) exceeds the cap.
 * Each line is a unique no-op statement so ESLint's `skipBlankLines` and
 * `skipComments` deductions don't bring the count back under the threshold.
 */
function buildOversizeSource(effectiveLines) {
  const head = '// PLANTED by controllerMaxLinesDoctrine.sentinel.test.mjs — Equoria-xod8b.\n';
  const body = Array.from({ length: effectiveLines }, (_, i) => `export const k${i} = ${i};`).join('\n');
  return `${head}${body}\n`;
}

function runLint(targetRelToBackend) {
  // Invoke ESLint via its raw .js entrypoint with the current Node binary —
  // works identically on Windows + POSIX without `shell: true` (which would
  // mangle quoting and trigger DEP0190). Resolving the project's
  // eslint.config.mjs happens automatically because cwd is backendRoot,
  // matching how `npm run lint` invokes the same entrypoint.
  const eslintJs = path.join(backendRoot, 'node_modules', 'eslint', 'bin', 'eslint.js');
  return spawnSync(process.execPath, [eslintJs, '--no-warn-ignored', targetRelToBackend], {
    cwd: backendRoot,
    encoding: 'utf8',
    shell: false,
    timeout: 60_000,
  });
}

describe('ESLint max-lines doctrine — controllers + routes (Equoria-xod8b / y8u2j)', () => {
  it('SENTINEL: controllers-layer rule fires when a > 800-effective-line controller is planted', () => {
    fs.mkdirSync(plantControllerDir, { recursive: true });
    const planted = path.join(plantControllerDir, 'plantedController.mjs');
    // 803 effective non-blank non-comment lines — just past the 800 cap.
    fs.writeFileSync(planted, buildOversizeSource(803));

    const res = runLint('modules/horses/controllers/_maxLinesDoctrineSentinelPlant/plantedController.mjs');

    // ESLint exits non-zero when a rule of severity `error` fires.
    expect(res.status).not.toBe(0);
    // The combined stdout+stderr must explicitly cite the `max-lines` rule
    // — without this, the test could pass on any unrelated lint failure
    // (e.g. parse error, unused import) and the doctrine signal would be
    // counterfeit.
    const out = `${res.stdout}\n${res.stderr}`;
    expect(out).toMatch(/max-lines/);
  });

  it('SENTINEL: routes-layer rule (Equoria-y8u2j) fires when a > 800-effective-line route file is planted', () => {
    fs.mkdirSync(plantRouteDir, { recursive: true });
    const planted = path.join(plantRouteDir, 'plantedRoutes.mjs');
    fs.writeFileSync(planted, buildOversizeSource(803));

    const res = runLint('modules/horses/routes/_maxLinesDoctrineSentinelPlant/plantedRoutes.mjs');

    expect(res.status).not.toBe(0);
    const out = `${res.stdout}\n${res.stderr}`;
    expect(out).toMatch(/max-lines/);
  });

  it('NEGATIVE CONTROL: a fresh 100-line controller passes the max-lines rule', () => {
    fs.mkdirSync(plantControllerDir, { recursive: true });
    const planted = path.join(plantControllerDir, 'plantedSmallController.mjs');
    fs.writeFileSync(planted, buildOversizeSource(100));

    const res = runLint('modules/horses/controllers/_maxLinesDoctrineSentinelPlant/plantedSmallController.mjs');

    // It's possible other unrelated rules fire on the synthetic source; the
    // contract here is narrower: max-lines must NOT be among them. We assert
    // the negative case explicitly.
    const out = `${res.stdout}\n${res.stderr}`;
    expect(out).not.toMatch(/max-lines/);
  });
});
