/**
 * fix-implausible-horse-age.mjs
 *
 * Corrects horses whose BOTH age column AND dateOfBirth are corrupted by the
 * historical calendar-years-ago dob bug compounded by the old
 * backfill-horse-age.mjs (which set age = floor((now - dob) / 7) from the bad
 * dob). Such rows have age == computed-from-dob (so they look "consistent" to
 * backfill-horse-dateofbirth.mjs) yet are wildly wrong — e.g. a store horse
 * showing age 160 with dob in 2023.
 *
 * There is no in-row source of truth for these rows (both fields are wrong), so
 * the intended age is supplied explicitly (default 3 = standard store/starter
 * horse age). The script:
 *   - Selects horses with age > THRESHOLD (clearly corrupted; game retirement is
 *     ~21 game-years, so > 30 cannot be a legitimate age).
 *   - Sets age = targetAge and dateOfBirth = startOfUtcDay(now) - targetAge*7 days
 *     so getHorseAgeYears(dob) === targetAge.
 *
 * Scoped per-horse updates (no raw updateMany). Idempotent: after a run, no row
 * has age > THRESHOLD, so a second run is a no-op.
 *
 * Usage:
 *   node backend/scripts/fix-implausible-horse-age.mjs --print-only
 *   node backend/scripts/fix-implausible-horse-age.mjs            # targetAge=3
 *   node backend/scripts/fix-implausible-horse-age.mjs --age=4
 *
 * Flags:
 *   --print-only   Dry-run: print what WOULD change; no writes.
 *   --age=N        Target age in game-years (default 3).
 *   --threshold=N  Corruption threshold (default 30).
 */

import prisma from '../db/index.mjs';
import { getHorseAgeYears } from '../utils/horseAge.mjs';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_GAME_YEAR = 7;

function startOfUtcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseArgs(argv) {
  const args = { dryRun: false, age: 3, threshold: 30 };
  for (const a of argv.slice(2)) {
    if (a === '--print-only' || a === '--dry-run') {
      args.dryRun = true;
    } else if (a.startsWith('--age=')) {
      args.age = Number(a.slice('--age='.length));
    } else if (a.startsWith('--threshold=')) {
      args.threshold = Number(a.slice('--threshold='.length));
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const now = new Date();
  const newDob = new Date(
    startOfUtcDay(now).getTime() - args.age * DAYS_PER_GAME_YEAR * MS_PER_DAY,
  );

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  fix-implausible-horse-age');
  console.log(`  Mode: ${args.dryRun ? 'DRY-RUN (no writes)' : 'WET RUN'}`);
  console.log(`  Now: ${now.toISOString()}  targetAge=${args.age}  threshold=${args.threshold}`);
  console.log(
    `  New dob for fixed rows: ${newDob.toISOString()} (reads ${getHorseAgeYears(newDob, now)}y)`,
  );
  console.log('═══════════════════════════════════════════════════════════');

  const corrupted = await prisma.horse.findMany({
    where: { age: { gt: args.threshold } },
    select: { id: true, name: true, dateOfBirth: true, age: true },
    orderBy: { id: 'asc' },
  });

  console.log(`\nFound ${corrupted.length} horse(s) with age > ${args.threshold}:\n`);
  let updated = 0;
  let failed = 0;

  for (const h of corrupted) {
    const before = `id=${h.id} "${h.name}" age=${h.age} dob=${h.dateOfBirth?.toISOString?.() ?? h.dateOfBirth} (reads ${getHorseAgeYears(h.dateOfBirth, now)}y)`;
    if (args.dryRun) {
      console.log(`  [DRY] ${before} → age=${args.age}, dob=${newDob.toISOString()}`);
      continue;
    }
    try {
      await prisma.horse.update({
        where: { id: h.id },
        data: { age: args.age, dateOfBirth: newDob },
      });
      updated += 1;
      console.log(`  [WET] ${before} → age=${args.age}, dob=${newDob.toISOString()}`);
    } catch (err) {
      failed += 1;
      console.error(`  [ERR] id=${h.id} "${h.name}": ${err.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  found:   ${corrupted.length}`);
  console.log(`  updated: ${updated}${args.dryRun ? '  (dry-run, no writes)' : ''}`);
  console.log(`  failed:  ${failed}`);
  console.log('═══════════════════════════════════════════════════════════');

  await prisma.$disconnect();
  if (failed > 0) {
    process.exit(1);
  }
}

// Equoria-5z0if: main-module guard. main() mutates Horse.age + Horse.dateOfBirth
// — must NOT run on bare import.
if (
  process.argv[1] &&
  import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`
) {
  main().catch(err => {
    console.error('Fatal error:', err);
    prisma.$disconnect().finally(() => process.exit(1));
  });
}
