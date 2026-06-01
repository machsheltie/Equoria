/**
 * backfillStarterHorseBreedId.mjs — Equoria-b9zgr
 *
 * ONE-TIME, SCOPED backfill for horses that were created with a NULL breedId
 * by the pre-fix registration path (authController.register created the
 * starter horse via a raw prisma.horse.create() that omitted any breed
 * connection — so every registration starter horse, ~3334 rows, was born
 * breedless). The forward fix is in authController.register (new starter
 * horses now arrive with the default breed); this script repairs the existing
 * NULL rows.
 *
 * ⚠️ DESTRUCTIVE REAL-DB MUTATION — governed by CLAUDE.md Rule 2 (REAL DB
 * ONLY). DO NOT RUN without explicit user/lead awareness. Defaults to DRY-RUN:
 * it reports what it WOULD change and writes nothing unless you pass --apply.
 *
 *   Dry run (default, writes nothing):   node backend/seed/backfillStarterHorseBreedId.mjs
 *   Apply (mutates the canonical DB):     node backend/seed/backfillStarterHorseBreedId.mjs --apply
 *
 * Idempotent: it only touches rows where breedId IS NULL, so re-running after a
 * successful apply is a no-op.
 *
 * Derivation strategy (most-specific signal first):
 *   1. INHERIT — if the horse has a sire OR dam whose breedId is set, adopt the
 *      sire's breedId (else the dam's). Foals descend from a known breed line.
 *   2. DEFAULT — otherwise (the registration starter-horse case, which has no
 *      lineage and no breed-identifying data), assign the canonical default
 *      breed (DEFAULT_TEMPERAMENT_BREED = 'Thoroughbred'), matching exactly
 *      what the fixed registration path now writes for new starter horses.
 *
 * All writes are id-scoped per-row updates (never an unscoped deleteMany /
 * updateMany over the whole table).
 */

import { fileURLToPath } from 'url';
import prisma from '../../packages/database/prismaClient.mjs';
import { DEFAULT_TEMPERAMENT_BREED } from '../modules/horses/index.mjs';

const APPLY = process.argv.includes('--apply');

async function backfillStarterHorseBreedId() {
  console.log(
    `🔧 breedId backfill (Equoria-b9zgr) — mode: ${APPLY ? 'APPLY (will mutate DB)' : 'DRY-RUN (no writes)'}\n`,
  );

  const defaultBreed = await prisma.breed.findUnique({
    where: { name: DEFAULT_TEMPERAMENT_BREED },
    select: { id: true },
  });
  if (!defaultBreed) {
    console.error(
      `❌ Default breed "${DEFAULT_TEMPERAMENT_BREED}" not found. Seed breeds before backfilling. Aborting.`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(`Default breed "${DEFAULT_TEMPERAMENT_BREED}" → id ${defaultBreed.id}\n`);

  // Scope: only NULL-breedId rows. Pull lineage breedIds so we can inherit.
  const breedlessHorses = await prisma.horse.findMany({
    where: { breedId: null },
    select: {
      id: true,
      name: true,
      sire: { select: { breedId: true } },
      dam: { select: { breedId: true } },
    },
  });

  console.log(`Found ${breedlessHorses.length} horses with NULL breedId.\n`);

  let inherited = 0;
  let defaulted = 0;

  for (const horse of breedlessHorses) {
    const inheritedBreedId = horse.sire?.breedId ?? horse.dam?.breedId ?? null;
    const targetBreedId = inheritedBreedId ?? defaultBreed.id;
    const source = inheritedBreedId !== null ? 'inherit(lineage)' : 'default(Thoroughbred)';

    if (inheritedBreedId !== null) {
      inherited++;
    } else {
      defaulted++;
    }

    if (APPLY) {
      // id-scoped single-row update — never unscoped.
      await prisma.horse.update({
        where: { id: horse.id },
        data: { breedId: targetBreedId },
      });
    }

    console.log(
      `  ${APPLY ? '✅' : '•'} horse ${horse.id} ("${horse.name}") breedId NULL → ${targetBreedId} [${source}]`,
    );
  }

  console.log('\n📊 Summary:');
  console.log(`   Total NULL-breedId horses: ${breedlessHorses.length}`);
  console.log(`   Would inherit from lineage: ${inherited}`);
  console.log(`   Would default to Thoroughbred: ${defaulted}`);
  if (!APPLY) {
    console.log('\nℹ️  DRY-RUN — no rows changed. Re-run with --apply to mutate the canonical DB.');
  } else {
    console.log('\n✅ Backfill applied.');
  }
}

// Equoria-flqjs: main-module guard. backfillStarterHorseBreedId() mutates
// horse.breedId (when --apply) — must NOT run on bare import (e.g. a
// parse-check `node -e "import('./backfillStarterHorseBreedId.mjs')"`).
// Windows-correct form: fileURLToPath(import.meta.url) decodes the URL to the
// native `C:\path` that process.argv[1] already is, so the comparison holds on
// both Windows and POSIX. The CONTRIBUTING.md `file://${argv}` string form is
// broken on Windows (file://C:/ two-slash vs Node's file:///C:/ three-slash).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  backfillStarterHorseBreedId()
    .catch(err => {
      console.error('❌ Backfill failed:', err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
