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
 * This service exposes a weekly job. Trainers retire when careerWeeks meet or
 * exceed the mandatory-retirement threshold (TrainerCareerPanel mirrors 80).
 * Riders retire at a hidden random age with a one-week notice (owner ruling
 * 2026-10-23, Equoria-or2ua); that pass lives in modules/riders and this job
 * runs it alongside the trainer pass. The job is idempotent.
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
import { processRiderRetirement } from '../../riders/index.mjs';

/**
 * Career-weeks threshold at which mandatory trainer retirement triggers.
 * Mirrors frontend TrainerCareerPanel.MANDATORY_RETIREMENT_WEEKS (80 weeks).
 * Riders no longer share it: since owner ruling 2026-10-23 (Equoria-or2ua) they
 * retire at a hidden random age, see modules/riders riderRetirementService.mjs.
 */
export const TRAINER_MANDATORY_RETIREMENT_WEEKS = 80;

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
    processRiderRetirement(),
    autoRetireOverdueTrainers(),
  ]);
  logger.info(
    `[riderTrainerRetirementService.processRiderTrainerRetirement] Complete. Riders retired: ${riders.retiredCount}, noticed: ${riders.noticedCount}; trainers retired: ${trainers.retiredCount}.`,
  );
  return { riders, trainers };
}
