/**
 * Equoria-5z0if — Sentinel-positive coverage for the "destructive scripts must
 * be guarded by a main-module check" invariant.
 *
 * Background: the c3kb6 DB-wipe incident occurred because
 * scripts/db-reset-test.mjs ran DROP DATABASE + CREATE DATABASE + prisma
 * migrate deploy at module top level. A worker running
 * `node -e "import('./scripts/db-reset-test.mjs')"` as a parse-check triggered
 * the destructive operations against the canonical Equoria DB.
 *
 * The structural fix (db-reset-test.mjs has it since c3kb6 closeout) is to
 * wrap ALL side-effects in:
 *
 *   if (import.meta.url === `file://${process.argv[1]}` ||
 *       fileURLToPath(import.meta.url) === process.argv[1]) {
 *     main()...
 *   }
 *
 * This sentinel scans every backend/scripts/*.mjs and any other script that
 * performs destructive operations (prisma writes, execSync of prisma
 * migrate, raw DROP/TRUNCATE/DELETE) and asserts the top-level invocation is
 * INSIDE a main-module guard.
 *
 * PLANTED-VIOLATION proof (OPTIMAL_FIX §2): the test below also constructs a
 * synthetic script body and asserts the detector FIRES on it — proving the
 * detector is not vacuously-true.
 *
 * Pure static-analysis test: reads source files, regex-scans. No DB, no
 * child process, no import of the scripts themselves (which would be
 * exactly the c3kb6 trigger).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test, expect } from '@jest/globals';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');
const BACKEND_SCRIPTS_DIR = path.join(REPO_ROOT, 'backend', 'scripts');

// Markers that indicate a script performs destructive (mutating) DB operations
// or runs prisma migrate, either of which MUST be guarded.
const DESTRUCTIVE_PATTERNS = [
  /prisma\.\w+\.(?:deleteMany|delete|updateMany|update|create|createMany|upsert)\s*\(/,
  /\$executeRaw(?:Unsafe)?\s*[`(]/,
  /\$queryRaw(?:Unsafe)?\s*[`(].*?(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT|ALTER)/is,
  /execSync\s*\(\s*['"`].*?prisma\s+(?:migrate|db push|db pull|generate)/,
  /execSync\s*\(\s*['"`].*?(?:DROP|TRUNCATE|DELETE\s+FROM)/i,
  /DROP\s+DATABASE/i,
  /CREATE\s+DATABASE/i,
];

// Regex for the main-module guard — accepts both the simple and the
// Windows-safe variants used across the tree.
//
// Forms accepted:
//   if (import.meta.url === `file://${process.argv[1]}`) { ... }
//   if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) { ... }
//   if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) { ... }
//   const isMainModule = ... ; if (isMainModule) { ... }
//   const invokedDirectly = ... ; if (invokedDirectly) { ... }
const MAIN_GUARD_PATTERNS = [
  /import\.meta\.url\s*===\s*`file:\/\/\$\{process\.argv\[1\]/,
  /fileURLToPath\s*\(\s*import\.meta\.url\s*\)\s*===\s*process\.argv\[1\]/,
];

/**
 * Returns true iff the file contains at least one main-module guard pattern.
 * (We do not attempt to verify that EVERY destructive call is inside it — a
 * single guard at the bottom of the file gating the top-level main() call is
 * the canonical idiom; the guard's presence is the contract.)
 */
function hasMainModuleGuard(source) {
  return MAIN_GUARD_PATTERNS.some(p => p.test(source));
}

/**
 * Returns true iff the file contains a top-level invocation that triggers
 * destructive work on bare import. We detect this by:
 *
 *  - Removing comments and string contents so regex-matches do not fire on
 *    documentation that mentions the pattern.
 *  - Asserting at least one DESTRUCTIVE_PATTERN matches the code body.
 *
 * A guarded script will still match DESTRUCTIVE_PATTERNS (the call exists
 * lexically) but the guard's presence proves the call only runs when the
 * file is the entry point.
 */
function fileMentionsDestructiveOp(source) {
  // Strip line comments (// ...) and block comments (/* ... */). Imperfect
  // but adequate: keeps source structure, removes documentation hits.
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  return DESTRUCTIVE_PATTERNS.some(p => p.test(stripped));
}

/**
 * Walk backend/scripts/*.mjs (single level — sub-directories are template/lib
 * code, not standalone CLI entry points).
 */
function listScripts() {
  return fs
    .readdirSync(BACKEND_SCRIPTS_DIR)
    .filter(f => f.endsWith('.mjs'))
    .filter(f => !f.endsWith('.test.mjs'))
    .map(f => path.join(BACKEND_SCRIPTS_DIR, f));
}

describe('Equoria-5z0if — destructive scripts must have main-module guard', () => {
  test('detector fires on a synthetic unguarded destructive script (PLANTED VIOLATION)', () => {
    const synthetic = `
      import { PrismaClient } from '@prisma/client';
      const prisma = new PrismaClient();
      async function main() {
        await prisma.horse.deleteMany({ where: { id: 1 } });
      }
      main();
    `;
    expect(fileMentionsDestructiveOp(synthetic)).toBe(true);
    expect(hasMainModuleGuard(synthetic)).toBe(false);
  });

  test('detector passes on a synthetic guarded destructive script (NEGATIVE CONTROL)', () => {
    const guarded = `
      import { PrismaClient } from '@prisma/client';
      const prisma = new PrismaClient();
      async function main() {
        await prisma.horse.deleteMany({ where: { id: 1 } });
      }
      if (import.meta.url === \`file://\${process.argv[1]}\`) {
        main();
      }
    `;
    expect(fileMentionsDestructiveOp(guarded)).toBe(true);
    expect(hasMainModuleGuard(guarded)).toBe(true);
  });

  test('detector ignores comment-only mentions (REGRESSION GUARD)', () => {
    const commentOnly = `
      // This file does NOT run prisma.horse.deleteMany — that's a doctrine literal.
      /* DROP DATABASE is mentioned here in a comment only */
      export function noop() {}
    `;
    expect(fileMentionsDestructiveOp(commentOnly)).toBe(false);
  });

  test('every backend/scripts/*.mjs that mentions a destructive op has a main-module guard', () => {
    const scripts = listScripts();
    expect(scripts.length).toBeGreaterThan(10); // sanity: directory still populated

    const unguarded = [];
    for (const filePath of scripts) {
      const source = fs.readFileSync(filePath, 'utf8');
      if (!fileMentionsDestructiveOp(source)) {
        continue;
      }
      if (!hasMainModuleGuard(source)) {
        unguarded.push(path.relative(REPO_ROOT, filePath));
      }
    }

    expect(unguarded).toEqual([]);
  });
});
