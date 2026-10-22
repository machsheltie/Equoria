/**
 * Reading CompetitionResult.placement whichever way it was written
 * (Equoria-f46tb).
 *
 * The column is a string written two ways: the nightly executors store the
 * rank as a number ('1', '2', ...), older paths stored the ordinal ('1st',
 * '2nd', ...). A reader that matches one spelling silently misses the other,
 * so the wins and placements leaderboards, the stable's championship border
 * and the legacy score disagreed about the same horse. Until one encoding is
 * settled by a data migration (owner-gated, Equoria-f46tb), every reader that
 * compares placements goes through these two helpers.
 *
 * Cross-cutting on purpose: leaderboards, horses, users and the app query
 * layer all read the column, and horses/users may not import the competition
 * module (it imports them).
 */

/**
 * The 1-based rank a stored placement records, or null when it records none.
 * '1' and '1st' are both 1; a number passes through.
 *
 * @param {unknown} raw - CompetitionResult.placement (or an already-numeric rank)
 * @returns {number|null}
 */
export function placementRank(raw) {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw > 0 ? raw : null;
  }
  if (typeof raw !== 'string') {
    return null;
  }
  const match = raw.trim().match(/^(\d+)/);
  const rank = match ? Number.parseInt(match[1], 10) : 0;
  return rank > 0 ? rank : null;
}

function ordinal(rank) {
  const lastTwo = rank % 100;
  if (lastTwo >= 11 && lastTwo <= 13) {
    return `${rank}th`;
  }
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[rank % 10] ?? 'th';
  return `${rank}${suffix}`;
}

/**
 * Every stored spelling of the given ranks, for a Prisma `placement: { in }`
 * filter: storedPlacements(1) is ['1', '1st'].
 *
 * @param {...number} ranks - 1-based ranks
 * @returns {string[]}
 */
export function storedPlacements(...ranks) {
  return ranks.flatMap(rank => [String(rank), ordinal(rank)]);
}
