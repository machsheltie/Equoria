/**
 * Equoria-pc042 — unsafe-raw-sql allowlist stale-entry detection sentinel.
 *
 * `scripts/doctrine-checks/check-no-unsafe-raw-sql.mjs` consumes
 * `unsafe-raw-sql-allowlist.json`, a narrow map of backend app-code files that
 * are exempt from the "no unsafe $executeRawUnsafe/$queryRawUnsafe" gate. An
 * allowlist entry naming a file that (a) no longer exists on disk OR (b) no
 * longer contains ANY unsafe raw-SQL callsite is STALE: the unsafe callsite
 * was migrated/deleted but the security-review exemption silently lingers, so
 * a future regression re-introducing an unsafe call into that same file would
 * be auto-exempted with no review. Under Equoria-pc042 the check FAILS
 * (exit 1) on stale entries, names them, and instructs that the allowlist may
 * only SHRINK — the same pattern the gates allowlist uses (Equoria-iz9gp, see
 * gatesAllowlistStale.sentinel.test.mjs) and the three baseline-delta checks
 * (Equoria-fefh2.11, see doctrineBaselineStale.sentinel.test.mjs).
 *
 * The check accepts an optional argv[2] allowlist-path override precisely so
 * this sentinel can plant a stale entry WITHOUT editing the canonical
 * allowlist. Production callers (run-all.sh, CI) pass no argument.
 *
 * Sentinel-positive proof (OPTIMAL_FIX_DISCIPLINE §2):
 *   1a. planted allowlist (canonical entries + one path that does not exist)
 *       → exit 1, stderr names the stale path + the shrink-only rule;
 *   1b. planted allowlist (canonical entries + one path that EXISTS but holds
 *       NO unsafe callsite) → exit 1, stderr names it as a no-callsite stale;
 *   2.  override with ONLY the canonical (all-live, all-with-callsite) entries
 *       → exit 0, proving the failures in (1) are the planted stale entries,
 *       not the override mechanism itself;
 *   3.  no argument (canonical allowlist) → exit 0 on the clean tree.
 *
 * Plant artifacts live in an os.tmpdir() scratch dir whose name contains
 * PLANTED (repo convention) and are deleted in afterEach.
 */

import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const CHECK_DIR = path.join(REPO_ROOT, 'scripts', 'doctrine-checks');
const CHECK = path.join(CHECK_DIR, 'check-no-unsafe-raw-sql.mjs');
const ALLOWLIST = path.join(CHECK_DIR, 'unsafe-raw-sql-allowlist.json');

// A repo-relative path that must never exist (stale flavour (a)).
const STALE_MISSING = 'backend/__pc042_stale_allowlist_entry_PLANTED_DOES_NOT_EXIST__.mjs';

// A repo-relative path that DOES exist but contains NO unsafe raw-SQL callsite
// (stale flavour (b)) — the run-all.sh harness is a stable, callsite-free file.
const STALE_NO_CALLSITE = 'scripts/doctrine-checks/run-all.sh';

let scratchDir;

beforeAll(() => {
  // Hard preconditions so the positive proofs below are not vacuous.
  expect(fs.existsSync(path.join(REPO_ROOT, ...STALE_MISSING.split('/')))).toBe(false);
  const noCallsiteAbs = path.join(REPO_ROOT, ...STALE_NO_CALLSITE.split('/'));
  expect(fs.existsSync(noCallsiteAbs)).toBe(true);
  expect(/\.\$(?:executeRawUnsafe|queryRawUnsafe)\s*\(/.test(fs.readFileSync(noCallsiteAbs, 'utf8'))).toBe(false);
});

afterEach(() => {
  if (scratchDir) {
    fs.rmSync(scratchDir, { recursive: true, force: true });
    scratchDir = undefined;
  }
});

function makeScratch() {
  scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pc042-unsafe-raw-sql-allowlist-stale-PLANTED-'));
  return scratchDir;
}

function runCheck(args = []) {
  return spawnSync('node', [CHECK, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

function plantAllowlist(extraEntries) {
  const dir = makeScratch();
  const canonical = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf8'));
  const planted = { ...canonical, allowlist: { ...canonical.allowlist } };
  for (const entry of extraEntries) {
    planted.allowlist[entry] = { reason: 'PLANTED stale entry (sentinel)', issue: 'Equoria-pc042' };
  }
  const plantedPath = path.join(dir, 'unsafe-raw-sql-allowlist-PLANTED.json');
  fs.writeFileSync(plantedPath, JSON.stringify(planted), 'utf8');
  return plantedPath;
}

describe('unsafe-raw-sql allowlist — stale-entry detection (Equoria-pc042)', () => {
  it('SENTINEL-POSITIVE: FIRES (exit 1) on a planted MISSING-file entry, naming it + the shrink-only rule', () => {
    const plantedPath = plantAllowlist([STALE_MISSING]);

    const res = runCheck([plantedPath]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('stale allowlist entries');
    expect(res.stderr).toContain(STALE_MISSING);
    expect(res.stderr).toContain('file no longer exists on disk');
    expect(res.stderr).toContain('may only SHRINK');
  });

  it('SENTINEL-POSITIVE: FIRES (exit 1) on a planted EXISTS-but-no-callsite entry, naming it as stale', () => {
    const plantedPath = plantAllowlist([STALE_NO_CALLSITE]);

    const res = runCheck([plantedPath]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('stale allowlist entries');
    expect(res.stderr).toContain(STALE_NO_CALLSITE);
    expect(res.stderr).toContain('no $executeRawUnsafe/$queryRawUnsafe callsite remains');
    expect(res.stderr).toContain('may only SHRINK');
  });

  it('control: the override mechanism itself passes with the canonical (all-live, with-callsite) entries', () => {
    const dir = makeScratch();
    const canonical = fs.readFileSync(ALLOWLIST, 'utf8');
    const copyPath = path.join(dir, 'unsafe-raw-sql-allowlist-PLANTED-canonical-copy.json');
    fs.writeFileSync(copyPath, canonical, 'utf8');

    const res = runCheck([copyPath]);
    expect(res.status).toBe(0);
    expect(res.stderr).not.toContain('stale allowlist entries');
  });

  it('clean tree: canonical allowlist (no override) exits 0 — every entry exists AND still holds an unsafe callsite', () => {
    const res = runCheck();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/no-unsafe-raw-sql.*OK/);
  });
});
