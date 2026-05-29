#!/usr/bin/env node
/**
 * Equoria-wm987: One-shot cleanup of 11 mojibake-corrupted breed duplicates.
 *
 * Background: the 26qjf.3 breed import created 11 rows whose names contain
 * U+FFFD ('�') replacement chars where UTF-8 multi-byte chars should be
 * (e.g. 'Asturc�n' duplicates the properly-encoded 'Asturcón'). All 11
 * corrupted rows have zero horse FK references; their proper-encoded
 * counterparts already exist in the breeds table. This script deletes the
 * corrupted rows after re-verifying the no-FK precondition row-by-row.
 *
 * Fail-closed: if ANY corrupted row has a non-zero horse FK count, OR any
 * corrupted row's proper counterpart is missing, the script aborts WITHOUT
 * deleting anything and emits the failing precondition. No partial deletes.
 *
 * Side-effects are deferred to the main-module guard at the bottom of the
 * file (Equoria-5z0if pattern) so bare import (parse-check) is safe.
 */

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The 11 corrupted (id → expected proper-counterpart name) pairs.
// IDs sourced from Equoria-wm987 description (queried 2026-05-28, confirmed
// 2026-05-29 to still be present with U+FFFD chars and zero horse FKs).
const MOJIBAKE_PAIRS = Object.freeze([
  { corruptedId: 31, properName: 'Asturcón' },
  { corruptedId: 114, properName: 'Foutanké' },
  { corruptedId: 132, properName: 'Hispano-Bretón' },
  { corruptedId: 133, properName: 'Hispano-Árabe' },
  { corruptedId: 178, properName: 'Mallorquín horse' },
  { corruptedId: 183, properName: 'Marismeño' },
  { corruptedId: 187, properName: 'Menorquín horse' },
  { corruptedId: 253, properName: 'Selle Français' },
  { corruptedId: 303, properName: 'Württemberger' },
  { corruptedId: 311, properName: 'Zweibrücker' },
  { corruptedId: 312, properName: 'Žemaitukas' },
]);

export async function cleanupMojibakeBreeds(prisma, { dryRun = false } = {}) {
  const corruptedIds = MOJIBAKE_PAIRS.map(p => p.corruptedId);
  const properNames = MOJIBAKE_PAIRS.map(p => p.properName);

  // Precondition 1: every corrupted row still exists AND its name still
  // contains U+FFFD. This guards against the script being run twice or
  // against name drift since the IDs were captured.
  const corruptedRows = await prisma.$queryRaw`
    SELECT id, name FROM breeds WHERE id = ANY(${corruptedIds}::int[]) ORDER BY id;
  `;
  for (const row of corruptedRows) {
    if (!row.name.includes('�')) {
      throw new Error(
        `Precondition failure: breed id=${row.id} name="${row.name}" no longer contains U+FFFD. Aborting (no deletes).`,
      );
    }
  }
  if (corruptedRows.length === 0) {
    return { skipped: true, reason: 'no mojibake rows present (already cleaned?)', deleted: 0 };
  }

  // Precondition 2: every corrupted row has ZERO horse FK references.
  const fkCounts = await prisma.$queryRaw`
    SELECT "breedId", count(*)::int AS cnt
      FROM horses
     WHERE "breedId" = ANY(${corruptedIds}::int[])
     GROUP BY "breedId";
  `;
  if (fkCounts.length > 0) {
    throw new Error(
      `Precondition failure: corrupted breed rows have horse FK references: ${JSON.stringify(fkCounts)}. Aborting (no deletes).`,
    );
  }

  // Precondition 3: every proper-counterpart name exists in breeds.
  const properRows = await prisma.$queryRaw`
    SELECT id, name FROM breeds WHERE name = ANY(${properNames}::text[]);
  `;
  const foundProper = new Set(properRows.map(r => r.name));
  const missingProper = properNames.filter(n => !foundProper.has(n));
  if (missingProper.length > 0) {
    throw new Error(
      `Precondition failure: proper-counterpart names missing from breeds table: ${JSON.stringify(missingProper)}. Aborting (no deletes).`,
    );
  }

  if (dryRun) {
    return {
      dryRun: true,
      wouldDelete: corruptedRows.map(r => ({ id: r.id, name: r.name })),
      deleted: 0,
    };
  }

  // All preconditions passed — scoped delete by id.
  const result = await prisma.breed.deleteMany({
    where: { id: { in: corruptedIds } },
  });

  return {
    deleted: result.count,
    rows: corruptedRows.map(r => ({ id: r.id, name: r.name })),
  };
}

async function main() {
  const { default: prisma } = await import('../../packages/database/prismaClient.mjs');
  const dryRun = process.argv.includes('--dry-run');
  try {
    const result = await cleanupMojibakeBreeds(prisma, { dryRun });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

// Equoria-5z0if main-module guard: deleteMany() against the canonical
// breeds table is destructive; the script must NOT execute on bare import
// (e.g. parse-check `node -e "import('./cleanup-mojibake-breeds.mjs')"`).
// Use fileURLToPath(import.meta.url) === process.argv[1] — accepted by the
// destructive-scripts sentinel (`MAIN_GUARD_PATTERNS[1]`) and correct on
// Windows (where the literal `file://${argv1}` form in CONTRIBUTING.md
// produces a two-slash URL while import.meta.url is the three-slash form).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
