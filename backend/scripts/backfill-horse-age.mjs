/**
 * backfill-horse-age.mjs (Equoria-y7df)
 *
 * One-shot, idempotent script that recomputes Horse.age from Horse.dateOfBirth
 * using the corrected game-year semantics (1 real-time week = 1 game year).
 *
 * Background: Prior to Equoria-son6, the daily aging cron wrote real-time
 * DAYS to Horse.age, while the rest of the codebase reads Horse.age as
 * GAME YEARS. After the cron started firing in production (Equoria-yzz5),
 * any horse the cron touched got a corrupted age value (e.g. age=1107 for
 * a horse 1107 days old, instead of age=158 game-years).
 *
 * This script:
 *   - Reads every horse's dateOfBirth.
 *   - Computes correctAge = floor((now - dateOfBirth) / 7 days).
 *   - Compares to current Horse.age.
 *   - In wet mode: updates only horses whose stored age != correctAge.
 *   - In dry-run mode: prints what WOULD change without writing.
 *
 * Idempotent: a second run finds correctAge === storedAge for all rows
 * and writes nothing.
 *
 * Per CLAUDE.md Rule 2 (REAL DB ONLY): runs against the canonical Equoria DB
 * with an explicit per-horse loop and logging. No raw deleteMany / updateMany
 * — every update is scoped to a single horse ID.
 *
 * Usage:
 *   node backend/scripts/backfill-horse-age.mjs --print-only
 *   node backend/scripts/backfill-horse-age.mjs
 *
 * Flags:
 *   --print-only   Dry-run: print BEFORE/AFTER counts and sample rows; no writes.
 *   --limit N      Only process the first N horses (debugging convenience).
 *   --quiet        Suppress per-horse logs; only print summary.
 */

import prisma from '../db/index.mjs';

const DAYS_PER_GAME_YEAR = 7;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function parseArgs(argv) {
  const args = { dryRun: false, limit: null, quiet: false };
  for (const a of argv.slice(2)) {
    if (a === '--print-only' || a === '--dry-run') {
      args.dryRun = true;
    } else if (a === '--quiet') {
      args.quiet = true;
    } else if (a.startsWith('--limit=')) {
      args.limit = Number(a.slice('--limit='.length));
    } else if (a === '--limit') {
      // handled below if value supplied as next token — but keep simple form
    }
  }
  return args;
}

function ageInGameYears(dob, now = new Date()) {
  if (!dob) {
    return null;
  }
  const diffMs = now.getTime() - new Date(dob).getTime();
  if (diffMs < 0) {
    return 0;
  }
  const days = Math.floor(diffMs / MS_PER_DAY);
  return Math.floor(days / DAYS_PER_GAME_YEAR);
}

async function main() {
  const args = parseArgs(process.argv);
  const startedAt = Date.now();
  const now = new Date();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  backfill-horse-age (Equoria-y7df)');
  console.log(`  Mode: ${args.dryRun ? 'DRY-RUN (no writes)' : 'WET RUN'}`);
  console.log(`  Now:  ${now.toISOString()}`);
  if (args.limit) {
    console.log(`  Limit: ${args.limit}`);
  }
  console.log('═══════════════════════════════════════════════════════════');

  // BEFORE snapshot
  const totalBefore = await prisma.horse.count();
  const overGameYearLimitBefore = await prisma.horse.count({ where: { age: { gt: 30 } } });
  const exactly1107Before = await prisma.horse.count({ where: { age: 1107 } });
  console.log(`\n[BEFORE] total horses:          ${totalBefore}`);
  console.log(`[BEFORE] horses with age > 30:  ${overGameYearLimitBefore}`);
  console.log(`[BEFORE] horses with age=1107:  ${exactly1107Before}  (canary for the cron bug)\n`);

  // Sample 5 rows for spot-checking
  const sample = await prisma.horse.findMany({
    select: { id: true, name: true, dateOfBirth: true, age: true },
    orderBy: { age: 'desc' },
    take: 5,
  });
  console.log('[BEFORE] top-5 oldest horses (by stored age):');
  for (const h of sample) {
    const correct = ageInGameYears(h.dateOfBirth, now);
    console.log(
      `  id=${h.id} "${h.name}" dob=${h.dateOfBirth?.toISOString?.() ?? h.dateOfBirth} stored=${h.age} → correct=${correct}`,
    );
  }
  console.log();

  // Stream over all horses (id-ordered) — avoids loading every row in memory
  let processed = 0;
  let needsUpdate = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;
  let lastId = 0;
  const BATCH_SIZE = 500;

  let hasMore = true;
  while (hasMore) {
    const batch = await prisma.horse.findMany({
      where: { id: { gt: lastId } },
      select: { id: true, name: true, dateOfBirth: true, age: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
    });
    if (batch.length === 0) {
      hasMore = false;
      break;
    }

    for (const horse of batch) {
      processed += 1;
      if (args.limit && processed > args.limit) {
        lastId = Number.POSITIVE_INFINITY;
        break;
      }

      const correctAge = ageInGameYears(horse.dateOfBirth, now);
      if (correctAge === null) {
        // No dateOfBirth — leave alone (cannot compute)
        unchanged += 1;
        continue;
      }
      if (correctAge === (horse.age ?? 0)) {
        unchanged += 1;
        continue;
      }

      needsUpdate += 1;

      if (args.dryRun) {
        if (!args.quiet) {
          console.log(
            `  [DRY] id=${horse.id} "${horse.name}" stored=${horse.age} → would set to ${correctAge}`,
          );
        }
        continue;
      }

      try {
        await prisma.horse.update({
          where: { id: horse.id },
          data: { age: correctAge },
        });
        updated += 1;
        if (!args.quiet) {
          console.log(
            `  [WET] id=${horse.id} "${horse.name}" stored=${horse.age} → set to ${correctAge}`,
          );
        }
      } catch (err) {
        failed += 1;
        console.error(`  [ERR] id=${horse.id} "${horse.name}": ${err.message}`);
      }
    }

    lastId = batch[batch.length - 1].id;
    if (args.limit && processed >= args.limit) {
      break;
    }
  }

  // AFTER snapshot (skip in dry-run since nothing changed)
  if (!args.dryRun) {
    const overGameYearLimitAfter = await prisma.horse.count({ where: { age: { gt: 30 } } });
    const exactly1107After = await prisma.horse.count({ where: { age: 1107 } });
    console.log();
    console.log(`[AFTER]  horses with age > 30:  ${overGameYearLimitAfter}`);
    console.log(`[AFTER]  horses with age=1107:  ${exactly1107After}`);
  }

  const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log();
  console.log('═══════════════════════════════════════════════════════════');
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

main().catch(err => {
  console.error('Fatal error:', err);
  prisma.$disconnect().finally(() => process.exit(1));
});
