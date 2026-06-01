/**
 * 🔒 Sentinel — forbid vacuous "feature not implemented" console.warn in test
 *    files (Equoria-igkff, Constitution §3 — tests exist to detect real failures)
 *
 * The eliminated anti-pattern:
 *
 *   if (limitReached) {
 *     expect(...).toBe(true);
 *   } else {
 *     console.warn('No groom hiring limit implemented yet - add this feature');
 *   }
 *
 * The `else` branch asserts NOTHING. The test passes whether the feature
 * exists or not — a false-confidence test, which Constitution §3 calls "worse
 * than no test." When the feature actually exists (as it did for both
 * groomHiringWorkflow cases), the warn line is also a misleading lie sitting
 * in the codebase indefinitely.
 *
 * This sentinel grep-scans all test files for the offending phrases. A new
 * occurrence MUST fail the test suite. If a test genuinely needs to mark a
 * missing-feature TODO, the correct shape is either (a) a real `expect(...)`
 * that fails until the feature lands (TDD red gate), or (b) a separately
 * filed `bd` issue + complete removal of the test stub. Either way, the warn
 * line is forbidden.
 *
 * Sentinel-positive verification: this test was authored against a planted
 * matching line and confirmed to fire; after removal of the two offending
 * occurrences in groomHiringWorkflow.test.mjs (lines 430, 455 pre-fix), the
 * scan returns zero — exactly what we want.
 *
 * Why a jest-level scan rather than an ESLint rule:
 *   - ESLint's test-files override at backend/eslint.config.mjs:236 already
 *     allows console.warn for legitimate diagnostic prints (globalSetup,
 *     teardown, load-test scaffolds — see the comment at lines 228-236).
 *   - Adding a custom no-restricted-syntax rule for THIS phrase only would
 *     conflate "vacuous TODO marker" with "legitimate diagnostic" and bloat
 *     the ESLint config. A targeted grep gate is the lower-overhead option
 *     for a single-phrase anti-pattern.
 */

import { describe, it, expect } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BACKEND_ROOT = resolve(__dirname, '..');

// Match `console.warn(...)` calls whose argument string is the vacuous TODO
// shape from Equoria-igkff. The phrases below are the literal patterns from
// the original anti-pattern; any new variation that telegraphs "feature
// missing" should be added here so the gate keeps catching drift.
const VACUOUS_PHRASES = [
  /not implemented yet/i,
  /implemented yet[^.]*-?\s*add this feature/i,
  /add this feature/i,
  /No \w+ implemented yet/i,
];

const CONSOLE_WARN_CALL = /console\.warn\s*\(\s*['"`]([^'"`]+)['"`]/g;

const SKIP_DIRS = new Set(['node_modules', '.git', 'coverage', 'dist', 'build', '.next', '.cache']);

const TEST_FILE_RE = /\.(test|spec|sentinel)\.m?js$/;

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue; // junction/broken-link defensive skip
    }
    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(entry)) {
        continue;
      }
      walk(full, acc);
    } else if (TEST_FILE_RE.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('🔒 Sentinel — no vacuous feature-warn in test files (Equoria-igkff)', () => {
  const testFiles = walk(BACKEND_ROOT);

  // Skip self — this file LEGITIMATELY contains the phrases inside string
  // literals as part of the regex definitions, and a self-match would create
  // an unbreakable false positive.
  const filesToScan = testFiles.filter(f => f !== __filename);

  it('discovers test files to scan', () => {
    // Guard against a path/glob regression silently scanning zero files.
    expect(filesToScan.length).toBeGreaterThan(50);
  });

  it('no test file contains the vacuous "feature not implemented" console.warn anti-pattern', () => {
    const violations = [];
    for (const file of filesToScan) {
      const src = readFileSync(file, 'utf8');
      CONSOLE_WARN_CALL.lastIndex = 0;
      let m;
      while ((m = CONSOLE_WARN_CALL.exec(src)) !== null) {
        const arg = m[1];
        for (const phrase of VACUOUS_PHRASES) {
          if (phrase.test(arg)) {
            // Report path relative to backend root for readability.
            const rel = file.slice(BACKEND_ROOT.length + 1).replace(/\\/g, '/');
            violations.push(`${rel}: "${arg}"`);
            break;
          }
        }
      }
    }
    if (violations.length > 0) {
      console.error(
        '[sentinel igkff] vacuous "feature not implemented" console.warn ' +
          'found in test files. Replace with a real expect() (TDD red gate) ' +
          'OR delete the test stub and file a bd issue for the missing ' +
          `feature. See Equoria-igkff for context.\n${violations.map(v => `  - ${v}`).join('\n')}`,
      );
    }
    expect(violations).toEqual([]);
  });
});
