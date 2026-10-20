/**
 * groomWorkRules.mjs — may this groom work right now? (Equoria-mwjst)
 *
 * Lives in the shared layer, like utils/competitionEntryRules.mjs, because two
 * modules need it and the grooms module already imports competition: the grooms
 * care paths re-export it from groomEngagementService, and the conformation
 * entry transaction checks the presenting groom with it. One rule, one place.
 */

/**
 * May this groom groom a horse right now?
 *
 * PURE, and takes the groom row the caller already fetched, so adding the check
 * to a care path costs no extra query. The three refusals, in the order a caller
 * should report them:
 *   - retired      — the game ended their career (Equoria-m9lz1).
 *   - inactive     — `isActive: false`.
 *   - fee unpaid   — the player's grace period: "The groom can't groom horse until
 *                    paid for that week but they don't officially lose the groom
 *                    once until they fail to pay for a whole week."
 *
 * @param {{ retired?: boolean, isActive?: boolean, feeUnpaidSince?: Date|null, name?: string }} groom
 * @returns {{ allowed: boolean, reason: string|null, code: string|null }}
 */
export function checkGroomMayWork(groom) {
  if (!groom) {
    return { allowed: false, reason: 'Groom not found', code: 'not_found' };
  }
  if (groom.retired) {
    return {
      allowed: false,
      reason: `${groom.name ?? 'This groom'} has retired and can no longer work.`,
      code: 'retired',
    };
  }
  if (groom.isActive === false) {
    return {
      allowed: false,
      reason: `${groom.name ?? 'This groom'} is not currently working.`,
      code: 'inactive',
    };
  }
  if (groom.feeUnpaidSince) {
    return {
      allowed: false,
      reason:
        `${groom.name ?? 'This groom'} is waiting on this week's fee and cannot work until it ` +
        'is paid. They stay on your staff for one week; after a full week unpaid they return to ' +
        'the grooms for hire.',
      code: 'fee_unpaid',
    };
  }
  return { allowed: true, reason: null, code: null };
}
