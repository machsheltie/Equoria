/**
 * competitionEntryRules.mjs (Equoria-576c0 B9)
 *
 * The show-entry rules as pure data and functions, in the shared layer so
 * every reader applies the same rules without a module cycle: the entry
 * transaction (modules/competition/services/entryEligibility.mjs), the
 * next-action suggestions (modules/users) and the eligibility summary
 * (logic/enhancedCompetitionSimulation.mjs). The users module cannot import
 * the competition barrel (competition already imports users), the same
 * reason the old XP bracket lived in utils/horseCompetitionLevel.mjs.
 *
 * Owner entry rules (2026-10-15) and rulings C10-C12 (2026-10-16):
 *   - age 3-20 game years (utils/horseAge.mjs, Eastern calendar);
 *   - C10: an active rider assignment whose rider is not retired and is
 *     employed by the horse's owner;
 *   - C12: a Gaited show needs gaitScores.gaiting present (a non-empty list);
 *   - no double entry in one show; no general competition cooldown;
 *   - R9: XP and points never gate entry (the level/range returns with B8).
 * Unchanged: an injured horse is refused (the Fair-or-better band is B7).
 * C11: conformation keeps its own age 0+ / groom rules; only double entry
 * applies to it here.
 */

import { getHorseAgeYears } from './horseAge.mjs';

export const MIN_ENTRY_AGE_YEARS = 3;
export const MAX_ENTRY_AGE_YEARS = 20;

/** Stable refusal codes with their HTTP status and player-facing message. */
export const ENTRY_REFUSALS = Object.freeze({
  AGE_TOO_YOUNG: Object.freeze({
    status: 400,
    message: 'Horse must be at least 3 years old to compete',
  }),
  AGE_TOO_OLD: Object.freeze({ status: 400, message: 'Horses over 20 years old cannot compete' }),
  HORSE_INJURED: Object.freeze({ status: 400, message: 'Injured horses cannot compete' }),
  RIDER_REQUIRED: Object.freeze({
    status: 400,
    message: 'An assigned rider is required to compete',
  }),
  RIDER_RETIRED: Object.freeze({ status: 400, message: "This horse's rider is retired" }),
  RIDER_NOT_EMPLOYED: Object.freeze({
    status: 400,
    message: "This horse's rider is not employed by you",
  }),
  GAITING_REQUIRED: Object.freeze({
    status: 400,
    message: 'Gaited shows require a horse with gaiting ability',
  }),
  ALREADY_ENTERED: Object.freeze({ status: 409, message: 'Horse is already entered in this show' }),
});

function hasGaiting(gaitScores) {
  return (
    gaitScores !== null &&
    typeof gaitScores === 'object' &&
    Array.isArray(gaitScores.gaiting) &&
    gaitScores.gaiting.length > 0
  );
}

/** The horse fields the entry rules read. */
export const ENTRY_RULE_HORSE_SELECT = Object.freeze({
  dateOfBirth: true,
  healthStatus: true,
  gaitScores: true,
});

/** The rider fields C10 reads from the active assignment. */
const ASSIGNMENT_SELECT = Object.freeze({
  horseId: true,
  rider: { select: { retired: true, userId: true } },
});

/**
 * The active rider assignment per horse, for C10. Assigning a rider deactivates
 * the horse's other assignments, so there is one; the newest is the one judged
 * if the data says otherwise. Works with the prisma client or a tx client.
 *
 * @param {object} db
 * @param {number[]} horseIds
 * @returns {Promise<Map<number, { rider: { retired: boolean, userId: string|null } }>>}
 */
export async function loadActiveAssignments(db, horseIds) {
  if (horseIds.length === 0) {
    return new Map();
  }
  const rows = await db.riderAssignment.findMany({
    where: { horseId: { in: horseIds }, isActive: true },
    orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
    select: ASSIGNMENT_SELECT,
  });
  const byHorse = new Map();
  for (const row of rows) {
    if (!byHorse.has(row.horseId)) {
      byHorse.set(row.horseId, row);
    }
  }
  return byHorse;
}

/** Age rule (3-20 game years from dateOfBirth): a refusal code or null. */
export function ageRefusal(dateOfBirth, now = new Date()) {
  const ageYears = getHorseAgeYears(dateOfBirth, now);
  if (ageYears < MIN_ENTRY_AGE_YEARS) {
    return 'AGE_TOO_YOUNG';
  }
  if (ageYears > MAX_ENTRY_AGE_YEARS) {
    return 'AGE_TOO_OLD';
  }
  return null;
}

/** Health rule (injured horses are refused): a refusal code or null. */
export function healthRefusal(healthStatus) {
  return String(healthStatus).toLowerCase() === 'injured' ? 'HORSE_INJURED' : null;
}

/** C10 rider rule over the horse's active assignment: a refusal code or null. */
export function riderRefusal(assignment, userId) {
  if (!assignment?.rider) {
    return 'RIDER_REQUIRED';
  }
  if (assignment.rider.retired === true) {
    return 'RIDER_RETIRED';
  }
  if (assignment.rider.userId !== userId) {
    return 'RIDER_NOT_EMPLOYED';
  }
  return null;
}

/** C12 Gaited rule: a refusal code or null. */
export function gaitingRefusal(discipline, gaitScores) {
  return discipline === 'Gaited' && !hasGaiting(gaitScores) ? 'GAITING_REQUIRED' : null;
}

/**
 * The entry rules over already-loaded data: the first refusal code, or null
 * when the horse may enter. Pure. The one source for the entry transaction, the
 * next-action suggestions and the eligibility summary.
 *
 * @param {object} input
 * @param {{ showType?: string, discipline?: string }} input.show - a show, or for
 *   a show-less check (the eligibility summary) just `{ discipline }`.
 * @param {{ dateOfBirth?: Date|string|null, healthStatus?: string|null,
 *   gaitScores?: object|null }} input.horse - ENTRY_RULE_HORSE_SELECT fields
 * @param {{ rider?: { retired?: boolean, userId?: string|null } }|null|undefined}
 *   input.assignment - the horse's active assignment (loadActiveAssignments)
 * @param {boolean} [input.alreadyEntered]
 * @param {string} input.userId - the horse's owner
 * @param {Date} [input.now]
 * @returns {keyof ENTRY_REFUSALS | null}
 */
export function evaluateEntryRules({
  show,
  horse,
  assignment,
  alreadyEntered = false,
  userId,
  now = new Date(),
}) {
  if (alreadyEntered) {
    return 'ALREADY_ENTERED';
  }
  if (show.showType === 'conformation') {
    return null; // C11: conformation's own age 0+ / groom rules live in its controller.
  }
  return (
    ageRefusal(horse?.dateOfBirth, now) ??
    healthRefusal(horse?.healthStatus) ??
    riderRefusal(assignment, userId) ??
    gaitingRefusal(show.discipline, horse?.gaitScores)
  );
}
