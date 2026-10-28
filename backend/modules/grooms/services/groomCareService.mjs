/**
 * Daily care: "groom horse" and the care status the horse page's Care area
 * shows (Equoria-l7xag, Equoria-35qwc, Equoria-08luj, Equoria-j765w.2).
 *
 * Owner rulings this module carries:
 *  - Grooms never work on their own. The player presses "groom horse" once per
 *    horse per Eastern game day (2026-10-20, 2026-10-09).
 *  - Bond starts at 0 and each groom adds +5, up to 100 (2026-10-26, q87).
 *  - A foal's groom does one activity a day, which the player picks from the
 *    activities its day band offers (2026-10-14, q67, q70).
 *  - There is no stress (2026-10-26). No receipts (2026-10-26): a groom answers
 *    with the horse's care status, the same object the Care area always shows.
 *
 * This is the only way to groom a horse. The old doors (POST /grooms/interact,
 * POST /grooms/enhanced/interact) are retired.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { bondScoreMax, careStreakGraceDays, dailyBondGain } from '../../../config/groomConfig.mjs';
import { groomInteractionSource } from '../../../utils/foalActivityStore.mjs';
import { gameDayBounds, gameDayIndex } from '../../../utils/gameTime.mjs';
import { getHorseAgeDays } from '../../../utils/horseAge.mjs';
import { checkGroomMayWork } from '../../../utils/groomWorkRules.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
import { interactionCompletedAction, updateGroomSynergy } from './groomProgressionService.mjs';
import { foalActivityLabel, foalCareToday } from './foalCareSchedule.mjs';

/** The interaction type stored for a horse aged 3 or over (no activity choice). */
export const adultGroomType = 'groomHorse';

/** A refusal the route answers with its status, authored message and code. */
export class GroomCareRefusal extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'GroomCareRefusal';
    this.status = status;
    this.code = code;
  }
}

const groomSelect = {
  id: true,
  name: true,
  // Equoria-nawn5: the Care Team shows the groom's star level with the name.
  starLevel: true,
  userId: true,
  retired: true,
  isActive: true,
  feeUnpaidSince: true,
};

/**
 * The horse's active groom: its oldest active assignment whose groom is on
 * the owner's staff (there is no priority level: Equoria-ekrab).
 * @param {object} db - prisma or a transaction client
 * @param {number} horseId
 * @param {string|null} ownerId
 */
async function findPrimaryAssignment(db, horseId, ownerId) {
  if (!ownerId) {
    return null;
  }
  return db.groomAssignment.findFirst({
    where: { foalId: horseId, isActive: true, groom: { userId: ownerId } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, groom: { select: groomSelect } },
  });
}

/** Today's groom interaction for a horse (Eastern game day), or null. */
async function findTodaysInteraction(db, horseId, now) {
  const { start, end } = gameDayBounds(now);
  return db.groomInteraction.findFirst({
    where: { foalId: horseId, timestamp: { gte: start, lt: end } },
    orderBy: { timestamp: 'asc' },
    select: { interactionType: true, timestamp: true },
  });
}

/**
 * Why the horse cannot be groomed now, or null when it can. Order matters:
 * already groomed, then no groom, then a groom who cannot work.
 */
function refusalFor(horse, assignment, todaysInteraction) {
  if (todaysInteraction) {
    return {
      status: 409,
      code: 'alreadyGroomedToday',
      message: `${horse.name} has already been groomed today. Come back tomorrow.`,
    };
  }
  if (!assignment) {
    return {
      status: 409,
      code: 'noGroomAssigned',
      message: `${horse.name} has no groom yet. Assign a groom to care for this horse.`,
    };
  }
  const work = checkGroomMayWork(assignment.groom);
  if (!work.allowed) {
    return { status: 409, code: 'groomCannotWork', message: work.reason };
  }
  return null;
}

function todaysActivityFor(foalCare, todaysInteraction) {
  if (!foalCare || !todaysInteraction) {
    return null;
  }
  const id = todaysInteraction.interactionType;
  return { id, label: foalActivityLabel(id) ?? 'Daily Care' };
}

/** Build the CareStatus object (see the care CONTRACT.md). Pure. */
function buildCareStatus(horse, assignment, todaysInteraction, now) {
  const refusal = refusalFor(horse, assignment, todaysInteraction);
  const foalCare = foalCareToday(horse.dateOfBirth, now);
  return {
    horseId: horse.id,
    horseName: horse.name,
    bond: horse.bondScore,
    lastGroomedAt: horse.lastGroomed ? new Date(horse.lastGroomed).toISOString() : null,
    groomedToday: Boolean(todaysInteraction),
    canGroomToday: refusal === null,
    refusal: refusal ? { code: refusal.code, message: refusal.message } : null,
    groom: assignment
      ? {
          id: assignment.groom.id,
          name: assignment.groom.name,
          starLevel: assignment.groom.starLevel,
        }
      : null,
    foal: foalCare
      ? { ...foalCare, todaysActivity: todaysActivityFor(foalCare, todaysInteraction) }
      : null,
  };
}

const horseCareSelect = {
  id: true,
  name: true,
  userId: true,
  dateOfBirth: true,
  bondScore: true,
  lastGroomed: true,
  daysGroomedInARow: true,
  taskLog: true,
};

/**
 * The care status of one horse.
 * @param {number} horseId
 * @param {Date} [now]
 * @returns {Promise<object|null>} null when the horse does not exist
 */
export async function getCareStatus(horseId, now = new Date(), db = prisma) {
  const horse = await db.horse.findUnique({ where: { id: horseId }, select: horseCareSelect });
  if (!horse) {
    return null;
  }
  const [assignment, todaysInteraction] = await Promise.all([
    findPrimaryAssignment(db, horseId, horse.userId),
    findTodaysInteraction(db, horseId, now),
  ]);
  return buildCareStatus(horse, assignment, todaysInteraction, now);
}

/**
 * Whether "groom horse" would succeed for this horse right now. The horse
 * page's overview reads this so it never disagrees with the action.
 * @param {number} horseId
 * @returns {Promise<boolean>}
 */
export async function canGroomHorseToday(horseId) {
  const status = await getCareStatus(horseId);
  return Boolean(status?.canGroomToday);
}

/** Care streak on the Eastern calendar: consecutive days, with the config grace. */
function nextStreak(lastGroomed, currentStreak, now) {
  if (!lastGroomed) {
    return 1;
  }
  const gap = gameDayIndex(now) - gameDayIndex(lastGroomed);
  if (gap >= 1 && gap <= careStreakGraceDays) {
    return currentStreak + 1;
  }
  return gap <= 0 ? Math.max(currentStreak, 1) : 1;
}

/** Which interaction type this groom stores, or a refusal for the activity. */
function chooseInteractionType(horse, foalCare, activity) {
  if (!foalCare) {
    if (activity !== undefined && activity !== null) {
      throw new GroomCareRefusal(
        400,
        'activityNotOffered',
        `${horse.name} is grown, so there is no activity to choose.`,
      );
    }
    return adultGroomType;
  }
  if (activity === undefined || activity === null || activity === '') {
    throw new GroomCareRefusal(
      400,
      'activityRequired',
      `Choose what the groom does with ${horse.name} today.`,
    );
  }
  if (!foalCare.activities.some(a => a.id === activity)) {
    throw new GroomCareRefusal(
      400,
      'activityNotOffered',
      `That activity is not on offer for ${horse.name} today.`,
    );
  }
  return activity;
}

/**
 * Groom a horse: the player's daily "groom horse" press.
 *
 * One transaction. The horse row is locked first (lock order User -> Horse ->
 * staff rows; no User row is written because care is free), and today's
 * interaction is re-read under that lock, so two presses in flight groom the
 * horse once. The GroomInteraction row, the horse's bond / last groomed /
 * streak / task log, the FoalActivity row and the groom-horse synergy row all
 * commit together or not at all.
 *
 * @param {{horseId:number, activity?:string|null, now?:Date}} input
 * @returns {Promise<object>} the horse's care status after grooming
 * @throws {GroomCareRefusal}
 */
export async function groomHorse({ horseId, activity, now = new Date() }) {
  await withRetryableTxMapping(
    prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "horses" WHERE "id" = ${horseId} FOR UPDATE`;
      const horse = await tx.horse.findUnique({
        where: { id: horseId },
        select: horseCareSelect,
      });
      if (!horse) {
        throw new GroomCareRefusal(404, 'horseNotFound', 'Horse not found');
      }
      const [assignment, todaysInteraction] = await Promise.all([
        findPrimaryAssignment(tx, horseId, horse.userId),
        findTodaysInteraction(tx, horseId, now),
      ]);
      const refusal = refusalFor(horse, assignment, todaysInteraction);
      if (refusal) {
        throw new GroomCareRefusal(refusal.status, refusal.code, refusal.message);
      }

      const foalCare = foalCareToday(horse.dateOfBirth, now);
      const interactionType = chooseInteractionType(horse, foalCare, activity);

      const newBond = Math.min(bondScoreMax, Math.max(0, horse.bondScore) + dailyBondGain);
      const bondAdded = newBond - horse.bondScore;
      const taskLog =
        horse.taskLog !== null && typeof horse.taskLog === 'object' && !Array.isArray(horse.taskLog)
          ? { ...horse.taskLog }
          : {};
      taskLog[interactionType] = (Number(taskLog[interactionType]) || 0) + 1;

      await tx.horse.update({
        where: { id: horseId },
        data: {
          bondScore: newBond,
          lastGroomed: now,
          daysGroomedInARow: nextStreak(horse.lastGroomed, horse.daysGroomedInARow ?? 0, now),
          taskLog,
        },
      });
      await tx.groomInteraction.create({
        data: {
          foalId: horseId,
          groomId: assignment.groom.id,
          assignmentId: assignment.id,
          interactionType,
          taskType: interactionType,
          duration: 0,
          bondingChange: bondAdded,
          milestoneWindowId: foalCare ? foalCare.band.id : null,
          timestamp: now,
        },
      });
      // FoalActivity is the event log Horse.taskLog caches (Equoria-2emg): the
      // two are written together so their counts agree.
      await tx.foalActivity.create({
        data: {
          foalId: horseId,
          day: getHorseAgeDays(horse.dateOfBirth, now),
          activityType: interactionType,
          outcome: 'good',
          bondingChange: bondAdded,
          description: foalCare
            ? `${foalActivityLabel(interactionType)} with the groom`
            : 'Groomed by the groom',
          source: groomInteractionSource,
        },
      });
      // Staff row last (lock order). Grooms are fixed NPCs: no XP, no level.
      await updateGroomSynergy(assignment.groom.id, horseId, interactionCompletedAction, 1, tx);
    }),
  );
  return getCareStatus(horseId, now);
}

/**
 * The player's horses that have a groom and have not been groomed this Eastern
 * game day, for the home reminders. Foals first, then by name.
 * @param {string} userId
 * @param {Date} [now]
 */
export async function listUngroomedToday(userId, now = new Date()) {
  const { start, end } = gameDayBounds(now);
  const horses = await prisma.horse.findMany({
    where: {
      userId,
      groomAssignments: { some: { isActive: true, groom: { userId } } },
      groomInteractions: { none: { timestamp: { gte: start, lt: end } } },
    },
    select: {
      id: true,
      name: true,
      dateOfBirth: true,
      groomAssignments: {
        where: { isActive: true, groom: { userId } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 1,
        select: { groom: { select: groomSelect } },
      },
    },
  });
  return horses
    .map(h => ({
      horseId: h.id,
      horseName: h.name,
      isFoal: foalCareToday(h.dateOfBirth, now) !== null,
      canGroomToday: checkGroomMayWork(h.groomAssignments[0]?.groom).allowed,
    }))
    .sort((a, b) => Number(b.isFoal) - Number(a.isFoal) || a.horseName.localeCompare(b.horseName));
}
