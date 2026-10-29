/**
 * Groom Retirement Notice — who is told that a groom retired, and what they read.
 *
 * Split out of groomRetirementService.mjs by Equoria-t08a4: recipient resolution
 * and payload assembly are a seam of their own, and the retirement file had
 * trimmed its explanations three times to stay under the 600-line cap. These are
 * PURE functions over rows `processRetirement` has already read inside its
 * transaction. The notification WRITE (`createNotificationTx`) deliberately stays
 * in that transaction body: invariant I4 (the notice is atomic with the
 * retirement) and groomRetirementGameDriven's boundary sentinel, which reads the
 * retirement service's source, both depend on it.
 *
 * Nothing here reads, returns or logs the hidden retirement age (invariant I3 in
 * groomRetirementService.mjs). The `ageYears` the payload carries is the groom's
 * ordinary age, sent in the same transaction that retires the groom.
 */

import logger from '../../../utils/logger.mjs';
import { groomAgeYears } from './groomAgeService.mjs';

/**
 * WHO GETS TOLD (Equoria-m9lz1 fix round 1).
 *   `Groom.userId` is `String?`, and `GroomAssignment` carries its OWN
 *   `userId`. Gating the notification on the groom's alone meant a groom with
 *   a null `userId` but live assignments could retire with nobody told — the
 *   player would lose care on their horse silently, which is exactly the
 *   failure the in-transaction notification exists to prevent. Currently
 *   unreachable (no unengaged non-retired groom has an active assignment —
 *   Equoria-ypb7d.2: "ownerless", a word `\bowner\b` cannot match)
 *   but the owner's "the game should notify a player" requirement is
 *   absolute, so it does not rely on that staying true. That population's
 *   SIZE is deliberately not quoted: it moves with ordinary play (56 when
 *   written, 62 the next day) and only "none has an active assignment" is
 *   load-bearing. Same reason as commit 6c8672c73.
 *
 *   Preference order: the groom's own owner, then the distinct owners of the
 *   assignments just ended. In the ordinary case those are the same person
 *   and this writes exactly ONE notification, so the normal path is
 *   unchanged. Ids are sorted so a multi-recipient write order is
 *   deterministic.
 *
 * @param {{userId: string|null}} retiredGroom
 * @param {Array<{userId: string|null}>} endingAssignments
 * @returns {string[]}
 */
export function retirementNoticeRecipients(retiredGroom, endingAssignments) {
  return retiredGroom.userId
    ? [retiredGroom.userId]
    : [...new Set(endingAssignments.map(a => a.userId).filter(Boolean))].sort();
}

/**
 * WHICH HORSES, PER RECIPIENT (fix round 3). A shared list of NAMES would show
 * one player another's horses in the multi-recipient fallback case. So the
 * groom's own owner gets every ending assignment that is theirs or carries no
 * `userId` of its own (`GroomAssignment.userId` is `String?`) — identical to the
 * old count on the ordinary path — and a fallback recipient gets only assignments
 * naming them. `horsesLeftUnattended` is that list's length, so it cannot lie.
 *
 * @returns {Array<{id: number, name: string|null}>}
 */
export function horsesForRecipient(retiredGroom, endingAssignments, recipientId) {
  return endingAssignments
    .filter(a =>
      retiredGroom.userId
        ? recipientId === retiredGroom.userId && (a.userId === recipientId || !a.userId)
        : a.userId === recipientId,
    )
    .map(a => ({ id: a.foal?.id ?? a.foalId, name: a.foal?.name ?? null }))
    .sort((x, y) => x.id - y.id);
}

/**
 * Every recipient's notice payload, in recipient order. The player's only
 * notice: it carries nothing they could not already see — and NOT the age (I3).
 *
 * @param {{groomId: number, retiredGroom: Object, endingAssignments: Object[], retirementReason: string}} input
 * @returns {{recipientIds: string[], payloadsByRecipient: Map<string, Object>}}
 */
export function buildRetirementNotices({
  groomId,
  retiredGroom,
  endingAssignments,
  retirementReason,
}) {
  const recipientIds = retirementNoticeRecipients(retiredGroom, endingAssignments);
  const payloadsByRecipient = new Map();
  for (const recipientId of recipientIds) {
    const horses = horsesForRecipient(retiredGroom, endingAssignments, recipientId);
    payloadsByRecipient.set(recipientId, {
      groomId,
      groomName: retiredGroom.name,
      speciality: retiredGroom.speciality,
      skillLevel: retiredGroom.skillLevel,
      // Owner ruling 2026-10-28 (q229): the star level, not the old 1-10 level.
      starLevel: retiredGroom.starLevel,
      // Equoria-maeba (owner, 2026-09-14): the notice speaks in YEARS. It used
      // to carry `careerWeeks`, which under the RETIRED career-weeks reading
      // was the groom's age and under the confirmed one is a bare count of
      // weekly passes — a number with no meaning to a player. The age is not
      // the hidden value (I3): that is the RETIREMENT age, and this notice is
      // sent in the same transaction that retires the groom, so it discloses
      // nothing ahead of the event.
      ageYears: groomAgeYears(retiredGroom),
      reason: retirementReason,
      horsesLeftUnattended: horses.length,
      horses,
    });
  }
  return { recipientIds, payloadsByRecipient };
}

/**
 * A HORSE WHOSE OWNER WAS NOT TOLD, in either shape: nobody could be notified
 * at all, or an ending assignment landed on no recipient's list. Both are
 * claims about DATA (`GroomAssignment.userId` vs `Groom.userId`), so both are
 * checked, and loud — that is what the in-transaction notice exists to prevent.
 * Loud but non-fatal: the retirement still commits.
 *
 * @param {number} groomId
 * @param {{recipientIds: string[], payloadsByRecipient: Map<string, Object>}} notices
 * @param {number} endedAssignmentCount
 */
export function reportUnattributedHorses(groomId, notices, endedAssignmentCount) {
  const attributed = [...notices.payloadsByRecipient.values()].reduce(
    (n, p) => n + p.horses.length,
    0,
  );
  if (attributed !== endedAssignmentCount) {
    logger.error(
      `[groomRetirementService.processRetirement] Groom ${groomId} ended ` +
        `${endedAssignmentCount} active assignment(s), but only ${attributed} reached one of ` +
        `${notices.recipientIds.length} notified player(s). A horse lost its groom with no warning to ` +
        'its owner. Investigate the userId on those GroomAssignment rows.',
    );
  }
}
