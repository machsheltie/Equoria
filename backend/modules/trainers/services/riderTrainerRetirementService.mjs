/**
 * riderTrainerRetirementService.mjs
 *
 * Equoria-osum — Automated retirement for Rider + Trainer.
 *
 * Prior to this service, Rider.retired and Trainer.retired were flipped to true
 * ONLY by the manual dismiss endpoints (riderController.dismissRider,
 * trainerController.dismissTrainer). The spec implies natural career arcs;
 * a player who never dismisses a rider/trainer would keep them forever.
 *
 * This service exposes a weekly job that retires any non-retired
 * Rider / Trainer whose careerWeeks meet or exceed the mandatory-retirement
 * threshold. The threshold mirrors the frontend
 * TrainerCareerPanel.MANDATORY_RETIREMENT_WEEKS = 80 (and is used for Rider
 * symmetrically — riders have the same career length per the existing UI
 * implication). The job is idempotent: re-running it does nothing if
 * everyone above threshold is already retired.
 *
 * Active assignments (riderAssignment / trainerAssignment with isActive=true)
 * are deactivated when their rider/trainer is auto-retired, matching the
 * behavior of dismissRider / dismissTrainer.
 *
 * Scheduled invocation: every Monday at 09:30 UTC, immediately after the
 * weekly salary processing job (which runs at 09:00 UTC) — see cronJobService.mjs.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';

/**
 * Career-weeks threshold at which mandatory retirement triggers.
 * Mirrors frontend TrainerCareerPanel.MANDATORY_RETIREMENT_WEEKS (80 weeks).
 * Riders use the same threshold — riders and trainers are treated as having
 * parallel career arcs in the current product model.
 */
export const RIDER_MANDATORY_RETIREMENT_WEEKS = 80;
export const TRAINER_MANDATORY_RETIREMENT_WEEKS = 80;

/**
 * Auto-retire all Riders whose careerWeeks >= RIDER_MANDATORY_RETIREMENT_WEEKS
 * and who are not already retired. Deactivates each retired rider's active
 * assignments.
 *
 * @returns {Promise<{retiredCount: number, deactivatedAssignmentCount: number, retiredIds: number[]}>}
 */
export async function autoRetireOverdueRiders() {
  const eligible = await prisma.rider.findMany({
    where: {
      retired: false,
      careerWeeks: { gte: RIDER_MANDATORY_RETIREMENT_WEEKS },
    },
    select: { id: true },
  });

  if (eligible.length === 0) {
    return { retiredCount: 0, deactivatedAssignmentCount: 0, retiredIds: [] };
  }

  const ids = eligible.map(r => r.id);

  // Equoria-r9u5k: retiring a rider ends BOTH representations of their
  // assignments, as dismissRider does (Equoria-6p398.6): the RiderAssignment
  // rows and the denormalised Horse.rider JSON the competition engine reads.
  // One transaction, Horse rows before staff rows (ascending ids).
  const { updateResult, assignmentResult } = await prisma.$transaction(async tx => {
    const active = await tx.riderAssignment.findMany({
      where: { riderId: { in: ids }, isActive: true },
      select: { horseId: true },
    });
    const horseIds = [...new Set(active.map(a => a.horseId))].sort((a, b) => a - b);
    if (horseIds.length > 0) {
      await tx.horse.updateMany({ where: { id: { in: horseIds } }, data: { rider: null } });
    }
    const deactivated = await tx.riderAssignment.updateMany({
      where: { riderId: { in: ids }, isActive: true },
      data: { isActive: false },
    });
    const retired = await tx.rider.updateMany({
      where: { id: { in: ids } },
      data: { retired: true },
    });
    return { updateResult: retired, assignmentResult: deactivated };
  });

  logger.info(
    `[riderTrainerRetirementService.autoRetireOverdueRiders] Retired ${updateResult.count} riders (ids: ${ids.join(', ')}); deactivated ${assignmentResult.count} active assignments.`,
  );

  return {
    retiredCount: updateResult.count,
    deactivatedAssignmentCount: assignmentResult.count,
    retiredIds: ids,
  };
}

/**
 * Auto-retire all Trainers whose careerWeeks >= TRAINER_MANDATORY_RETIREMENT_WEEKS
 * and who are not already retired. Deactivates each retired trainer's active
 * assignments.
 *
 * @returns {Promise<{retiredCount: number, deactivatedAssignmentCount: number, retiredIds: number[]}>}
 */
export async function autoRetireOverdueTrainers() {
  const eligible = await prisma.trainer.findMany({
    where: {
      retired: false,
      careerWeeks: { gte: TRAINER_MANDATORY_RETIREMENT_WEEKS },
    },
    select: { id: true },
  });

  if (eligible.length === 0) {
    return { retiredCount: 0, deactivatedAssignmentCount: 0, retiredIds: [] };
  }

  const ids = eligible.map(t => t.id);

  const updateResult = await prisma.trainer.updateMany({
    where: { id: { in: ids } },
    data: { retired: true },
  });

  const assignmentResult = await prisma.trainerAssignment.updateMany({
    where: { trainerId: { in: ids }, isActive: true },
    data: { isActive: false },
  });

  logger.info(
    `[riderTrainerRetirementService.autoRetireOverdueTrainers] Retired ${updateResult.count} trainers (ids: ${ids.join(', ')}); deactivated ${assignmentResult.count} active assignments.`,
  );

  return {
    retiredCount: updateResult.count,
    deactivatedAssignmentCount: assignmentResult.count,
    retiredIds: ids,
  };
}

/**
 * Combined job entry point invoked by the cron scheduler. Runs both
 * rider and trainer retirement passes and returns aggregate counts.
 *
 * @returns {Promise<{riders: object, trainers: object}>}
 */
export async function processRiderTrainerRetirement() {
  logger.info(
    '[riderTrainerRetirementService.processRiderTrainerRetirement] Starting weekly auto-retirement pass...',
  );
  const [riders, trainers] = await Promise.all([
    autoRetireOverdueRiders(),
    autoRetireOverdueTrainers(),
  ]);
  logger.info(
    `[riderTrainerRetirementService.processRiderTrainerRetirement] Complete. Riders retired: ${riders.retiredCount}; trainers retired: ${trainers.retiredCount}.`,
  );
  return { riders, trainers };
}
