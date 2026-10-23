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
  // Equoria-cmw85.16: only the three fields the routes read. An include would
  // return every Horse column (a dozen JSONB blobs) for up to 100 horses.
  return prisma.horse.findMany({
    where: { id: { in: horseIds } },
    select: { id: true, name: true, userId: true, user: { select: { id: true, username: true } } },
  });
}

/**
 * Wins per horse, ordered desc, for the wins metric branch (placement is the
 * Int rank since Equoria-f46tb).
 */
export function groupWinsByHorse(whereClause, { take, skip }) {
  return prisma.competitionResult.groupBy({
    by: ['horseId'],
    where: { ...whereClause, placement: 1 },
    _count: { id: true },
    orderBy: [{ _count: { id: 'desc' } }, { horseId: 'asc' }],
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
    orderBy: [{ _sum: { prizeWon: 'desc' } }, { horseId: 'asc' }],
    take,
    skip,
  });
}

/** Top-3 placements per horse for the placements metric branch. */
export function groupTopThreePlacementsByHorse(whereClause, { take, skip }) {
  return prisma.competitionResult.groupBy({
    by: ['horseId'],
    where: { ...whereClause, placement: { in: [1, 2, 3] } },
    _count: { id: true },
    orderBy: [{ _count: { id: 'desc' } }, { horseId: 'asc' }],
    take,
    skip,
  });
}

/**
 * Translate the route-built whereClause into SQL conditions. The translation is
 * intentionally CLOSED: only the exact filter shapes the route builds
 * (`placement: { not: null }`, optional `discipline` equality, optional
 * `runDate: { gte }`) are supported, and anything else throws instead of being
 * silently dropped from the SQL.
 *
 * @param {object} whereClause
 * @param {string} caller - function name for error messages
 * @returns {Array} Prisma.sql fragments, all of which must hold
 */
function whereToSqlConditions(whereClause, caller) {
  const { placement, discipline, runDate, ...unsupported } = whereClause ?? {};
  const unsupportedKeys = Object.keys(unsupported);
  if (unsupportedKeys.length > 0) {
    throw new Error(
      `${caller}: unsupported filter key(s) in whereClause: ${unsupportedKeys.join(', ')} — extend the SQL translation before filtering on them`,
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
    throw new Error(`${caller}: only the \`placement: { not: null }\` filter is supported`);
  }

  const conditions = [Prisma.sql`"placement" IS NOT NULL`];
  if (discipline !== undefined) {
    conditions.push(Prisma.sql`"discipline" = ${discipline}`);
  }
  if (runDate !== undefined) {
    const { gte, ...otherOps } = runDate ?? {};
    if (gte === undefined || Object.keys(otherOps).length > 0) {
      throw new Error(`${caller}: only the \`runDate: { gte }\` filter is supported`);
    }
    conditions.push(Prisma.sql`"runDate" >= ${new Date(gte)}`);
  }
  return conditions;
}

/**
 * Average placement per horse for the average_placement metric branch.
 * Requires a minimum of 3 numeric placements (HAVING count >= 3) so the
 * average is statistically meaningful.
 *
 * `CompetitionResult.placement` is the Int rank since Equoria-f46tb (it was a
 * String written as '1' and '1st'; Equoria-6lobd computed the average over its
 * leading digits). The average is computed in SQL:
 *
 * - Rows with no placing (NULL) are excluded from BOTH the average and the
 *   returned count (the route's `placement: { not: null }`), so
 *   competitionCount is the honest n the average was computed over.
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
  const conditions = whereToSqlConditions(whereClause, 'groupAveragePlacementByHorse');

  // Function-call form (`$queryRaw(Prisma.sql\`…\`)`) rather than the tagged
  // template — the in-repo convention for composed fragments (see
  // horseFeedService.mjs / horseConformationController.mjs). Under Jest the
  // tagged-template form failed to recognise the joined Sql fragments and
  // bound them as jsonb parameters (42804).
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT
      "horseId",
      AVG("placement")::float8 AS "averagePlacement",
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
 * Total-distinct-horse count for pagination metadata, counted in SQL
 * (Equoria-4qpqb) instead of materialising one group per horse in Node.
 *
 * @param {object} whereClause - same closed filter shapes as the average branch
 * @returns {Promise<number>} distinct horses with a result matching the filter
 */
export async function countDistinctHorses(whereClause) {
  const conditions = whereToSqlConditions(whereClause, 'countDistinctHorses');
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT COUNT(DISTINCT "horseId")::int AS "horseCount"
    FROM "competition_results"
    WHERE ${Prisma.join(conditions, ' AND ')}
  `);
  return Number(rows[0]?.horseCount ?? 0);
}

/**
 * Equoria-xxdqh (owner ruling 2026-10-22): the minimum shows entered before a
 * horse appears on the win-percentage board.
 */
export const winPercentageMinShows = 100;

// A win is a first place. `placement` is still a String column holding '1' or
// '1st' until the Int migration (Equoria-f46tb); both spellings count.
const isWinSql = Prisma.sql`"placement" IN ('1', '1st')`;

/**
 * Per-horse record over settled results (placement NOT NULL — a placeholder
 * row for a show that has not run yet is not a show entered), aggregated and
 * ranked in SQL. Returns the requested page plus the total qualifying count.
 *
 * @param {'winPercentage'|'wins'} board
 * @param {{ take: number, skip: number }} page
 * @returns {Promise<{ rows: Array<{ horseId: number, wins: number, showsEntered: number }>, total: number }>}
 */
async function rankHorseRecords(board, { take, skip }, discipline) {
  const having =
    board === 'winPercentage'
      ? Prisma.sql`COUNT(*) >= ${winPercentageMinShows}`
      : Prisma.sql`COUNT(*) FILTER (WHERE ${isWinSql}) >= 1`;
  // Equal ratios of integers divide to the identical float8, so equal win
  // percentages tie exactly and fall through to the horseId key.
  const orderBy =
    board === 'winPercentage'
      ? Prisma.sql`"wins"::float8 / "showsEntered" DESC, "horseId" ASC`
      : Prisma.sql`"wins" DESC, "horseId" ASC`;
  // Only the discipline boards narrow the record to one discipline.
  const disciplineFilter =
    discipline === undefined ? Prisma.empty : Prisma.sql` AND "discipline" = ${discipline}`;
  const records = Prisma.sql`
    SELECT
      "horseId",
      (COUNT(*) FILTER (WHERE ${isWinSql}))::int AS "wins",
      COUNT(*)::int AS "showsEntered"
    FROM "competition_results"
    WHERE "placement" IS NOT NULL${disciplineFilter}
    GROUP BY "horseId"
    HAVING ${having}`;

  const [rows, totals] = await Promise.all([
    prisma.$queryRaw(Prisma.sql`
      SELECT * FROM (${records}) AS "record"
      ORDER BY ${orderBy}
      LIMIT ${take} OFFSET ${skip}`),
    prisma.$queryRaw(Prisma.sql`SELECT COUNT(*)::int AS "total" FROM (${records}) AS "record"`),
  ]);
  return { rows, total: Number(totals[0]?.total ?? 0) };
}

/** Horses with >= winPercentageMinShows shows entered, by wins / shows entered. */
export function rankHorsesByWinPercentage(page) {
  return rankHorseRecords('winPercentage', page);
}

/** Horses with at least one win, by number of wins. */
export function rankHorsesByWins(page) {
  return rankHorseRecords('wins', page);
}

/**
 * Horses with at least one win in `discipline`, by wins there (Equoria-pthuj).
 * `showsEntered` counts the horse's settled results in that discipline only.
 */
export function rankHorsesByWinsIn(discipline, page) {
  return rankHorseRecords('wins', page, discipline);
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
