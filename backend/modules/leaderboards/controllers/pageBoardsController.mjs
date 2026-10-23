/**
 * Page boards — level, prize money, owner and discipline (Equoria-pthuj).
 *
 * The LeaderboardsPage reads one response shape for every tab:
 * `{ entries, currentPage, totalPages, totalEntries }`, each entry being
 * `{ rank, horseId?, horseName?, ownerId, ownerName, primaryStat,
 * secondaryStats, isCurrentUser }` (see horseRecordBoardsController for the
 * win-rate and wins tabs). The canonical routes (`/players/level`,
 * `/horses/earnings`, `/players/horse-earnings`) keep their documented
 * `users` / `horses` / `rankings` shapes; these handlers serve the page's
 * aliases (`/level`, `/prize-money`, `/owner`, `/discipline`) with the page
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
import { isKnownDiscipline } from '../../competition/index.mjs';
import {
  fetchHorseDetailsByIds,
  rankHorsesByWinsIn,
} from '../services/leaderboardCompetitionQueries.mjs';

const cacheTtl = 300; // 5 minutes, the leaderboard convention

const pageWindow = req => parsePaginationParams(req, { defaultLimit: 50, maxLimit: 100 });

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
  const window = pageWindow(req);
  return serveBoard(req, res, {
    boardName: 'discipline',
    cacheKey: `leaderboard:page:discipline:${discipline}:${window.limit}:${window.skip}`,
    window,
    load: async ({ take, skip }) => {
      const { rows, total } = await rankHorsesByWinsIn(discipline, { take, skip });
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
