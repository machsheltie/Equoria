/**
 * Groom Retirement Service
 *
 * Equoria-m9lz1 — retirement belongs to the GAME, not the player.
 *
 * The owner's ruling (2026-09-08):
 *   "Players don't retire grooms. Grooms retire automatically at a randomly
 *    selected age by the game. They can retire any time between age 50-65 and
 *    that is not known until the week they retire. Grooms are hired from the
 *    marketplace. Player [does] not own them. The game should notify a player
 *    [when] their groom is retiring so they can select a new one."
 *
 * The invariants this module owns:
 *
 *   I1  ONLY THE GAME RETIRES A GROOM. No HTTP request flips `Groom.retired`;
 *       `POST /grooms/:id/retirement/process` is closed (403) — see
 *       routes/groomRetirementRoutes.mjs and its regression
 *       __tests__/groomRetirementEndpointClosed.integration.test.mjs. The only
 *       production caller of `processRetirement` is
 *       `processWeeklyCareerProgression` below.
 *
 *   I2  AGE-DRIVEN, AT A HIDDEN PER-GROOM AGE IN [50, 65]. Drawn once and
 *       persisted in `GroomRetirementSchedule`, never recomputed, so it cannot
 *       drift between reads. The unit is the same weekly tick as
 *       `Groom.careerWeeks` (Equoria's clock is 1 real week = 1 game-year, see
 *       backend/utils/horseAge.mjs), so the test is a direct age comparison.
 *
 *   I3  THE AGE IS NOT DISCOVERABLE BEFORE IT TAKES EFFECT. It lives in its own
 *       table so no groom read path can return it (see the schema comment on
 *       `GroomRetirementSchedule`), and nothing here returns it, a countdown to
 *       it, or a value a client could invert to obtain it. Hence
 *       `checkRetirementEligibility` returns no `weeksUntilRetirement` /
 *       `noticeRequired`, and `getGroomsApproachingRetirement` and
 *       `statistics.approachingRetirement` are gone: each WAS the disclosure.
 *
 *   I4  THE NOTIFICATION IS ATOMIC WITH THE RETIREMENT, and reaches SOMEONE.
 *       Written by the same transaction that flips `retired` and ends the
 *       assignments (`createNotificationTx`) — it is the player's only warning,
 *       so it must not be able to fail independently. Recipient is the groom's
 *       own `userId`, falling back to the distinct owners of the assignments just
 *       ended, because `Groom.userId` is nullable while `GroomAssignment` carries
 *       its own; if neither names anyone the transaction logs loudly.
 *
 *   I5  RETIREMENT ENDS ASSIGNMENTS; IT NEVER DESTROYS HISTORY. Pre-m9lz1 this
 *       ran `prisma.groomAssignment.deleteMany({ where: { groomId } })` under a
 *       comment claiming it removed "active" assignments — the `where` matched
 *       EVERY row, so one retirement destroyed the groom's whole assignment
 *       history and, because `groom_interactions.assignmentId` is
 *       `ON DELETE SET NULL`, detached every past interaction from the assignment
 *       that produced it. Irreversibly. Now active rows are ENDED
 *       (`isActive: false` + `endDate`), mirroring
 *       marketplace/services/horseTransferReconciliation.endActiveAssignmentsOnHorse;
 *       inactive rows are untouched; open `GroomAssignmentLog` rows are closed.
 *
 * REMOVED TRIGGERS: the pre-m9lz1 pass also retired on level >= 10 and on 12+
 * assignment logs. Both retire a groom at any age, and the assignment-count one
 * fires after a dozen ordinary re-assignments — long before age 50 — so keeping
 * it would have meant the age rule almost never fired. The reason strings stay in
 * `RETIREMENT_REASONS` for existing `Groom.retirementReason` rows, which
 * `getRetirementStatistics` groups by; nothing computes them. Reinstating a
 * "master groom graduates" mechanic is a product decision (Equoria-8l6lg).
 *
 * THE SCHEDULER: backend/services/jobs/groomCareerProgressionJob.mjs (registry A,
 * so advisory-locked AND heartbeat-wrapped AND visible at
 * /api/admin/cron/health) — Mondays 09:45 UTC. It runs AFTER weeklySalaries (09:00) because payroll
 * bills per ACTIVE assignment: retiring first would cost a groom who worked that
 * week their final wage. Read that descriptor's header before relying on it.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import {
  createNotificationTx,
  finalizeNotificationAfterCommit,
} from '../../../utils/notificationService.mjs';
// Equoria-m9lz1 fix round 1: `autoCreateLegacyOnRetirement` moved to
// groomLegacyService.mjs, where its constants, perk pool and `createLegacyLog`
// already live. It is a legacy-log concern that retirement happens to trigger,
// not retirement mechanics, and nothing outside this file called it.
import { autoCreateLegacyOnRetirement } from './groomLegacyService.mjs';
// The hidden retirement age lives in its own module so that every read or draw
// of it is one grep away (Equoria-m9lz1 invariant I3).
import {
  RETIREMENT_AGE_MIN,
  RETIREMENT_AGE_MAX,
  drawRetirementAge,
  ensureRetirementSchedule,
  readRetirementAge,
} from './groomRetirementScheduleService.mjs';

export { drawRetirementAge, ensureRetirementSchedule };

/**
 * Retirement reasons enum.
 *
 * `AGE` is the only value the game computes after Equoria-m9lz1.
 * `MANDATORY_CAREER_LIMIT`, `EARLY_LEVEL_CAP`, `EARLY_ASSIGNMENT_LIMIT` and
 * `VOLUNTARY` are retained for HISTORICAL rows only — `Groom.retirementReason`
 * already holds them and `getRetirementStatistics` groups by that column.
 * Nothing produces them any more.
 */
export const RETIREMENT_REASONS = {
  AGE: 'age',
  MANDATORY_CAREER_LIMIT: 'mandatory_career_limit',
  EARLY_LEVEL_CAP: 'early_level_cap',
  EARLY_ASSIGNMENT_LIMIT: 'early_assignment_limit',
  VOLUNTARY: 'voluntary',
};

/**
 * Career progression constants.
 *
 * The inclusive random band for a groom's retirement age. The database also
 * enforces it: `groom_retirement_schedules_age_range` CHECK constraint in
 * migration 20260908180000_m9lz1_groom_retirement_schedule. Widening the band
 * here without widening that constraint produces a write error, deliberately.
 */
export const CAREER_CONSTANTS = {
  RETIREMENT_AGE_MIN,
  RETIREMENT_AGE_MAX,
};

/** The notification type the game emits in the week a groom retires. */
export const GROOM_RETIRED_NOTIFICATION_TYPE = 'groom_retired';

/**
 * Increment career weeks for a groom.
 *
 * One tick per weekly career pass. On Equoria's clock this is one game-year of
 * the groom's working life, so `careerWeeks` is the groom's career age and is
 * what `checkRetirementEligibility` compares against the hidden retirement age.
 *
 * @param {number} groomId - The groom ID
 * @returns {Promise<Object>} Updated groom with new career weeks
 */
export async function incrementCareerWeeks(groomId) {
  // Explicit existence check — prisma.update() may not throw P2025 reliably
  // across all Prisma client versions when the record is not found.
  const exists = await prisma.groom.findUnique({ where: { id: groomId }, select: { id: true } });
  if (!exists) {
    throw new Error(`Groom with ID ${groomId} not found`);
  }

  const updatedGroom = await prisma.groom.update({
    where: { id: groomId },
    data: {
      careerWeeks: {
        increment: 1,
      },
    },
    include: {
      groomAssignmentLogs: true,
    },
  });

  logger.info(`Incremented career weeks for groom ${groomId} to ${updatedGroom.careerWeeks}`);
  return updatedGroom;
}

/**
 * Check whether the game will retire this groom.
 *
 * The ONLY rule is age: `careerWeeks >= retirementAge`, where `retirementAge`
 * is the groom's hidden, once-drawn schedule value.
 *
 * WHAT THIS DELIBERATELY DOES NOT RETURN (Equoria-m9lz1, invariant I3): the
 * retirement age, a countdown to it (`weeksUntilRetirement`), or a
 * within-one-week flag (`noticeRequired`). A client knows `careerWeeks`, so any
 * of those three hands it the hidden age by subtraction — which is precisely
 * the "not known until the week they retire" the owner's ruling requires. Do
 * not add them back. `eligible` itself is safe: it can only be true in the same
 * weekly pass that retires the groom, so it reveals nothing ahead of the event.
 *
 * @param {number} groomId - The groom ID
 * @returns {Promise<{eligible: boolean, reason: string, mandatory: boolean}>}
 */
export async function checkRetirementEligibility(groomId) {
  const groom = await prisma.groom.findUnique({
    where: { id: groomId },
    select: { id: true, retired: true, careerWeeks: true, retirementSchedule: true },
  });

  if (!groom) {
    throw new Error(`Groom with ID ${groomId} not found`);
  }

  if (groom.retired) {
    return { eligible: false, reason: 'already_retired', mandatory: false };
  }

  // No schedule drawn yet (a groom that predates Equoria-m9lz1, or one whose
  // first weekly pass has not run). Not retiring: the game draws the age on the
  // next pass via ensureRetirementSchedule. This branch never invents an age —
  // a computed-on-read age could differ between two reads, which is the drift
  // the persisted schedule exists to prevent.
  const retirementAge = groom.retirementSchedule?.retirementAge ?? null;
  if (retirementAge === null) {
    return { eligible: false, reason: 'not_scheduled', mandatory: false };
  }

  if (groom.careerWeeks >= retirementAge) {
    return { eligible: true, reason: RETIREMENT_REASONS.AGE, mandatory: true };
  }

  return { eligible: false, reason: 'not_eligible', mandatory: false };
}

/**
 * Retire a groom. GAME-INTERNAL — no HTTP route reaches this (invariant I1).
 *
 * Everything the player can observe about the retirement happens in ONE
 * transaction, in this order:
 *   1. `Groom` flipped to retired — a GUARDED conditional update
 *      (`updateMany` with `retired: false` in the `where`, then `count === 1`),
 *      the Equoria-zvp4 idiom. Two concurrent passes cannot both retire the same
 *      groom: the loser sees count 0 and throws, rolling its own transaction
 *      back with no second notification. No `SELECT ... FOR UPDATE` — the
 *      precondition fits in the WHERE clause, so mechanism (2) of the
 *      concurrency ruling applies and mechanism (3) is unnecessary.
 *   2. ACTIVE `GroomAssignment` rows ended (`isActive: false` + `endDate`).
 *      Inactive rows — the groom's history — are NOT matched and NOT touched.
 *   3. Open `GroomAssignmentLog` rows closed with `unassignedAt`.
 *   4. The `groom_retired` Notification, via `createNotificationTx` on the same
 *      `tx` (invariant I4). It throws on failure, so an unannounceable
 *      retirement does not happen at all.
 *
 * Write order is Groom → GroomAssignment → GroomAssignmentLog → Notification:
 * ascending by dependency depth, no `User` row touched, matching the campaign's
 * lock-ordering rule.
 *
 * @param {number} groomId - The groom ID
 * @param {string|null} reason - Retirement reason (defaults to the computed one)
 * @param {boolean} voluntary - Bypass the eligibility check. Retained for the
 *   legacy/mentor integration tests; NO production caller passes true.
 * @returns {Promise<Object>} Retired groom data
 */
export async function processRetirement(groomId, reason = null, voluntary = false) {
  const eligibility = await checkRetirementEligibility(groomId);

  if (!eligibility.eligible && !voluntary) {
    throw new Error(`Groom ${groomId} is not eligible for retirement`);
  }

  const retirementReason = reason || eligibility.reason || RETIREMENT_REASONS.AGE;
  const retirementTimestamp = new Date();

  const committed = await prisma.$transaction(async tx => {
    const flipped = await tx.groom.updateMany({
      where: { id: groomId, retired: false },
      data: {
        retired: true,
        retirementReason,
        retirementTimestamp,
        isActive: false, // Mark as inactive
      },
    });
    if (flipped.count !== 1) {
      throw new Error(`Groom ${groomId} was already retired by a concurrent pass`);
    }

    // Read the assignments about to end BEFORE ending them, because their own
    // `userId` is the fallback notification recipient (see below) and the
    // `updateMany` that follows does not return rows.
    const endingAssignments = await tx.groomAssignment.findMany({
      where: { groomId, isActive: true },
      select: { userId: true },
    });

    // Equoria-m9lz1 / task-17 §7.1: END the active assignments. The pre-fix
    // `deleteMany({ where: { groomId } })` matched every row for the groom and
    // destroyed its whole assignment history (and detached every past
    // GroomInteraction, whose assignmentId FK is ON DELETE SET NULL).
    const endedAssignments = await tx.groomAssignment.updateMany({
      where: { groomId, isActive: true },
      data: { isActive: false, endDate: retirementTimestamp },
    });

    const closedLogs = await tx.groomAssignmentLog.updateMany({
      where: { groomId, unassignedAt: null },
      data: { unassignedAt: retirementTimestamp },
    });

    const retiredGroom = await tx.groom.findUnique({
      where: { id: groomId },
      include: {
        groomAssignmentLogs: true,
        groomHorseSynergies: true,
      },
    });

    // WHO GETS TOLD (Equoria-m9lz1 fix round 1).
    //   `Groom.userId` is `String?`, and `GroomAssignment` carries its OWN
    //   `userId`. Gating the notification on the groom's alone meant a groom with
    //   a null `userId` but live assignments could retire with nobody told — the
    //   player would lose care on their horse silently, which is exactly the
    //   failure the in-transaction notification exists to prevent. Currently
    //   unreachable (none of the 56 ownerless non-retired grooms has an active
    //   assignment) but the owner's "the game should notify a player"
    //   requirement is absolute, so it does not rely on that staying true.
    //
    //   Preference order: the groom's own owner, then the distinct owners of the
    //   assignments just ended. In the ordinary case those are the same person
    //   and this writes exactly ONE notification, so the normal path is
    //   unchanged. Ids are sorted so a multi-recipient write order is
    //   deterministic.
    const recipientIds = retiredGroom.userId
      ? [retiredGroom.userId]
      : [...new Set(endingAssignments.map(a => a.userId).filter(Boolean))].sort();

    // The player's only warning, written with the retirement it announces.
    // The payload carries nothing the player could not already see; in
    // particular it does NOT carry the retirement age (invariant I3).
    const notificationPayload =
      recipientIds.length > 0
        ? {
            groomId,
            groomName: retiredGroom.name,
            speciality: retiredGroom.speciality,
            skillLevel: retiredGroom.skillLevel,
            level: retiredGroom.level,
            careerWeeks: retiredGroom.careerWeeks,
            reason: retirementReason,
            horsesLeftUnattended: endedAssignments.count,
          }
        : null;

    const notificationIds = [];
    for (const recipientId of recipientIds) {
      const notification = await createNotificationTx(
        tx,
        recipientId,
        GROOM_RETIRED_NOTIFICATION_TYPE,
        notificationPayload,
      );
      notificationIds.push(notification.id);
    }

    // The genuinely unnotifiable case: assignments ended and not one of them,
    // nor the groom, names a player. Nothing can be sent, so say so loudly
    // rather than let it pass as a successful retirement.
    if (recipientIds.length === 0 && endedAssignments.count > 0) {
      logger.error(
        `[groomRetirementService.processRetirement] Groom ${groomId} retired and ended ` +
          `${endedAssignments.count} active assignment(s), but neither the groom nor any of those ` +
          'assignments names a userId — NO player could be notified. Investigate the ownerless ' +
          'assignment rows; a player may have lost care on a horse with no warning.',
      );
    }

    return {
      retiredGroom,
      endedAssignmentCount: endedAssignments.count,
      closedAssignmentLogCount: closedLogs.count,
      notificationIds,
      notificationRecipientIds: recipientIds,
      notificationPayload,
    };
  });

  const { retiredGroom } = committed;

  logger.info(
    `Processed retirement for groom ${groomId} with reason: ${retirementReason} ` +
      `(${committed.endedAssignmentCount} assignments ended, ` +
      `${committed.closedAssignmentLogCount} assignment logs closed)`,
  );

  // Post-commit, in ADR-011 / ADR-007 order: the real-time nudge and the
  // retention prune follow the durable write, once per recipient. Never throws.
  // The SAME payload each row carries is published, so the stream and the stored
  // notification can never describe different events. Driven by the RECIPIENT
  // list, not by `retiredGroom.userId`, so a fallback recipient gets its stream
  // nudge and its retention prune too.
  for (const recipientId of committed.notificationRecipientIds) {
    finalizeNotificationAfterCommit(
      recipientId,
      GROOM_RETIRED_NOTIFICATION_TYPE,
      committed.notificationPayload,
    );
  }

  // Equoria-c0vo: auto-create GroomLegacyLog for level-7+ retirees by pairing
  // the mentor with the same user's lowest-level active groom as protégé.
  // If no eligible protégé exists, defer — the legacy can be created later via
  // the manual generateLegacyProtege flow when a new groom is hired.
  let legacyLog = null;
  try {
    legacyLog = await autoCreateLegacyOnRetirement(retiredGroom);
  } catch (legacyError) {
    logger.error(
      `[groomRetirementService.processRetirement] Failed to auto-create legacy for groom ${groomId}: ${legacyError.message}`,
    );
    // Don't fail the retirement if legacy creation fails
  }

  return {
    groom: retiredGroom,
    retirementReason,
    retirementTimestamp,
    assignmentCount: retiredGroom.groomAssignmentLogs.length,
    synergyRecords: retiredGroom.groomHorseSynergies.length,
    endedAssignmentCount: committed.endedAssignmentCount,
    closedAssignmentLogCount: committed.closedAssignmentLogCount,
    // Plural: one per notified player. Normally length 1 (the groom's own
    // owner); length 0 only when nobody could be notified, which the
    // transaction logs loudly when assignments were ended anyway.
    notificationIds: committed.notificationIds,
    notificationRecipientIds: committed.notificationRecipientIds,
    legacyLog,
  };
}

/**
 * Get retirement statistics for a user.
 *
 * Equoria-m9lz1: the former `approachingRetirement` key is GONE. It counted the
 * user's grooms within one week of retiring, which is exactly the disclosure the
 * owner's ruling forbids (invariant I3). Do not reinstate it.
 *
 * `retirementReasons` groups over `Groom.retirementReason` and therefore still
 * reports historical `mandatory_career_limit` / `early_level_cap` /
 * `early_assignment_limit` rows alongside the current `age`.
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Retirement statistics
 */
export async function getRetirementStatistics(userId) {
  const [activeGrooms, retiredGrooms] = await Promise.all([
    prisma.groom.count({
      where: { userId, retired: false },
    }),
    prisma.groom.count({
      where: { userId, retired: true },
    }),
  ]);

  // Get retirement reasons breakdown
  const retirementReasons = await prisma.groom.groupBy({
    by: ['retirementReason'],
    where: { userId, retired: true },
    _count: { retirementReason: true },
  });

  // Calculate average career length for retired grooms
  const retiredGroomsData = await prisma.groom.findMany({
    where: { userId, retired: true },
    select: { careerWeeks: true },
  });

  const averageCareerLength =
    retiredGroomsData.length > 0
      ? retiredGroomsData.reduce((sum, groom) => sum + groom.careerWeeks, 0) /
        retiredGroomsData.length
      : 0;

  return {
    activeGrooms,
    retiredGrooms,
    totalGrooms: activeGrooms + retiredGrooms,
    retirementRate: retiredGrooms / (activeGrooms + retiredGrooms) || 0,
    retirementReasons: retirementReasons.reduce((acc, reason) => {
      acc[reason.retirementReason] = reason._count.retirementReason;
      return acc;
    }, {}),
    averageCareerLength: Math.round(averageCareerLength * 100) / 100,
  };
}

/**
 * Process weekly career progression for all active grooms — THE game path.
 *
 * Per groom, in order:
 *   - draw and persist the hidden retirement age if it has none yet;
 *   - advance `careerWeeks` by one (one game-year of career);
 *   - retire the groom if it has reached its retirement age, notifying the
 *     player inside the retirement transaction.
 *
 * Age is the only retirement trigger (see the module header for why the
 * level-cap and assignment-count triggers were removed).
 *
 * Per-groom failures are collected rather than aborting the pass: one groom
 * with bad data must not stop every other player's week. A failed retirement
 * leaves that groom entirely untouched, because the retirement is one
 * transaction.
 *
 * @param {string|null} userId - Optional user ID to scope processing (used in tests for isolation)
 * @returns {Promise<Object>} Processing results with statistics
 */
export async function processWeeklyCareerProgression(userId = null) {
  try {
    logger.info('Starting weekly career progression processing');

    // Get all active (non-retired) grooms, optionally scoped to a specific user
    const whereClause = { retired: false, isActive: true };
    if (userId) {
      whereClause.userId = userId;
    }
    const activeGrooms = await prisma.groom.findMany({
      where: whereClause,
      select: { id: true, name: true, careerWeeks: true, level: true },
    });

    const results = {
      processed: 0,
      retired: 0,
      scheduled: 0,
      errors: [],
      retirements: [],
    };

    // Process each groom
    for (const groom of activeGrooms) {
      try {
        // Backstop for grooms that predate Equoria-m9lz1, legacy protégés, and
        // fixtures. Idempotent: a groom that already has a schedule keeps it, and
        // the common (already-scheduled) case costs exactly one read.
        if ((await readRetirementAge(prisma, groom.id)) === null) {
          await ensureRetirementSchedule(prisma, groom.id);
          results.scheduled++;
        }

        // Increment career weeks (the groom ages one game-year)
        await incrementCareerWeeks(groom.id);
        results.processed++;

        // Retire if the groom has reached its hidden retirement age
        const eligibility = await checkRetirementEligibility(groom.id);
        if (eligibility.eligible) {
          await processRetirement(groom.id, eligibility.reason);
          results.retired++;
          results.retirements.push({
            groomId: groom.id,
            groomName: groom.name,
            reason: eligibility.reason,
            careerWeeks: groom.careerWeeks + 1,
            level: groom.level,
          });

          logger.info(`Groom ${groom.name} (ID: ${groom.id}) retired: ${eligibility.reason}`);
        }
      } catch (error) {
        logger.error(`Error processing groom ${groom.id}:`, error);
        results.errors.push({
          groomId: groom.id,
          groomName: groom.name,
          error: error.message,
        });
      }
    }

    logger.info(
      `Weekly career progression completed: ${results.processed} processed, ${results.retired} retired, ${results.errors.length} errors`,
    );

    return results;
  } catch (error) {
    logger.error(`Error in weekly career progression: ${error.message}`);
    throw new Error('Failed to process weekly career progression', { cause: error });
  }
}

export default {
  drawRetirementAge,
  ensureRetirementSchedule,
  incrementCareerWeeks,
  checkRetirementEligibility,
  processRetirement,
  getRetirementStatistics,
  processWeeklyCareerProgression,
  RETIREMENT_REASONS,
  CAREER_CONSTANTS,
  GROOM_RETIRED_NOTIFICATION_TYPE,
};
