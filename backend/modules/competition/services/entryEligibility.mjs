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
  entryRefusalMessage,
  evaluateEntryRules,
  loadActiveAssignments,
  loadActiveDisciplineTypes,
} from '../../../utils/competitionEntryRules.mjs';

export { ENTRY_REFUSALS } from '../../../utils/competitionEntryRules.mjs';

/** Thrown inside the entry transaction; rolls the entry back. */
export class EntryRefusalError extends Error {
  constructor(code, message = ENTRY_REFUSALS[code].message, errors = null) {
    super(message);
    this.name = 'EntryRefusalError';
    this.code = code;
    this.status = ENTRY_REFUSALS[code].status;
    // The individual reasons, when the refusal has several (conformation rules).
    this.errors = errors;
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
 * @param {string} input.userId - the entrant, who must own the horse (checked
 *   here, under the entrant's User row lock)
 * @param {Date} [input.now]
 */
export async function checkEntryEligibility(
  tx,
  { show, showId, horseId, userId, now = new Date() },
) {
  // The 3-type limit (B10) counts the horse's entries, so two concurrent
  // entries for new types must not both read the same count. A guarded no-op
  // update of the owner's User row takes its row lock: every entry for the
  // horse (only its owner can enter it) serializes here, and the paid path's
  // later User debit is already under this lock. No horse lock: a zero-prize
  // settlement takes Horse -> User, so locking the horse after the User row
  // here could deadlock with it. (Feeding was the other Horse -> User path
  // until Equoria-lmer7 moved it to User first.)
  const serialized = await tx.user.updateMany({
    where: { id: userId },
    data: { money: { increment: 0 } },
  });
  if (serialized.count !== 1) {
    throw new Error(`Entrant ${userId} not found`);
  }
  // Equoria-mwjst: ownership is decided here, under that lock, not by the
  // request's earlier read. A sale always writes the seller's User row (its
  // credit, even at price 0) before it moves the horse, so a sale and this
  // entry are ordered by the same lock: a horse sold first reads as not ours
  // and is refused; one entered first is sold with its entry already paid by
  // the player who owned it.
  const owned = await tx.horse.findFirst({ where: { id: horseId, userId }, select: { id: true } });
  if (!owned) {
    throw new EntryRefusalError('horseNotFound');
  }
  const existing = await tx.showEntry.findFirst({
    where: { showId, horseId },
    select: { id: true },
  });
  const ridden = show.showType !== 'conformation';
  const horse = ridden
    ? await tx.horse.findUnique({ where: { id: horseId }, select: ENTRY_RULE_HORSE_SELECT })
    : null;
  const assignment = ridden ? (await loadActiveAssignments(tx, [horseId])).get(horseId) : null;
  const activeTypes = (await loadActiveDisciplineTypes(tx, [horseId])).get(horseId);
  const code = evaluateEntryRules({
    show,
    horse,
    assignment,
    alreadyEntered: existing !== null,
    activeTypes,
    userId,
    now,
  });
  if (code) {
    throw new EntryRefusalError(code, entryRefusalMessage(code, { activeTypes }));
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
  res.status(error.status).json({
    success: false,
    code: error.code,
    message: error.message,
    ...(error.errors ? { errors: error.errors } : {}),
  });
  return true;
}
