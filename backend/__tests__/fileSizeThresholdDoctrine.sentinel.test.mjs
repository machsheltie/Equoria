/**
 * Equoria-urqic.7 file-size-threshold doctrine sentinel.
 *
 * Proves the shrink-only file-size ratchet (check-file-size-thresholds.mjs +
 * file-size-baseline.json) actually fires:
 *   1. passes on the current tree (every over-threshold file is allow-listed
 *      at >= its current line count);
 *   2. FAILS when a NEW > 600-line SOURCE file is planted (not on the
 *      allow-list);
 *   3. FAILS when a NEW > 800-line TEST file is planted;
 *   4. PASSES when a planted source file is just under the 600 cap (negative
 *      control — proves it's the size, not the plant location, that trips it);
 *   5. via the argv[2] alternate-baseline hook, FAILS on a stale baseline entry
 *      (a path no longer over threshold / not on disk) — proving the
 *      shrink-only prune is enforced — and PASSES with the canonical copy,
 *      proving the override mechanism itself is sound.
 *
 * Without this sentinel a future scope narrowing, threshold bump, or walker
 * regression could silently let new god-files re-emerge — the "test that
 * doesn't really test" pattern CLAUDE.md §3 rejects.
 *
 * Plant artifacts live under marker-named scratch dirs (basename excluded by
 * isPlantArtifactBasename) and an os.tmpdir() scratch for the baseline JSON;
 * all are removed in afterEach.
 */

import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CHECK = path.join(REPO_ROOT, 'scripts/doctrine-checks/check-file-size-thresholds.mjs');
const BASELINE = path.join(REPO_ROOT, 'scripts/doctrine-checks/file-size-baseline.json');

// Plant dirs use a non-marker basename so the WALKER collects the planted file
// (isPlantArtifactBasename excludes DO_NOT_COMMIT / PLANTED basenames). The
// planted FILE basename is what the walker sees, so it must be a normal name.
const PLANT_SRC_DIR = path.join(REPO_ROOT, 'backend/modules/horses/services/_file_size_doctrine_sentinel');
const PLANT_TEST_DIR = path.join(REPO_ROOT, 'backend/__tests__/_file_size_doctrine_sentinel');

let scratchDir;

beforeAll(() => {
  // Hard precondition: the plant dirs must not already exist.
  for (const dir of [PLANT_SRC_DIR, PLANT_TEST_DIR]) {
    expect(fs.existsSync(dir)).toBe(false);
  }
});

afterEach(() => {
  for (const dir of [PLANT_SRC_DIR, PLANT_TEST_DIR]) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
  if (scratchDir) {
    fs.rmSync(scratchDir, { recursive: true, force: true });
    scratchDir = undefined;
  }
});

function makeScratch() {
  scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'urqic7-file-size-PLANTED-'));
  return scratchDir;
}

function runCheck(args = []) {
  return spawnSync('node', [CHECK, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

/** Build a source file with exactly `lines` newline-terminated lines. */
function buildSource(lines) {
  return `${Array.from({ length: lines }, (_, i) => `export const k${i} = ${i};`).join('\n')}\n`;
}

describe('check-file-size-thresholds.mjs (Equoria-urqic.7)', () => {
  it('passes on the current tree — every over-threshold file is allow-listed', () => {
    const res = runCheck();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/file-size-thresholds.*OK/);
  });

  it('SENTINEL: FAILS when a NEW > 600-line SOURCE file is planted', () => {
    fs.mkdirSync(PLANT_SRC_DIR, { recursive: true });
    const planted = path.join(PLANT_SRC_DIR, 'plantedService.mjs');
    fs.writeFileSync(planted, buildSource(650)); // > 600 source cap

    const res = runCheck();
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/file-size-thresholds.*FAIL/);
    expect(res.stderr).toMatch(/plantedService\.mjs/);
    expect(res.stderr).toMatch(/NEW — not on the allow-list/);
  });

  it('SENTINEL: FAILS when a NEW > 800-line TEST file is planted', () => {
    fs.mkdirSync(PLANT_TEST_DIR, { recursive: true });
    const planted = path.join(PLANT_TEST_DIR, 'plantedThing.test.mjs');
    fs.writeFileSync(planted, buildSource(850)); // > 800 test cap

    const res = runCheck();
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/file-size-thresholds.*FAIL/);
    expect(res.stderr).toMatch(/plantedThing\.test\.mjs/);
  });

  it('NEGATIVE CONTROL: a planted SOURCE file UNDER the 600 cap does NOT trip the check', () => {
    fs.mkdirSync(PLANT_SRC_DIR, { recursive: true });
    const planted = path.join(PLANT_SRC_DIR, 'plantedSmallService.mjs');
    fs.writeFileSync(planted, buildSource(550)); // < 600 source cap

    const res = runCheck();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/file-size-thresholds.*OK/);
  });

  it('NEGATIVE CONTROL: a > 600-line file that is also > 800 but is a TEST file is judged by the 800 cap', () => {
    // A 700-line .test.mjs is OVER the 600 source cap but UNDER the 800 test
    // cap — proving test files get the more lenient threshold, not the source
    // one. If isTestFile() regressed, this would FAIL (judged at 600).
    fs.mkdirSync(PLANT_TEST_DIR, { recursive: true });
    const planted = path.join(PLANT_TEST_DIR, 'plantedMid.test.mjs');
    fs.writeFileSync(planted, buildSource(700));

    const res = runCheck();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/file-size-thresholds.*OK/);
  });

  it('SENTINEL: via argv[2], FAILS on a stale baseline entry (path no longer over threshold)', () => {
    const dir = makeScratch();
    const canonical = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
    // A repo-relative path that exists on disk but is NOT over threshold:
    // this very sentinel file (well under 800 lines for a test, but we also
    // record it as a SOURCE-shaped entry). Simpler + robust: a path that does
    // not exist at all.
    const staleEntry = 'backend/__tests__/__urqic7_stale_PLANTED_DOES_NOT_EXIST__.test.mjs';
    expect(fs.existsSync(path.join(REPO_ROOT, ...staleEntry.split('/')))).toBe(false);
    const planted = { ...canonical, [staleEntry]: 999 };
    const plantedPath = path.join(dir, 'file-size-PLANTED-baseline.json');
    fs.writeFileSync(plantedPath, JSON.stringify(planted), 'utf8');

    const res = runCheck([plantedPath]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('stale baseline entries');
    expect(res.stderr).toContain(staleEntry);
    expect(res.stderr).toContain('may only SHRINK');
  });

  it('control: the argv[2] override mechanism itself passes with the canonical baseline copy', () => {
    const dir = makeScratch();
    const canonical = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
    const copyPath = path.join(dir, 'file-size-PLANTED-canonical-copy.json');
    fs.writeFileSync(copyPath, JSON.stringify(canonical), 'utf8');

    const res = runCheck([copyPath]);
    expect(res.status).toBe(0);
    expect(res.stderr).not.toContain('stale baseline entries');
  });
});
