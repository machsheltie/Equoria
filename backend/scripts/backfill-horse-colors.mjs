/**
 * backfill-horse-colors.mjs
 *
 * One-time script: gives a phenotype to every horse that has none, for horses
 * created before the color genetics system (Epic 31E).
 *
 * Equoria-k0d28 (GEN-09): a horse that already has a colorGenotype (a foal's
 * inherited genes) keeps it; only its phenotype is derived from it. A genotype
 * is generated only for a horse whose colorGenotype is empty. Each UPDATE runs
 * in its own transaction and is guarded in its WHERE clause, so a row changed
 * since it was read (phenotype set, or genotype written) is left alone.
 *
 * Safe to run multiple times — skips horses that already have phenotype set.
 *
 * Usage:
 *   node backend/scripts/backfill-horse-colors.mjs
 */

import prisma from '../../packages/database/prismaClient.mjs';
import { fileURLToPath } from 'node:url';
import {
  generateGenotype,
  calculateBreedPhenotype,
  generateMarkings,
} from '../modules/horses/index.mjs';

/**
 * Whether a stored colorGenotype carries genes (a non-empty object).
 *
 * @param {unknown} colorGenotype
 * @returns {boolean}
 */
function hasGenotype(colorGenotype) {
  return (
    colorGenotype !== null &&
    typeof colorGenotype === 'object' &&
    !Array.isArray(colorGenotype) &&
    Object.keys(colorGenotype).length > 0
  );
}

/**
 * Give a phenotype to every horse without one (optionally only the given ids).
 *
 * @param {{ horseIds?: number[]|null, log?: (msg: string) => void }} [options]
 * @returns {Promise<{ found: number, updated: number, keptGenotype: number, skipped: number, failed: number }>}
 */
export async function backfillHorseColors({ horseIds = null, log = console.log } = {}) {
  // Prisma's JSON null filter is complex; use raw SQL instead for reliability
  const horses = Array.isArray(horseIds)
    ? await prisma.$queryRaw`
        SELECT id, "breedId", "colorGenotype" FROM horses
        WHERE phenotype IS NULL AND id = ANY(${horseIds}::int[])
      `
    : await prisma.$queryRaw`
        SELECT id, "breedId", "colorGenotype" FROM horses WHERE phenotype IS NULL
      `;

  log(`Found ${horses.length} horses without color data. Generating...`);

  // Batch-fetch breed genetic profiles via raw SQL (avoids stale Prisma client schema issues)
  const breedIds = [...new Set(horses.map(h => h.breedId).filter(Boolean))];
  const breedProfileById = new Map();
  if (breedIds.length > 0) {
    const breeds = await prisma.$queryRaw`
      SELECT id, "breedGeneticProfile" FROM breeds WHERE id = ANY(${breedIds}::int[])
    `;
    for (const b of breeds) {
      breedProfileById.set(b.id, b.breedGeneticProfile);
    }
  }

  const result = { found: horses.length, updated: 0, keptGenotype: 0, skipped: 0, failed: 0 };

  for (const horse of horses) {
    try {
      const breedGeneticProfile = horse.breedId
        ? (breedProfileById.get(horse.breedId) ?? null)
        : null;

      const keepGenotype = hasGenotype(horse.colorGenotype);
      const colorGenotype = keepGenotype
        ? horse.colorGenotype
        : generateGenotype(breedGeneticProfile);
      // q277: the shade is rolled by the breed's odds, as for any new horse.
      const baseColor = calculateBreedPhenotype(colorGenotype, breedGeneticProfile);
      const markings = generateMarkings(
        breedGeneticProfile,
        baseColor.colorName,
        Math.random,
        colorGenotype,
      );
      const phenotype = { ...baseColor, ...markings };
      const genotypeJson = JSON.stringify(colorGenotype);
      const phenotypeJson = JSON.stringify(phenotype);

      // Raw SQL since the Prisma client in packages/database may be stale.
      const changed = await prisma.$transaction(tx =>
        keepGenotype
          ? tx.$executeRaw`
              UPDATE horses
              SET phenotype = ${phenotypeJson}::jsonb
              WHERE id = ${horse.id}
                AND phenotype IS NULL
                AND "colorGenotype" = ${genotypeJson}::jsonb
            `
          : tx.$executeRaw`
              UPDATE horses
              SET "colorGenotype" = ${genotypeJson}::jsonb,
                  phenotype = ${phenotypeJson}::jsonb
              WHERE id = ${horse.id}
                AND phenotype IS NULL
                AND ("colorGenotype" IS NULL
                     OR "colorGenotype" = 'null'::jsonb
                     OR "colorGenotype" = '{}'::jsonb)
            `,
      );

      if (changed === 0) {
        result.skipped++;
        continue;
      }
      result.updated++;
      if (keepGenotype) {
        result.keptGenotype++;
      }
      if (result.updated % 50 === 0) {
        log(`  ${result.updated}/${horses.length} updated...`);
      }
    } catch (err) {
      console.error(`  Failed to update horse ${horse.id}:`, err.message);
      result.failed++;
    }
  }

  log(
    `\nDone. Updated: ${result.updated} (kept inherited genotype: ${result.keptGenotype}), ` +
      `Skipped (changed since read): ${result.skipped}, Failed: ${result.failed}`,
  );
  return result;
}

// Equoria-5z0if: main-module guard. The backfill mutates Horse.colorGenotype/phenotype —
// must NOT run on bare import.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  backfillHorseColors()
    .then(() => prisma.$disconnect())
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
