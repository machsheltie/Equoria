/**
 * entryEligibility.mjs (Equoria-576c0 B9)
 *
 * The one entry-eligibility check both ridden entry paths run inside their
 * entry transaction (showEscrowTx.enterShowAtomicTx for POST
 * /api/v1/shows/:id/enter, competitionRouteQueries.enterShowDeferredTx for
 * POST /api/v1/competition/enter), so a rule can never pass on one path and
 * fail on the other, and every read is atomic with the entry it allows.
 *
 * Owner entry rules (2026-10-15) and rulings C10-C12 (2026-10-16):
 *   - age 3-20 game years (utils/horseAge.mjs, Eastern calendar);
 *   - C10: an active rider assignment whose rider is not retired and is
 *     employed by the horse's owner (the rider flag adjustment in scoring is
 *     unchanged);
 *   - C12: a Gaited show needs gaitScores.gaiting present (a non-empty list;
 *     a horse with no gait scores cannot enter Gaited);
 *   - no double entry in one show; no general competition cooldown.
 *   - R9: entering has nothing to do with XP or points, so the XP level
 *     bracket (Equoria-g8qg0) is no longer an entry rule. The show's
 *     level/range returns with B8, levels from the score.
 * Unchanged: an injured horse is refused (the Fair-or-better health band is B7).
 * C11: a conformation entry keeps its own age 0+ and groom rules
 * (conformationShowController); only the double-entry rule applies here.
 */

import { getHorseAgeYears } from '../../../utils/horseAge.mjs';

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

/** Thrown inside the entry transaction; rolls the entry back. */
export class EntryRefusalError extends Error {
  constructor(code) {
    super(ENTRY_REFUSALS[code].message);
    this.name = 'EntryRefusalError';
    this.code = code;
    this.status = ENTRY_REFUSALS[code].status;
  }
}

function hasGaiting(gaitScores) {
  return (
    gaitScores !== null &&
    typeof gaitScores === 'object' &&
    Array.isArray(gaitScores.gaiting) &&
    gaitScores.gaiting.length > 0
  );
}

/**
 * Check a horse may enter a show. Run INSIDE the entry transaction with its
 * client, before any money moves. Throws EntryRefusalError; returns nothing.
 *
 * @param {object} tx - the entry transaction's Prisma client
 * @param {object} input
 * @param {{ showType?: string, discipline?: string }} input.show
 * @param {number} input.showId
 * @param {number} input.horseId
 * @param {string} input.userId - the entrant (the horse's owner; ownership is
 *   checked by the caller before the transaction)
 * @param {Date} [input.now]
 */
export async function checkEntryEligibility(
  tx,
  { show, showId, horseId, userId, now = new Date() },
) {
  const existing = await tx.showEntry.findFirst({
    where: { showId, horseId },
    select: { id: true },
  });
  if (existing) {
    throw new EntryRefusalError('ALREADY_ENTERED');
  }
  if (show.showType === 'conformation') {
    return; // C11: conformation's own age 0+ / groom rules live in its controller.
  }

  const horse = await tx.horse.findUnique({
    where: { id: horseId },
    select: { dateOfBirth: true, healthStatus: true, gaitScores: true },
  });
  const ageYears = getHorseAgeYears(horse?.dateOfBirth, now);
  if (ageYears < MIN_ENTRY_AGE_YEARS) {
    throw new EntryRefusalError('AGE_TOO_YOUNG');
  }
  if (ageYears > MAX_ENTRY_AGE_YEARS) {
    throw new EntryRefusalError('AGE_TOO_OLD');
  }
  if (String(horse.healthStatus).toLowerCase() === 'injured') {
    throw new EntryRefusalError('HORSE_INJURED');
  }

  // C10. Assigning a rider deactivates the horse's other assignments, so there
  // is one active assignment; the newest is the one judged if data says otherwise.
  const assignment = await tx.riderAssignment.findFirst({
    where: { horseId, isActive: true },
    orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
    select: { rider: { select: { retired: true, userId: true } } },
  });
  if (!assignment?.rider) {
    throw new EntryRefusalError('RIDER_REQUIRED');
  }
  if (assignment.rider.retired === true) {
    throw new EntryRefusalError('RIDER_RETIRED');
  }
  if (assignment.rider.userId !== userId) {
    throw new EntryRefusalError('RIDER_NOT_EMPLOYED');
  }

  // C12.
  if (show.discipline === 'Gaited' && !hasGaiting(horse.gaitScores)) {
    throw new EntryRefusalError('GAITING_REQUIRED');
  }
}

/**
 * Send an EntryRefusalError as `{ success: false, code, message }` with its
 * status. Returns true when it handled the error.
 */
export function sendEntryRefusal(res, error) {
  if (!(error instanceof EntryRefusalError)) {
    return false;
  }
  res.status(error.status).json({ success: false, code: error.code, message: error.message });
  return true;
}
