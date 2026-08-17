/**
 * Leaderboards — competition-result aggregation queries
 *
 * Wraps the ten prisma calls used by leaderboardRoutes.mjs so the routes
 * layer no longer imports prisma directly (Equoria-becrm).
 *
 * Each metric branch (wins / earnings / placements / average_placement)
 * exposes a small `*ByGroupBy` helper that does the actual prisma.groupBy
 * call. The horse-detail join is shared (`fetchHorseDetailsByIds`) and
 * called once per metric branch with the ordered horse-id list the
 * groupBy returned.
 */

import prisma, { Prisma } from '../../../../packages/database/prismaClient.mjs';

/**
 * Fetch the per-horse user/breed details for an ordered list of horse ids.
 * Used by every metric branch to enrich the groupBy result with name +
 * owning user.
 *
 * @param {number[]} horseIds
 * @returns {Promise<Array<object>>}
 */
export function fetchHorseDetailsByIds(horseIds) {
  return prisma.horse.findMany({
    where: { id: { in: horseIds } },
    include: { user: { select: { id: true, username: true } } },
  });
}

/** Wins per horse, ordered desc, for the wins metric branch. */
export function groupWinsByHorse(whereClause, { take, skip }) {
  return prisma.competitionResult.groupBy({
    by: ['horseId'],
    where: { ...whereClause, placement: '1' },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take,
    skip,
  });
}

/** Earnings sum per horse for the earnings metric branch. */
export function groupEarningsByHorse(whereClause, { take, skip }) {
  return prisma.competitionResult.groupBy({
    by: ['horseId'],
    where: whereClause,
    _sum: { prizeWon: true },
    orderBy: { _sum: { prizeWon: 'desc' } },
    take,
    skip,
  });
}

/** Top-3 placements per horse for the placements metric branch. */
export function groupTopThreePlacementsByHorse(whereClause, { take, skip }) {
  return prisma.competitionResult.groupBy({
    by: ['horseId'],
    where: { ...whereClause, placement: { in: ['1', '2', '3'] } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take,
    skip,
  });
}

/**
 * Average placement per horse for the average_placement metric branch.
 * Requires a minimum of 3 numeric placements (HAVING count >= 3) so the
 * average is statistically meaningful.
 *
 * Equoria-6lobd: `CompetitionResult.placement` is a String? column, and
 * Prisma's `_avg` / `orderBy: { _avg }` only accept numeric fields — the
 * previous `prisma.competitionResult.groupBy({ _avg: { placement } })`
 * threw PrismaClientValidationError on every call, turning every
 * `?metric=average_placement` request into a 500. Until the placement
 * column becomes an Int (the migration decided under Equoria-f46tb), the
 * average is computed in SQL over the leading digits of the string:
 *
 * - `substring(placement from '^[0-9]+')::int` parses '1' and '1st'
 *   identically — the same leading-digits contract as placementToNumber()
 *   (userStatsService) and parseCompetitionPlacement()
 *   (horseOverviewController).
 * - Rows whose placement has no leading digit (e.g. a 'DQ') are excluded
 *   from BOTH the average and the returned count, so competitionCount is
 *   the honest n the average was computed over.
 * - Ties on the average are broken by horseId ASC so pagination is
 *   deterministic.
 *
 * The return shape mirrors the groupBy result the route already consumes:
 * `{ horseId, _avg: { placement }, _count: { id } }`.
 *
 * The whereClause translation is intentionally CLOSED: only the exact
 * filter shapes the route builds (`placement: { not: null }`, optional
 * `discipline` equality, optional `runDate: { gte }`) are supported, and
 * anything else throws instead of being silently dropped from the SQL.
 *
 * @param {object} whereClause - route-built filter (see above)
 * @param {{ take: number, skip: number }} pagination
 * @returns {Promise<Array<{ horseId: number, _avg: { placement: number }, _count: { id: number } }>>}
 */
export async function groupAveragePlacementByHorse(whereClause, { take, skip }) {
  const { placement, discipline, runDate, ...unsupported } = whereClause ?? {};
  const unsupportedKeys = Object.keys(unsupported);
  if (unsupportedKeys.length > 0) {
    throw new Error(
      `groupAveragePlacementByHorse: unsupported filter key(s) in whereClause: ${unsupportedKeys.join(', ')} — extend the SQL translation before filtering on them`,
    );
  }
  // The route always sends `placement: { not: null }`; any OTHER placement
  // filter has no SQL translation here and must not be silently ignored.
  if (
    placement !== undefined &&
    !(
      placement !== null &&
      typeof placement === 'object' &&
      placement.not === null &&
      Object.keys(placement).length === 1
    )
  ) {
    throw new Error(
      'groupAveragePlacementByHorse: only the `placement: { not: null }` filter is supported',
    );
  }

  const conditions = [
    Prisma.sql`"placement" IS NOT NULL`,
    // Numeric guard: only rows whose placement starts with a digit enter
    // the average ('1', '2nd', '10th' — yes; 'DQ' — no).
    Prisma.sql`"placement" ~ '^[0-9]'`,
  ];
  if (discipline !== undefined) {
    conditions.push(Prisma.sql`"discipline" = ${discipline}`);
  }
  if (runDate !== undefined) {
    const { gte, ...otherOps } = runDate ?? {};
    if (gte === undefined || Object.keys(otherOps).length > 0) {
      throw new Error(
        'groupAveragePlacementByHorse: only the `runDate: { gte }` filter is supported',
      );
    }
    conditions.push(Prisma.sql`"runDate" >= ${new Date(gte)}`);
  }

  // Function-call form (`$queryRaw(Prisma.sql\`…\`)`) rather than the tagged
  // template — the in-repo convention for composed fragments (see
  // horseFeedService.mjs / horseConformationController.mjs). Under Jest the
  // tagged-template form failed to recognise the joined Sql fragments and
  // bound them as jsonb parameters (42804).
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT
      "horseId",
      AVG((substring("placement" from '^[0-9]+'))::int)::float8 AS "averagePlacement",
      COUNT(*)::int AS "resultCount"
    FROM "competition_results"
    WHERE ${Prisma.join(conditions, ' AND ')}
    GROUP BY "horseId"
    HAVING COUNT(*) >= 3
    ORDER BY "averagePlacement" ASC, "horseId" ASC
    LIMIT ${take} OFFSET ${skip}
  `);

  return rows.map(row => ({
    horseId: row.horseId,
    _avg: { placement: row.averagePlacement },
    _count: { id: row.resultCount },
  }));
}

/**
 * Total-distinct-horse count for pagination metadata. Returns an array
 * whose `.length` is the count of distinct horses matching the filter.
 *
 * @param {object} whereClause
 * @returns {Promise<Array<{ horseId: number }>>}
 */
export function groupDistinctHorseCount(whereClause) {
  return prisma.competitionResult.groupBy({
    by: ['horseId'],
    where: whereClause,
    _count: { id: true },
  });
}

/**
 * Fetch the horse-leaderboard-profile row + competitionResults summary
 * used by `GET /api/leaderboards/horse/:horseId`. Returns `null` if the
 * row no longer exists.
 *
 * @param {number} horseId
 * @returns {Promise<object|null>}
 */
export function getHorseProfileForLeaderboard(horseId) {
  return prisma.horse.findUnique({
    where: { id: horseId },
    select: {
      id: true,
      name: true,
      dateOfBirth: true,
      sex: true,
      speed: true,
      stamina: true,
      agility: true,
      balance: true,
      precision: true,
      intelligence: true,
      boldness: true,
      flexibility: true,
      obedience: true,
      focus: true,
      totalEarnings: true,
      breed: { select: { name: true } },
      competitionResults: {
        select: { placement: true },
        where: { placement: { not: null } },
      },
    },
  });
}
