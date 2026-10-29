/**
 * backfill-horse-temperament-gaits.mjs (Equoria-576c0.5)
 *
 * One-time backfill of a NULL `temperament` and a NULL `gaitScores` on existing
 * horses, ahead of making both columns required (owner ruling 2026-10-19, decision 4 /
 * O5, option A).
 *
 * How each value is filled
 *   - temperament: generateTemperament(breedName), the same roll a new horse gets (the
 *     breed's temperamentWeights over the 12 temperaments). No default-breed fallback.
 *   - gaitScores: generateGaitScores(breedName), the same roll a new horse gets: the
 *     breed's gait ranges only, with special gaits only for a gaited breed (owner
 *     rulings 2026-10-28, q210 / q211).
 *   - A horse with no breed, or whose breed has no profile, no temperament weights or
 *     no gait ranges, is NOT guessed: that column stays NULL and the horse is listed
 *     under `skipped` for manual handling. A column that can be filled is still filled.
 *   - A breed-profile source that failed to load (an error with a `cause`) aborts the
 *     run; that is an infrastructure fault, not a missing breed.
 *
 * Safety
 *   - The whole run is one transaction. A dry run (the default) performs every UPDATE,
 *     re-counts the NULLs inside the transaction, then rolls everything back, so it
 *     proves the backfill against real rows and writes nothing. Pass --apply to commit.
 *   - Each UPDATE is scoped to one horse id and only sets a column that is still NULL,
 *     so a re-run (or a row filled meanwhile) is never overwritten.
 *   - The breed-profile cache is preloaded from the database first, as the server does,
 *     so the rolls use the same breed data new horses get.
 *
 * Usage (from backend/)
 *   node scripts/backfill-horse-temperament-gaits.mjs           # dry run, rolled back
 *   node scripts/backfill-horse-temperament-gaits.mjs --apply   # commit
 */

import { fileURLToPath } from 'node:url';
import prisma from '../../packages/database/prismaClient.mjs';
import { preloadBreedProfiles } from '../modules/horses/index.mjs';
import { generateTemperament } from '../modules/horses/services/temperamentService.mjs';
import { generateGaitScores } from '../modules/horses/services/gaitService.mjs';

/** Thrown inside the transaction to roll a dry run back; carries its result out. */
class DryRunRollback extends Error {
  constructor(result) {
    super('dry run rolled back');
    this.result = result;
  }
}

/**
 * Roll one value from the breed, or explain why it cannot be rolled.
 * @param {() => unknown} roll
 * @returns {{ value?: unknown, reason?: string }}
 */
function tryRoll(roll) {
  try {
    return { value: roll() };
  } catch (err) {
    if (err?.cause) {
      throw err;
    }
    return { reason: err.message };
  }
}

/**
 * Work out the fill for each horse. Pure apart from the breed-profile lookups.
 *
 * @param {Array<{ id: number, name: string, breedName: string|null,
 *   temperament: string|null, gaitScores: object|null }>} horses
 * @param {{ random?: () => number }} [options] - uniform source for the gait rolls
 * @returns {{ updates: Array<{ id: number, temperament?: string, gaitScores?: object }>,
 *   skipped: Array<{ id: number, name: string, breedName: string|null,
 *   columns: string[], reason: string }> }}
 */
export function planTemperamentGaitBackfill(horses, { random = Math.random } = {}) {
  const updates = [];
  const skipped = [];
  for (const horse of horses) {
    const needsTemperament = horse.temperament === null;
    const needsGaits = horse.gaitScores === null;
    if (!needsTemperament && !needsGaits) {
      continue;
    }
    const update = { id: horse.id };
    const missing = [];
    const reasons = [];
    if (!horse.breedName) {
      if (needsTemperament) {
        missing.push('temperament');
      }
      if (needsGaits) {
        missing.push('gaitScores');
      }
      reasons.push('horse has no breed');
    } else {
      if (needsTemperament) {
        const t = tryRoll(() => generateTemperament(horse.breedName));
        if (t.reason) {
          missing.push('temperament');
          reasons.push(t.reason);
        } else {
          update.temperament = t.value;
        }
      }
      if (needsGaits) {
        const g = tryRoll(() => generateGaitScores(horse.breedName, { random }));
        if (g.reason) {
          missing.push('gaitScores');
          reasons.push(g.reason);
        } else {
          update.gaitScores = g.value;
        }
      }
    }
    if (Object.keys(update).length > 1) {
      updates.push(update);
    }
    if (missing.length > 0) {
      skipped.push({
        id: horse.id,
        name: horse.name,
        breedName: horse.breedName ?? null,
        columns: missing,
        reason: reasons.join('; '),
      });
    }
  }
  return { updates, skipped };
}

async function selectCandidates(client, horseIds) {
  if (horseIds) {
    return client.$queryRaw`
      SELECT h.id, h.name, h.temperament, h."gaitScores", b.name AS "breedName"
      FROM horses h LEFT JOIN breeds b ON b.id = h."breedId"
      WHERE (h.temperament IS NULL OR h."gaitScores" IS NULL)
        AND h.id = ANY(${horseIds}::int[])
      ORDER BY h.id`;
  }
  return client.$queryRaw`
    SELECT h.id, h.name, h.temperament, h."gaitScores", b.name AS "breedName"
    FROM horses h LEFT JOIN breeds b ON b.id = h."breedId"
    WHERE h.temperament IS NULL OR h."gaitScores" IS NULL
    ORDER BY h.id`;
}

async function countNulls(client, horseIds) {
  const [row] = horseIds
    ? await client.$queryRaw`
        SELECT count(*) FILTER (WHERE temperament IS NULL)::int AS "nullTemperament",
               count(*) FILTER (WHERE "gaitScores" IS NULL)::int AS "nullGaitScores"
        FROM horses WHERE id = ANY(${horseIds}::int[])`
    : await client.$queryRaw`
        SELECT count(*) FILTER (WHERE temperament IS NULL)::int AS "nullTemperament",
               count(*) FILTER (WHERE "gaitScores" IS NULL)::int AS "nullGaitScores"
        FROM horses`;
  return row;
}

/**
 * Fill NULL temperament and gaitScores in one transaction.
 *
 * @param {{ dryRun?: boolean, horseIds?: number[], random?: () => number,
 *   client?: import('@prisma/client').PrismaClient }} [options]
 *   `dryRun` (default true) rolls the transaction back after the re-count;
 *   `horseIds` narrows the run to those horses (tests, or one horse by hand).
 * @returns {Promise<{ rolledBack: boolean, before: object, after: object,
 *   temperamentFilled: number, gaitScoresFilled: number, skipped: object[] }>}
 */
export async function runTemperamentGaitBackfill({
  dryRun = true,
  horseIds,
  random = Math.random,
  client = prisma,
} = {}) {
  try {
    return await client.$transaction(
      async tx => {
        const before = await countNulls(tx, horseIds);
        const candidates = await selectCandidates(tx, horseIds);
        const { updates, skipped } = planTemperamentGaitBackfill(candidates, { random });
        let temperamentFilled = 0;
        let gaitScoresFilled = 0;
        for (const u of updates) {
          if (u.temperament !== undefined) {
            temperamentFilled += await tx.$executeRaw`
              UPDATE horses SET temperament = ${u.temperament}
              WHERE id = ${u.id} AND temperament IS NULL`;
          }
          if (u.gaitScores !== undefined) {
            gaitScoresFilled += await tx.$executeRaw`
              UPDATE horses SET "gaitScores" = ${JSON.stringify(u.gaitScores)}::jsonb
              WHERE id = ${u.id} AND "gaitScores" IS NULL`;
          }
        }
        const after = await countNulls(tx, horseIds);
        const result = {
          rolledBack: dryRun,
          before,
          after,
          temperamentFilled,
          gaitScoresFilled,
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
  const result = await runTemperamentGaitBackfill({ dryRun: !apply });
  for (const s of result.skipped) {
    console.log(`SKIPPED ${JSON.stringify(s)}`);
  }
  console.log(
    JSON.stringify({
      mode: apply ? 'APPLIED' : 'DRY RUN (rolled back, nothing written)',
      before: result.before,
      after: result.after,
      temperamentFilled: result.temperamentFilled,
      gaitScoresFilled: result.gaitScoresFilled,
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
