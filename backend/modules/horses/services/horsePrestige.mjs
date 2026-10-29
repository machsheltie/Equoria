/**
 * Horse Prestige (Equoria-jyf8c, audit COMP-04).
 *
 * Owner ruling q255 (2026-10-28): a horse earns Prestige from its placings, plus
 * bonuses for placing in big fields and for repeat wins. Competition bible vol 13
 * marks the calculation [OPEN] and gives no weights, and [LOCKED] Prestige never
 * changes a competition score or genetic quality, so nothing here feeds scoring.
 *
 * Prestige is a projection of the horse's settled CompetitionResult rows (bible:
 * leaderboards and records are projections of authoritative results), so it
 * needs no column and a horse can never hold Prestige its results do not earn.
 *
 * Every number lives in horsePrestigeRules below. THE VALUES ARE PLACEHOLDERS:
 * the owner has ruled the structure, not the numbers, and they are waiting on
 * her answer. Change them only there.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';

/** PLACEHOLDER values, pending the owner's numbers (Equoria-jyf8c). */
export const horsePrestigeRules = Object.freeze({
  /** Prestige per placing, by placement; any other placement earns none. */
  placementPoints: Object.freeze({ 1: 10, 2: 6, 3: 4 }),
  /** A placing in a field of at least this many entrants earns the bonus once. */
  bigField: Object.freeze({ minimumEntrants: 10, bonusPoints: 5 }),
  /** Every 1st place after the horse's first win earns this bonus. */
  repeatWin: Object.freeze({ bonusPoints: 5 }),
});

/**
 * A horse's Prestige from its results, in the order they ran.
 *
 * @param {Array<{ placement: number|null, fieldSize: number }>} results - oldest first.
 * @param {typeof horsePrestigeRules} [rules]
 * @returns {number}
 */
export function scoreHorsePrestige(results, rules = horsePrestigeRules) {
  let prestige = 0;
  let wins = 0;
  for (const { placement, fieldSize } of results) {
    const placingPoints = rules.placementPoints[placement] ?? 0;
    if (placingPoints === 0) {
      continue;
    }
    prestige += placingPoints;
    if (fieldSize >= rules.bigField.minimumEntrants) {
      prestige += rules.bigField.bonusPoints;
    }
    if (placement === 1) {
      if (wins > 0) {
        prestige += rules.repeatWin.bonusPoints;
      }
      wins += 1;
    }
  }
  return prestige;
}

/**
 * Read a horse's results with each show's field size and score them.
 *
 * @param {number} horseId
 * @param {object} [client] - Prisma client or transaction.
 * @returns {Promise<number>}
 */
export async function computeHorsePrestige(horseId, client = prisma) {
  const results = await client.competitionResult.findMany({
    where: { horseId },
    select: { showId: true, placement: true },
    orderBy: [{ runDate: 'asc' }, { id: 'asc' }],
  });
  if (results.length === 0) {
    return 0;
  }
  const fields = await client.competitionResult.groupBy({
    by: ['showId'],
    where: { showId: { in: [...new Set(results.map(r => r.showId))] } },
    _count: { _all: true },
  });
  const fieldSizeByShow = new Map(fields.map(f => [f.showId, f._count._all]));
  return scoreHorsePrestige(
    results.map(r => ({ placement: r.placement, fieldSize: fieldSizeByShow.get(r.showId) ?? 0 })),
  );
}
