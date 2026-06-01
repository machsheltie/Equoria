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

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');
const BACKEND_ROOT = path.join(REPO_ROOT, 'backend');

// Forbidden patterns. Both detect the construct in real code; both are
// stripped of comments before matching so that documentation mentions do
// not false-flag.
const CREATE_REQUIRE_PATTERN = /createRequire\s*\(\s*import\.meta\.url\s*\)/;
const MODULE_EXPORTS_PATTERN = /(?:^|[^.\w])(?:module\.exports|exports\.\w+)\s*=/m;

// Allowlist of currently-known violations that have their own tracking issue.
// REMOVE entries here as those issues land — do not let this list grow.
// (Equoria-3f0yx removed 2026-05-28 after authController migrated to native
// ESM JSON imports.)
const ALLOWLIST = [];

// Test file itself contains the patterns it detects (planted-violation
// synthetic + this comment). Excluded so the sentinel does not self-match.
const SELF_TEST_PATH = path.normalize('backend/__tests__/scripts/noCommonJsInMjs.sentinel.test.mjs');

function isAllowed(relPath) {
  const norm = path.normalize(relPath);
  return ALLOWLIST.includes(norm);
}

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
 * Strip line and block comments so doc mentions of the patterns don't fire
 * the regex. Approximate but adequate: we never need to be exact about what
 * is "code" vs "comment" — false positives would be the failure mode and
 * none have been observed.
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('Equoria-6gcvi — NO COMMONJS MIXING in backend tree (*.mjs)', () => {
  test('CREATE_REQUIRE_PATTERN fires on a synthetic violation (PLANTED)', () => {
    const synthetic = `import { createRequire } from 'module';
const require = createRequire(import.meta.url);`;
    expect(CREATE_REQUIRE_PATTERN.test(stripComments(synthetic))).toBe(true);
  });

  test('MODULE_EXPORTS_PATTERN fires on a synthetic violation (PLANTED)', () => {
    const synthetic = `function foo() {}
module.exports = foo;`;
    expect(MODULE_EXPORTS_PATTERN.test(stripComments(synthetic))).toBe(true);

    const namedExports = 'exports.bar = function () {};';
    expect(MODULE_EXPORTS_PATTERN.test(stripComments(namedExports))).toBe(true);
  });

  test('detector ignores comment-only mentions (NEGATIVE CONTROL)', () => {
    const commentOnly = `
      // Do not use createRequire(import.meta.url) — it's banned.
      /* module.exports = ... is also forbidden. */
      export function noop() {}
    `;
    expect(CREATE_REQUIRE_PATTERN.test(stripComments(commentOnly))).toBe(false);
    expect(MODULE_EXPORTS_PATTERN.test(stripComments(commentOnly))).toBe(false);
  });

  test('detector ignores property-access dot prefix (e.g. `foo.module.exports`)', () => {
    // The (?:^|[^.\w]) prefix prevents false positives on properties named
    // .exports on namespaced objects.
    const benign = 'const x = foo.module.exports;';
    expect(MODULE_EXPORTS_PATTERN.test(stripComments(benign))).toBe(false);
  });

  test('no backend tree (*.mjs) uses createRequire (outside allowlist)', () => {
    const files = walkMjs(BACKEND_ROOT);
    expect(files.length).toBeGreaterThan(100); // sanity

    const violations = [];
    for (const filePath of files) {
      const rel = path.relative(REPO_ROOT, filePath);
      if (isAllowed(rel) || path.normalize(rel) === SELF_TEST_PATH) {
        continue;
      }
      const source = fs.readFileSync(filePath, 'utf8');
      const stripped = stripComments(source);
      if (CREATE_REQUIRE_PATTERN.test(stripped)) {
        violations.push(rel);
      }
    }

    expect(violations).toEqual([]);
  });

  test('no backend tree (*.mjs) uses module.exports / exports.x = (no allowlist)', () => {
    const files = walkMjs(BACKEND_ROOT);

    const violations = [];
    for (const filePath of files) {
      const rel = path.relative(REPO_ROOT, filePath);
      if (path.normalize(rel) === SELF_TEST_PATH) {
        continue;
      }
      const source = fs.readFileSync(filePath, 'utf8');
      const stripped = stripComments(source);
      if (MODULE_EXPORTS_PATTERN.test(stripped)) {
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
      const filePath = path.join(REPO_ROOT, rel);
      if (!fs.existsSync(filePath)) {
        // File may have been moved/deleted by the linked fix — that's fine,
        // but the entry needs cleanup too. Surface the staleness.
        throw new Error(`Allowlist references ${rel} but file does not exist. Remove the entry.`);
      }
      const source = fs.readFileSync(filePath, 'utf8');
      const stripped = stripComments(source);
      const stillViolates = CREATE_REQUIRE_PATTERN.test(stripped);
      if (!stillViolates) {
        throw new Error(
          `Allowlist entry ${rel} no longer matches the forbidden pattern. ` +
            'Remove it from ALLOWLIST so a re-introduction can be caught.',
        );
      }
    }
  });
});
