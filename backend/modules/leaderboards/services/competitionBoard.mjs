/**
 * The competition leaderboard payload for GET /api/leaderboard/competition
 * (Equoria-cmw85.6).
 *
 * Moved out of the route handler so the route can wrap the whole assembly (the
 * metric groupBy, the horse-detail read and the distinct-horse count) in one
 * getCachedQuery call. Everything a request varies by is an argument, and the
 * result is plain JSON-safe data (numbers, strings, booleans), so it survives
 * the Redis round-trip unchanged.
 */

import { startOfGameDay } from '../../../utils/gameTime.mjs';
import {
  countDistinctHorses,
  fetchHorseDetailsByIds,
  groupAveragePlacementByHorse,
  groupEarningsByHorse,
  groupTopThreePlacementsByHorse,
  groupWinsByHorse,
} from './leaderboardCompetitionQueries.mjs';

/** Seconds a competition leaderboard page is served from the server query cache. */
export const competitionBoardCacheTtl = 300;

/** The cache key: every parameter that changes the page. */
export function competitionBoardCacheKey({ discipline, period, metric, limit, offset }) {
  return `leaderboard:competition:${discipline || 'all'}:${period}:${metric}:${limit}:${offset}`;
}

/**
 * The rows of each metric: its ranking query and what a row adds to the entry.
 * Keyed by the camelCase form of the `metric` request value (the API spells the
 * last one with an underscore).
 */
const metricBoards = {
  wins: {
    group: groupWinsByHorse,
    fields: g => ({ wins: g._count.id }),
    value: g => g._count.id,
  },
  earnings: {
    group: groupEarningsByHorse,
    fields: g => ({ totalEarnings: Number(g._sum.prizeWon) || 0 }),
    value: g => Number(g._sum.prizeWon) || 0,
  },
  placements: {
    group: groupTopThreePlacementsByHorse,
    fields: g => ({ topPlacements: g._count.id }),
    value: g => g._count.id,
  },
  averagePlacement: {
    group: groupAveragePlacementByHorse,
    fields: g => ({
      averagePlacement: Number(g._avg.placement) || 0,
      competitionCount: g._count.id,
    }),
    value: g => Number(g._avg.placement) || 0,
  },
};

/** The result filter for a period: 00:00 Eastern of its first game day. */
function periodDateFilter(period) {
  const days = { week: 7, month: 30, year: 365 }[period];
  if (days === undefined) {
    return {};
  }
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return { runDate: { gte: startOfGameDay(startDate) } };
}

/**
 * @param {{ discipline?: string, period: string, metric: string, limit: number|string, offset: number|string }} params
 * @returns {Promise<{ leaderboard: object[], filters: object, pagination: object }>}
 */
export async function buildCompetitionBoard({ discipline, period, metric, limit, offset }) {
  const take = parseInt(limit);
  const skip = parseInt(offset);

  const whereClause = {
    placement: { not: null }, // Only completed competitions
    ...periodDateFilter(period),
    ...(discipline ? { discipline } : {}),
  };

  const board = metricBoards[metric.replace(/_(\w)/g, (_, c) => c.toUpperCase())];
  const ranked = board ? await board.group(whereClause, { take, skip }) : [];
  const horses = await fetchHorseDetailsByIds(ranked.map(g => g.horseId));

  const leaderboard = ranked.map((g, index) => {
    const horse = horses.find(h => h.id === g.horseId);
    return {
      rank: skip + index + 1,
      horseId: g.horseId,
      horseName: horse?.name || 'Unknown',
      userId: horse?.userId,
      userName: horse?.user?.username || 'Unknown',
      ...board.fields(g),
      metric,
      value: board.value(g),
    };
  });

  const total = await countDistinctHorses(whereClause);

  return {
    leaderboard,
    filters: { discipline, period, metric },
    pagination: { total, limit: take, offset: skip, hasMore: skip + take < total },
  };
}
