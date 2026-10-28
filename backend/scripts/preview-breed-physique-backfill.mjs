/**
 * preview-breed-physique-backfill.mjs: DRY RUN ONLY. Writes nothing.
 *
 * Equoria-vqz4b / Equoria-17zgu. Horse Trader and onboarding starter horses used to
 * be created with the flat-20 conformation placeholder and no gait scores. New horses
 * are now rolled from their breed's ranges (modules/horses/services/breedPhysique.mjs).
 * Whether EXISTING horses should be re-rolled is an open owner question (decision
 * q208), so this script only shows what a re-roll would produce. It has no write path;
 * a real backfill needs the owner's answer and a separate, reviewed script.
 *
 * Candidates (read with SELECT only):
 *   - conformation is exactly the flat-20 placeholder in all 8 regions AND the horse
 *     has no sire and no dam (a foal is never generated flat), or
 *   - gaitScores IS NULL.
 * For each candidate it prints the old values and one sample re-roll from the
 * breed's ranges: new conformation where the old one is the placeholder (otherwise
 * kept), then gaits from that conformation where gaits are NULL (otherwise kept).
 * Every run draws a fresh sample, so the printed "new" values are illustrative.
 * Horses whose breed has no ranges are listed as skipped.
 *
 * Usage (from backend/):
 *   node scripts/preview-breed-physique-backfill.mjs [--limit=N]
 */

import { fileURLToPath } from 'node:url';
import prisma from '../../packages/database/prismaClient.mjs';
import { preloadBreedProfiles, generateBreedPhysique } from '../modules/horses/index.mjs';
import { generateGaitScores } from '../modules/horses/services/gaitService.mjs';

const regions = ['head', 'neck', 'shoulders', 'back', 'hindquarters', 'legs', 'hooves', 'topline'];

function isFlatPlaceholder(conf) {
  return (
    conf !== null &&
    typeof conf === 'object' &&
    !Array.isArray(conf) &&
    regions.every(r => conf[r] === 20)
  );
}

function parseLimit(argv) {
  const arg = argv.find(a => a.startsWith('--limit='));
  const n = arg ? Number.parseInt(arg.slice('--limit='.length), 10) : 500;
  return Number.isInteger(n) && n > 0 ? n : 500;
}

async function main() {
  const limit = parseLimit(process.argv.slice(2));
  await preloadBreedProfiles(prisma);

  const horses = await prisma.$queryRaw`
    SELECT h.id, h.name, h."breedId", h."sireId", h."damId",
           h."conformationScores", h."gaitScores", b.name AS "breedName"
    FROM horses h
    LEFT JOIN breeds b ON b.id = h."breedId"
    WHERE h."gaitScores" IS NULL
       OR (h."sireId" IS NULL AND h."damId" IS NULL
           AND h."conformationScores"->>'head' = '20'
           AND h."conformationScores"->>'topline' = '20')
    ORDER BY h.id
    LIMIT ${limit}
  `;

  let previewed = 0;
  let skipped = 0;
  for (const h of horses) {
    const rerollConformation = !h.sireId && !h.damId && isFlatPlaceholder(h.conformationScores);
    const rerollGaits = h.gaitScores === null;
    if (!rerollConformation && !rerollGaits) {
      continue;
    }
    if (!h.breedName) {
      skipped++;
      console.log(JSON.stringify({ id: h.id, name: h.name, skipped: 'no breed' }));
      continue;
    }
    try {
      const rolled = generateBreedPhysique(h.breedName);
      const conformationScores = rerollConformation
        ? rolled.conformationScores
        : h.conformationScores;
      const gaitScores = rerollGaits
        ? rerollConformation
          ? rolled.gaitScores
          : generateGaitScores(h.breedName, conformationScores)
        : h.gaitScores;
      previewed++;
      console.log(
        JSON.stringify({
          id: h.id,
          name: h.name,
          breed: h.breedName,
          old: { conformationScores: h.conformationScores, gaitScores: h.gaitScores },
          new: { conformationScores, gaitScores },
        }),
      );
    } catch (err) {
      skipped++;
      console.log(
        JSON.stringify({ id: h.id, name: h.name, breed: h.breedName, skipped: err.message }),
      );
    }
  }

  console.log(
    `DRY RUN: ${previewed} horse(s) previewed, ${skipped} skipped (limit ${limit}). Nothing was written.`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
    .catch(error => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
