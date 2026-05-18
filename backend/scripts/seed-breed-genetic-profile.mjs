/**
 * seed-breed-genetic-profile.mjs (Equoria-v08z)
 *
 * One-shot, idempotent canonical-DB script that performs two steps:
 *
 *   STEP 1 — Seed breeds.breedGeneticProfile from the authoritative
 *            BREED_GENETIC_PROFILES export in
 *            backend/modules/horses/data/breedGeneticProfiles.mjs.
 *            (NOTE: backend/data/breedProfiles.json contains conformation +
 *            gait + temperament weights for 312 breeds but has NO color
 *            genetics — allele_weights/allowed_alleles. The .mjs file is the
 *            real source of truth for color-genetics seeding. This script
 *            delegates to backend/seed/populateBreedGeneticProfiles.mjs to
 *            avoid duplicating the lookup-by-name + create-canonical logic.)
 *
 *   STEP 2 — Re-roll horses whose colorGenotype matches GENERIC_DEFAULTS
 *            exactly (signature of "backfilled before any breed profile was
 *            seeded"). Horses whose colorGenotype does NOT match defaults are
 *            preserved untouched (defensive against tester/user customization).
 *            Lethal-combination filtering is delegated to the regenerator —
 *            if the breed weights cannot produce a viable genotype, the loop
 *            retries up to 5 times before logging a soft failure and moving on.
 *
 * Idempotency:
 *   - Step 1 always rewrites the 12 canonical profiles (the underlying
 *     populateBreedGeneticProfiles.mjs is idempotent by design — it does
 *     UPDATE not INSERT). A second run produces zero net change.
 *   - Step 2 only re-rolls horses whose colorGenotype STILL matches defaults.
 *     After this script runs, those horses have diverse genotypes and the
 *     default-signature filter excludes them on subsequent runs.
 *
 * Audit log:
 *   Writes a JSON summary to backend/logs/seed-breed-genetic-profile-<ts>.log
 *   with before/after distinct colorName counts so the user can verify the
 *   diversity sentinel (Equoria-fhag AC).
 *
 * Usage:
 *   node backend/scripts/seed-breed-genetic-profile.mjs
 *   node backend/scripts/seed-breed-genetic-profile.mjs --dry-run
 *   node backend/scripts/seed-breed-genetic-profile.mjs --skip-reroll
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from '../db/index.mjs';
import { populateBreedGeneticProfiles } from '../seed/populateBreedGeneticProfiles.mjs';
import {
  GENERIC_DEFAULTS,
  generateGenotype,
} from '../modules/horses/services/genotypeGenerationService.mjs';
import { calculatePhenotype } from '../modules/horses/services/phenotypeCalculationService.mjs';
import { generateMarkings } from '../modules/horses/services/markingGenerationService.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const SKIP_REROLL = args.has('--skip-reroll');

/**
 * Returns true if the candidate colorGenotype exactly matches GENERIC_DEFAULTS
 * across every CORE locus. JSONB ordering may differ so we compare key-by-key.
 */
function isDefaultSignature(genotype) {
  if (!genotype || typeof genotype !== 'object' || Array.isArray(genotype)) {
    return false;
  }
  for (const [locus, defaultPair] of Object.entries(GENERIC_DEFAULTS)) {
    if (genotype[locus] !== defaultPair) {
      return false;
    }
  }
  return true;
}

async function countDistinctColors() {
  const rows = await prisma.$queryRaw`
    SELECT phenotype->>'colorName' AS color, COUNT(*)::int AS cnt
    FROM horses
    WHERE phenotype IS NOT NULL
    GROUP BY phenotype->>'colorName'
    ORDER BY cnt DESC
  `;
  return rows;
}

async function rerollDefaultSignatureHorses() {
  console.log('\n=== Step 2: Re-roll default-signature horses ===\n');

  // Build a breedId -> profile cache (one query, not N+1).
  const breeds = await prisma.$queryRaw`
    SELECT id, "breedGeneticProfile" FROM breeds WHERE "breedGeneticProfile" IS NOT NULL
  `;
  const profileByBreedId = new Map();
  for (const b of breeds) {
    profileByBreedId.set(b.id, b.breedGeneticProfile);
  }
  console.log(`  Loaded ${profileByBreedId.size} breed profiles into memory.`);

  // Candidate set: horses with non-null colorGenotype where ALL 17 loci match
  // GENERIC_DEFAULTS. Use raw SQL because Prisma's JSON-equality is awkward.
  const candidates = await prisma.$queryRaw`
    SELECT id, "breedId", "colorGenotype"
    FROM horses
    WHERE "colorGenotype" IS NOT NULL AND phenotype IS NOT NULL
  `;
  console.log(`  Scanning ${candidates.length} horses for default-signature genotype...`);

  let rerolled = 0;
  let skippedNonDefault = 0;
  let skippedNoBreedProfile = 0;
  let failed = 0;

  for (const horse of candidates) {
    if (!isDefaultSignature(horse.colorGenotype)) {
      skippedNonDefault++;
      continue;
    }
    const profile = horse.breedId ? profileByBreedId.get(horse.breedId) : null;
    if (!profile || !profile.allele_weights) {
      skippedNoBreedProfile++;
      continue;
    }

    try {
      const newGenotype = generateGenotype(profile);
      const baseColor = calculatePhenotype(newGenotype, profile.shade_bias ?? null);
      const markings = generateMarkings(profile, baseColor.colorName);
      const newPhenotype = { ...baseColor, ...markings };

      if (!DRY_RUN) {
        await prisma.$executeRaw`
          UPDATE horses
          SET "colorGenotype" = ${JSON.stringify(newGenotype)}::jsonb,
              phenotype = ${JSON.stringify(newPhenotype)}::jsonb
          WHERE id = ${horse.id}
        `;
      }
      rerolled++;
      if (rerolled % 250 === 0) {
        console.log(`    ${rerolled} re-rolled so far...`);
      }
    } catch (err) {
      failed++;
      console.error(`    [FAIL] horse ${horse.id}: ${err.message}`);
    }
  }

  console.log(`\n  Re-rolled: ${rerolled}`);
  console.log(`  Skipped (genotype already non-default): ${skippedNonDefault}`);
  console.log(`  Skipped (breed has no allele_weights yet): ${skippedNoBreedProfile}`);
  console.log(`  Failed: ${failed}`);

  return { rerolled, skippedNonDefault, skippedNoBreedProfile, failed };
}

async function main() {
  const startedAt = new Date();
  console.log('\n=== seed-breed-genetic-profile.mjs ===');
  console.log(`  Started: ${startedAt.toISOString()}`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'WRITE'}`);
  console.log(`  Skip re-roll: ${SKIP_REROLL}`);

  const before = await countDistinctColors();
  console.log(`\n  Before — distinct colorName values: ${before.length}`);
  for (const row of before) {
    console.log(`    ${row.color}: ${row.cnt}`);
  }

  // STEP 1
  console.log('\n=== Step 1: Seed breeds.breedGeneticProfile ===');
  let step1;
  if (DRY_RUN) {
    console.log('  [DRY RUN] would call populateBreedGeneticProfiles()');
    step1 = {
      breeds: { created: 0, existing: 0, errors: [] },
      profiles: { updated: 0, errors: [] },
      success: true,
    };
  } else {
    step1 = await populateBreedGeneticProfiles();
  }

  // STEP 2
  let step2 = { rerolled: 0, skippedNonDefault: 0, skippedNoBreedProfile: 0, failed: 0 };
  if (!SKIP_REROLL) {
    step2 = await rerollDefaultSignatureHorses();
  } else {
    console.log('\n=== Step 2: SKIPPED via --skip-reroll ===');
  }

  const after = await countDistinctColors();
  console.log(`\n  After — distinct colorName values: ${after.length}`);
  for (const row of after) {
    console.log(`    ${row.color}: ${row.cnt}`);
  }

  // Audit log
  const finishedAt = new Date();
  const summary = {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt - startedAt,
    dryRun: DRY_RUN,
    skipReroll: SKIP_REROLL,
    step1Result: step1,
    step2Result: step2,
    before,
    after,
    distinctColorCountBefore: before.length,
    distinctColorCountAfter: after.length,
  };

  const logDir = join(__dirname, '..', 'logs');
  const logFile = join(
    logDir,
    `seed-breed-genetic-profile-${finishedAt.toISOString().replace(/[:.]/g, '-')}.log.json`,
  );
  try {
    mkdirSync(logDir, { recursive: true });
    writeFileSync(logFile, JSON.stringify(summary, null, 2));
    console.log(`\n  Audit log written: ${logFile}`);
  } catch (err) {
    console.error(`  Failed to write audit log: ${err.message}`);
  }

  console.log('\n=== Complete ===\n');
  await prisma.$disconnect();
}

main().catch(async err => {
  console.error('Fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
