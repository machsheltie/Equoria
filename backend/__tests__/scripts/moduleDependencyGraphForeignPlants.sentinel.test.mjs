/**
 * Sentinel: the module-dependency-graph gate versus OTHER suites' plants (Equoria-rfv9j, from the
 * WS4 S6 push window; Equoria-q4uem.4).
 *
 * Under the two-lane sharded gate, sibling scripts-dir sentinels plant and delete files under
 * backend/modules while scripts/doctrine-checks/check-module-dependency-graph.mjs reads the tree.
 * The gate skips the reserved scratch names of other suites (shared list in
 * scripts/lib/doctrine-scan-patterns.mjs, precedent Equoria-27lqy), reports them as WARNs, treats a
 * reserved-name directory as never-a-module, and refuses to let that skip hide COMMITTED source: a
 * skipped name that git tracks is an R2 violation (fail closed without git).
 *
 * Why a separate suite from moduleDependencyGraphDoctrine.sentinel.test.mjs: that suite crossed the
 * 800-line cap, and these arms plant only FOREIGN-token names (`_v8l96_sentinel_*`), which every
 * gate run skips. The core suite's own-token (`_ws4graphplant_`) violation plants are visible to
 * ANY gate run, so if the two suites land in different lanes the core may be mid-arm while this one
 * runs the gate. Every assertion here is therefore about THIS suite's plant only — the WARN line
 * naming it, the absence of a violation line naming it, a tracked-name violation (exit 1 either
 * way) — never `status 0`, never an exact count, never a module-count equality, and the hygiene
 * hooks check only this suite's `planted` list (strayPlants() scans for the core suite's token).
 *
 * Plant hygiene: unique per-run names (RUN_ID), every created directory recorded and removed
 * deepest-first by cleanupPlants(), which asserts absence; the tracked-name arm unstages its
 * intent-to-add entry in `finally` and asserts the index is clean of it.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CHECK,
  RUN_ID,
  esc,
  relPosix,
  planted,
  plantFile,
  cleanupPlants,
  runCheck,
  gitInRepo,
} from '../helpers/moduleDependencyGraphDoctrinePlants.mjs';

beforeAll(() => {
  expect(fs.existsSync(CHECK)).toBe(true);
});

afterEach(() => {
  cleanupPlants();
});

afterAll(() => {
  expect(planted).toEqual([]);
});

describe('check-module-dependency-graph.mjs versus foreign sentinel plants (Equoria-rfv9j)', () => {
  it('F2: a FOREIGN sentinel plant (reserved `_v8l96_sentinel` name) carrying a cross-module deep import is skipped with a WARN, never judged', () => {
    const plant = plantFile(
      `competition/_v8l96_sentinel_ws4race_${RUN_ID}.mjs`,
      "import { x } from '../horses/services/horseService.mjs';\nexport const y = x;\n",
    );
    const rel = relPosix(plant);
    const res = runCheck();
    expect(res.out).not.toMatch(new RegExp(`R2 ${esc(rel)}`)); // no violation line names my plant
    expect(res.out).toMatch(new RegExp(`WARN skipped foreign sentinel plant ${esc(rel)}`));
    expect(res.out).toMatch(/ foreign-skipped=[1-9]\d* /);
  });

  it('M2: a FOREIGN plant directory that contains an index.mjs is skipped whole — never judged as a module (its `export *` would be R3)', () => {
    const barrel = plantFile(`_v8l96_sentinel_moddir_${RUN_ID}/index.mjs`, "export * from './services/x.mjs';\n");
    const dir = relPosix(path.dirname(barrel));
    const res = runCheck();
    expect(res.out).not.toMatch(new RegExp(`R3 ${esc(dir)}`)); // never judged as a barrel
    expect(res.out).toMatch(new RegExp(`WARN skipped foreign sentinel plant ${esc(dir)}`));
    expect(res.out).not.toMatch(new RegExp(`directory without a barrel.*${esc(path.basename(dir))}`));
  });

  it('M1: a TRACKED file whose name carries a reserved scratch-plant token is a violation — the skip never hides committed source', () => {
    // Simulated with an intent-to-add index entry (unstaged in `finally`); the file is an ordinary plant.
    const plant = plantFile(`competition/_v8l96_sentinel_tracked_${RUN_ID}.mjs`, 'export const y = 1;\n');
    const rel = relPosix(plant);
    expect(gitInRepo(['ls-files', '--', 'backend/modules']).stdout).not.toMatch(/_v8l96_sentinel_tracked_/); // no leftover from a crashed run
    expect(gitInRepo(['add', '-N', '--', rel]).status).toBe(0);
    try {
      expect(gitInRepo(['ls-files', '--', rel]).stdout.trim()).toBe(rel);
      const res = runCheck();
      expect(res.status).toBe(1);
      expect(res.out).toContain(`R2 tracked file carries a reserved scratch-plant name: ${rel}`);
    } finally {
      expect(gitInRepo(['reset', '-q', '--', rel]).status).toBe(0);
    }
    expect(gitInRepo(['ls-files', '--', rel]).stdout.trim()).toBe('');
  });

  // Equoria-kcgnk: inside `git push` the pre-push hook exports GIT_DIR, GIT_WORK_TREE and
  // GIT_INDEX_FILE. The gate's own `git ls-files` and this suite's `git add -N` / `git reset`
  // inherited them, so the verdict (and the intent-to-add entry) followed the hook's git instead of
  // this checkout: F2, M1 and M2 all failed under a hook-style env, and M1 failed in the 2026-10-23
  // gate with status 128. Jest gives a test a copy of process.env, so the hook environment is handed
  // to the helpers explicitly, exactly as the gate process holds it.
  it('hook env: with hook-style GIT_* variables the tracked-name arm still judges THIS checkout', () => {
    const elsewhere = path.join(os.tmpdir(), `equoria-kcgnk-not-the-repo-${process.pid}`);
    const hookEnv = {
      ...process.env,
      GIT_DIR: path.join(elsewhere, '.git'),
      GIT_WORK_TREE: elsewhere,
      GIT_INDEX_FILE: path.join(elsewhere, 'index'),
    };
    const plantSuffix = `${process.pid}x${Date.now()}`;
    const plant = plantFile(`competition/_v8l96_sentinel_hookenv_${plantSuffix}.mjs`, 'export const y = 1;\n');
    const rel = relPosix(plant);
    expect(gitInRepo(['add', '-N', '--', rel], hookEnv).status).toBe(0);
    try {
      expect(gitInRepo(['ls-files', '--', rel], hookEnv).stdout.trim()).toBe(rel);
      const res = runCheck([], hookEnv);
      expect(res.status).toBe(1);
      expect(res.out).toContain(`R2 tracked file carries a reserved scratch-plant name: ${rel}`);
    } finally {
      expect(gitInRepo(['reset', '-q', '--', rel]).status).toBe(0);
    }
    expect(gitInRepo(['ls-files', '--', rel]).stdout.trim()).toBe('');
  });

  it('wiring: the gate routes its directory walk and every walked-file read through the shared ENOENT-tolerant helpers, the reserved-name skip and the tracked-name check', () => {
    const src = fs.readFileSync(CHECK, 'utf8');
    expect(src).toContain("from '../lib/doctrine-scan-patterns.mjs'");
    expect(src).toContain('readdirSyncTolerant(');
    expect(src).toContain('readScannedFileSyncTolerant(');
    expect(src).toContain('isReservedScratchPlantPathSegment(');
    expect(src).toContain("spawnSync('git', ['ls-files', '--'");
    // Only the allow-list JSON (a tracked config file, never a plant) is read directly.
    expect(src.match(/fs\.readFileSync\(/g) ?? []).toEqual(['fs.readFileSync(']);
    expect(src).toMatch(/fs\.readFileSync\(ALLOWLIST_PATH/);
  });
});
