/**
 * Recent winners — the latest first places, in the page shape (Equoria-pthuj).
 *
 * The ranked boards (player and horse XP, points, earnings, wins, win
 * percentage, per-discipline wins) live in boardsController / boardService
 * (Equoria-y3nia).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { getCachedQuery } from '../../../utils/cacheHelper.mjs';
import { parsePaginationParams } from '../../../utils/paginationHelper.mjs';
import { startOfGameDay } from '../../../utils/gameTime.mjs';

const cacheTtl = 300; // 5 minutes, the leaderboard convention

/**
 * The periods the page offers on the boards built from dated results (Equoria-5uptv).
 * Same windows as GET /competition: weekly is the last 7 days, monthly the last 30,
 * each from 00:00 Eastern of its first game day; daily is today's game day.
 * `all-time` (or no period) has no start.
 */
const dayMs = 24 * 60 * 60 * 1000;
const periodStarts = {
  'all-time': () => null,
  daily: now => startOfGameDay(now),
  weekly: now => startOfGameDay(new Date(now.getTime() - 7 * dayMs)),
  monthly: now => startOfGameDay(new Date(now.getTime() - 30 * dayMs)),
};

/**
 * The start of the requested period, `null` for all-time, or `undefined` when the
 * request names a period the boards do not know (the caller answers 400).
 */
function periodStart(req) {
  const { period = 'all-time' } = req.query;
  const start = periodStarts[period];
  return typeof start === 'function' && Object.hasOwn(periodStarts, period)
    ? start(new Date())
    : undefined;
}

const unknownPeriodResponse = res =>
  res.status(400).json({
    success: false,
    message: 'Period must be one of: all-time, daily, weekly, monthly',
  });

/**
 * GET /api/v1/leaderboards/recent-winners — the latest first places. Answers the
 * page shape beside `winners`, the list its other readers (and tests) use.
 * Documented: limit default 20, max 50 (Equoria-9svu0).
 */
export const recentWinnersBoard = async (req, res) => {
  try {
    const { discipline } = req.query;
    const since = periodStart(req);
    if (since === undefined) {
      return unknownPeriodResponse(res);
    }
    const { limit } = parsePaginationParams(req, { defaultLimit: 20, maxLimit: 50 });
    // placement is the Int rank (Equoria-f46tb).
    const whereClause = { placement: 1 };
    if (since !== null) {
      whereClause.runDate = { gte: since };
    }

    if (discipline) {
      whereClause.discipline = discipline;
    }

    const cacheKey = `leaderboard:recent-winners:${discipline ?? 'all'}:${req.query.period ?? 'all-time'}:${limit}`;
    const results = await getCachedQuery(
      cacheKey,
      () =>
        prisma.competitionResult.findMany({
          where: whereClause,
          orderBy: [{ runDate: 'desc' }, { id: 'desc' }],
          take: limit,
          select: {
            id: true,
            runDate: true,
            showName: true,
            discipline: true,
            score: true,
            prizeWon: true,
            horseId: true,
            horse: {
              select: {
                name: true,
                userId: true,
                user: { select: { username: true } },
              },
            },
          },
        }),
      cacheTtl,
    );

    const winners = results.map(entry => ({
      id: entry.id,
      show: entry.showName,
      runDate: entry.runDate,
      horse: { name: entry.horse?.name || 'Unknown Horse' },
      owner: entry.horse?.user?.username || 'Unknown Owner',
      competition: { discipline: entry.discipline },
    }));

    // Newest first, so rank is recency; the page reads `entries` (Equoria-pthuj).
    const entries = results.map((entry, index) => ({
      rank: index + 1,
      horseId: entry.horseId,
      horseName: entry.horse?.name ?? null,
      ownerId: entry.horse?.userId ?? null,
      ownerName: entry.horse?.user?.username ?? null,
      primaryStat: Number(entry.score),
      secondaryStats: { totalPrizeMoney: Number(entry.prizeWon ?? 0) },
      isCurrentUser: Boolean(entry.horse?.userId) && entry.horse.userId === req.user?.id,
    }));
    const responseData = {
      winners,
      entries,
      currentPage: 1,
      totalPages: 1,
      totalEntries: entries.length,
    };
    if (discipline) {
      responseData.discipline = discipline;
    }

    res.json({
      success: true,
      message: 'Recent winners retrieved successfully',
      data: responseData,
    });
  } catch (error) {
    logger.error(`[pageBoardsController.recentWinners] Error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to retrieve recent winners' });
  }
};
