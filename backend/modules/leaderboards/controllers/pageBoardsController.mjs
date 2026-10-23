/**
 * Page boards — level, prize money, owner, discipline and recent winners (Equoria-pthuj).
 *
 * The LeaderboardsPage reads one response shape for every tab:
 * `{ entries, currentPage, totalPages, totalEntries }`, each entry being
 * `{ rank, horseId?, horseName?, ownerId, ownerName, primaryStat,
 * secondaryStats, isCurrentUser }` (see horseRecordBoardsController for the
 * win-rate and wins tabs). The canonical routes (`/players/level`,
 * `/horses/earnings`, `/players/horse-earnings`) keep their documented
 * `users` / `horses` / `rankings` shapes; these handlers serve the page's
 * aliases (`/level`, `/prize-money`, `/owner`, `/discipline`, `/recent-winners`) with the page
 * shape, using the same ordering as the canonical routes.
 *
 * Nothing here invents a ranking rule: level orders by (level, xp, id) like
 * `/players/level`; prize money orders by horse totalEarnings like
 * `/horses/earnings`; owner orders by summed horse totalEarnings like
 * `/players/horse-earnings`; discipline ranks horses by first places in that
 * discipline, the default metric of `/competition?discipline=`.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { getCachedQuery } from '../../../utils/cacheHelper.mjs';
import { parsePaginationParams } from '../../../utils/paginationHelper.mjs';
import { startOfGameDay } from '../../../utils/gameTime.mjs';
import { isKnownDiscipline } from '../../competition/index.mjs';
import {
  fetchHorseDetailsByIds,
  rankHorsesByWinsIn,
} from '../services/leaderboardCompetitionQueries.mjs';

// The win-percentage and wins boards are page boards too; one module serves them all.
export { winPercentageBoard, winsBoard } from './horseRecordBoardsController.mjs';

const cacheTtl = 300; // 5 minutes, the leaderboard convention

const pageWindow = req => parsePaginationParams(req, { defaultLimit: 50, maxLimit: 100 });

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

/** Run `load` through the cache and answer with the page shape. */
async function serveBoard(req, res, { boardName, cacheKey, window, load }) {
  const { page, limit, skip } = window;
  try {
    const board = await getCachedQuery(cacheKey, () => load({ take: limit, skip }), cacheTtl);
    return res.json({
      success: true,
      data: {
        entries: board.entries.map(entry => ({
          ...entry,
          isCurrentUser: entry.ownerId !== null && entry.ownerId === req.user?.id,
        })),
        currentPage: page,
        totalPages: Math.ceil(board.total / limit),
        totalEntries: board.total,
      },
    });
  } catch (error) {
    logger.error(`[pageBoardsController.${boardName}] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve the leaderboard' });
  }
}

/** GET /api/v1/leaderboards/level — players by level, then xp. */
export const levelBoard = (req, res) => {
  const window = pageWindow(req);
  return serveBoard(req, res, {
    boardName: 'level',
    cacheKey: `leaderboard:page:level:${window.limit}:${window.skip}`,
    window,
    load: async ({ take, skip }) => {
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          take,
          skip,
          orderBy: [{ level: 'desc' }, { xp: 'desc' }, { id: 'asc' }],
          select: { id: true, username: true, level: true },
        }),
        prisma.user.count(),
      ]);
      return {
        total,
        entries: users.map((user, index) => ({
          rank: skip + index + 1,
          ownerId: user.id,
          ownerName: user.username,
          primaryStat: user.level,
          secondaryStats: {},
        })),
      };
    },
  });
};

/** GET /api/v1/leaderboards/prize-money — horses by total earnings. */
export const prizeMoneyBoard = (req, res) => {
  const window = pageWindow(req);
  return serveBoard(req, res, {
    boardName: 'prizeMoney',
    cacheKey: `leaderboard:page:prize-money:${window.limit}:${window.skip}`,
    window,
    load: async ({ take, skip }) => {
      const where = { totalEarnings: { gt: 0 } };
      const [horses, total] = await Promise.all([
        prisma.horse.findMany({
          where,
          take,
          skip,
          orderBy: [{ totalEarnings: 'desc' }, { id: 'asc' }],
          select: {
            id: true,
            name: true,
            totalEarnings: true,
            userId: true,
            user: { select: { username: true } },
          },
        }),
        prisma.horse.count({ where }),
      ]);
      return {
        total,
        entries: horses.map((horse, index) => ({
          rank: skip + index + 1,
          horseId: horse.id,
          horseName: horse.name,
          ownerId: horse.userId,
          ownerName: horse.user?.username ?? null,
          primaryStat: horse.totalEarnings,
          secondaryStats: {},
        })),
      };
    },
  });
};

/** GET /api/v1/leaderboards/owner — owners by the summed earnings of their horses. */
export const ownerBoard = (req, res) => {
  const window = pageWindow(req);
  return serveBoard(req, res, {
    boardName: 'owner',
    cacheKey: `leaderboard:page:owner:${window.limit}:${window.skip}`,
    window,
    load: async ({ take, skip }) => {
      const [sums, total] = await Promise.all([
        prisma.horse.groupBy({
          by: ['userId'],
          where: { userId: { not: null } },
          _sum: { totalEarnings: true },
          orderBy: [{ _sum: { totalEarnings: 'desc' } }, { userId: 'asc' }],
          take,
          skip,
        }),
        prisma.user.count({ where: { horses: { some: {} } } }),
      ]);
      const users = await prisma.user.findMany({
        where: { id: { in: sums.map(row => row.userId) } },
        select: { id: true, username: true },
      });
      const nameById = new Map(users.map(user => [user.id, user.username]));
      return {
        total,
        entries: sums.map((row, index) => ({
          rank: skip + index + 1,
          ownerId: row.userId,
          ownerName: nameById.get(row.userId) ?? null,
          primaryStat: row._sum.totalEarnings ?? 0,
          secondaryStats: {},
        })),
      };
    },
  });
};

/** GET /api/v1/leaderboards/discipline?discipline=<name> — horses by first places in that discipline. */
export const disciplineBoard = (req, res) => {
  const { discipline } = req.query;
  if (!isKnownDiscipline(discipline)) {
    return res.status(400).json({ success: false, message: 'A known discipline is required' });
  }
  const since = periodStart(req);
  if (since === undefined) {
    return unknownPeriodResponse(res);
  }
  const window = pageWindow(req);
  return serveBoard(req, res, {
    boardName: 'discipline',
    cacheKey: `leaderboard:page:discipline:${discipline}:${req.query.period ?? 'all-time'}:${window.limit}:${window.skip}`,
    window,
    load: async ({ take, skip }) => {
      const { rows, total } = await rankHorsesByWinsIn(
        discipline,
        { take, skip },
        since ?? undefined,
      );
      const horses = await fetchHorseDetailsByIds(rows.map(row => row.horseId));
      const horseById = new Map(horses.map(horse => [horse.id, horse]));
      return {
        total,
        entries: rows.map((row, index) => {
          const horse = horseById.get(row.horseId);
          return {
            rank: skip + index + 1,
            horseId: row.horseId,
            horseName: horse?.name ?? null,
            ownerId: horse?.userId ?? null,
            ownerName: horse?.user?.username ?? null,
            primaryStat: row.wins,
            secondaryStats: { wins: row.wins, totalCompetitions: row.showsEntered },
          };
        }),
      };
    },
  });
};

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
