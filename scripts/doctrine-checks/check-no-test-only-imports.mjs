#!/usr/bin/env node
/**
 * Doctrine: no production code imports or re-exports a __TESTING_ONLY_* binding.
 *
 * Replaces check-no-test-only-imports.sh (Equoria-tie0 / 21R-SEC-3-FOLLOW-11).
 * The shell version used line-level grep, which missed:
 *   1. Multi-line imports where __TESTING_ONLY_ is on a continuation line
 *      (import keyword on a different line than the binding name)
 *   2. Re-exports: `export { __TESTING_ONLY_X } from '...'` — valid ES module
 *      syntax that forwards the test-only binding to other consumers
 *
 * This script reads each file as a string and applies a multi-line-aware regex
 * that catches both single-line and multi-line import/export declarations
 * containing the __TESTING_ONLY_ prefix. No AST parser dependency required.
 *
 * Regex: /\b(?:import|export)\s*\{[^{}]*__TESTING_ONLY_[^{}]*\}/gs
 *   - `\b(?:import|export)` — start of an import or export statement
 *   - `\s*\{` — optional whitespace, then opening brace
 *   - `[^{}]*` — any content except braces (crosses newlines, no nested braces
 *     in import/export specifier lists)
 *   - `__TESTING_ONLY_` — the forbidden prefix
 *   - `[^{}]*\}` — rest of specifier list up to closing brace
 *
 * Exclusions (same as the shell version):
 *   - Test files (*.test.*, *.spec.*, __tests__/, tests/ directories)
 *   - The defining module (backend/middleware/requestBodySecurity.mjs)
 *   - ESLint config files (eslint.config.*, .eslintrc.*)
 *   - This script itself (scripts/doctrine-checks/)
 *   - node_modules, coverage, dist, build directories
 *
 * Permitted-import allow-list (Equoria-6p398.4):
 *   Some production code legitimately awaits a runtime-gated test seam that
 *   can never fire outside `NODE_ENV === 'test'` (see
 *   backend/modules/marketplace/services/marketplaceRaceBarrier.mjs). Rather
 *   than exempting the whole importing file (which would hide an unrelated
 *   __TESTING_ONLY_ import added to that same file later), PERMITTED_TEST_ONLY_IMPORTS
 *   below maps one importing file to the exact binding(s) it may import, each
 *   with a one-line reason. A match is only skipped when EVERY
 *   `__TESTING_ONLY_*` identifier inside the matched import/export is on that
 *   file's permitted list; anything else still fails the check.
 */

import { join, resolve, relative, extname, basename } from 'path';
import { statSync } from 'fs';
import { fileURLToPath } from 'url';

// Equoria-p1mlt: route enumerated-file reads through the shared tolerant reader
// so a file that vanishes mid-scan (concurrent jest sentinel plant+delete, the
// q7lqz race) is skipped loudly (ENOENT-only) instead of crashing the check.
// Replaces the previous `try { readFileSync } catch { continue; }` which
// silently swallowed ANY read error (EACCES, EISDIR, …) — masking real
// environment faults (EDGE_CASE_FIX_DISCIPLINE §3: fail loud on non-ENOENT).
//
// Equoria-8nq7i: route the DIRECTORY recursion in walkFiles() through the
// shared readdirSyncTolerant too. The previous `try { readdirSync } catch
// { return }` was the same silent-catch-on-non-ENOENT defect ONE LEVEL UP
// (directory vs file): it swallowed EACCES / EMFILE / ENOTDIR as well as the
// legitimate ENOENT (a directory that vanished mid-scan), masking real
// environment faults. readdirSyncTolerant tolerates ONLY ENOENT, loudly.
import {
  readScannedFileSyncTolerant,
  readdirSyncTolerant,
} from '../lib/doctrine-scan-patterns.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

const PRODUCTION_PATHS = [join(REPO_ROOT, 'backend'), join(REPO_ROOT, 'frontend', 'src')];

const SKIP_DIRS = new Set([
  'node_modules',
  '__tests__',
  'tests',
  'coverage',
  'coverage-security',
  'dist',
  'build',
]);
const SOURCE_EXTS = new Set(['.mjs', '.js', '.ts', '.tsx']);

// Matches a single-line or multi-line import/export specifier block containing
// the __TESTING_ONLY_ prefix. The [^{}] character class prevents the regex
// from spanning across multiple import statements.
const IMPORT_EXPORT_PATTERN = /\b(?:import|export)\s*\{[^{}]*__TESTING_ONLY_[^{}]*\}/gs;

// Pulls every individual `__TESTING_ONLY_*` identifier out of one matched
// import/export block, so an allow-list entry can be checked per binding
// rather than per whole file.
const TEST_ONLY_BINDING_PATTERN = /__TESTING_ONLY_[A-Za-z0-9_]*/g;

// Explicit allow-list: importing file (repo-relative, forward slashes) ->
// the exact __TESTING_ONLY_ bindings that file may import, each with why
// production cannot reach the gated behavior. This is NOT a per-file
// exclusion — it is checked per binding below, so an unlisted
// __TESTING_ONLY_ import added to one of these files (or the listed binding
// imported anywhere else) still fails the check.
const PERMITTED_TEST_ONLY_IMPORTS = new Map([
  [
    'backend/modules/marketplace/controllers/marketplaceController.mjs',
    {
      bindings: new Set(['__TESTING_ONLY_awaitMarketplaceRaceBarrier']),
      reason:
        "Awaits marketplaceRaceBarrier.mjs's delay/abort seam once in buyHorse " +
        '(Equoria-6p398.4); the awaiter no-ops unless a test has armed it, and arming ' +
        'throws outside NODE_ENV === "test", so a deployed process can never reach it.',
    },
  ],
  [
    'backend/modules/marketplace/services/horseTransferReconciliation.mjs',
    {
      bindings: new Set(['__TESTING_ONLY_awaitMarketplaceRaceBarrier']),
      reason:
        'Awaits the same seam at the end of reconcileHorseOnTransfer (Equoria-6p398.4) so a ' +
        'test can prove late writes roll back with the purchase; same runtime guard as above.',
    },
  ],
  [
    'backend/modules/grooms/controllers/groomFreeAgentController.mjs',
    {
      bindings: new Set(['__TESTING_ONLY_awaitGroomHireRaceBarrier']),
      reason:
        "Awaits groomHireRaceBarrier.mjs's delay seam once in hireFreeAgent, between the " +
        'pool pre-read and the transaction (Equoria-ypb7d.2 fix round 3). Production cannot ' +
        "reach it: the awaiter no-ops unless armed, and arming throws outside NODE_ENV === 'test'. " +
        "It exists because the guarded claim's count !== 1 -> 409 refusal was otherwise only " +
        'assertable by a two-caller race whose loser took the 404 pre-read branch about three ' +
        'times in five, which left the 409 mapping covered by nothing.',
    },
  ],
]);

function* walkFiles(dir) {
  // Equoria-8nq7i: ENOENT-only-tolerant readdir. A vanished directory yields
  // [] (zero files, loudly noticed); any other readdir error (EACCES, EMFILE,
  // …) rethrows so the check crashes instead of silently under-scanning.
  const entries = readdirSyncTolerant(dir, { withFileTypes: true }, 'no-test-only-imports');
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(full);
    } else if (entry.isFile() && SOURCE_EXTS.has(extname(entry.name))) {
      yield full;
    }
  }
}

function isExcluded(absPath) {
  const rel = relative(REPO_ROOT, absPath).replace(/\\/g, '/');
  // The defining module that exports test-only symbols
  if (rel === 'backend/middleware/requestBodySecurity.mjs') return true;
  // ESLint config files that reference the name as config data (not imports)
  const base = basename(rel);
  if (/^\.?eslint/.test(base)) return true;
  // This script directory (doctrine checks themselves)
  if (rel.startsWith('scripts/doctrine-checks/')) return true;
  // Test files by name pattern
  if (/\.(test|spec)\.[a-z]+$/.test(base)) return true;
  return false;
}

const violations = [];

let scannedCount = 0;

for (const productionPath of PRODUCTION_PATHS) {
  let exists = true;
  try {
    statSync(productionPath);
  } catch {
    exists = false;
  }

  if (!exists) continue;

  for (const absPath of walkFiles(productionPath)) {
    if (isExcluded(absPath)) continue;

    const content = readScannedFileSyncTolerant(absPath, 'no-test-only-imports');
    if (content === null) continue; // vanished mid-scan (ENOENT) — skip, noticed

    scannedCount++;
    const rel = relative(REPO_ROOT, absPath).replace(/\\/g, '/');
    const permitted = PERMITTED_TEST_ONLY_IMPORTS.get(rel);
    IMPORT_EXPORT_PATTERN.lastIndex = 0;
    let match;
    while ((match = IMPORT_EXPORT_PATTERN.exec(content)) !== null) {
      const bindingsInMatch = match[0].match(TEST_ONLY_BINDING_PATTERN) ?? [];
      const unpermitted = bindingsInMatch.filter(
        (binding) => !(permitted && permitted.bindings.has(binding))
      );
      if (unpermitted.length === 0) continue; // every binding here is allow-listed for this file

      const lineNum = content.slice(0, match.index).split('\n').length;
      violations.push(`${rel}:${lineNum}: ${match[0].replace(/\s+/g, ' ').trim()}`);
    }
  }
}

if (scannedCount === 0) {
  process.stderr.write(
    'doctrine-check: ERROR — no source files found in production paths.\n' +
      'This almost certainly means the script is running from the wrong directory.\n' +
      `Working directory: ${process.cwd()}\n`
  );
  process.exit(2);
}

if (violations.length > 0) {
  process.stdout.write('\n');
  process.stdout.write(
    'Production code imports or re-exports a __TESTING_ONLY_* binding (forbidden):\n'
  );
  for (const v of violations) {
    process.stdout.write(`  ${v}\n`);
  }
  process.stdout.write('\n');
  process.stdout.write(
    'Test-only exports (__TESTING_ONLY_ prefix) are runtime-gated escape hatches for tests.\n' +
      "Production code must use the module's public API. If you need access from production,\n" +
      'refactor the module to expose a proper public API — do not consume the test-only binding.\n' +
      'A genuinely runtime-gated seam (see marketplaceRaceBarrier.mjs) may instead be added to\n' +
      'PERMITTED_TEST_ONLY_IMPORTS in this script, with a one-line reason production cannot\n' +
      'reach the gated behavior.\n'
  );
  process.exit(1);
}

process.exit(0);
