/**
 * Equoria-gixjh — frontend pages-layer max-lines doctrine sentinel.
 *
 * Proves the ESLint `max-lines` rule scoped (in the root `eslint.config.js`,
 * Equoria-kdduk) to `frontend/src/pages/**` *.tsx (cap 600, `__tests__`
 * excluded) actually FIRES when an oversize page module is planted at a guarded
 * path. Mirrors the api-client barrel sentinel
 * (frontend/src/lib/__tests__/apiClientMaxLinesDoctrine.sentinel.test.ts,
 * Equoria-n4ebf). Without this sentinel-positive test the pages cap is a
 * placebo (OPTIMAL_FIX §2): a future glob narrowing, threshold bump, or stray
 * `// eslint-disable max-lines` could let a 1700-line page god-file (the very
 * thing the HorseDetailPage split decomposed) silently re-emerge and no test
 * would notice.
 *
 * Plant path: `frontend/src/pages/_pagesMaxLines_sentinel_plant.tsx`. It is
 * covered by the rule glob `frontend/src/pages/**` *.tsx and is NOT under
 * `__tests__`, so the cap applies. The plant file does not exist in the tree at
 * rest and is removed in afterEach — the real page modules are never mutated.
 *
 * The eslint binary is invoked from the REPO ROOT so it resolves the root flat
 * `eslint.config.js` — the same config the pre-commit lint-staged pass and a
 * root `eslint .` use.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// HERE = frontend/src/pages/__tests__ ; repo root is four levels up.
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..');
const FRONTEND_ROOT = path.resolve(HERE, '..', '..', '..');

const PLANT_REL = 'frontend/src/pages/_pagesMaxLines_sentinel_plant.tsx';
const PLANT_ABS = path.join(REPO_ROOT, PLANT_REL);

afterEach(() => {
  try {
    fs.rmSync(PLANT_ABS, { force: true });
  } catch {
    // best-effort cleanup
  }
});

/**
 * Build a synthetic .tsx source whose effective line count (skipping blank
 * lines and pure-comment lines, matching the rule's skipBlankLines +
 * skipComments config) is exactly `effectiveLines`. Each line is a unique
 * no-op export so the deductions don't bring the count back under the cap.
 */
function buildSource(effectiveLines: number): string {
  const head = '// PLANTED by pagesMaxLinesDoctrine.sentinel.test.tsx — Equoria-gixjh.\n';
  const body = Array.from({ length: effectiveLines }, (_, i) => `export const k${i} = ${i};`).join(
    '\n'
  );
  return `${head}${body}\n`;
}

function runLint(targetRelToRepoRoot: string): ReturnType<typeof spawnSync> {
  // Use the frontend's eslint binary but run with cwd = repo root so the root
  // flat eslint.config.js is the one that loads (it owns the pages max-lines
  // rule). shell:false works identically on Windows + POSIX.
  const eslintJs = path.join(FRONTEND_ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js');
  return spawnSync(process.execPath, [eslintJs, '--no-warn-ignored', targetRelToRepoRoot], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    shell: false,
    timeout: 90_000,
  });
}

describe('ESLint max-lines doctrine — frontend pages layer (Equoria-gixjh)', () => {
  it('SENTINEL: the rule fires when a > 600-effective-line page is planted', () => {
    // 603 effective non-blank non-comment lines — just past the 600 cap.
    fs.writeFileSync(PLANT_ABS, buildSource(603));

    const res = runLint(PLANT_REL);

    // ESLint exits non-zero when an `error`-severity rule fires.
    expect(res.status).not.toBe(0);
    // The output must explicitly cite `max-lines` — otherwise the test could
    // pass on any unrelated lint failure and the doctrine signal is counterfeit.
    const out = `${res.stdout ?? ''}\n${res.stderr ?? ''}`;
    expect(out).toMatch(/max-lines/);
  });

  it('NEGATIVE CONTROL: a fresh 100-line page at the guarded path does NOT trip max-lines', () => {
    fs.writeFileSync(PLANT_ABS, buildSource(100));

    const res = runLint(PLANT_REL);

    // Other unrelated rules may fire on the synthetic source; the contract here
    // is narrower — max-lines must NOT be among them under the cap.
    const out = `${res.stdout ?? ''}\n${res.stderr ?? ''}`;
    expect(out).not.toMatch(/max-lines/);
  });
});
