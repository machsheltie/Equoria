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
 */

import { readFileSync } from 'fs';
import { join, resolve, relative, extname, basename } from 'path';
import { readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';

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

function* walkFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
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

    let content;
    try {
      content = readFileSync(absPath, 'utf8');
    } catch {
      continue;
    }

    scannedCount++;
    IMPORT_EXPORT_PATTERN.lastIndex = 0;
    let match;
    while ((match = IMPORT_EXPORT_PATTERN.exec(content)) !== null) {
      const lineNum = content.slice(0, match.index).split('\n').length;
      const rel = relative(REPO_ROOT, absPath).replace(/\\/g, '/');
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
      'refactor the module to expose a proper public API — do not consume the test-only binding.\n'
  );
  process.exit(1);
}

process.exit(0);
