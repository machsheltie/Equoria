/**
 * backfill-horse-temperament.mjs
 *
 * One-time script (Equoria-f5372): assigns a permanent temperament to every
 * existing horse whose temperament column is NULL. These horses were created
 * before temperament was wired into the store-purchase and starter-horse
 * paths (and predate temperament entirely for legacy rows).
 *
 * Strategy: when a horse has a breed with a breedProfiles.json entry, use that
 * breed's temperament_weights; otherwise fall back to the default breed's
 * weights (generateTemperamentWithDefault). Mirrors backfill-horse-colors.mjs.
 *
 * Safe to run multiple times — only touches rows where temperament IS NULL.
 * The UPDATE is scoped to a single horse id per statement (never unscoped).
 *
 * Usage:
 *   node backend/scripts/backfill-horse-temperament.mjs
 */

import prisma from '../db/index.mjs';
import { generateTemperamentWithDefault } from '../modules/horses/services/temperamentService.mjs';

async function run() {
  // Raw SQL for the NULL filter (mirrors backfill-horse-colors.mjs).
  const horses = await prisma.$queryRaw`
    SELECT id, "breedId" FROM horses WHERE temperament IS NULL
  `;

  console.log(`Found ${horses.length} horses without temperament. Generating...`);

  // Batch-resolve breed names so we can use per-breed weights where available.
  const breedIds = [...new Set(horses.map(h => h.breedId).filter(Boolean))];
  const breedNameById = new Map();
  if (breedIds.length > 0) {
    const breeds = await prisma.$queryRaw`
      SELECT id, name FROM breeds WHERE id = ANY(${breedIds}::int[])
    `;
    for (const b of breeds) {
      breedNameById.set(b.id, b.name);
    }
  }

  let updated = 0;
  let failed = 0;

  for (const horse of horses) {
    try {
      const breedName = horse.breedId ? (breedNameById.get(horse.breedId) ?? null) : null;
      const temperament = generateTemperamentWithDefault(breedName);

      // Scoped to this horse id — never an unscoped UPDATE (CLAUDE.md §3).
      await prisma.$executeRaw`
        UPDATE horses
        SET temperament = ${temperament}
        WHERE id = ${horse.id} AND temperament IS NULL
      `;

      updated++;
      if (updated % 100 === 0) {
        console.log(`  ${updated}/${horses.length} updated...`);
      }
    } catch (err) {
      console.error(`  Failed to update horse ${horse.id}:`, err.message);
      failed++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Failed: ${failed}`);
  await prisma.$disconnect();
}

// Equoria-5z0if: main-module guard. run() mutates Horse.temperament —
// must NOT run on bare import.
if (
  process.argv[1] &&
  import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`
) {
  run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
