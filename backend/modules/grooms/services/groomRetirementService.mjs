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
 *       `processWeeklyCareerProgression`, which Equoria-ypb7d.1 moved to
 *       services/groomCareerProgressionService.mjs.
 *
 *   I2  AGE-DRIVEN, AT A HIDDEN PER-GROOM AGE IN [50, 65]. Drawn once and
 *       persisted in `GroomRetirementSchedule`, never recomputed, so it cannot
 *       drift between reads. Equoria-ypb7d.1 gave the comparison its missing
 *       origin: a groom's age is `startAge + careerWeeks`, where `startAge` is
 *       drawn from 18..24 at hire and `careerWeeks` still ticks once per weekly
 *       pass — one game-year on Equoria's clock (1 real week = 1 game-year, see
 *       backend/utils/horseAge.mjs). Pre-ypb7d the age WAS `careerWeeks` alone,
 *       so a groom hired today was age 0. See services/groomAgeService.mjs.
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
 * /api/admin/cron/health) — Mondays 09:45 UTC. It runs AFTER weeklySalaries
 * (09:00) because the weekly fee bills every groom ON STAFF (Equoria-ypb7d.3
 * changed the basis from per-ACTIVE-ASSIGNMENT to per-engagement): retiring first
 * would end the engagement before the groom who worked that week was paid. Read
 * that descriptor's header before relying on it.
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
  ensureRetirementSchedule,
  readRetirementAge,
} from './groomRetirementScheduleService.mjs';
// Equoria-ypb7d.1: the groom's ORDINARY age — `startAge + careerWeeks`, on the
// same 1-week-is-1-game-year clock horses use (backend/utils/horseAge.mjs). Not
// secret, unlike the retirement age above; see groomAgeService.mjs.
import { groomAgeYears } from './groomAgeService.mjs';
// Equoria-ypb7d.2: retirement CLOSES the engagement (players never own grooms).
import { ENGAGEMENT_END_REASONS, endEngagementTx } from './groomEngagementService.mjs';
// Equoria-ypb7d.1: a reporting read over rows retirement already wrote, split out
// so the age model fits under the 600-line cap. Re-exported so the route and every
// existing importer are unchanged.
import { getRetirementStatistics } from './groomRetirementStatsService.mjs';

export { getRetirementStatistics };

// Fix round 3: nothing from groomRetirementScheduleService.mjs is re-exported here
// or on the default export. `export { drawRetirementAge, ensureRetirementSchedule }`
// sat on this line, and index.mjs star-exports this module, so it published the
// age-RETURNING `ensureRetirementSchedule` to the whole backend. Import by path.

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
 * Make sure this groom has a retirement age drawn, and say only WHETHER one had
 * to be drawn. The safe accessor the weekly pass uses.
 *
 * WHY IT EXISTS HERE AND NOT IN THE PASS (Equoria-ypb7d.1). The pass moved to
 * groomCareerProgressionService.mjs when this file hit its 600-line cap, and it
 * needs the backstop that draws a schedule for grooms predating Equoria-m9lz1.
 * Calling `readRetirementAge` / `ensureRetirementSchedule` from there would be a
 * doctrine violation, correctly: this file and groomRetirementScheduleService.mjs
 * are the only two allowed to handle the hidden age, and
 * scripts/doctrine-checks/check-no-retirement-schedule-leak.mjs enforces it. Its
 * own failure message names the remedy — "expose a safe accessor from them" —
 * and this is that accessor. It returns a BOOLEAN. It never returns, logs or
 * interpolates the age, so no caller can obtain it through this door.
 *
 * @param {number} groomId
 * @returns {Promise<boolean>} true when a schedule was drawn on this call
 */
export async function ensureRetirementDrawn(groomId) {
  if ((await readRetirementAge(prisma, groomId)) !== null) {
    return false;
  }
  await ensureRetirementSchedule(prisma, groomId);
  return true;
}

/**
 * Check whether the game will retire this groom.
 *
 * The ONLY rule is age: `age >= retirementAge`, where `age` is the groom's real
 * age — `startAge + careerWeeks` (Equoria-ypb7d.1) — and `retirementAge` is the
 * groom's hidden, once-drawn schedule value in 50..65.
 *
 * WHY THE COMPARISON CHANGED. Pre-ypb7d it was `careerWeeks >= retirementAge`, so
 * a groom hired today was age 0 and retired after 50-65 weekly passes — a
 * real-world year, effectively retiring at about 75-90 (Equoria-maeba). The owner
 * ruled: "grooms should have a built in start age. Anywhere from 18-24 years old."
 * With that origin the wait is 26 to 47 weekly passes — still months of real time,
 * which is inherent to a year-per-week clock and is stated, not hidden.
 *
 * NOTHING BUT CHANCE DECIDES THE TIMING: two independent uniform draws (18..24 and
 * 50..65) and no other input. "Math.random determines when they retire between
 * 50-65 years old. That is all." — owner, 2026-09-09. Do not reintroduce level,
 * experience, assignment-count or performance influence under any name.
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
    select: {
      id: true,
      retired: true,
      careerWeeks: true,
      startAge: true,
      retirementSchedule: true,
    },
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

  // No start age drawn yet (a groom that predates Equoria-ypb7d and whose first
  // weekly pass has not run). Its age is UNKNOWN, and unknown is not 0: treating
  // it as 0 would postpone retirement by up to 24 game-years, and treating it as
  // anything else would be inventing an age. Refuse to decide; the weekly pass
  // draws one via `ensureStartAge` before it asks again.
  const age = groomAgeYears(groom);
  if (age === null) {
    return { eligible: false, reason: 'age_unknown', mandatory: false };
  }

  if (age >= retirementAge) {
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
    // The HORSE comes with them (fix round 3): the notice used to carry a bare
    // count in a game where the player knows all three by name.
    const endingAssignments = await tx.groomAssignment.findMany({
      where: { groomId, isActive: true },
      select: { userId: true, foalId: true, foal: { select: { id: true, name: true } } },
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

    // Equoria-ypb7d.2: a career ending also ends the ENGAGEMENT — players never own
    // grooms, so what retirement terminates is a working relationship, and the
    // GroomEngagement row records why. Zero closed is normal (engagements predating
    // that table have no row) and must not stop the retirement.
    //
    // `Groom.userId` is deliberately NOT cleared, unlike a non-payment release:
    // `retired` already bars work and the hire pool, and keeping the pointer is what
    // lets the player still read their retired grooms (invariant I5). See the
    // field's comment in schema.prisma.
    const closedEngagements = await endEngagementTx(
      tx,
      groomId,
      ENGAGEMENT_END_REASONS.RETIREMENT,
      retirementTimestamp,
    );

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
    //   unreachable (no ownerless non-retired groom has an active assignment)
    //   but the owner's "the game should notify a player" requirement is
    //   absolute, so it does not rely on that staying true. That population's
    //   SIZE is deliberately not quoted: it moves with ordinary play (56 when
    //   written, 62 the next day) and only "none has an active assignment" is
    //   load-bearing. Same reason as commit 6c8672c73.
    //
    //   Preference order: the groom's own owner, then the distinct owners of the
    //   assignments just ended. In the ordinary case those are the same person
    //   and this writes exactly ONE notification, so the normal path is
    //   unchanged. Ids are sorted so a multi-recipient write order is
    //   deterministic.
    const recipientIds = retiredGroom.userId
      ? [retiredGroom.userId]
      : [...new Set(endingAssignments.map(a => a.userId).filter(Boolean))].sort();

    // WHICH HORSES, PER RECIPIENT (fix round 3). A shared list of NAMES would show
    // one player another's horses in the multi-recipient fallback case. So the
    // groom's own owner gets every ending assignment that is theirs or carries no
    // `userId` of its own (`GroomAssignment.userId` is `String?`) — identical to the
    // old count on the ordinary path — and a fallback recipient gets only assignments
    // naming them. `horsesLeftUnattended` is that list's length, so it cannot lie.
    const horsesForRecipient = recipientId =>
      endingAssignments
        .filter(a =>
          retiredGroom.userId
            ? recipientId === retiredGroom.userId && (a.userId === recipientId || !a.userId)
            : a.userId === recipientId,
        )
        .map(a => ({ id: a.foal?.id ?? a.foalId, name: a.foal?.name ?? null }))
        .sort((x, y) => x.id - y.id);

    // The player's only notice, written with the retirement it announces. It
    // carries nothing they could not already see — and NOT the age (I3).
    const notificationIds = [];
    const notificationPayloadsByRecipient = new Map();
    for (const recipientId of recipientIds) {
      const horses = horsesForRecipient(recipientId);
      const payload = {
        groomId,
        groomName: retiredGroom.name,
        speciality: retiredGroom.speciality,
        skillLevel: retiredGroom.skillLevel,
        level: retiredGroom.level,
        careerWeeks: retiredGroom.careerWeeks,
        reason: retirementReason,
        horsesLeftUnattended: horses.length,
        horses,
      };
      notificationPayloadsByRecipient.set(recipientId, payload);
      const notification = await createNotificationTx(
        tx,
        recipientId,
        GROOM_RETIRED_NOTIFICATION_TYPE,
        payload,
      );
      notificationIds.push(notification.id);
    }

    // A HORSE WHOSE OWNER WAS NOT TOLD, in either shape: nobody could be notified
    // at all, or an ending assignment landed on no recipient's list. Both are
    // claims about DATA (`GroomAssignment.userId` vs `Groom.userId`), so both are
    // checked, and loud — that is what the in-transaction notice exists to prevent.
    const attributed = [...notificationPayloadsByRecipient.values()].reduce(
      (n, p) => n + p.horses.length,
      0,
    );
    if (attributed !== endedAssignments.count) {
      logger.error(
        `[groomRetirementService.processRetirement] Groom ${groomId} ended ` +
          `${endedAssignments.count} active assignment(s), but only ${attributed} reached one of ` +
          `${recipientIds.length} notified player(s). A horse lost its groom with no warning to ` +
          'its owner. Investigate the userId on those GroomAssignment rows.',
      );
    }

    return {
      retiredGroom,
      endedAssignmentCount: endedAssignments.count,
      closedAssignmentLogCount: closedLogs.count,
      closedEngagementCount: closedEngagements,
      notificationIds,
      notificationRecipientIds: recipientIds,
      // Entries, so the post-commit publish sends each recipient EXACTLY the
      // payload their own stored row carries.
      notificationPayloadsByRecipient: [...notificationPayloadsByRecipient.entries()],
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
  for (const [recipientId, payload] of committed.notificationPayloadsByRecipient) {
    finalizeNotificationAfterCommit(recipientId, GROOM_RETIRED_NOTIFICATION_TYPE, payload);
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
    closedEngagementCount: committed.closedEngagementCount,
    // Plural: one per notified player. Normally length 1 (the groom's own
    // owner); length 0 only when nobody could be notified, which the
    // transaction logs loudly when assignments were ended anyway.
    notificationIds: committed.notificationIds,
    notificationRecipientIds: committed.notificationRecipientIds,
    // [recipientId, payload] entries; `horses` is scoped to that player.
    notificationPayloadsByRecipient: committed.notificationPayloadsByRecipient,
    legacyLog,
  };
}

export default {
  incrementCareerWeeks,
  ensureRetirementDrawn,
  checkRetirementEligibility,
  processRetirement,
  getRetirementStatistics,
  RETIREMENT_REASONS,
  CAREER_CONSTANTS,
  GROOM_RETIRED_NOTIFICATION_TYPE,
};
