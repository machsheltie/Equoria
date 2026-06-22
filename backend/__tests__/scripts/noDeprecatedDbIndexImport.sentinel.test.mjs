/**
 * Equoria-4wl0r — Sentinel: no backend *.mjs may import the deprecated
 * `backend/db/index.mjs` Prisma re-export shim.
 *
 * The shim was a thin wrapper that re-exported the default Prisma client
 * from `packages/database/prismaClient.mjs`. Having both paths live
 * concurrently produced two module instances under pnpm hoisting and
 * worktree node_modules junctions, manifesting as cross-realm
 * `instanceof Date` failures (Equoria-s20o cronJobs.mjs documents the
 * historical workaround) and a latent double-connection-pool risk.
 *
 * The shim is deleted; this sentinel locks in the migration:
 *
 *   - Static imports:  `import x from '<...>/db/index.mjs'`
 *   - Dynamic imports: `await import('<...>/db/index.mjs')`
 *   - Path-joined dynamic: `await import(join(__dirname, '<...>/db/index.mjs'))`
 *
 * Any of the above re-introduced in any backend *.mjs fails this test.
 *
 * PLANTED-VIOLATION proof (OPTIMAL_FIX §2): tests below assert the regex
 * matches synthetic violation source strings. A passing-but-vacuous
 * detector would silently degrade and the next contributor that
 * accidentally re-adds the shim would not be caught — the sentinel-
 * positive cases prevent that.
 *
 * Pure static scan: reads source files, regex-matches. No DB, no spawn.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test, expect } from '@jest/globals';
import {
  isReservedScratchPlantPathSegment,
  readScannedFileSyncTolerant,
} from '../../../scripts/lib/doctrine-scan-patterns.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');
const BACKEND_ROOT = path.join(REPO_ROOT, 'backend');
// Equoria-u70px/hpgl3: the repo-root tests/ directory lives OUTSIDE backend/
// and so escaped the original backend-only walk. Two root suites (breeds,
// progression) kept importing the deleted db/index.mjs and only failed at
// runtime (suite-load error), not at sentinel time. Scanning root tests/ here
// closes that gap so the regression class is caught statically.
const ROOT_TESTS_ROOT = path.join(REPO_ROOT, 'tests');

// Matches `db/index.mjs` or `db/index` referenced from any relative import
// path, in any import-like position. Allows `.mjs` to be optional (some test
// files used the bare `db/index` form historically), and matches inside both
// single and double quotes.
//
// Equoria-hpgl3 FIX: the prior pattern `['"]\s*(?:[.\\/]+)+db\/index...` only
// matched when `db/index` was preceded SOLELY by `.`/`/`/`\` segments — so a
// path with an intermediate NAMED directory like `../backend/db/index.mjs`
// (the EXACT form the repo-root breeds + progression suites used) silently
// escaped the scan. That blind spot is precisely why those broken imports
// reached runtime instead of being caught statically. The pattern now allows
// optional intermediate path segments (`backend/`, `packages/foo/`, …) between
// the leading `./`|`../` and the trailing `db/index`, while still anchoring to
// a quoted relative-import string (leading `.`/`..` + slash) so arbitrary text
// that merely contains `db/index.mjs` (e.g. a verbose log line) is NOT flagged.
const DB_INDEX_IMPORT_PATTERN = /['"]\s*\.{1,2}[\\/](?:[\w.\\/-]*[\\/])?db\/index(?:\.mjs)?\s*['"]/;

// This test file itself contains documentation references to the
// deprecated path so the patterns above will match against it. Excluded
// so the sentinel does not self-match.
const SELF_TEST_PATH = path.normalize('backend/__tests__/scripts/noDeprecatedDbIndexImport.sentinel.test.mjs');

/**
 * Walk backend/ recursively, returning every .mjs path. Skips node_modules,
 * .archive, coverage, dist, build.
 *
 * Equoria-27lqy: also skips reserved scratch/plant path segments that sibling
 * scripts-dir sentinels plant + delete into the real backend tree mid-run
 * (e.g. `_v8l96_sentinel_*.mjs`, `__doctrine_jest_plant_*`,
 * `_q7lqz_vanished_scan_scratch/`). A foreign transient on disk at the instant
 * of THIS walk is not a defect in the repo's tracked source — reading it (or
 * racing its deletion) produced a ~50% concurrency flake. Excluding the
 * reserved basenames keeps the zero-violation assertion attributed to tracked
 * source only. The reserved tokens are sentinel-scratch inventions that never
 * appear in a real committed file's name, so this cannot mask a genuine
 * db/index.mjs import in tracked source. The directory `readdirSync` is also
 * ENOENT-tolerant: a scratch DIR can vanish between enumeration and recursion.
 */
function walkMjs(root) {
  const out = [];
  function recurse(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      // Equoria-27lqy: a scratch directory planted by a sibling sentinel can be
      // deleted between the parent's enumeration and this recursion. Tolerate
      // ONLY ENOENT (a vanished dir contributes zero files); rethrow anything
      // else (EACCES, EMFILE, …) — a real fault must still crash the scan.
      if (err && err.code === 'ENOENT') {
        return;
      }
      throw err;
    }
    for (const e of entries) {
      // Skip reserved scratch/plant artifacts foreign sentinels leave on disk.
      if (isReservedScratchPlantPathSegment(e.name)) {
        continue;
      }
      if (e.isDirectory()) {
        if (['node_modules', '.archive', 'coverage', 'dist', 'build'].includes(e.name)) {
          continue;
        }
        recurse(path.join(dir, e.name));
      } else if (e.isFile() && e.name.endsWith('.mjs')) {
        out.push(path.join(dir, e.name));
      }
    }
  }
  recurse(root);
  return out;
}

/**
 * Strip line and block comments so doc mentions of the deprecated path
 * don't fire the regex. Approximate but adequate: false positives would
 * be the failure mode here (a comment that mentions `db/index.mjs` as
 * historical context is intentional, not a violation).
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('Equoria-4wl0r — no imports of deprecated backend/db/index.mjs shim', () => {
  test('DB_INDEX_IMPORT_PATTERN fires on a static-import violation (PLANTED)', () => {
    const synthetic = "import prisma from '../db/index.mjs';";
    expect(DB_INDEX_IMPORT_PATTERN.test(stripComments(synthetic))).toBe(true);
  });

  test('DB_INDEX_IMPORT_PATTERN fires on deeper-relative import (PLANTED)', () => {
    const synthetic = "import prisma from '../../../db/index.mjs';";
    expect(DB_INDEX_IMPORT_PATTERN.test(stripComments(synthetic))).toBe(true);
  });

  test('DB_INDEX_IMPORT_PATTERN fires on a dynamic-import violation (PLANTED)', () => {
    const synthetic = "const { default: prisma } = await import('../../db/index.mjs');";
    expect(DB_INDEX_IMPORT_PATTERN.test(stripComments(synthetic))).toBe(true);
  });

  test('DB_INDEX_IMPORT_PATTERN fires on a join(__dirname, ...) dynamic-import (PLANTED)', () => {
    const synthetic = "const { default: prisma } = await import(join(__dirname, '../../../db/index.mjs'));";
    expect(DB_INDEX_IMPORT_PATTERN.test(stripComments(synthetic))).toBe(true);
  });

  test('DB_INDEX_IMPORT_PATTERN fires on the repo-root tests/ shape (PLANTED)', () => {
    // Equoria-u70px: the exact shape the breeds/progression root suites used —
    // `../backend/db/index.mjs` (root tests/ reach DOWN into backend/db/).
    const synthetic = "import prisma from '../backend/db/index.mjs';";
    expect(DB_INDEX_IMPORT_PATTERN.test(stripComments(synthetic))).toBe(true);
  });

  test('detector ignores comment-only mentions (NEGATIVE CONTROL)', () => {
    const commentOnly = `
      // Historical: prior path was ../db/index.mjs — removed Equoria-4wl0r.
      /* Do not import '../../db/index.mjs' — the shim was deleted. */
      export function noop() {}
    `;
    expect(DB_INDEX_IMPORT_PATTERN.test(stripComments(commentOnly))).toBe(false);
  });

  test('detector ignores canonical-path imports (NEGATIVE CONTROL)', () => {
    const benign = `
      import prisma from '../../packages/database/prismaClient.mjs';
      const { default: x } = await import('../../packages/database/prismaClient.mjs');
    `;
    expect(DB_INDEX_IMPORT_PATTERN.test(stripComments(benign))).toBe(false);
  });

  test('no backend tree (*.mjs) imports the deprecated db/index.mjs path', () => {
    const files = walkMjs(BACKEND_ROOT);
    expect(files.length).toBeGreaterThan(100); // sanity

    const violations = [];
    for (const filePath of files) {
      const rel = path.relative(REPO_ROOT, filePath);
      if (path.normalize(rel) === SELF_TEST_PATH) {
        continue;
      }
      // Equoria-27lqy: tolerate a file that vanished between the walk and the
      // read (a sibling sentinel deleting its transient plant). ENOENT → null →
      // skip; any other error rethrows inside the helper.
      const source = readScannedFileSyncTolerant(filePath, 'noDeprecatedDbIndexImport');
      if (source === null) {
        continue;
      }
      const stripped = stripComments(source);
      if (DB_INDEX_IMPORT_PATTERN.test(stripped)) {
        violations.push(rel);
      }
    }

    expect(violations).toEqual([]);
  });

  // Equoria-u70px/hpgl3: repo-root tests/ is a SEPARATE walk root (outside
  // backend/). The breeds + progression suites that motivated this extension
  // are migrated to packages/database/prismaClient.mjs, so this must be green.
  test('no repo-root tests/ (*.mjs) imports the deprecated db/index.mjs path', () => {
    const files = walkMjs(ROOT_TESTS_ROOT);
    expect(files.length).toBeGreaterThan(0); // sanity: the dir exists and has suites

    const violations = [];
    for (const filePath of files) {
      const rel = path.relative(REPO_ROOT, filePath);
      // Equoria-27lqy: tolerate a file that vanished mid-walk (see above).
      const source = readScannedFileSyncTolerant(filePath, 'noDeprecatedDbIndexImport');
      if (source === null) {
        continue;
      }
      const stripped = stripComments(source);
      if (DB_INDEX_IMPORT_PATTERN.test(stripped)) {
        violations.push(rel);
      }
    }

    expect(violations).toEqual([]);
  });

  test('backend/db/index.mjs shim file is deleted', () => {
    const shimPath = path.join(BACKEND_ROOT, 'db', 'index.mjs');
    expect(fs.existsSync(shimPath)).toBe(false);
  });
});
