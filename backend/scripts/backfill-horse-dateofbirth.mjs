/**
 * backfill-horse-dateofbirth.mjs
 *
 * One-shot, idempotent script that corrects Horse.dateOfBirth so that the
 * canonical game-year age math (getHorseAgeYears = floor((now - dob) / 7 days))
 * reports the horse's INTENDED age (the value stored in Horse.age).
 *
 * Background: several creation/seed paths historically wrote dateOfBirth as
 * "now - age CALENDAR years" (e.g. authController starter horse:
 * `new Date(today.getFullYear() - 3, ...)`, seedDevData `yearsAgo(age)`,
 * createTestData `now - 365*age days`). Under Equoria's 1-game-year = 7-real-days
 * convention, a calendar-years-ago dob is read as ~52x too old — a "3 game-year"
 * starter horse displays as ~156 game-years. The age COLUMN held the correct
 * intended value (3) while the dob-derived ageYears (what the frontend shows via
 * `ageYears ?? age`) was wrong.
 *
 * Fix direction: dateOfBirth is the source of truth post-Equoria-son6, so we
 * correct the dob to match the intended age:
 *   dateOfBirth = startOfUtcDay(now) - age * 7 days
 *
 * Scope: only horses whose dob-derived game-years DISAGREE with the stored age
 * are touched. A correctly-aged horse (incl. in-game-bred foals) satisfies
 * floor((now - dob) / 7) === age and is left alone. Idempotent: a second run
 * finds no divergence and writes nothing.
 *
 * Per CLAUDE.md Rule 2 (REAL DB ONLY): runs against the canonical Equoria DB
 * with an explicit per-horse loop. Every update is scoped to a single horse ID —
 * no raw updateMany / deleteMany.
 *
 * Usage:
 *   node backend/scripts/backfill-horse-dateofbirth.mjs --print-only
 *   node backend/scripts/backfill-horse-dateofbirth.mjs
 *
 * Flags:
 *   --print-only   Dry-run: print BEFORE/AFTER counts and sample rows; no writes.
 *   --quiet        Suppress per-horse logs; only print summary.
 */

import prisma from '../../packages/database/prismaClient.mjs';
import { fileURLToPath } from 'node:url';
import { getHorseAgeYears } from '../utils/horseAge.mjs';

const DAYS_PER_GAME_YEAR = 7;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function startOfUtcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * The dateOfBirth (date-only UTC) that makes getHorseAgeYears() return `age`.
 * @param {number} age - intended age in game-years
 * @param {Date} now
 * @returns {Date}
 */
function dobForAge(age, now = new Date()) {
  return new Date(startOfUtcDay(now).getTime() - age * DAYS_PER_GAME_YEAR * MS_PER_DAY);
}

function parseArgs(argv) {
  const args = { dryRun: false, quiet: false };
  for (const a of argv.slice(2)) {
    if (a === '--print-only' || a === '--dry-run') {
      args.dryRun = true;
    } else if (a === '--quiet') {
      args.quiet = true;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const startedAt = Date.now();
  const now = new Date();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  backfill-horse-dateofbirth');
  console.log(`  Mode: ${args.dryRun ? 'DRY-RUN (no writes)' : 'WET RUN'}`);
  console.log(`  Now:  ${now.toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════');

  const totalBefore = await prisma.horse.count();
  console.log(`\n[BEFORE] total horses: ${totalBefore}\n`);

  let processed = 0;
  let needsUpdate = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;
  let lastId = 0;
  const BATCH_SIZE = 500;
  const sampleShown = [];

  while (true) {
    const batch = await prisma.horse.findMany({
      where: { id: { gt: lastId } },
      select: { id: true, name: true, dateOfBirth: true, age: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
    });
    if (batch.length === 0) {
      break;
    }

    for (const horse of batch) {
      processed += 1;

      if (horse.dateOfBirth === null || horse.age === null || horse.age === undefined) {
        unchanged += 1;
        continue;
      }

      const currentYears = getHorseAgeYears(horse.dateOfBirth, now);
      if (currentYears === horse.age) {
        unchanged += 1;
        continue;
      }

      needsUpdate += 1;
      const newDob = dobForAge(horse.age, now);

      if (sampleShown.length < 5) {
        sampleShown.push(
          `  id=${horse.id} "${horse.name}" age=${horse.age} dob=${horse.dateOfBirth?.toISOString?.() ?? horse.dateOfBirth} (reads ${currentYears}y) → dob=${newDob.toISOString()} (reads ${getHorseAgeYears(newDob, now)}y)`,
        );
      }

      if (args.dryRun) {
        continue;
      }

      try {
        await prisma.horse.update({
          where: { id: horse.id },
          data: { dateOfBirth: newDob },
        });
        updated += 1;
        if (!args.quiet) {
          console.log(
            `  [WET] id=${horse.id} "${horse.name}" age=${horse.age} → dob=${newDob.toISOString()}`,
          );
        }
      } catch (err) {
        failed += 1;
        console.error(`  [ERR] id=${horse.id} "${horse.name}": ${err.message}`);
      }
    }

    lastId = batch[batch.length - 1].id;
  }

  console.log('\n[SAMPLE] first up-to-5 diverging rows:');
  for (const line of sampleShown) {
    console.log(line);
  }

  const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Summary');
  console.log(`  processed:    ${processed}`);
  console.log(`  needs-update: ${needsUpdate}`);
  console.log(`  updated:      ${updated}${args.dryRun ? '  (dry-run, no writes)' : ''}`);
  console.log(`  unchanged:    ${unchanged}`);
  console.log(`  failed:       ${failed}`);
  console.log(`  duration:     ${duration}s`);
  console.log('═══════════════════════════════════════════════════════════');

  await prisma.$disconnect();
  if (failed > 0) {
    process.exit(1);
  }
}

// Equoria-5z0if: main-module guard. main() mutates Horse.dateOfBirth —
// must NOT run on bare import.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => {
    console.error('Fatal error:', err);
    prisma.$disconnect().finally(() => process.exit(1));
  });
}
