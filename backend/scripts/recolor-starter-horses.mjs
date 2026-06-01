/**
 * recolor-starter-horses.mjs (Equoria-wvdya)
 *
 * One-time, idempotent, SCOPED recolor of the legacy all-Bay starter horses.
 *
 * Context: before Equoria-mvrvb fixed NEW starter color generation, the
 * registration path minted every "<username>'s First Horse" with the fixed
 * GENERIC_DEFAULTS genotype — which always phenotypes as Bay. The canonical DB
 * still holds ~6877 of these all-Bay starter rows. mvrvb only fixed go-forward
 * generation; this script gives the EXISTING starters the same diverse,
 * game-coherent color distribution (GENERIC_STARTER_WEIGHTS) that new starters
 * now get.
 *
 * Why a separate script from 26qjf.5's re-roll:
 *   26qjf.5 re-rolls default-signature horses that HAVE a breed profile (reading
 *   breeds.breedGeneticProfile). Starter "First Horse" rows are BREEDLESS
 *   (breedId IS NULL), so 26qjf.5 skips them (skippedNoBreedProfile). This
 *   script handles exactly that breedless default-signature starter population
 *   via the no-profile generateGenotype(null) path.
 *
 * Scoping (CLAUDE.md Rule 2 — never touch real customized data):
 *   A row is recolored ONLY if ALL of these hold:
 *     - name matches the starter pattern  "%'s First Horse"
 *     - breedId IS NULL (a real bred/purchased horse has a breed)
 *     - colorGenotype is the default signature (all GENERIC_DEFAULTS; legacy
 *       17-locus rows missing Prl/BR1 count as default — see isDefaultSignature)
 *   Any starter whose genotype is NOT default-signature (a tester/user already
 *   recolored it, or it carries real color data) is left UNTOUCHED.
 *
 * Idempotency:
 *   After recolor, the genotype is no longer the default signature, so a second
 *   run's filter excludes it → zero net change on re-run.
 *
 * Safety:
 *   - All writes are id-scoped single-row UPDATEs (never a bulk unscoped update).
 *   - --dry-run reports the candidate count + sample without writing.
 *   - Records BEFORE/AFTER distinct colorName counts for the starter population.
 *
 * Usage:
 *   node backend/scripts/recolor-starter-horses.mjs --dry-run
 *   node backend/scripts/recolor-starter-horses.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from '../../packages/database/prismaClient.mjs';
import {
  generateGenotype,
  calculatePhenotype,
  generateMarkings,
} from '../modules/horses/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');

// Equoria-kfgep: isDefaultSignature lives in the shared helper module
// backend/utils/defaultGenotypeSignature.mjs (with SIGNATURE_OPTIONAL_LOCI for
// the Prl/BR1 carve-out — loci added in Equoria-26qjf.1, missing keys on
// legacy starter rows treated as default since the wild-type IS 'n/n'). Import
// it and re-export so this module's local callers and its test keep working
// with the canonical single-source implementation.
import { isDefaultSignature } from '../utils/defaultGenotypeSignature.mjs';
export { isDefaultSignature };

/** Distinct colorName counts for the starter ("First Horse") population only. */
async function countStarterColors() {
  const rows = await prisma.$queryRaw`
    SELECT phenotype->>'colorName' AS color, COUNT(*)::int AS cnt
    FROM horses
    WHERE name LIKE '%''s First Horse' AND "breedId" IS NULL AND phenotype IS NOT NULL
    GROUP BY phenotype->>'colorName'
    ORDER BY cnt DESC
  `;
  return rows;
}

async function run() {
  const startedAt = new Date();
  console.log('\n=== recolor-starter-horses.mjs (Equoria-wvdya) ===');
  console.log(`  Started: ${startedAt.toISOString()}`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'WRITE'}`);

  const before = await countStarterColors();
  const beforeTotal = before.reduce((s, r) => s + r.cnt, 0);
  console.log(
    `\n  BEFORE — starter population: ${beforeTotal} horses, ${before.length} distinct colors`,
  );
  for (const row of before.slice(0, 10)) {
    console.log(`    ${row.color}: ${row.cnt}`);
  }

  // Candidate set: breedless starters with a non-null genotype. We filter to
  // default-signature in-memory (raw JSON-equality in SQL is brittle).
  const candidates = await prisma.$queryRaw`
    SELECT id, "colorGenotype"
    FROM horses
    WHERE name LIKE '%''s First Horse'
      AND "breedId" IS NULL
      AND "colorGenotype" IS NOT NULL
  `;
  console.log(
    `\n  Scanning ${candidates.length} breedless starter horses for default signature...`,
  );

  let recolored = 0;
  let skippedNonDefault = 0;
  let failed = 0;

  for (const horse of candidates) {
    if (!isDefaultSignature(horse.colorGenotype)) {
      skippedNonDefault++;
      continue;
    }
    try {
      // Breedless → no-profile starter distribution (the post-mvrvb diverse path).
      const colorGenotype = generateGenotype(null);
      const baseColor = calculatePhenotype(colorGenotype, null);
      const markings = generateMarkings(null, baseColor.colorName);
      const phenotype = { ...baseColor, ...markings };

      if (!DRY_RUN) {
        // id-scoped single-row update — never bulk/unscoped.
        await prisma.$executeRaw`
          UPDATE horses
          SET "colorGenotype" = ${JSON.stringify(colorGenotype)}::jsonb,
              phenotype = ${JSON.stringify(phenotype)}::jsonb
          WHERE id = ${horse.id}
        `;
      }
      recolored++;
      if (recolored % 500 === 0) {
        console.log(`    ${recolored} recolored so far...`);
      }
    } catch (err) {
      failed++;
      console.error(`    [FAIL] horse ${horse.id}: ${err.message}`);
    }
  }

  console.log(`\n  Recolored: ${recolored}${DRY_RUN ? ' (would recolor — dry run)' : ''}`);
  console.log(
    `  Skipped (genotype already non-default — customization preserved): ${skippedNonDefault}`,
  );
  console.log(`  Failed: ${failed}`);

  const after = await countStarterColors();
  console.log(`\n  AFTER — starter population: ${after.length} distinct colors`);
  for (const row of after.slice(0, 12)) {
    console.log(`    ${row.color}: ${row.cnt}`);
  }

  // Audit log
  const finishedAt = new Date();
  const summary = {
    issue: 'Equoria-wvdya',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt - startedAt,
    dryRun: DRY_RUN,
    candidatesScanned: candidates.length,
    recolored,
    skippedNonDefault,
    failed,
    before,
    after,
    distinctColorCountBefore: before.length,
    distinctColorCountAfter: after.length,
  };
  const logDir = join(__dirname, '..', 'logs');
  const logFile = join(
    logDir,
    `recolor-starter-horses-${finishedAt.toISOString().replace(/[:.]/g, '-')}.log.json`,
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

// Run only when invoked directly (not when imported by a test).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run().catch(async err => {
    console.error('Fatal:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
}
