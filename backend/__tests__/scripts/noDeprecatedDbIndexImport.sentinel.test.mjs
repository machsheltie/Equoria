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

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');
const BACKEND_ROOT = path.join(REPO_ROOT, 'backend');

// Matches `db/index.mjs` or `db/index` referenced from any relative path,
// in any import-like position. Allows `.mjs` extension to be optional
// (some test files used the bare `db/index` form historically), and
// matches inside both single and double quotes. The leading group
// `['"]\s*(?:[./\\]+)+` ensures we only flag actual import-path strings
// (relative paths with `.` / `..` / slashes), never arbitrary text that
// happens to contain `db/index.mjs` (e.g. a verbose log line).
const DB_INDEX_IMPORT_PATTERN = /['"]\s*(?:[.\\/]+)+db\/index(?:\.mjs)?\s*['"]/;

// This test file itself contains documentation references to the
// deprecated path so the patterns above will match against it. Excluded
// so the sentinel does not self-match.
const SELF_TEST_PATH = path.normalize('backend/__tests__/scripts/noDeprecatedDbIndexImport.sentinel.test.mjs');

/**
 * Walk backend/ recursively, returning every .mjs path. Skips node_modules,
 * .archive, coverage, dist, build.
 */
function walkMjs(root) {
  const out = [];
  function recurse(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
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
      const source = fs.readFileSync(filePath, 'utf8');
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
