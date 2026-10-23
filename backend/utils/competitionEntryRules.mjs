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
 * Health: an injured horse is refused, and so is any horse whose displayed
 * health is Bad — a horse must be Fair or better to enter (owner rulings
 * 2026-10-22 Equoria-0d4wa, 2026-10-23 Equoria-u0jop).
 * C11: conformation keeps its own age 0+ / groom rules; only double entry
 * applies to it here.
 */

import { getHorseAgeYears } from './horseAge.mjs';
import { hasBadHealth } from './horseHealth.mjs';
import { checkGroomMayWork } from './groomWorkRules.mjs';
import { maxActiveAgeYears, minActiveAgeYears } from '../constants/horseAgePolicy.mjs';

// The ridden entry window is the horse age policy's active window (Equoria-2nacc).
export const MIN_ENTRY_AGE_YEARS = minActiveAgeYears;
export const MAX_ENTRY_AGE_YEARS = maxActiveAgeYears;
/** Days a groom must have been assigned to a horse before a conformation entry (C11). */
export const minConformationGroomAssignmentDays = 2;
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
  // camelCase: new codes may not add snake-case names (Equoria-pjvp8 ratchet).
  // Owner ruling 2026-10-23 (Equoria-u0jop); was horseCriticalHealth.
  horseBadHealth: Object.freeze({
    status: 400,
    message:
      'Horses in Bad health cannot compete. A horse must be in Fair health or better to breed, train or enter a show. Feed and vet to restore health.',
  }),
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
  SHOW_UNDATED: Object.freeze({
    status: 409,
    message: 'This show has no closing date and is not taking entries',
  }),
  DISCIPLINE_TYPE_LIMIT: Object.freeze({
    status: 400,
    message:
      'This horse already has shows in 3 discipline types. A new type can be entered once every show of one of them has run.',
  }),
  // Equoria-mwjst: re-checked inside the entry transaction. Not-found and
  // not-yours stay one answer (CWE-639).
  HORSE_NOT_FOUND: Object.freeze({ status: 404, message: 'Horse not found' }),
  GROOM_NOT_ON_STAFF: Object.freeze({
    status: 400,
    message: 'Groom not found or not on your staff',
  }),
  GROOM_CANNOT_WORK: Object.freeze({ status: 400, message: 'This groom cannot work right now' }),
  CONFORMATION_INELIGIBLE: Object.freeze({
    status: 400,
    message: 'Horse does not meet conformation show entry requirements',
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
 * An undated RIDDEN show (closeDate null) never runs (the executor only picks
 * closeDate <= now) and refuses new entries, so a legacy entry in one does not
 * count; a conformation show runs 7 days from createdAt, so it always counts.
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
      where: {
        horseId: { in: horseIds },
        show: {
          status: { not: 'completed' },
          OR: [{ closeDate: { not: null } }, { showType: 'conformation' }],
        },
      },
      select: { horseId: true, show: { select: { showType: true, discipline: true } } },
    });
    for (const row of rows) {
      byHorse.get(row.horseId)?.add(disciplineTypeOf(row.show));
    }
  }
  return new Map([...byHorse].map(([id, types]) => [id, [...types].sort()]));
}

/**
 * Which of these horses have a groom ready for a conformation entry (C11): an
 * active assignment, to a groom on `userId`'s staff, who may work now
 * (checkGroomMayWork) and has been assigned for at least
 * minConformationGroomAssignmentDays. The same groom rules the entry
 * transaction applies (checkConformationEntryInTx), so a suggestion built on it
 * is one the entry will accept. Works with the prisma client or a tx client.
 *
 * @param {object} db
 * @param {number[]} horseIds
 * @param {string} userId
 * @param {Date} [now]
 * @returns {Promise<Set<number>>}
 */
export async function loadHorsesWithConformationGroom(db, horseIds, userId, now = new Date()) {
  if (horseIds.length === 0) {
    return new Set();
  }
  const rows = await db.groomAssignment.findMany({
    where: { foalId: { in: horseIds }, userId, isActive: true },
    select: {
      foalId: true,
      createdAt: true,
      groom: {
        select: { userId: true, name: true, retired: true, isActive: true, feeUnpaidSince: true },
      },
    },
  });
  const minAgeMs = minConformationGroomAssignmentDays * 24 * 60 * 60 * 1000;
  const ready = new Set();
  for (const row of rows) {
    const assignedMs = row.createdAt ? new Date(row.createdAt).getTime() : NaN;
    if (
      row.groom?.userId === userId &&
      checkGroomMayWork(row.groom).allowed &&
      Number.isFinite(assignedMs) &&
      now.getTime() - assignedMs >= minAgeMs
    ) {
      ready.add(row.foalId);
    }
  }
  return ready;
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
  // Displayed health (utils/horseHealth.mjs) for the bad-health rule.
  age: true,
  lastFedDate: true,
  hungerSince: true,
  lastVettedDate: true,
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

/**
 * Health rule: a refusal code or null. An injured horse keeps its own code; any
 * other horse in Bad health is refused too (owner rulings 2026-10-22
 * Equoria-0d4wa, 2026-10-23 Equoria-u0jop: Fair or better to enter). The gate
 * is the one breeding, training and conformation entry apply: hasBadHealth.
 *
 * @param {{ healthStatus?: string|null, age?: number|null,
 *   lastFedDate?: Date|string|null, lastVettedDate?: Date|string|null }|null|undefined} horse
 * @param {Date} [now]
 */
export function healthRefusal(horse, now = new Date()) {
  if (String(horse?.healthStatus).toLowerCase() === 'injured') {
    return 'HORSE_INJURED';
  }
  return horse && hasBadHealth(horse, now) ? 'horseBadHealth' : null;
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
 *   gaitScores?: object|null, age?: number|null, lastFedDate?: Date|string|null,
 *   lastVettedDate?: Date|string|null }} input.horse - ENTRY_RULE_HORSE_SELECT fields
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
  // Owner ruling (2026-10-05/07/12): undated shows refuse entry. Only a show
  // snapshot that carries closeDate is judged (the eligibility summary has no
  // show); conformation keeps its own schedule (7 days from createdAt).
  if (show.showType !== 'conformation' && show.closeDate === null) {
    return 'SHOW_UNDATED';
  }
  if (show.showType === 'conformation') {
    // C11: conformation's own age 0+ / groom rules live in its controller; it
    // still counts as one discipline type (C13).
    return disciplineTypeRefusal(show, activeTypes);
  }
  return (
    ageRefusal(horse?.dateOfBirth, now) ??
    healthRefusal(horse, now) ??
    riderRefusal(assignment, userId) ??
    gaitingRefusal(show.discipline, horse?.gaitScores) ??
    disciplineTypeRefusal(show, activeTypes)
  );
}
