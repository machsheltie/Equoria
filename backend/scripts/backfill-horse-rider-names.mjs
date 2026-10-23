/**
 * backfill-horse-rider-names.mjs (Equoria-oey96.50)
 *
 * One-shot, idempotent backfill. `Horse.rider` is a JSON copy of the assigned
 * rider ({ id, name, level, speciality }) that assignRider writes. Riders have
 * firstName/lastName and no `name` column, so until the write-site fix in this
 * same issue the copy was written with `name: rider.name` = undefined, which
 * JSON drops: every horse assigned before the fix carries a rider with no name.
 *
 * Owner ruling 2026-10-23: backfill the nameless copies from the rider record.
 * For each horse whose `rider` JSON is an object with no non-empty `name`, the
 * name becomes "<firstName> <lastName>" of the rider row its `id` points at.
 * Nothing else in the JSON changes. A copy whose rider row no longer exists is
 * left alone and counted as `riderMissing`.
 *
 * Safety:
 *   - Dry run by default: counts only, no writes. `--execute` writes.
 *   - Each write is ONE guarded statement for ONE horse, re-checking that the
 *     JSON still points at the same rider and still has no name, so a rider
 *     reassigned or a name written since the scan is never overwritten.
 *   - Idempotent: a second run finds nothing nameless that it can fix.
 *   - Import-safe: side effects only in main(), behind the main-module guard.
 *
 * Usage (from the repo root):
 *   node backend/scripts/backfill-horse-rider-names.mjs            # dry run
 *   node backend/scripts/backfill-horse-rider-names.mjs --execute  # write
 */

import { fileURLToPath } from 'node:url';
import prisma from '../../packages/database/prismaClient.mjs';

/** Horses whose rider JSON is an object with no usable name (optionally only `horseIds`). */
async function findNamelessRiderCopies(client, horseIds) {
  // Two literal queries rather than a composed fragment, so the optional scope
  // is never sent as a bind value.
  if (horseIds === null) {
    return client.$queryRaw`
      SELECT id, rider->>'id' AS "riderId"
      FROM horses
      WHERE rider IS NOT NULL
        AND jsonb_typeof(rider) = 'object'
        AND COALESCE(rider->>'name', '') = ''
      ORDER BY id`;
  }
  return client.$queryRaw`
    SELECT id, rider->>'id' AS "riderId"
    FROM horses
    WHERE rider IS NOT NULL
      AND jsonb_typeof(rider) = 'object'
      AND COALESCE(rider->>'name', '') = ''
      AND id = ANY(${horseIds}::int[])
    ORDER BY id`;
}

/**
 * Fill the missing `name` in nameless `Horse.rider` copies from the rider rows.
 *
 * @param {object} [options]
 * @param {object} [options.client] - Prisma client (defaults to the shared one)
 * @param {boolean} [options.execute] - write when true; count only when false
 * @param {number[]|null} [options.horseIds] - restrict to these horses (tests)
 * @returns {Promise<{ nameless: number, fixable: number, riderMissing: number, updated: number }>}
 */
export async function backfillHorseRiderNames({
  client = prisma,
  execute = false,
  horseIds = null,
} = {}) {
  const rows = await findNamelessRiderCopies(client, horseIds);
  const riderIds = [
    ...new Set(rows.map(r => Number.parseInt(r.riderId, 10)).filter(Number.isInteger)),
  ];
  const riders = await client.rider.findMany({
    where: { id: { in: riderIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const nameById = new Map(riders.map(r => [r.id, `${r.firstName} ${r.lastName}`]));

  const counts = { nameless: rows.length, fixable: 0, riderMissing: 0, updated: 0 };
  for (const row of rows) {
    const riderId = Number.parseInt(row.riderId, 10);
    const name = nameById.get(riderId);
    if (!name) {
      counts.riderMissing++;
      continue;
    }
    counts.fixable++;
    if (!execute) {
      continue;
    }
    const written = await client.$executeRaw`
      UPDATE horses
      SET rider = jsonb_set(rider, '{name}', to_jsonb(${name}::text), true)
      WHERE id = ${row.id}
        AND jsonb_typeof(rider) = 'object'
        AND rider->>'id' = ${String(riderId)}
        AND COALESCE(rider->>'name', '') = ''`;
    counts.updated += written;
  }
  return counts;
}

async function main() {
  const execute = process.argv.slice(2).includes('--execute');
  console.log(
    `backfill-horse-rider-names (Equoria-oey96.50) — ${execute ? 'EXECUTE' : 'DRY RUN (no writes)'}`,
  );
  const counts = await backfillHorseRiderNames({ execute });
  console.log(`  nameless rider copies: ${counts.nameless}`);
  console.log(`  fixable from a rider row: ${counts.fixable}`);
  console.log(`  rider row missing (left alone): ${counts.riderMissing}`);
  console.log(`  updated: ${counts.updated}${execute ? '' : '  (dry run)'}`);
  await prisma.$disconnect();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(async error => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
}
