/**
 * Error-message leak sentinel (Equoria-rv3fd)
 *
 * The anti-pattern this sentinel catches:
 *
 *   error: process.env.NODE_ENV !== 'production' ? error.message : 'fallback'
 *
 * Why it leaks: the project explicitly uses `beta` and `beta-readiness`
 * NODE_ENV values for tester-facing deployments. `!== 'production'` is true
 * in BOTH of those envs, so the raw `error.message` (which can include
 * Prisma column names, table names, validation paths, and constraint
 * details) flows to the client. This is a reconnaissance surface against
 * live beta — exactly the recon Constitution §2 forbids.
 *
 * The fix shape: gate the verbose error on `=== 'development'` (or route
 * through the central `errorHandler.mjs` which already has production-only
 * stack policy). Either makes beta / beta-readiness return the generic
 * fallback while preserving local debugging.
 *
 * Why source-text sentinel (not HTTP test): forcing a real 500 in 19
 * different controller/route bodies requires either monkey-patching the
 * service layer per-route or planting fault-injection hooks — both add
 * production-surface complexity. The literal source-text pattern is a
 * crisp, low-noise check that catches every reintroduction and runs in
 * <100ms. Cross-references:
 *   - .claude/rules/SECURITY.md A09 (logging / monitoring)
 *   - CLAUDE.md Constitution §2 (beta as falsifiable test)
 *   - .claude/rules/OPTIMAL_FIX_DISCIPLINE.md §2 (sentinel-positive test
 *     required for every check)
 *
 * Adjacent locations checked at filing (2026-05-28):
 *   - `backend/utils/emailService.mjs` uses `NODE_ENV !== 'production'`
 *     for dev-path GATING (suppress real email sends in dev/beta), not
 *     for error-message leak. Different concern, intentionally excluded.
 *   - All other matches of the literal ternary live in horseRoutes.mjs
 *     and horseController.mjs — the 19 sites this sentinel covers.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = resolve(__dirname, '..');

/**
 * Recursively collect every .mjs / .js file under `dir`, skipping
 * `node_modules`, `coverage*`, `dist`, `build`, and any `__tests__` /
 * `tests` directory (tests can talk about the anti-pattern in literals;
 * production code cannot ship it).
 */
function collectSourceFiles(dir) {
  const out = [];
  const skip = new Set([
    'node_modules',
    'coverage',
    'coverage-security',
    'dist',
    'build',
    '__tests__',
    'tests',
    'eslint-plugins', // plugin source can literally encode the pattern
  ]);
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (entry.endsWith('.mjs') || entry.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

// The exact anti-pattern: `NODE_ENV !== 'production'` (single or double
// quotes) used as the test of a ternary whose true-branch is `error.message`.
// Matches the canonical leak form; does NOT match the safe `=== 'development'`
// form, nor `NODE_ENV !== 'production'` used for non-error gating (e.g.,
// suppressing real email sends).
const LEAK_PATTERN = /NODE_ENV\s*!==\s*['"]production['"]\s*\?\s*[\w.]*error\.message/;

describe('Error-message leak sentinel (Equoria-rv3fd)', () => {
  const files = collectSourceFiles(BACKEND_ROOT);

  it('finds at least one backend source file (sanity)', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('no production source file gates error.message on NODE_ENV !== production', () => {
    const offenders = [];
    for (const file of files) {
      // The ESLint config legitimately encodes the anti-pattern as a
      // rule-message literal; exclude it. Other config files are not
      // scanned for the same reason — the rule lives in source code, not
      // config.
      if (file.endsWith('eslint.config.mjs') || file.endsWith('eslint.config.js')) {
        continue;
      }
      const src = readFileSync(file, 'utf8');
      const lines = src.split('\n');
      lines.forEach((line, idx) => {
        // Ignore comment-only lines (`//` or `*` continuation) — docs may
        // legitimately reference the anti-pattern when explaining the fix.
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
          return;
        }
        if (LEAK_PATTERN.test(line)) {
          offenders.push(`${file}:${idx + 1}: ${trimmed}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  // Sentinel-positive: prove the regex fires on the canonical leak form,
  // so a future refactor that breaks the regex (e.g., a stray whitespace
  // change to LEAK_PATTERN) cannot silently turn this sentinel into a
  // no-op. Per OPTIMAL_FIX_DISCIPLINE.md §2 — "a check without a positive
  // test is a placebo".
  describe('LEAK_PATTERN positive proofs', () => {
    it('fires on the single-quoted canonical form', () => {
      const sample =
        "error: process.env.NODE_ENV !== 'production' ? error.message : 'Something went wrong',";
      expect(LEAK_PATTERN.test(sample)).toBe(true);
    });

    it('fires on the double-quoted canonical form', () => {
      const sample =
        'error: process.env.NODE_ENV !== "production" ? error.message : "Something went wrong",';
      expect(LEAK_PATTERN.test(sample)).toBe(true);
    });

    it('fires on the err.message variant (shorthand)', () => {
      const sample = "msg: process.env.NODE_ENV !== 'production' ? err.error.message : 'fallback'";
      expect(LEAK_PATTERN.test(sample)).toBe(true);
    });

    it('does NOT fire on the safe === development form', () => {
      const sample =
        "error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',";
      expect(LEAK_PATTERN.test(sample)).toBe(false);
    });

    it('does NOT fire on non-error gating (e.g., emailService dev guards)', () => {
      const sample = "if (process.env.NODE_ENV !== 'production') { return mockSendMail(); }";
      expect(LEAK_PATTERN.test(sample)).toBe(false);
    });
  });
});
