/**
 * 🛡️ STATIC SENTINEL: no unscoped `deleteMany()` / `deleteMany({})` in test files.
 *
 * Equoria-jcgid (systemic). CLAUDE.md §2: the Jest suite runs against the
 * CANONICAL (production) DB (`.env.test` -> real `equoria` DB). A bare
 * `prisma.<model>.deleteMany()` or `deleteMany({})` with NO `where` clause in
 * any test that the backend Jest project picks up therefore DELETES REAL
 * USER DATA when the full suite (pre-push hook / CI) runs. Empirically a
 * full-suite run zeroed `xp_events`, `competition_results`, and
 * `horse_xp_events` on the canonical DB; user/horse rows survived only by FK
 * accident.
 *
 * This is a STATIC sentinel: it reads test-file SOURCE with `fs` and never
 * executes the dangerous tests, so running THIS test cannot itself trigger a
 * wipe (OPTIMAL_FIX_DISCIPLINE §2 — the safe sentinel-positive). It fails the
 * moment a NEW unscoped `deleteMany()` is introduced into any backend or root
 * `tests/` test file.
 *
 * Sentinel-positive guarantee: against the pre-fix code (an unscoped
 * `deleteMany({})` present in a non-allowlisted file) this test FAILS; with
 * every such call scoped it PASSES. Verified by temporarily planting an
 * unscoped call in a scratch path during development.
 *
 * KNOWN-OFFENDER ALLOWLIST: now EMPTY. The three originally-allowlisted files
 * (owned by SEPARATE bd issues per anti-bundling, EDGE_CASE_FIX_DISCIPLINE §7)
 * have all landed their fixes, so each entry was removed (the second assertion
 * below enforces this — a stale entry whose file no longer has an unscoped
 * deleteMany fails the test, keeping the allowlist from rotting):
 *   - tests/leaderboardController.integration.test.mjs  -> Equoria-rofku  (FIXED)
 *   - tests/integration/breeds.test.mjs                 -> Equoria-lkady  (FIXED / relocated)
 *   - backend/scripts/cleanupAssignments.mjs            -> Equoria-2apsk  (FIXED)
 *
 * With an empty allowlist, ANY unscoped deleteMany in a scanned file now fails
 * the first assertion. Re-add an entry (with its owning bd issue) only if a new
 * legitimate-but-deferred offender is introduced.
 */

import { describe, it, expect } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// repoRoot = .../  (backend/__tests__ -> backend -> repo root)
const repoRoot = path.resolve(__dirname, '..', '..');

// Roots the backend Jest project scans (jest.config.js: roots + testMatch).
const SCAN_ROOTS = [path.join(repoRoot, 'backend'), path.join(repoRoot, 'tests')];

const SKIP_DIRS = new Set(['node_modules', 'coverage', 'dist', 'build', '.archive', '.backups', '.git']);

// Exact repo-relative paths (POSIX separators) of KNOWN unscoped-deleteMany
// files owned by sibling issues. See header. Remove an entry when its sibling
// issue scopes the call.
const KNOWN_OFFENDER_ALLOWLIST = new Set([
  // Empty: rofku, lkady, and 2apsk all landed their scoped-deleteMany fixes.
]);

// Unscoped deleteMany: `deleteMany()` or `deleteMany({})` (only whitespace
// inside the parens / braces). A scoped call — `deleteMany({ where: ... })` —
// has non-whitespace before the closing brace and is NOT matched. `\s` covers
// newlines, so a call split across lines (`deleteMany(\n{}\n)`) is still
// matched when the regex is run against the whole-file source.
const UNSCOPED_DELETE_MANY = /\.deleteMany\(\s*(?:\{\s*\})?\s*\)/;
const UNSCOPED_DELETE_MANY_GLOBAL = /\.deleteMany\(\s*(?:\{\s*\})?\s*\)/g;

function collectFiles(rootDir) {
  let entries;
  try {
    entries = readdirSync(rootDir, { withFileTypes: true, recursive: true });
  } catch {
    return []; // root may not exist in some checkouts
  }
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    // entry.parentPath (Node 20.12+/24) is the absolute dir of this entry.
    const dir = entry.parentPath ?? entry.path ?? rootDir;
    const abs = path.join(dir, entry.name);
    const rel = path.relative(repoRoot, abs).split(path.sep).join('/');
    if (rel.split('/').some(seg => SKIP_DIRS.has(seg))) {
      continue;
    }
    files.push({ abs, rel });
  }
  return files;
}

// Scan test files plus the cleanup script (it is in the 2apsk allowlist and we
// want the stale-allowlist check to see it).
function isScanTarget(rel) {
  if (/\.test\.(mjs|js)$/.test(rel)) {
    return true;
  }
  if (rel === 'backend/scripts/cleanupAssignments.mjs') {
    return true;
  }
  return false;
}

function scanAll() {
  const offenders = [];
  const seen = new Set();
  for (const root of SCAN_ROOTS) {
    for (const { abs, rel } of collectFiles(root)) {
      if (seen.has(rel)) {
        continue;
      }
      seen.add(rel);
      if (!isScanTarget(rel)) {
        continue;
      }
      let src;
      try {
        src = readFileSync(abs, 'utf8');
      } catch {
        continue;
      }
      // Blank out comment-only lines (preserving line count) so doc/comment
      // mentions of `deleteMany()` — e.g. this file's own header or
      // CLAUDE.md-style warnings — never count as offenders, in BOTH the
      // per-line and whole-file passes.
      const lines = src.split('\n');
      const codeLines = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
          return '';
        }
        return line;
      });

      const hits = [];
      codeLines.forEach((line, i) => {
        if (UNSCOPED_DELETE_MANY.test(line)) {
          hits.push(i + 1);
        }
      });

      // Whole-file pass (over comment-stripped source) catches a call split
      // across multiple lines (`deleteMany(\n{}\n)`) that the per-line pass
      // above misses. If whole-file matches exceed the per-line hits, the
      // surplus are multiline; record the offender with an approximate
      // "multiline" marker since exact line attribution is not meaningful.
      const codeSrc = codeLines.join('\n');
      UNSCOPED_DELETE_MANY_GLOBAL.lastIndex = 0;
      const wholeFileCount = (codeSrc.match(UNSCOPED_DELETE_MANY_GLOBAL) || []).length;
      if (wholeFileCount > hits.length) {
        hits.push('multiline');
      }
      if (hits.length) {
        offenders.push({ rel, lines: hits });
      }
    }
  }
  return offenders;
}

describe('🛡️ STATIC SENTINEL: no unscoped deleteMany in test files (Equoria-jcgid)', () => {
  const offenders = scanAll();
  const offenderPaths = new Set(offenders.map(o => o.rel));

  it('no NON-allowlisted test file contains an unscoped deleteMany() / deleteMany({})', () => {
    const unexpected = offenders.filter(o => !KNOWN_OFFENDER_ALLOWLIST.has(o.rel));
    if (unexpected.length) {
      const detail = unexpected.map(o => `  - ${o.rel} (lines ${o.lines.join(', ')})`).join('\n');
      throw new Error(
        'Unscoped deleteMany() found in test file(s) that run against the CANONICAL DB ' +
          '(CLAUDE.md §2). Scope every cleanup with a where-clause ' +
          `(\`where: { id: { in: [...] } }\` or \`where: { name: { startsWith: 'TestFixture-' } }\`):\n${detail}`,
      );
    }
    expect(unexpected).toEqual([]);
  });

  it('every allowlisted known-offender still actually has an unscoped deleteMany (no stale allowlist)', () => {
    // When a sibling issue scopes its file, its allowlist entry must be removed.
    // This catches a stale entry so the allowlist cannot quietly rot.
    const stale = [...KNOWN_OFFENDER_ALLOWLIST].filter(p => !offenderPaths.has(p));
    if (stale.length) {
      throw new Error(
        'Stale KNOWN_OFFENDER_ALLOWLIST entries (file no longer has an unscoped ' +
          'deleteMany — its sibling issue was fixed). Remove these from the ' +
          `allowlist in noUnscopedDeleteManySentinel.test.mjs:\n${stale.map(p => `  - ${p}`).join('\n')}`,
      );
    }
    expect(stale).toEqual([]);
  });
});
