/**
 * Equoria-6gcvi — Sentinel for ES_MODULES_REQUIREMENTS.md "NO COMMONJS MIXING"
 * in backend tree (*.mjs).
 *
 * Two patterns are forbidden in any backend .mjs:
 *
 *   1. `createRequire(import.meta.url)` — gratuitous CJS bridge. ESM-native
 *      imports work for every dependency we use; the bridge exists only as a
 *      historical wart and provides nothing ESM cannot.
 *   2. `module.exports = ...` / `exports.x = ...` — pure CJS export form,
 *      incompatible with the project's `"type": "module"` posture.
 *
 * Allowlist (intentional, time-bounded):
 *
 *   (empty — Equoria-3f0yx closed; authController.mjs now uses the native
 *   ESM `import x from './x.json' with { type: 'json' }` form. Add a new
 *   entry only if a fresh violation is intentionally landed AND has its
 *   own bd issue tracking removal.)
 *
 * PLANTED-VIOLATION proof (OPTIMAL_FIX §2): tests below assert the regexes
 * match a synthetic violation source string. A passing-but-vacuous detector
 * would silently degrade — sentinel-positive catches that.
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
const repoRoot = path.resolve(path.dirname(__filename), '..', '..', '..');
const backendRoot = path.join(repoRoot, 'backend');

// Forbidden patterns. Both detect the construct in real code; both are
// stripped of comments before matching so that documentation mentions do
// not false-flag.
const createRequirePattern = /createRequire\s*\(\s*import\.meta\.url\s*\)/;
const moduleExportsPattern = /(?:^|[^.\w])(?:module\.exports|exports\.\w+)\s*=/m;

// Allowlist of currently-known violations that have their own tracking issue.
// REMOVE entries here as those issues land — do not let this list grow.
// (Equoria-3f0yx removed 2026-05-28 after authController migrated to native
// ESM JSON imports.)
const ALLOWLIST = [];

// Test file itself contains the patterns it detects (planted-violation
// synthetic + this comment). Excluded so the sentinel does not self-match.
const selfTestPath = path.normalize('backend/__tests__/scripts/noCommonJsInMjs.sentinel.test.mjs');

function isAllowed(relPath) {
  const norm = path.normalize(relPath);
  return ALLOWLIST.includes(norm);
}

/**
 * Walk backend/ recursively, returning every .mjs path. Skips node_modules,
 * .archive, coverage, dist, build.
 *
 * Equoria-27lqy: also skips reserved scratch/plant path segments that sibling
 * scripts-dir sentinels plant + delete into the real backend tree mid-run
 * (e.g. `_v8l96Sentinel*.mjs`, `__doctrineJestPlant_*`,
 * `_q7lqzVanishedScanScratch/`). A foreign transient on disk at the instant
 * of THIS walk is not a defect in the repo's tracked source — reading it (or
 * racing its deletion) produced a ~50% concurrency flake. Excluding the
 * reserved basenames keeps the zero-violation assertion attributed to tracked
 * source only. The reserved tokens are sentinel-scratch inventions that never
 * appear in a real committed file's name, so this cannot mask a genuine
 * CommonJS violation in tracked source. The directory `readdirSync` is also
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
 * Strip line and block comments so doc mentions of the patterns don't fire
 * the regex. Approximate but adequate: we never need to be exact about what
 * is "code" vs "comment" — false positives would be the failure mode and
 * none have been observed.
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('Equoria-6gcvi — NO COMMONJS MIXING in backend tree (*.mjs)', () => {
  test('createRequirePattern fires on a synthetic violation (PLANTED)', () => {
    const synthetic = `import { createRequire } from 'module';
const require = createRequire(import.meta.url);`;
    expect(createRequirePattern.test(stripComments(synthetic))).toBe(true);
  });

  test('moduleExportsPattern fires on a synthetic violation (PLANTED)', () => {
    const synthetic = `function foo() {}
module.exports = foo;`;
    expect(moduleExportsPattern.test(stripComments(synthetic))).toBe(true);

    const namedExports = 'exports.bar = function () {};';
    expect(moduleExportsPattern.test(stripComments(namedExports))).toBe(true);
  });

  test('detector ignores comment-only mentions (NEGATIVE CONTROL)', () => {
    const commentOnly = `
      // Do not use createRequire(import.meta.url) — it's banned.
      /* module.exports = ... is also forbidden. */
      export function noop() {}
    `;
    expect(createRequirePattern.test(stripComments(commentOnly))).toBe(false);
    expect(moduleExportsPattern.test(stripComments(commentOnly))).toBe(false);
  });

  test('detector ignores property-access dot prefix (e.g. `foo.module.exports`)', () => {
    // The (?:^|[^.\w]) prefix prevents false positives on properties named
    // .exports on namespaced objects.
    const benign = 'const x = foo.module.exports;';
    expect(moduleExportsPattern.test(stripComments(benign))).toBe(false);
  });

  test('no backend tree (*.mjs) uses createRequire (outside allowlist)', () => {
    const files = walkMjs(backendRoot);
    expect(files.length).toBeGreaterThan(100); // sanity

    const violations = [];
    for (const filePath of files) {
      const rel = path.relative(repoRoot, filePath);
      if (isAllowed(rel) || path.normalize(rel) === selfTestPath) {
        continue;
      }
      // Equoria-27lqy: tolerate a file that vanished between the walk and the
      // read (a sibling sentinel deleting its transient plant). ENOENT → null →
      // skip; any other error rethrows inside the helper.
      const source = readScannedFileSyncTolerant(filePath, 'noCommonJsInMjs');
      if (source === null) {
        continue;
      }
      const stripped = stripComments(source);
      if (createRequirePattern.test(stripped)) {
        violations.push(rel);
      }
    }

    expect(violations).toEqual([]);
  });

  test('no backend tree (*.mjs) uses module.exports / exports.x = (no allowlist)', () => {
    const files = walkMjs(backendRoot);

    const violations = [];
    for (const filePath of files) {
      const rel = path.relative(repoRoot, filePath);
      if (path.normalize(rel) === selfTestPath) {
        continue;
      }
      // Equoria-27lqy: tolerate a file that vanished mid-walk (see above).
      const source = readScannedFileSyncTolerant(filePath, 'noCommonJsInMjs');
      if (source === null) {
        continue;
      }
      const stripped = stripComments(source);
      if (moduleExportsPattern.test(stripped)) {
        violations.push(rel);
      }
    }

    expect(violations).toEqual([]);
  });

  test('allowlist entries are still in violation (regression guard for stale allowlist)', () => {
    // If an allowlisted file no longer matches the pattern, the entry should
    // be removed. This test prevents the allowlist from rotting into an
    // ineffective comment.
    for (const rel of ALLOWLIST) {
      const filePath = path.join(repoRoot, rel);
      if (!fs.existsSync(filePath)) {
        // File may have been moved/deleted by the linked fix — that's fine,
        // but the entry needs cleanup too. Surface the staleness.
        throw new Error(`Allowlist references ${rel} but file does not exist. Remove the entry.`);
      }
      const source = fs.readFileSync(filePath, 'utf8');
      const stripped = stripComments(source);
      const stillViolates = createRequirePattern.test(stripped);
      if (!stillViolates) {
        throw new Error(
          `Allowlist entry ${rel} no longer matches the forbidden pattern. ` +
            'Remove it from ALLOWLIST so a re-introduction can be caught.',
        );
      }
    }
  });
});
