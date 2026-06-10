/**
 * Equoria-iz9gp — gates-allowlist stale-entry detection sentinel.
 *
 * `scripts/doctrine-checks/check-gates-run-on-prs.mjs` consumes
 * `gates-allowlist.txt`, a flat list of `*-gate` job keys that are exempt
 * from the "gates must run on PRs" rule. An allowlist entry naming a job key
 * that no longer exists as a `*-gate` job in ANY workflow is STALE:
 * dead-weight exemption that could silently auto-exempt a future gate reusing
 * the key. Under Equoria-iz9gp the check FAILS (exit 1) on stale entries,
 * names them, and instructs that the allowlist may only SHRINK — the same
 * pattern the three baseline-delta checks use (see
 * doctrineBaselineStale.sentinel.test.mjs).
 *
 * The check accepts an optional argv[2] allowlist-path override precisely so
 * this sentinel can plant a stale entry WITHOUT editing the canonical
 * allowlist. Production callers (run-all.sh, CI) pass no argument.
 *
 * Sentinel-positive proof (OPTIMAL_FIX_DISCIPLINE §2):
 *   1. planted allowlist (canonical entries + one job key that exists in no
 *      workflow) → exit 1, stderr names the stale key + the shrink-only rule;
 *   2. override with ONLY the canonical (all-real) entries → exit 0, proving
 *      the failure in (1) is the planted stale entry, not the override
 *      mechanism itself;
 *   3. no argument (canonical allowlist) → exit 0 on the clean tree.
 *
 * Plant artifacts live in an os.tmpdir() scratch dir whose name contains
 * PLANTED (repo convention) and are deleted in afterEach.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const CHECK_DIR = path.join(REPO_ROOT, 'scripts', 'doctrine-checks');
const GATES_CHECK = path.join(CHECK_DIR, 'check-gates-run-on-prs.mjs');
const GATES_ALLOWLIST = path.join(CHECK_DIR, 'gates-allowlist.txt');

// A job key that must never name a real `*-gate` job in any workflow.
const STALE_JOB_KEY = 'fefh-iz9gp-stale-gate-planted-does-not-exist-gate';

let scratchDir;

afterEach(() => {
  if (scratchDir) {
    fs.rmSync(scratchDir, { recursive: true, force: true });
    scratchDir = undefined;
  }
});

function makeScratch() {
  scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iz9gp-gates-allowlist-stale-PLANTED-'));
  return scratchDir;
}

function runCheck(args = []) {
  return spawnSync('node', [GATES_CHECK, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

describe('gates-allowlist — stale-entry detection (Equoria-iz9gp)', () => {
  it('SENTINEL-POSITIVE: FIRES (exit 1) on a planted stale entry, naming it + the shrink-only rule', () => {
    const dir = makeScratch();
    const canonical = fs.readFileSync(GATES_ALLOWLIST, 'utf8');
    const planted = `${canonical}\n${STALE_JOB_KEY}\n`;
    const plantedPath = path.join(dir, 'gates-allowlist-PLANTED.txt');
    fs.writeFileSync(plantedPath, planted, 'utf8');

    const res = runCheck([plantedPath]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('stale allowlist entries');
    expect(res.stderr).toContain(STALE_JOB_KEY);
    expect(res.stderr).toContain('may only SHRINK');
  });

  it('control: the override mechanism itself passes with the canonical (all-real) entries', () => {
    const dir = makeScratch();
    const canonical = fs.readFileSync(GATES_ALLOWLIST, 'utf8');
    const copyPath = path.join(dir, 'gates-allowlist-PLANTED-canonical-copy.txt');
    fs.writeFileSync(copyPath, canonical, 'utf8');

    const res = runCheck([copyPath]);
    expect(res.status).toBe(0);
    expect(res.stderr).not.toContain('stale allowlist entries');
  });

  it('clean tree: canonical allowlist (no override) exits 0 — every entry names a real *-gate job', () => {
    const res = runCheck();
    expect(res.status).toBe(0);
  });
});
