/**
 * Equoria-pjvp8 — camelCase naming ratchet sentinel.
 *
 * Proves check-camelcase-naming.mjs is not vacuous:
 *   - it passes on the committed tree;
 *   - it FAILS on each planted violation class (snake identifier, UPPER_SNAKE
 *     constant, stored snake string value, JSON data key);
 *   - it does NOT count comments, environment-variable reads, or module
 *     specifiers;
 *   - a file that drops below its baseline must shrink the baseline, stale
 *     entries fail, and --shrink-baseline lowers entries without adding any.
 *
 * Planted snake tokens are assembled from parts so this file's own source
 * stays camelCase (the check scans tests too). Plants live in a directory
 * whose name carries the reserved `_sentinel_plant` token and are removed in
 * afterEach. Alternate baselines live in os.tmpdir().
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const checkDir = path.join(repoRoot, 'scripts', 'doctrine-checks');
const check = path.join(checkDir, 'check-camelcase-naming.mjs');
const canonicalBaseline = path.join(checkDir, 'camelcase-naming-baseline.json');
const us = '_';
// The directory name must carry the reserved `_sentinel_plant` scratch token
// (scripts/lib/doctrine-scan-patterns.mjs), which is itself snake_case.
const plantDirName = ['', '', 'camelcase', 'sentinel', 'plant'].join(us);
const plantDir = path.join(repoRoot, 'backend', 'services', plantDirName);
const plantRel = `backend/services/${plantDirName}`;

const lowerName = ['foal', 'care'].join(us);
const upperName = ['GROOM', 'LIMIT'].join(us);

let scratchDir;

afterEach(() => {
  fs.rmSync(plantDir, { recursive: true, force: true });
  if (scratchDir) {
    fs.rmSync(scratchDir, { recursive: true, force: true });
  }
  scratchDir = undefined;
});

function runCheck(args = []) {
  return spawnSync('node', [check, ...args], { cwd: repoRoot, encoding: 'utf8' });
}

function plant(name, source) {
  fs.mkdirSync(plantDir, { recursive: true });
  fs.writeFileSync(path.join(plantDir, name), source);
}

function scratchBaseline(contents) {
  scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'camelcase-sentinel-'));
  const file = path.join(scratchDir, 'baseline.json');
  fs.writeFileSync(file, JSON.stringify(contents, null, 2));
  return file;
}

function readCanonical() {
  return JSON.parse(fs.readFileSync(canonicalBaseline, 'utf8'));
}

describe('check-camelcase-naming.mjs (Equoria-pjvp8)', () => {
  it('passes on the committed tree', () => {
    const res = runCheck();
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/camelcase-naming\] OK/);
  });

  it('SENTINEL: fails on a new snake_case identifier', () => {
    plant(
      'plantedIdentifier.mjs',
      `export const ${lowerName}Total = 1;\nexport function f(${lowerName}) { return ${lowerName}; }\n`,
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(`${plantRel}/plantedIdentifier.mjs`);
    expect(res.stderr).toContain(`${lowerName} (identifier)`);
  });

  it('SENTINEL: fails on a new UPPER_SNAKE constant', () => {
    plant('plantedConstant.mjs', `export const ${upperName} = 3;\n`);
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(`${upperName} (identifier)`);
  });

  it('SENTINEL: fails on a stored snake_case string value', () => {
    plant('plantedValue.mjs', `export const speciality = '${lowerName}';\n`);
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(`${lowerName} (string)`);
  });

  it('SENTINEL: fails on a snake_case JSON data key', () => {
    plant('plantedData.json', JSON.stringify({ [lowerName]: 1 }));
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(`${lowerName} (jsonKey)`);
  });

  it('SENTINEL: fails on a snake name assembled at runtime in production code', () => {
    const prefix = ['resists', ''].join(us);
    plant(
      'plantedAssembled.mjs',
      [
        `export const viaTemplate = (t) => \`${prefix}\${t}\`;`,
        `export const viaConcat = (t) => '${prefix}' + t;`,
        '',
      ].join('\n'),
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(`${prefix} (templateFragment)`);
    expect(res.stderr).toContain(`${prefix} (concatFragment)`);
  });

  it('does not fragment-scan throwaway fixture identities in test files', () => {
    const prefix = ['testuser', ''].join(us);
    plant('plantedFixture.test.mjs', `export const name = \`${prefix}\${Date.now()}\`;\n`);
    const res = runCheck();
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('does not count comments, env reads, or module specifiers', () => {
    plant(
      'plantedExempt.mjs',
      [
        `import { spawnSync } from '${['child', 'process'].join(us)}';`,
        `// the old ${lowerName} spelling was removed`,
        `/* ${upperName} used to live here */`,
        `export const mode = process.env.${['NODE', 'ENV'].join(us)};`,
        'export const run = spawnSync;',
        '',
      ].join('\n'),
    );
    const res = runCheck();
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('fails when a file drops below its baseline without shrinking it', () => {
    const baseline = readCanonical();
    const [file, count] = Object.entries(baseline)[0];
    const res = runCheck(['--baseline', scratchBaseline({ ...baseline, [file]: count + 1 })]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(`${file}: ${count} < baseline ${count + 1}`);
    expect(res.stderr).toContain('--shrink-baseline');
  });

  it('fails on a stale baseline entry', () => {
    const stale = 'backend/services/doesNotExistCamelcaseSentinel.mjs';
    expect(fs.existsSync(path.join(repoRoot, ...stale.split('/')))).toBe(false);
    const res = runCheck(['--baseline', scratchBaseline({ ...readCanonical(), [stale]: 2 })]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(`stale baseline entry (file gone): ${stale}`);
  });

  it('--shrink-baseline lowers entries but never adds a new file', () => {
    const baseline = readCanonical();
    const [file, count] = Object.entries(baseline)[0];
    const alt = scratchBaseline({ ...baseline, [file]: count + 5 });
    plant('plantedConstant.mjs', `export const ${upperName} = 3;\n`);

    const res = runCheck(['--baseline', alt, '--shrink-baseline']);
    const shrunk = JSON.parse(fs.readFileSync(alt, 'utf8'));
    expect(shrunk[file]).toBe(count);
    expect(Object.keys(shrunk).some(key => key.startsWith(plantRel))).toBe(false);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(`${plantRel}/plantedConstant.mjs`);
  });
});
