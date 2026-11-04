/**
 * Equoria-4bs3s doctrine sentinel.
 *
 * Proves the no-unversioned-api doctrine check fires when a new
 * unversioned `/api/<X>` literal is planted in a fresh frontend source
 * file. Without this, a future regex narrowing or scope shrinkage could
 * silently let new violations slip past.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(HERE, '..', '..');
const CHECK = path.join(repoRoot, 'scripts/doctrine-checks/check-no-unversioned-api.mjs');
const plantDir = path.join(repoRoot, 'frontend/src/_noUnversionedApiDoctrineSentinel');

afterEach(() => {
  try {
    fs.rmSync(plantDir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
});

function runCheck() {
  return spawnSync('node', [CHECK], { cwd: repoRoot, encoding: 'utf8' });
}

describe('check-no-unversioned-api.mjs (Equoria-4bs3s)', () => {
  it('passes against the live frontend tree (0 violations after codemod)', () => {
    const res = runCheck();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/no-unversioned-api.*OK/);
  });

  it('SENTINEL: fails when a NEW unversioned `/api/...` literal is planted', () => {
    fs.mkdirSync(plantDir, { recursive: true });
    const planted = path.join(plantDir, 'planted.ts');
    // Build the path from concat so this sentinel's own source doesn't
    // trip the doctrine on the test file itself (the regex is non-greedy
    // about matching literal /api/<X>/ inside string quotes; concat
    // avoids it).
    const PREFIX = '/api/';
    const FORBIDDEN = `${PREFIX}horses/test`;
    fs.writeFileSync(
      planted,
      [
        '// PLANTED by noUnversionedApiDoctrine.sentinel.test.mjs (Equoria-4bs3s).',
        '// If this file lands on master you have a bigger problem than this test.',
        'export function plantedCall() {',
        `  return fetch('${FORBIDDEN}');`,
        '}',
        '',
      ].join('\n'),
    );

    const res = runCheck();
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/no-unversioned-api.*FAIL/);
    expect(res.stderr).toMatch(/planted\.ts/);
  });

  it('SENTINEL: allows /api/v1/... (canonical) and /api/internal/... (4bs3s-sibling exempt)', () => {
    fs.mkdirSync(plantDir, { recursive: true });
    const planted = path.join(plantDir, 'allowed.ts');
    fs.writeFileSync(
      planted,
      [
        "export const canonical = '/api/v1/horses/list';",
        "export const internalGhost = '/api/internal/feature-flags';",
        '',
      ].join('\n'),
    );
    const res = runCheck();
    expect(res.status).toBe(0);
  });
});
