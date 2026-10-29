/**
 * backfill-horse-breed-conformation.mjs (Equoria-vqz4b, owner ruling q208)
 *
 * One-time re-score of horses still carrying the flat-20 conformation placeholder
 * (every region 20, overall 20: the column default). Owner ruling 2026-10-28, q208:
 * "Yes, re-score all 5 from their breed ranges". Replaces the read-only
 * preview-breed-physique-backfill.mjs, whose gait half the temperament/gait backfill
 * (backfill-horse-temperament-gaits.mjs) already covered.
 *
 * How the scores are rolled
 *   - generateConformationScores(breedName): the same conformation roll a new store or
 *     starter horse gets through breedPhysique.mjs. Each of the 8 regions comes from its
 *     own breed range, then overallConformation is their rounded average.
 *   - Only conformationScores is written. Gait scores are not read or touched.
 *   - A horse with no breed, or whose breed has no conformation ranges, is NOT guessed:
 *     it keeps the placeholder and is listed under `skipped` for manual handling.
 *   - A breed-profile source that failed to load (an error with a `cause`) aborts the
 *     run; that is an infrastructure fault, not a missing breed.
 *
 * Which horses
 *   Only rows whose conformationScores equals the placeholder exactly (jsonb equality:
 *   the same 9 keys, every value 20, nothing else). Any other conformation, including a
 *   partly-20 one, is left alone.
 *
 * Safety
 *   - The whole run is one transaction. A dry run (the default) performs every UPDATE,
 *     re-counts the placeholders inside the transaction, then rolls everything back, so
 *     it proves the re-score against real rows and writes nothing. Pass --apply to commit.
 *   - Each UPDATE is scoped to one horse id and only applies while that row still holds
 *     the placeholder, so a re-run (or a row changed meanwhile) is never overwritten.
 *   - The breed-profile cache is preloaded from the database first, as the server does,
 *     so the rolls use the same breed data new horses get.
 *
 * Usage (from backend/)
 *   node scripts/backfill-horse-breed-conformation.mjs           # dry run, rolled back
 *   node scripts/backfill-horse-breed-conformation.mjs --apply   # commit
 */

import { fileURLToPath } from 'node:url';
import prisma from '../../packages/database/prismaClient.mjs';
import { preloadBreedProfiles } from '../modules/horses/index.mjs';
import { generateConformationScores } from '../modules/horses/services/conformationService.mjs';

/** The schema default for horses.conformationScores: the flat-20 placeholder. */
export const flatConformationPlaceholder = Object.freeze({
  head: 20,
  neck: 20,
  shoulders: 20,
  back: 20,
  legs: 20,
  hooves: 20,
  topline: 20,
  hindquarters: 20,
  overallConformation: 20,
});

const placeholderJson = JSON.stringify(flatConformationPlaceholder);

/** Thrown inside the transaction to roll a dry run back; carries its result out. */
class DryRunRollback extends Error {
  constructor(result) {
    super('dry run rolled back');
    this.result = result;
  }
}

/**
 * Work out the re-score for each placeholder horse. Pure apart from the breed-profile
 * lookups.
 *
 * @param {Array<{ id: number, name: string, breedName: string|null }>} horses
 * @param {{ random?: () => number }} [options] - uniform source for the rolls
 * @returns {{ updates: Array<{ id: number, conformationScores: object }>,
 *   skipped: Array<{ id: number, name: string, breedName: string|null, reason: string }> }}
 */
export function planBreedConformationBackfill(horses, { random = Math.random } = {}) {
  const updates = [];
  const skipped = [];
  for (const horse of horses) {
    if (!horse.breedName) {
      skipped.push({
        id: horse.id,
        name: horse.name,
        breedName: null,
        reason: 'horse has no breed',
      });
      continue;
    }
    try {
      updates.push({
        id: horse.id,
        conformationScores: generateConformationScores(horse.breedName, { random }),
      });
    } catch (err) {
      if (err?.cause) {
        throw err;
      }
      skipped.push({
        id: horse.id,
        name: horse.name,
        breedName: horse.breedName,
        reason: err.message,
      });
    }
  }
  return { updates, skipped };
}

async function selectPlaceholderHorses(client, horseIds) {
  if (horseIds) {
    return client.$queryRaw`
      SELECT h.id, h.name, b.name AS "breedName"
      FROM horses h LEFT JOIN breeds b ON b.id = h."breedId"
      WHERE h."conformationScores" = ${placeholderJson}::jsonb
        AND h.id = ANY(${horseIds}::int[])
      ORDER BY h.id`;
  }
  return client.$queryRaw`
    SELECT h.id, h.name, b.name AS "breedName"
    FROM horses h LEFT JOIN breeds b ON b.id = h."breedId"
    WHERE h."conformationScores" = ${placeholderJson}::jsonb
    ORDER BY h.id`;
}

async function countPlaceholders(client, horseIds) {
  const [row] = horseIds
    ? await client.$queryRaw`
        SELECT count(*)::int AS "placeholderHorses" FROM horses
        WHERE "conformationScores" = ${placeholderJson}::jsonb
          AND id = ANY(${horseIds}::int[])`
    : await client.$queryRaw`
        SELECT count(*)::int AS "placeholderHorses" FROM horses
        WHERE "conformationScores" = ${placeholderJson}::jsonb`;
  return row.placeholderHorses;
}

/**
 * Re-score every flat-20 placeholder conformation from the breed, in one transaction.
 *
 * @param {{ dryRun?: boolean, horseIds?: number[], random?: () => number,
 *   client?: import('@prisma/client').PrismaClient }} [options]
 *   `dryRun` (default true) rolls the transaction back after the re-count;
 *   `horseIds` narrows the run to those horses (tests, or one horse by hand).
 * @returns {Promise<{ rolledBack: boolean, placeholdersBefore: number,
 *   placeholdersAfter: number, rescored: Array<{ id: number, conformationScores: object }>,
 *   skipped: object[] }>}
 */
export async function runBreedConformationBackfill({
  dryRun = true,
  horseIds,
  random = Math.random,
  client = prisma,
} = {}) {
  try {
    return await client.$transaction(
      async tx => {
        const placeholdersBefore = await countPlaceholders(tx, horseIds);
        const candidates = await selectPlaceholderHorses(tx, horseIds);
        const { updates, skipped } = planBreedConformationBackfill(candidates, { random });
        const rescored = [];
        for (const u of updates) {
          const changed = await tx.$executeRaw`
            UPDATE horses SET "conformationScores" = ${JSON.stringify(u.conformationScores)}::jsonb
            WHERE id = ${u.id} AND "conformationScores" = ${placeholderJson}::jsonb`;
          if (changed === 1) {
            rescored.push(u);
          }
        }
        const placeholdersAfter = await countPlaceholders(tx, horseIds);
        const result = {
          rolledBack: dryRun,
          placeholdersBefore,
          placeholdersAfter,
          rescored,
          skipped,
        };
        if (dryRun) {
          throw new DryRunRollback(result);
        }
        return result;
      },
      { timeout: 120000 },
    );
  } catch (err) {
    if (err instanceof DryRunRollback) {
      return err.result;
    }
    throw err;
  }
}

async function main() {
  const apply = process.argv.slice(2).includes('--apply');
  await preloadBreedProfiles(prisma);
  const result = await runBreedConformationBackfill({ dryRun: !apply });
  for (const r of result.rescored) {
    console.log(`RESCORED ${JSON.stringify(r)}`);
  }
  for (const s of result.skipped) {
    console.log(`SKIPPED ${JSON.stringify(s)}`);
  }
  console.log(
    JSON.stringify({
      mode: apply ? 'APPLIED' : 'DRY RUN (rolled back, nothing written)',
      placeholdersBefore: result.placeholdersBefore,
      placeholdersAfter: result.placeholdersAfter,
      rescored: result.rescored.length,
      skippedHorses: result.skipped.length,
    }),
  );
}

// Main-module guard: main() writes horses and must not run on import.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
    .catch(err => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
