/**
 * Equoria-rkgq9 doctrine sentinel.
 *
 * Proves the no-radix-imports doctrine check (a) passes against the live
 * frontend tree now that all 8 @radix-ui primitives are retired, and (b)
 * FIRES when a fresh `@radix-ui` import is planted in a new frontend source
 * file. Without (b), a future regex narrowing or scope shrinkage could let a
 * reintroduced Radix import slip past the gate.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CHECK = path.join(REPO_ROOT, 'scripts/doctrine-checks/check-no-radix-imports.mjs');
const PLANT_DIR = path.join(REPO_ROOT, 'frontend/src/_no_radix_imports_doctrine_sentinel');

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

describe('check-no-radix-imports.mjs (Equoria-rkgq9)', () => {
  it('passes against the live frontend tree (0 @radix-ui imports after rip-out)', () => {
    const res = runCheck();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/no-radix-imports.*OK/);
  });

  it('SENTINEL: fails when a NEW @radix-ui import is planted', () => {
    fs.mkdirSync(PLANT_DIR, { recursive: true });
    const planted = path.join(PLANT_DIR, 'planted.tsx');
    // Build the specifier from concat so an accidental scan of this sentinel's
    // own location can never match — the planted FILE is what must trip the gate.
    const SCOPE = '@radix-ui';
    const PKG = `${SCOPE}/react-dialog`;
    fs.writeFileSync(
      planted,
      [
        '// PLANTED by noRadixImportsDoctrine.sentinel.test.mjs (Equoria-rkgq9).',
        '// If this file lands on master you have a bigger problem than this test.',
        `import * as Dialog from '${PKG}';`,
        'export const planted = Dialog;',
        '',
      ].join('\n'),
    );

    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/no-radix-imports.*FAIL/);
    expect(res.stderr).toMatch(/react-dialog|@radix-ui/);
  });
});
