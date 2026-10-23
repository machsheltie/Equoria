/**
 * Backfill the hidden rider retirement schedule and start age (Equoria-or2ua,
 * owner ruling 2026-10-23).
 *
 * Riders created before the ruling have no start age (18-25) and no hidden
 * retirement age (40-65). This rolls both ONCE for every active rider that lacks
 * them. It is idempotent: a rider that already has a value keeps it, so running
 * it again changes nothing.
 *
 * Usage:
 *   node backend/scripts/backfill-rider-retirement-schedules.mjs --dry-run
 *   node backend/scripts/backfill-rider-retirement-schedules.mjs
 *
 *   --dry-run / --print-only   Count what WOULD change; write nothing.
 *
 * It prints counts only, never a drawn age. Do NOT run it against production
 * without the owner's go-ahead.
 */

import { fileURLToPath } from 'node:url';
import prisma from '../../packages/database/prismaClient.mjs';
import { backfillRiderRetirementSchedules } from '../modules/riders/index.mjs';

export function parseArgs(argv) {
  return { dryRun: argv.slice(2).some(a => a === '--dry-run' || a === '--print-only') };
}

async function main() {
  const { dryRun } = parseArgs(process.argv);
  console.log(`Rider retirement backfill. Mode: ${dryRun ? 'DRY-RUN (no writes)' : 'WET RUN'}`);
  const result = await backfillRiderRetirementSchedules({ dryRun });
  console.log(`  riders without a start age:          ${result.ridersWithoutStartAge}`);
  console.log(`  riders without a retirement schedule: ${result.ridersWithoutSchedule}`);
  console.log(`  start ages written:                  ${result.startAgesWritten}`);
  console.log(`  schedules written:                   ${result.schedulesWritten}`);
  await prisma.$disconnect();
}

// Main-module guard: importing this file (a test does) must not write anything.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(async err => {
    console.error('Rider retirement backfill failed:', err.message);
    await prisma.$disconnect();
    process.exit(1);
  });
}
