/**
 * Equoria-fefh2.11 — doctrine baseline stale-entry detection sentinel.
 *
 * The three baseline-delta doctrine checks
 *   - check-no-new-silent-cleanup-catch.mjs   (burn-down: Equoria-1ohys)
 *   - check-no-new-rethrow-after-log.mjs      (burn-down: Equoria-wkdwx)
 *   - check-no-new-api-client-vi-mock.mjs     (burn-down: Equoria-f12xy)
 * grandfather legacy occurrences via a baseline (two JSON files + one inline
 * list). A baseline entry whose file no longer exists on disk is STALE:
 * unusable grandfathered headroom that a future regression could silently
 * hide under. Under fefh2.11 each check now FAILS (exit 1) on stale entries,
 * naming them and instructing that the baseline may only shrink.
 *
 * Each check accepts an optional argv[2] baseline-path override (JSON object
 * for the two count baselines, JSON array of paths for the vi-mock list)
 * precisely so this sentinel can plant a stale entry WITHOUT editing the
 * canonical baselines. Production callers (run-all.sh, CI) pass no argument.
 *
 * Sentinel-positive proof (OPTIMAL_FIX_DISCIPLINE §2), per check:
 *   1. planted baseline (canonical entries + one path that does not exist)
 *      → exit 1, stderr names the stale path + the shrink-only instruction;
 *   2. override with ONLY the canonical (all-existing) entries → exit 0,
 *      proving the failure in (1) is the planted stale entry, not the
 *      override mechanism itself;
 *   3. no argument (canonical baseline) → exit 0 on the clean tree.
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

const SILENT_CATCH_CHECK = path.join(CHECK_DIR, 'check-no-new-silent-cleanup-catch.mjs');
const RETHROW_CHECK = path.join(CHECK_DIR, 'check-no-new-rethrow-after-log.mjs');
const VI_MOCK_CHECK = path.join(CHECK_DIR, 'check-no-new-api-client-vi-mock.mjs');

const SILENT_CATCH_BASELINE = path.join(CHECK_DIR, 'silent-cleanup-catch-baseline.json');
const RETHROW_BASELINE = path.join(CHECK_DIR, 'rethrow-after-log-baseline.json');

// A repo-relative path that must never exist. Marker-named per convention.
const STALE_ENTRY = 'backend/__tests__/__fefh2_stale_baseline_entry_PLANTED_DOES_NOT_EXIST__.test.mjs';

let scratchDir;

beforeAll(() => {
  // Hard precondition: the planted stale path must not actually exist,
  // otherwise the positive proofs below would be vacuous.
  expect(fs.existsSync(path.join(REPO_ROOT, ...STALE_ENTRY.split('/')))).toBe(false);
});

afterEach(() => {
  if (scratchDir) {
    fs.rmSync(scratchDir, { recursive: true, force: true });
    scratchDir = undefined;
  }
});

function makeScratch() {
  scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fefh2-baseline-stale-PLANTED-'));
  return scratchDir;
}

function runCheck(checkPath, args = []) {
  return spawnSync('node', [checkPath, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

/**
 * Extract the canonical inline baseline of the vi-mock check from its own
 * source. The CANONICAL_BASELINE array entries are the only single-quoted
 * 'frontend/...' string literals in that file.
 */
function readViMockCanonicalBaseline() {
  const src = fs.readFileSync(VI_MOCK_CHECK, 'utf8');
  const entries = [...src.matchAll(/'(frontend\/[^']+)'/g)].map(m => m[1]);
  expect(entries.length).toBeGreaterThan(0);
  return entries;
}

describe.each([
  ['silent-cleanup-catch', SILENT_CATCH_CHECK, SILENT_CATCH_BASELINE],
  ['rethrow-after-log', RETHROW_CHECK, RETHROW_BASELINE],
])('%s — stale baseline-entry detection (Equoria-fefh2.11)', (label, checkPath, baselinePath) => {
  it('SENTINEL-POSITIVE: FIRES (exit 1) on a planted stale entry, naming it + the shrink-only rule', () => {
    const dir = makeScratch();
    const canonical = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const planted = { ...canonical, [STALE_ENTRY]: 1 };
    const plantedPath = path.join(dir, `${label}-PLANTED-baseline.json`);
    fs.writeFileSync(plantedPath, JSON.stringify(planted), 'utf8');

    const res = runCheck(checkPath, [plantedPath]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('stale baseline entries');
    expect(res.stderr).toContain(STALE_ENTRY);
    expect(res.stderr).toContain('may only SHRINK');
  });

  it('control: the override mechanism itself passes with the canonical (all-existing) entries', () => {
    const dir = makeScratch();
    const canonical = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const copyPath = path.join(dir, `${label}-PLANTED-canonical-copy.json`);
    fs.writeFileSync(copyPath, JSON.stringify(canonical), 'utf8');

    const res = runCheck(checkPath, [copyPath]);
    expect(res.status).toBe(0);
    expect(res.stderr).not.toContain('stale baseline entries');
  });

  it('clean tree: canonical baseline (no override) exits 0 — every entry exists on disk', () => {
    const res = runCheck(checkPath);
    expect(res.status).toBe(0);
  });
});

describe('api-client-vi-mock — stale baseline-entry detection (Equoria-fefh2.11)', () => {
  it('SENTINEL-POSITIVE: FIRES (exit 1) on a planted stale entry, naming it + the shrink-only rule', () => {
    const dir = makeScratch();
    const staleFrontendEntry = 'frontend/src/pages/__tests__/__fefh2_stale_PLANTED_DOES_NOT_EXIST__.test.tsx';
    expect(fs.existsSync(path.join(REPO_ROOT, ...staleFrontendEntry.split('/')))).toBe(false);
    const planted = [...readViMockCanonicalBaseline(), staleFrontendEntry];
    const plantedPath = path.join(dir, 'api-client-vi-mock-PLANTED-baseline.json');
    fs.writeFileSync(plantedPath, JSON.stringify(planted), 'utf8');

    const res = runCheck(VI_MOCK_CHECK, [plantedPath]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('stale baseline entries');
    expect(res.stderr).toContain(staleFrontendEntry);
    expect(res.stderr).toContain('may only SHRINK');
  });

  it('control: the override mechanism itself passes with the canonical (all-existing) entries', () => {
    const dir = makeScratch();
    const copyPath = path.join(dir, 'api-client-vi-mock-PLANTED-canonical-copy.json');
    fs.writeFileSync(copyPath, JSON.stringify(readViMockCanonicalBaseline()), 'utf8');

    const res = runCheck(VI_MOCK_CHECK, [copyPath]);
    expect(res.status).toBe(0);
    expect(res.stderr).not.toContain('stale baseline entries');
  });

  it('clean tree: canonical inline baseline (no override) exits 0 — every entry exists on disk', () => {
    const res = runCheck(VI_MOCK_CHECK);
    expect(res.status).toBe(0);
  });

  it('a malformed override (not a JSON array of strings) exits 2 with a clear message, not a crash', () => {
    const dir = makeScratch();
    const badPath = path.join(dir, 'api-client-vi-mock-PLANTED-malformed.json');
    fs.writeFileSync(badPath, JSON.stringify({ not: 'an array' }), 'utf8');

    const res = runCheck(VI_MOCK_CHECK, [badPath]);
    expect(res.status).toBe(2);
    expect(res.stderr).toContain('must be a JSON array of repo-relative path strings');
  });
});
