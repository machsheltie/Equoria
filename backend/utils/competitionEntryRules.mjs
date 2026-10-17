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
/** At most this many discipline types active at once (owner entry rules; B10). */
export const MAX_ACTIVE_DISCIPLINE_TYPES = 3;

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
  DISCIPLINE_TYPE_LIMIT: Object.freeze({
    status: 400,
    message:
      'This horse already has shows in 3 discipline types. A new type can be entered once every show of one of them has run.',
  }),
});

/**
 * The player-facing message for a refusal. DISCIPLINE_TYPE_LIMIT names the
 * horse's active types when they are known.
 * @param {keyof ENTRY_REFUSALS} code
 * @param {{ activeTypes?: string[] }} [context]
 */
export function entryRefusalMessage(code, { activeTypes } = {}) {
  if (code === 'DISCIPLINE_TYPE_LIMIT' && activeTypes?.length) {
    return `This horse already has shows in ${activeTypes.length} discipline types (${activeTypes.join(', ')}). A new type can be entered once every show of one of them has run.`;
  }
  return ENTRY_REFUSALS[code].message;
}

/**
 * A show's discipline type for the 3-type limit (C13): conformation and parade
 * each count as one type; a ridden show's type is its discipline.
 * @param {{ showType?: string|null, discipline?: string|null }} show
 * @returns {string}
 */
export function disciplineTypeOf(show) {
  if (show.showType === 'conformation') {
    return 'Conformation';
  }
  if (show.showType === 'parade') {
    return 'Parade';
  }
  return show.discipline;
}

/**
 * Each horse's ACTIVE discipline types: the types of the shows it is entered in
 * whose status is not 'completed' (open or executing: entered, not yet run and
 * settled; the executor marks a show completed when it settles). Sorted, unique.
 * Works with the prisma client or a tx client.
 *
 * @param {object} db
 * @param {number[]} horseIds
 * @returns {Promise<Map<number, string[]>>}
 */
export async function loadActiveDisciplineTypes(db, horseIds) {
  const byHorse = new Map(horseIds.map(id => [id, new Set()]));
  if (horseIds.length > 0) {
    const rows = await db.showEntry.findMany({
      where: { horseId: { in: horseIds }, show: { status: { not: 'completed' } } },
      select: { horseId: true, show: { select: { showType: true, discipline: true } } },
    });
    for (const row of rows) {
      byHorse.get(row.horseId)?.add(disciplineTypeOf(row.show));
    }
  }
  return new Map([...byHorse].map(([id, types]) => [id, [...types].sort()]));
}

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

/**
 * The 3-type limit: a show of an active type is always fine; a new type only
 * while fewer than 3 types are active. A refusal code or null.
 */
export function disciplineTypeRefusal(show, activeTypes = []) {
  if (activeTypes.includes(disciplineTypeOf(show))) {
    return null;
  }
  return activeTypes.length >= MAX_ACTIVE_DISCIPLINE_TYPES ? 'DISCIPLINE_TYPE_LIMIT' : null;
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
 * @param {string[]} [input.activeTypes] - the horse's active discipline types
 *   (loadActiveDisciplineTypes)
 * @param {string} input.userId - the horse's owner
 * @param {Date} [input.now]
 * @returns {keyof ENTRY_REFUSALS | null}
 */
export function evaluateEntryRules({
  show,
  horse,
  assignment,
  alreadyEntered = false,
  activeTypes = [],
  userId,
  now = new Date(),
}) {
  if (alreadyEntered) {
    return 'ALREADY_ENTERED';
  }
  if (show.showType === 'conformation') {
    // C11: conformation's own age 0+ / groom rules live in its controller; it
    // still counts as one discipline type (C13).
    return disciplineTypeRefusal(show, activeTypes);
  }
  return (
    ageRefusal(horse?.dateOfBirth, now) ??
    healthRefusal(horse?.healthStatus) ??
    riderRefusal(assignment, userId) ??
    gaitingRefusal(show.discipline, horse?.gaitScores) ??
    disciplineTypeRefusal(show, activeTypes)
  );
}
