/**
 * Equoria-709qm (slice 2) — Sentinel: the legacy non-ledger money writers must
 * stay removed from production code.
 *
 * Background: three legacy earnings/money writers bypassed every invariant the
 * economy layer now enforces (atomic conditional predicate + user_transactions
 * ledger row + SystemAccount conservation pairing):
 *   - updateUserMoney       (was backend/utils/userUpdates.mjs)  — bare
 *                             user.update({ money: { increment } }), no tx, no
 *                             ledger, negative amounts pass through as decrements.
 *   - transferEntryFees     (was backend/utils/userUpdates.mjs)  — called it.
 *   - updateHorseEarnings   (was backend/utils/horseUpdates.mjs) — non-tx
 *                             totalEarnings increment.
 *   - updateHorseRewards    (was backend/utils/horseUpdates.mjs) — bundled the
 *                             above earnings write with a stat write.
 *
 * Their last production consumer (enterAndRunShow) was retired in slice 1
 * (commit cc0e2987b); slice 2 deleted the writers themselves. The hjtys audit
 * found 13 unpaired sinks precisely because helpers like these existed, so the
 * risk this sentinel guards is a FUTURE feature (or an AI agent pattern-matching
 * on the old code) re-creating one of these named non-ledger writers and
 * silently reintroducing the pre-hjzwt/kl16c unpaired-write defect class.
 *
 * The gate: no PRODUCTION file (backend/**, excluding test dirs/files) may
 * DEFINE, EXPORT, or IMPORT any of the four forbidden names. It is a
 * definition/export/import-context scan (not a bare-substring scan), and it
 * strips comments first, so a documentation mention (e.g. the deliberate
 * "updateHorseRewards/updateHorseStat are NOT reused" note in
 * competitionAwards.mjs) does not trip it.
 *
 * updateHorseStat is DELIBERATELY NOT in the forbidden set: it is a stat writer
 * (not a money writer), out of slice 2's named scope, and still exported from
 * horseUpdates.mjs. (It is itself a production-orphan duplicate of the live
 * horseModelService.updateHorseStat — removal tracked as a 709qm follow-up.)
 *
 * PLANTED-VIOLATION proof (OPTIMAL_FIX §2): the tests below construct synthetic
 * sources and assert the detector FIRES on a re-created definition / re-wired
 * import — proving it is not vacuously-true — and does NOT fire on a comment-only
 * mention or on the kept updateHorseStat symbol.
 *
 * Pure static-analysis test: reads source files, regex-scans. No DB, no imports
 * of the scanned modules.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test, expect } from '@jest/globals';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');
const BACKEND_DIR = path.join(REPO_ROOT, 'backend');

// The four legacy non-ledger money writers retired by Equoria-709qm.
const FORBIDDEN = Object.freeze(['updateUserMoney', 'transferEntryFees', 'updateHorseEarnings', 'updateHorseRewards']);

// Directory names that hold test / build code — excluded from the PRODUCTION scan.
const EXCLUDED_DIRS = new Set(['node_modules', '__tests__', 'tests', 'coverage', 'dist', 'build']);

/**
 * Strip block and line comments so a documentation mention of a forbidden name
 * is not treated as a real reference. Imperfect (does not parse strings) but the
 * reference patterns below only match code contexts.
 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/**
 * Return the forbidden names DEFINED / EXPORTED / IMPORTED in a source string.
 * Context-scoped patterns (not bare substring) so an incidental identifier use
 * is not required — a re-created writer must be a declaration, export, or import
 * to be a real regression.
 */
function forbiddenRefsIn(source) {
  const stripped = stripComments(source);
  const hits = [];
  for (const name of FORBIDDEN) {
    const patterns = [
      new RegExp(`(?:async\\s+)?function\\s+${name}\\b`), // function decl
      new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=`), // arrow / const decl
      new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`), // named-export list
      new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\b`), // export function
      new RegExp(`export\\s+(?:const|let|var)\\s+${name}\\b`), // export const
      new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from`), // named import
      new RegExp(`\\b${name}\\s+as\\s+\\w+`), // import/export alias
    ];
    if (patterns.some(p => p.test(stripped))) {
      hits.push(name);
    }
  }
  return hits;
}

/** Recursively collect production *.mjs files under backend/. */
function listProductionMjs(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }
      listProductionMjs(path.join(dir, entry.name), acc);
      continue;
    }
    if (!entry.name.endsWith('.mjs')) {
      continue;
    }
    if (/\.(test|spec)\.mjs$/.test(entry.name)) {
      continue;
    }
    acc.push(path.join(dir, entry.name));
  }
  return acc;
}

describe('Equoria-709qm — legacy non-ledger money writers stay removed', () => {
  test('detector FIRES on a re-created writer definition (PLANTED VIOLATION)', () => {
    const synthetic = `
      import prisma from '../../packages/database/prismaClient.mjs';
      async function updateUserMoney(userId, amount) {
        return prisma.user.update({ where: { id: userId }, data: { money: { increment: amount } } });
      }
      export { updateUserMoney };
    `;
    expect(forbiddenRefsIn(synthetic)).toContain('updateUserMoney');
  });

  test('detector FIRES on a re-wired import of a forbidden writer (PLANTED VIOLATION)', () => {
    const synthetic = `
      import { updateHorseEarnings, updateHorseRewards } from '../../../utils/horseUpdates.mjs';
      export function awardPrize(id, amt) { return updateHorseEarnings(id, amt); }
    `;
    const hits = forbiddenRefsIn(synthetic);
    expect(hits).toContain('updateHorseEarnings');
    expect(hits).toContain('updateHorseRewards');
  });

  test('detector FIRES on an aliased re-export (PLANTED VIOLATION)', () => {
    const synthetic = 'export { transferEntryFees as sendFees } from legacyModule;';
    expect(forbiddenRefsIn(synthetic)).toContain('transferEntryFees');
  });

  test('detector IGNORES a comment-only mention (NEGATIVE CONTROL)', () => {
    // Mirrors the real deliberate note in competitionAwards.mjs.
    const commentOnly = `
      /**
       * updateHorseRewards / updateHorseStat are deliberately NOT reused here —
       * they are separate un-transacted writes (updateUserMoney too).
       */
      export function awardPlacementProgression() {}
      // transferEntryFees and updateHorseEarnings were retired (709qm).
    `;
    expect(forbiddenRefsIn(commentOnly)).toEqual([]);
  });

  test('detector does NOT flag the kept updateHorseStat symbol (NEGATIVE CONTROL)', () => {
    const keptSymbol = `
      async function updateHorseStat(horseId, statName, increase = 1) { return null; }
      export { updateHorseStat };
    `;
    expect(forbiddenRefsIn(keptSymbol)).toEqual([]);
  });

  test('no production backend file defines, exports, or imports a forbidden money writer', () => {
    const files = listProductionMjs(BACKEND_DIR);
    expect(files.length).toBeGreaterThan(50); // sanity: the walk found the tree

    const violations = [];
    for (const filePath of files) {
      const source = fs.readFileSync(filePath, 'utf8');
      const hits = forbiddenRefsIn(source);
      if (hits.length > 0) {
        violations.push(`${path.relative(REPO_ROOT, filePath)} → ${hits.join(', ')}`);
      }
    }

    expect(violations).toEqual([]);
  });
});
