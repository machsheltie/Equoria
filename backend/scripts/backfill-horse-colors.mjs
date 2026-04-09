/**
 * backfill-horse-colors.mjs
 *
 * One-time script: generates colorGenotype and phenotype for all existing horses
 * that were created before the color genetics system (Epic 31E).
 *
 * Safe to run multiple times — skips horses that already have phenotype set.
 *
 * Usage:
 *   node backend/scripts/backfill-horse-colors.mjs
 */

import prisma from '../db/index.mjs';
import { generateGenotype } from '../modules/horses/services/genotypeGenerationService.mjs';
import { calculatePhenotype } from '../modules/horses/services/phenotypeCalculationService.mjs';
import { generateMarkings } from '../modules/horses/services/markingGenerationService.mjs';

async function run() {
  // Prisma's JSON null filter is complex; use raw SQL instead for reliability
  const horses = await prisma.$queryRaw`
    SELECT id, "breedId" FROM horses WHERE phenotype IS NULL
  `;

  console.log(`Found ${horses.length} horses without color data. Generating...`);

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

  let updated = 0;
  let failed = 0;

  for (const horse of horses) {
    try {
      const breedGeneticProfile = horse.breedId
        ? (breedProfileById.get(horse.breedId) ?? null)
        : null;

      const colorGenotype = generateGenotype(breedGeneticProfile);
      const baseColor = calculatePhenotype(colorGenotype, breedGeneticProfile?.shade_bias ?? null);
      const markings = generateMarkings(breedGeneticProfile, baseColor.colorName);
      const phenotype = { ...baseColor, ...markings };

      // Use raw SQL since the Prisma client in packages/database may be stale
      await prisma.$executeRaw`
        UPDATE horses
        SET "colorGenotype" = ${JSON.stringify(colorGenotype)}::jsonb,
            phenotype = ${JSON.stringify(phenotype)}::jsonb
        WHERE id = ${horse.id}
      `;

      updated++;
      if (updated % 50 === 0) {
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

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
