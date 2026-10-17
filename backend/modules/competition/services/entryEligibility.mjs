/**
 * entryEligibility.mjs (Equoria-576c0 B9)
 *
 * The one entry-eligibility check both ridden entry paths run inside their
 * entry transaction (showEscrowTx.enterShowAtomicTx for POST
 * /api/v1/shows/:id/enter, competitionRouteQueries.enterShowDeferredTx for
 * POST /api/v1/competition/enter), so a rule can never pass on one path and
 * fail on the other, and every read is atomic with the entry it allows. The
 * rules themselves are utils/competitionEntryRules.mjs.
 */

import {
  ENTRY_REFUSALS,
  ENTRY_RULE_HORSE_SELECT,
  evaluateEntryRules,
  loadActiveAssignments,
} from '../../../utils/competitionEntryRules.mjs';

export { ENTRY_REFUSALS } from '../../../utils/competitionEntryRules.mjs';

/** Thrown inside the entry transaction; rolls the entry back. */
export class EntryRefusalError extends Error {
  constructor(code) {
    super(ENTRY_REFUSALS[code].message);
    this.name = 'EntryRefusalError';
    this.code = code;
    this.status = ENTRY_REFUSALS[code].status;
  }
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
  const ridden = show.showType !== 'conformation';
  const horse = ridden
    ? await tx.horse.findUnique({ where: { id: horseId }, select: ENTRY_RULE_HORSE_SELECT })
    : null;
  const assignment = ridden ? (await loadActiveAssignments(tx, [horseId])).get(horseId) : null;
  const code = evaluateEntryRules({
    show,
    horse,
    assignment,
    alreadyEntered: existing !== null,
    userId,
    now,
  });
  if (code) {
    throw new EntryRefusalError(code);
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
