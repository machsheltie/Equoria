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
 * wrap ALL side-effects in the CANONICAL, cross-platform-correct guard:
 *
 *   if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
 *     main()...
 *   }
 *
 * NOTE (Equoria-ur0y8): this detector ALSO still accepts the legacy
 * string-concat form `import.meta.url === \`file://${process.argv[1]...}\``
 * because ~30 backend/scripts use it and are being migrated incrementally.
 * That form is BROKEN ON WINDOWS (`file://C:/...` ≠ `file:///C:/...`, so the
 * guard never fires and the script silently no-ops as a direct entrypoint),
 * but it does no HARM on bare import (the guard is simply never-true, which
 * is fail-safe for the c3kb6 DB-wipe concern this sentinel guards). The
 * detector therefore keeps accepting it; the bulk migration to the
 * fileURLToPath form is tracked separately (see Equoria-ur0y8 follow-up).
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
// Equoria-o706s: scan both backend/scripts/ AND backend/seed/. Both hold
// standalone CLI entry points that run destructive prisma writes / seeds at
// module top level, so both need the c3kb6/5z0if main-module guard enforced.
// (backend/seed/userSeed.mjs's guard from 9eh0t was previously unenforced.)
const BACKEND_SCRIPTS_DIR = path.join(REPO_ROOT, 'backend', 'scripts');
const BACKEND_SEED_DIR = path.join(REPO_ROOT, 'backend', 'seed');
const SCAN_DIRS = [BACKEND_SCRIPTS_DIR, BACKEND_SEED_DIR];

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

// Regex for the main-module guard.
//
// CANONICAL (cross-platform correct — Equoria-ur0y8):
//   if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) { ... }
//
// LEGACY (accepted, but WINDOWS-BROKEN — never fires on Win32; being
// migrated, see Equoria-ur0y8 follow-up):
//   if (import.meta.url === `file://${process.argv[1]}`) { ... }
//   if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) { ... }
//
// Also accepted (Equoria-o706s — forms used by destructive backend/seed/*.mjs):
//
//   CANONICAL via a hoisted __filename alias (seedDevData.mjs, repairBreedIds.mjs):
//     const __filename = fileURLToPath(import.meta.url);
//     if (process.argv[1] && __filename === process.argv[1]) { ... }
//   We accept the `__filename === process.argv[1]` comparison ONLY in files that
//   also assign `__filename = fileURLToPath(import.meta.url)` (verified
//   separately in hasMainModuleGuard so a bare `__filename` from some other
//   binding can't sneak through).
//
//   pathToFileURL form (seedPerformanceData.mjs) — Windows-correct, compares
//   import.meta.url to the file URL built from process.argv[1]:
//     if (import.meta.url === pathToFileURL(process.argv[1]).href) { ... }
//
//   Legacy `file:///${argv.replace(...)}` via a hoisted var (seedShows.mjs):
//     const executedFileUrl = `file:///${process.argv[1].replace(/\\/g, '/')}`;
//     if (currentFileUrl === executedFileUrl) { ... }
//   Accepted as the legacy/three-slash sibling of the file:// template form
//   (does no harm on bare import — fail-safe for the c3kb6 concern).
const MAIN_GUARD_PATTERNS = [
  /import\.meta\.url\s*===\s*`file:\/\/\$\{process\.argv\[1\]/,
  /fileURLToPath\s*\(\s*import\.meta\.url\s*\)\s*===\s*process\.argv\[1\]/,
  /import\.meta\.url\s*===\s*pathToFileURL\s*\(\s*process\.argv\[1\]\s*\)\s*\.href/,
  /`file:\/\/\/\$\{process\.argv\[1\]/,
];

// Equoria-o706s: the __filename-alias form
// `if (... __filename === process.argv[1])` is only a valid main-module guard
// when __filename was bound from fileURLToPath(import.meta.url). This pattern
// pair (the alias binding AND the comparison) must BOTH be present.
const FILENAME_ALIAS_BINDING = /__filename\s*=\s*fileURLToPath\s*\(\s*import\.meta\.url\s*\)/;
const FILENAME_ALIAS_GUARD = /__filename\s*===\s*process\.argv\[1\]/;

/**
 * Returns true iff the file contains at least one main-module guard pattern.
 * (We do not attempt to verify that EVERY destructive call is inside it — a
 * single guard at the bottom of the file gating the top-level main() call is
 * the canonical idiom; the guard's presence is the contract.)
 */
function hasMainModuleGuard(source) {
  if (MAIN_GUARD_PATTERNS.some(p => p.test(source))) {
    return true;
  }
  // __filename-alias form: only valid if __filename was bound from
  // fileURLToPath(import.meta.url) AND used in the `=== process.argv[1]` guard.
  return FILENAME_ALIAS_BINDING.test(source) && FILENAME_ALIAS_GUARD.test(source);
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
 * Walk backend/scripts/*.mjs AND backend/seed/*.mjs (single level each —
 * sub-directories are template/lib code, not standalone CLI entry points).
 * Equoria-o706s: seed/ added so userSeed.mjs's 9eh0t guard (and the
 * seedDatabase/seedDevData/backfill/repair guards from xrbog+flqjs) are
 * sentinel-enforced.
 */
function listScripts() {
  const files = [];
  for (const dir of SCAN_DIRS) {
    if (!fs.existsSync(dir)) {
      continue;
    }
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.mjs') || f.endsWith('.test.mjs')) {
        continue;
      }
      files.push(path.join(dir, f));
    }
  }
  return files;
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

  test('detector accepts the pathToFileURL(...).href guard form (Equoria-o706s NEGATIVE CONTROL)', () => {
    // Form used by backend/seed/seedPerformanceData.mjs.
    const guarded = `
      import { pathToFileURL } from 'url';
      import { PrismaClient } from '@prisma/client';
      const prisma = new PrismaClient();
      async function main() {
        await prisma.horse.deleteMany({ where: { id: 1 } });
      }
      if (import.meta.url === pathToFileURL(process.argv[1]).href) {
        main();
      }
    `;
    expect(fileMentionsDestructiveOp(guarded)).toBe(true);
    expect(hasMainModuleGuard(guarded)).toBe(true);
  });

  test('detector accepts the __filename-alias guard form (Equoria-o706s NEGATIVE CONTROL)', () => {
    // Form used by backend/seed/seedDevData.mjs + repairBreedIds.mjs.
    const guarded = `
      import { fileURLToPath } from 'url';
      import { PrismaClient } from '@prisma/client';
      const __filename = fileURLToPath(import.meta.url);
      const prisma = new PrismaClient();
      async function main() {
        await prisma.horse.updateMany({ data: { breedId: 1 } });
      }
      if (process.argv[1] && __filename === process.argv[1]) {
        main();
      }
    `;
    expect(fileMentionsDestructiveOp(guarded)).toBe(true);
    expect(hasMainModuleGuard(guarded)).toBe(true);
  });

  test('detector accepts the legacy file:/// var-hoist guard form (Equoria-o706s NEGATIVE CONTROL)', () => {
    // Form used by backend/seed/seedShows.mjs.
    const guarded = `
      import { PrismaClient } from '@prisma/client';
      const prisma = new PrismaClient();
      async function main() {
        await prisma.show.createMany({ data: [] });
      }
      const currentFileUrl = import.meta.url;
      const executedFileUrl = \`file:///\${process.argv[1].replace(/\\\\/g, '/')}\`;
      if (currentFileUrl === executedFileUrl) {
        main();
      }
    `;
    expect(fileMentionsDestructiveOp(guarded)).toBe(true);
    expect(hasMainModuleGuard(guarded)).toBe(true);
  });

  test('detector REJECTS a bare __filename === process.argv[1] without the fileURLToPath binding (Equoria-o706s PLANTED VIOLATION)', () => {
    // A __filename bound from somewhere else (e.g. a string literal) is NOT a
    // valid main-module guard — the alias form requires the
    // fileURLToPath(import.meta.url) binding to be present.
    const sneaky = `
      import { PrismaClient } from '@prisma/client';
      const prisma = new PrismaClient();
      const __filename = '/some/hardcoded/path.mjs';
      async function main() {
        await prisma.horse.deleteMany({ where: { id: 1 } });
      }
      if (process.argv[1] && __filename === process.argv[1]) {
        main();
      }
    `;
    expect(fileMentionsDestructiveOp(sneaky)).toBe(true);
    expect(hasMainModuleGuard(sneaky)).toBe(false);
  });

  test('detector ignores comment-only mentions (REGRESSION GUARD)', () => {
    const commentOnly = `
      // This file does NOT run prisma.horse.deleteMany — that's a doctrine literal.
      /* DROP DATABASE is mentioned here in a comment only */
      export function noop() {}
    `;
    expect(fileMentionsDestructiveOp(commentOnly)).toBe(false);
  });

  test('every backend/scripts/*.mjs AND backend/seed/*.mjs that mentions a destructive op has a main-module guard', () => {
    const scripts = listScripts();
    expect(scripts.length).toBeGreaterThan(10); // sanity: directories still populated

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
