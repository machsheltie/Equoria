/**
 * Backfill the hidden rider retirement schedule and the start age for riders
 * that exist from before the 2026-10-23 ruling (Equoria-or2ua).
 *
 * Idempotent: a rider that already has a start age or a schedule row keeps it
 * (the start age is claimed with a guarded `startAge: null` update and the
 * schedule with `createMany(skipDuplicates)`), so running it twice changes
 * nothing the second time. Retired riders are skipped.
 *
 * A dry run counts what would change and writes nothing. The result carries
 * counts only, never a drawn age, so a log line or a console print cannot
 * disclose a rider's hidden retirement age.
 *
 * This is run by hand (backend/scripts/backfillRiderRetirementSchedules.mjs);
 * the weekly pass never draws an age itself.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import {
  ensureRiderRetirementSchedule,
  ensureRiderStartAge,
} from './riderRetirementScheduleService.mjs';

/**
 * @param {{dryRun?: boolean}} [options]
 * @returns {Promise<{dryRun: boolean, ridersWithoutStartAge: number, ridersWithoutSchedule: number, startAgesWritten: number, schedulesWritten: number}>}
 */
export async function backfillRiderRetirementSchedules({ dryRun = false } = {}) {
  const missingStartAge = await prisma.rider.findMany({
    where: { retired: false, startAge: null },
    select: { id: true },
  });
  const missingSchedule = await prisma.rider.findMany({
    where: { retired: false, riderRetirementSchedule: { is: null } },
    select: { id: true },
  });

  const result = {
    dryRun,
    ridersWithoutStartAge: missingStartAge.length,
    ridersWithoutSchedule: missingSchedule.length,
    startAgesWritten: 0,
    schedulesWritten: 0,
  };
  if (dryRun) {
    return result;
  }

  for (const { id } of missingStartAge) {
    await ensureRiderStartAge(prisma, id);
    result.startAgesWritten += 1;
  }
  for (const { id } of missingSchedule) {
    await ensureRiderRetirementSchedule(prisma, id);
    result.schedulesWritten += 1;
  }
  return result;
}
