/**
 * Equoria-q7lqz — doctrine scans must tolerate files that vanish mid-scan.
 *
 * Incident: during a concurrent jest run, sentinel suites plant + delete
 * temp test files (e.g. backend/__tests__/__doctrine_jest_plant_DO_NOT_COMMIT__.test.mjs).
 * check-no-new-silent-cleanup-catch.mjs enumerated such a file in walk(),
 * the sentinel deleted it, and the subsequent readFileSync in
 * countSilentCatches() crashed the whole check with ENOENT.
 *
 * The fix (scripts/lib/doctrine-scan-patterns.mjs):
 *   1. readScannedFileSyncTolerant(path, label) — tolerates ONLY ENOENT,
 *      printing a one-line notice and returning null; rethrows everything
 *      else (NOT a silent catch).
 *   2. isPlantArtifactBasename(name) — basenames containing the UPPERCASE
 *      DO_NOT_COMMIT / PLANTED markers are sentinel plant artifacts by repo
 *      convention and are excluded from the three baseline-delta checks'
 *      walks. The match is CASE-SENSITIVE on purpose: the 75odq / ej9k1
 *      sentinels plant lowercase `planted.test.mjs` / `plantedService.mjs`
 *      and REQUIRE their check to fire on them.
 *
 * This suite proves, sentinel-positive (OPTIMAL_FIX_DISCIPLINE §2):
 *   - the tolerance fires (notice + null) on a genuinely vanished file;
 *   - the tolerance does NOT swallow non-ENOENT errors;
 *   - the enumerate-then-delete-then-read sequence (the exact crash shape)
 *     completes without throwing;
 *   - the real silent-cleanup-catch check IGNORES a planted violation in a
 *     DO_NOT_COMMIT / PLANTED-named file (walker exclusion) but STILL FIRES
 *     on the same violation under a normal name (no detection weakening);
 *   - all three named checks are actually WIRED through the tolerant reader
 *     and the plant exclusion (so the unit proofs transfer to the checks).
 */

import { describe, it, expect, afterEach, jest } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  isPlantArtifactBasename,
  readScannedFileSyncTolerant,
  readdirSyncTolerant,
  walkFiles,
} from '../../../scripts/lib/doctrine-scan-patterns.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const CHECK_DIR = path.join(REPO_ROOT, 'scripts', 'doctrine-checks');
const SILENT_CATCH_CHECK = path.join(CHECK_DIR, 'check-no-new-silent-cleanup-catch.mjs');
// Scratch dir INSIDE the silent-cleanup-catch check's scan scope (backend/**)
// so end-to-end plants are actually walked by the real check.
const SCRATCH_DIR = path.join(REPO_ROOT, 'backend', '__tests__', '_q7lqz_vanished_scan_scratch');

// Build the forbidden silent-catch literal by concatenation so the SOURCE of
// THIS sentinel file never contains the bare pattern (which would trip the
// silent-cleanup-catch gate on this file itself). Same technique as the
// 75odq sentinel (silentCleanupCatchDoctrine.sentinel.test.mjs).
const DOT = '.';
const ARROW = '=> {})';
const VIOLATION_SRC = [
  "import { test } from '@jest/globals';",
  "test('placeholder', async () => {",
  `  await Promise${DOT}reject(new Error('x'))${DOT}catch(() ${ARROW};`,
  '});',
  '',
].join('\n');

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(SCRATCH_DIR, { recursive: true, force: true });
});

function runSilentCatchCheck() {
  return spawnSync('node', [SILENT_CATCH_CHECK], { cwd: REPO_ROOT, encoding: 'utf8' });
}

describe('isPlantArtifactBasename (Equoria-q7lqz)', () => {
  it('matches the UPPERCASE plant-artifact markers', () => {
    expect(isPlantArtifactBasename('__doctrine_jest_plant_DO_NOT_COMMIT__.test.mjs')).toBe(true);
    expect(isPlantArtifactBasename('q7lqz_PLANTED_artifact.test.mjs')).toBe(true);
  });

  it('is CASE-SENSITIVE: lowercase planted names are NOT excluded (75odq/ej9k1 sentinels depend on this)', () => {
    // silentCleanupCatchDoctrine.sentinel.test.mjs plants `planted.test.mjs`
    // and rethrowAfterLogDoctrine.sentinel.test.mjs plants
    // `plantedService.mjs` — both REQUIRE the check to fire on them.
    expect(isPlantArtifactBasename('planted.test.mjs')).toBe(false);
    expect(isPlantArtifactBasename('plantedService.mjs')).toBe(false);
    expect(isPlantArtifactBasename('ordinaryFile.test.mjs')).toBe(false);
  });
});

describe('walkFiles plant-artifact exclusion (Equoria-70pb9)', () => {
  // walkFiles() now excludes plant-artifact basenames by DEFAULT. These prove,
  // sentinel-positive (OPTIMAL_FIX_DISCIPLINE §2):
  //   - the default walk OMITS a DO_NOT_COMMIT / PLANTED file present on disk;
  //   - includePlantArtifacts:true OPTS BACK IN so a deliberate plant is seen;
  //   - the exclusion is CASE-SENSITIVE (lowercase planted.* still walked), so
  //     the 75odq/ej9k1 sentinels that plant lowercase fixtures keep firing.
  const INCLUDE_ALL = { skipDir: () => false, includeFile: () => true };

  it('SENTINEL: default walk EXCLUDES a DO_NOT_COMMIT-named file that is on disk', () => {
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
    const marker = path.join(SCRATCH_DIR, 'leftover_DO_NOT_COMMIT.test.mjs');
    const plantedUpper = path.join(SCRATCH_DIR, 'q7lqz_PLANTED_thing.mjs');
    const ordinary = path.join(SCRATCH_DIR, 'ordinary.test.mjs');
    fs.writeFileSync(marker, '// 70pb9 marker fixture\n', 'utf8');
    fs.writeFileSync(plantedUpper, '// 70pb9 PLANTED fixture\n', 'utf8');
    fs.writeFileSync(ordinary, '// 70pb9 ordinary fixture\n', 'utf8');

    const walked = walkFiles([SCRATCH_DIR], INCLUDE_ALL);
    expect(walked).toContain(ordinary);
    expect(walked).not.toContain(marker);
    expect(walked).not.toContain(plantedUpper);
  });

  it('SENTINEL: includePlantArtifacts:true OPTS BACK IN — marker files are walked', () => {
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
    const marker = path.join(SCRATCH_DIR, 'wanted_DO_NOT_COMMIT.test.mjs');
    fs.writeFileSync(marker, '// 70pb9 opt-in fixture\n', 'utf8');

    const excluded = walkFiles([SCRATCH_DIR], INCLUDE_ALL);
    expect(excluded).not.toContain(marker);

    const included = walkFiles([SCRATCH_DIR], { ...INCLUDE_ALL, includePlantArtifacts: true });
    expect(included).toContain(marker);
  });

  it('is CASE-SENSITIVE: lowercase planted.* fixtures are STILL walked by default (75odq/ej9k1)', () => {
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
    const lower = path.join(SCRATCH_DIR, 'planted.test.mjs');
    fs.writeFileSync(lower, '// 70pb9 lowercase fixture\n', 'utf8');

    const walked = walkFiles([SCRATCH_DIR], INCLUDE_ALL);
    expect(walked).toContain(lower);
  });
});

describe('readScannedFileSyncTolerant (Equoria-q7lqz)', () => {
  it('returns file content for an existing file (no notice)', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
    const f = path.join(SCRATCH_DIR, 'present.txt');
    fs.writeFileSync(f, 'hello-q7lqz', 'utf8');
    expect(readScannedFileSyncTolerant(f, 'q7lqz-test')).toBe('hello-q7lqz');
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('SENTINEL: tolerates ENOENT — returns null and prints the one-line notice', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const missing = path.join(SCRATCH_DIR, 'never-existed-q7lqz.test.mjs');
    expect(readScannedFileSyncTolerant(missing, 'q7lqz-test')).toBeNull();
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy.mock.calls[0][0]).toBe(`[q7lqz-test] notice: skipped vanished file ${missing}`);
  });

  it('SENTINEL: does NOT tolerate non-ENOENT errors — rethrows (no silent catch)', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
    // Reading a DIRECTORY fails with EISDIR (or EPERM on some platforms) —
    // either way it is not ENOENT and must propagate.
    let thrown;
    try {
      readScannedFileSyncTolerant(SCRATCH_DIR, 'q7lqz-test');
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeDefined();
    expect(thrown.code).not.toBe('ENOENT');
    expect(errSpy).not.toHaveBeenCalled(); // no notice on the rethrow path
  });

  it('SENTINEL: the exact crash shape — enumerate, delete one file, read all — completes without throwing', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
    const vanishing = path.join(SCRATCH_DIR, 'vanishes.test.mjs');
    const surviving = path.join(SCRATCH_DIR, 'survives.test.mjs');
    fs.writeFileSync(vanishing, '// q7lqz vanishing fixture\n', 'utf8');
    fs.writeFileSync(surviving, '// q7lqz surviving fixture\n', 'utf8');

    const files = walkFiles([SCRATCH_DIR], {
      skipDir: () => false,
      includeFile: name => name.endsWith('.test.mjs'),
    });
    expect(files.sort()).toEqual([surviving, vanishing].sort());

    // The mid-scan deletion that crashed the check pre-fix:
    fs.rmSync(vanishing);

    const results = files.map(f => readScannedFileSyncTolerant(f, 'q7lqz-test'));
    const byPath = new Map(files.map((f, i) => [f, results[i]]));
    expect(byPath.get(vanishing)).toBeNull();
    expect(byPath.get(surviving)).toBe('// q7lqz surviving fixture\n');
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy.mock.calls[0][0]).toContain('notice: skipped vanished file');
  });
});

describe('readdirSyncTolerant (Equoria-8nq7i)', () => {
  // The DIRECTORY-level twin of readScannedFileSyncTolerant. Before 8nq7i,
  // check-no-test-only-imports.mjs's LOCAL walkFiles() recursion read the
  // directory via `try { readdirSync } catch { return }` — swallowing ALL
  // readdir errors, not just the legitimate ENOENT (a directory that vanished
  // mid-scan). That is the same silent-catch-on-non-ENOENT defect class one
  // level up (directory vs file). These prove, sentinel-positive
  // (OPTIMAL_FIX_DISCIPLINE §2):
  //   - a real directory's entries are returned (no notice);
  //   - a vanished directory (ENOENT) yields [] + a one-line notice (skipped);
  //   - a NON-ENOENT readdir error (simulated EACCES) is RETHROWN, not
  //     swallowed — the check must crash on a real environment fault.

  it('returns directory entries for an existing directory (no notice)', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
    fs.writeFileSync(path.join(SCRATCH_DIR, 'a.mjs'), '// 8nq7i\n', 'utf8');
    fs.writeFileSync(path.join(SCRATCH_DIR, 'b.mjs'), '// 8nq7i\n', 'utf8');

    const entries = readdirSyncTolerant(SCRATCH_DIR, { withFileTypes: true }, '8nq7i-test');
    const names = entries.map(e => e.name).sort();
    expect(names).toEqual(['a.mjs', 'b.mjs']);
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('SENTINEL: tolerates ENOENT — returns [] and prints the one-line notice', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const missingDir = path.join(SCRATCH_DIR, 'never-existed-8nq7i-dir');
    const entries = readdirSyncTolerant(missingDir, { withFileTypes: true }, '8nq7i-test');
    expect(entries).toEqual([]);
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy.mock.calls[0][0]).toBe(
      `[8nq7i-test] notice: skipped vanished directory ${missingDir}`,
    );
  });

  it('SENTINEL: does NOT tolerate a non-ENOENT readdir error (simulated EACCES) — rethrows (no silent catch)', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
    const target = path.join(SCRATCH_DIR, 'guarded-dir');
    fs.mkdirSync(target, { recursive: true });

    // Simulate a real environment fault (EACCES) that is NOT a vanished
    // directory. readdirSyncTolerant must let it propagate, NOT swallow it.
    const eacces = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    const readdirSpy = jest.spyOn(fs, 'readdirSync').mockImplementation(() => {
      throw eacces;
    });

    let thrown;
    try {
      readdirSyncTolerant(target, { withFileTypes: true }, '8nq7i-test');
    } catch (err) {
      thrown = err;
    }
    readdirSpy.mockRestore();

    expect(thrown).toBe(eacces);
    expect(thrown.code).toBe('EACCES');
    expect(thrown.code).not.toBe('ENOENT');
    expect(errSpy).not.toHaveBeenCalled(); // no notice on the rethrow path
  });
});

describe('check-no-test-only-imports.mjs directory recursion is WIRED through readdirSyncTolerant (Equoria-8nq7i)', () => {
  // The check uses its OWN local walkFiles() generator (not the shared
  // walkFiles). Its directory recursion must route through the shared
  // readdirSyncTolerant so a non-ENOENT readdir error is rethrown rather than
  // swallowed by a bare `catch { return }`. Source-level wiring assertion so a
  // future refactor that reintroduces the bare catch fails this sentinel.
  it('imports readdirSyncTolerant from the shared lib and no longer uses a bare readdirSync catch', () => {
    const src = fs.readFileSync(path.join(CHECK_DIR, 'check-no-test-only-imports.mjs'), 'utf8');
    expect(src).toContain('readdirSyncTolerant(');
    expect(src).toContain("from '../lib/doctrine-scan-patterns.mjs'");
    // The bare `readdirSync(dir, …)` call inside the local walk is gone — the
    // recursion now goes through the tolerant helper.
    expect(src).not.toMatch(/\breaddirSync\s*\(/);
  });
});

describe('walker-level plant-artifact exclusion on the REAL check (Equoria-q7lqz)', () => {
  it('IGNORES a violation in a DO_NOT_COMMIT-named file (plant artifacts are excluded)', () => {
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
    fs.writeFileSync(path.join(SCRATCH_DIR, 'q7lqz_excluded_DO_NOT_COMMIT.test.mjs'), VIOLATION_SRC, 'utf8');
    const res = runSilentCatchCheck();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/silent-cleanup-catch.*OK/);
  });

  it('IGNORES a violation in a PLANTED-named file (plant artifacts are excluded)', () => {
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
    fs.writeFileSync(path.join(SCRATCH_DIR, 'q7lqz_excluded_PLANTED.test.mjs'), VIOLATION_SRC, 'utf8');
    const res = runSilentCatchCheck();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/silent-cleanup-catch.*OK/);
  });

  it('SENTINEL-POSITIVE: still FIRES on the same violation under a normal name (exclusion did not weaken detection)', () => {
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
    fs.writeFileSync(path.join(SCRATCH_DIR, 'q7lqz_ordinary_name.test.mjs'), VIOLATION_SRC, 'utf8');
    const res = runSilentCatchCheck();
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/silent-cleanup-catch.*FAIL/);
    expect(res.stderr).toMatch(/q7lqz_ordinary_name\.test\.mjs/);
  });
});

describe('the three named checks are WIRED through the tolerance + exclusion (Equoria-q7lqz)', () => {
  const WIRED_CHECKS = [
    'check-no-new-silent-cleanup-catch.mjs',
    'check-no-new-rethrow-after-log.mjs',
    'check-no-new-api-client-vi-mock.mjs',
  ];

  it.each(WIRED_CHECKS)('%s routes reads through readScannedFileSyncTolerant and excludes plant artifacts', name => {
    const src = fs.readFileSync(path.join(CHECK_DIR, name), 'utf8');
    expect(src).toContain('readScannedFileSyncTolerant(');
    expect(src).toContain('isPlantArtifactBasename(');
    // The tolerant reader must come from the shared lib, not a local copy.
    expect(src).toContain("from '../lib/doctrine-scan-patterns.mjs'");
  });
});

describe('the migrated source-tree-walking checks are WIRED through the tolerant reader (Equoria-7avnu)', () => {
  // These checks walk the backend/frontend SOURCE/TEST trees and then
  // readFileSync the enumerated files — the exact q7lqz race surface (a
  // concurrent jest sentinel suite can plant+delete a temp file between the
  // walk and the read). Each must route its per-file read through the shared
  // readScannedFileSyncTolerant so a vanished file is skipped (ENOENT-only,
  // loudly) instead of crashing the whole check.
  //
  // NOTE (deliberate asymmetry vs. the baseline-delta block above): these
  // checks must NOT add isPlantArtifactBasename() exclusion. Their
  // sentinel-positive proofs (doctrineScanPatterns.sentinel.test.mjs,
  // Equoria-4iudq/ml7jj) plant `*_DO_NOT_COMMIT_*` violations and assert the
  // check FIRES on them — excluding plants would silently disarm those proofs.
  // The library documents this at the isPlantArtifactBasename definition.
  const MIGRATED_CHECKS = [
    'check-no-cleanup-routes.mjs',
    'check-no-db-mocks.mjs',
    'check-no-frontend-mocks.mjs',
    'check-no-graceful-skip.mjs',
    'check-no-unversioned-api.mjs',
    'check-no-prisma-in-routes.mjs',
    'check-no-placeholder-tests.mjs',
    'check-security-middleware-tested.mjs',
    'check-no-test-only-imports.mjs',
  ];

  it.each(MIGRATED_CHECKS)(
    '%s routes its enumerated-file read through readScannedFileSyncTolerant from the shared lib',
    name => {
      const src = fs.readFileSync(path.join(CHECK_DIR, name), 'utf8');
      expect(src).toContain('readScannedFileSyncTolerant(');
      expect(src).toContain("from '../lib/doctrine-scan-patterns.mjs'");
      // The per-file read must SKIP (continue) on a vanished file, not crash.
      expect(src).toContain('=== null');
    },
  );

  it.each(MIGRATED_CHECKS)('%s no longer reads an enumerated/walked file via a bare fs.readFileSync', name => {
    const src = fs.readFileSync(path.join(CHECK_DIR, name), 'utf8');
    // Bare reads of FIXED paths (e.g. a baseline JSON, an override file) are
    // fine — those cannot vanish mid-scan. Walked-file reads inside the scan
    // loop are the q7lqz surface and must go through the tolerant reader.
    // The migrated checks read the scanned file from a `for (... of walk...)`
    // (or equivalent) loop variable; after migration that read is the
    // tolerant reader, so no `readFileSync(<loop-var>` of the scanned file
    // should remain. We assert the common scanned-file variable names used
    // by these checks are not passed to a bare readFileSync.
    const bareScannedRead =
      /\bfs\.readFileSync\(\s*(?:file|f|tf|absPath)\b/.test(src) ||
      /\breadFileSync\(\s*(?:file|f|tf|absPath)\b/.test(src);
    expect(bareScannedRead).toBe(false);
  });
});
