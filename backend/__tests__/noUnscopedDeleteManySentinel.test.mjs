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
 * KNOWN-OFFENDER ALLOWLIST: three files still contain unscoped calls and are
 * owned by SEPARATE bd issues (anti-bundling, EDGE_CASE_FIX_DISCIPLINE §7).
 * They are allow-listed by exact relative path so this sentinel is GREEN today
 * yet still catches any NEW file. When a sibling lands its fix it MUST remove
 * its entry here (the entry then becomes a stale-allowlist failure surfaced by
 * the second assertion below), keeping the allowlist from rotting:
 *   - tests/leaderboardController.integration.test.mjs  -> Equoria-rofku
 *   - tests/integration/breeds.test.mjs                 -> Equoria-lkady
 *   - backend/scripts/cleanupAssignments.mjs            -> Equoria-2apsk (manual script, not a test)
 *
 * Note: `tests/integration/` is excluded from the backend Jest project via
 * jest.config.js testPathIgnorePatterns, so breeds.test.mjs is lower-risk
 * (never executed by the suite) but is still allow-listed for completeness so
 * the static scan does not have to special-case it.
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

const SKIP_DIRS = new Set([
  'node_modules',
  'coverage',
  'dist',
  'build',
  '.archive',
  '.backups',
  '.git',
]);

// Exact repo-relative paths (POSIX separators) of KNOWN unscoped-deleteMany
// files owned by sibling issues. See header. Remove an entry when its sibling
// issue scopes the call.
const KNOWN_OFFENDER_ALLOWLIST = new Set([
  'tests/leaderboardController.integration.test.mjs', // Equoria-rofku
  'tests/integration/breeds.test.mjs', // Equoria-lkady
  'backend/scripts/cleanupAssignments.mjs', // Equoria-2apsk
]);

// Unscoped deleteMany: `deleteMany()` or `deleteMany({})` (only whitespace
// inside the parens / braces). A scoped call — `deleteMany({ where: ... })` —
// has non-whitespace before the closing brace and is NOT matched.
const UNSCOPED_DELETE_MANY = /\.deleteMany\(\s*(?:\{\s*\})?\s*\)/;

function collectFiles(rootDir) {
  let entries;
  try {
    entries = readdirSync(rootDir, { withFileTypes: true, recursive: true });
  } catch {
    return []; // root may not exist in some checkouts
  }
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    // entry.parentPath (Node 20.12+/24) is the absolute dir of this entry.
    const dir = entry.parentPath ?? entry.path ?? rootDir;
    const abs = path.join(dir, entry.name);
    const rel = path.relative(repoRoot, abs).split(path.sep).join('/');
    if (rel.split('/').some((seg) => SKIP_DIRS.has(seg))) continue;
    files.push({ abs, rel });
  }
  return files;
}

// Scan test files plus the cleanup script (it is in the 2apsk allowlist and we
// want the stale-allowlist check to see it).
function isScanTarget(rel) {
  if (/\.test\.(mjs|js)$/.test(rel)) return true;
  if (rel === 'backend/scripts/cleanupAssignments.mjs') return true;
  return false;
}

function scanAll() {
  const offenders = [];
  const seen = new Set();
  for (const root of SCAN_ROOTS) {
    for (const { abs, rel } of collectFiles(root)) {
      if (seen.has(rel)) continue;
      seen.add(rel);
      if (!isScanTarget(rel)) continue;
      let src;
      try {
        src = readFileSync(abs, 'utf8');
      } catch {
        continue;
      }
      const lines = src.split('\n');
      const hits = [];
      lines.forEach((line, i) => {
        // Skip comment-only lines so doc/comment mentions of `deleteMany()`
        // (e.g. this very file's header, or CLAUDE.md-style warnings) do not
        // count as offenders.
        const trimmed = line.trim();
        if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
          return;
        }
        if (UNSCOPED_DELETE_MANY.test(line)) {
          hits.push(i + 1);
        }
      });
      if (hits.length) offenders.push({ rel, lines: hits });
    }
  }
  return offenders;
}

describe('🛡️ STATIC SENTINEL: no unscoped deleteMany in test files (Equoria-jcgid)', () => {
  const offenders = scanAll();
  const offenderPaths = new Set(offenders.map((o) => o.rel));

  it('no NON-allowlisted test file contains an unscoped deleteMany() / deleteMany({})', () => {
    const unexpected = offenders.filter((o) => !KNOWN_OFFENDER_ALLOWLIST.has(o.rel));
    if (unexpected.length) {
      const detail = unexpected
        .map((o) => `  - ${o.rel} (lines ${o.lines.join(', ')})`)
        .join('\n');
      throw new Error(
        'Unscoped deleteMany() found in test file(s) that run against the CANONICAL DB ' +
          '(CLAUDE.md §2). Scope every cleanup with a where-clause ' +
          "(`where: { id: { in: [...] } }` or `where: { name: { startsWith: 'TestFixture-' } }`):\n" +
          detail,
      );
    }
    expect(unexpected).toEqual([]);
  });

  it('every allowlisted known-offender still actually has an unscoped deleteMany (no stale allowlist)', () => {
    // When a sibling issue scopes its file, its allowlist entry must be removed.
    // This catches a stale entry so the allowlist cannot quietly rot.
    const stale = [...KNOWN_OFFENDER_ALLOWLIST].filter((p) => !offenderPaths.has(p));
    if (stale.length) {
      throw new Error(
        'Stale KNOWN_OFFENDER_ALLOWLIST entries (file no longer has an unscoped ' +
          'deleteMany — its sibling issue was fixed). Remove these from the ' +
          'allowlist in noUnscopedDeleteManySentinel.test.mjs:\n' +
          stale.map((p) => `  - ${p}`).join('\n'),
      );
    }
    expect(stale).toEqual([]);
  });
});
