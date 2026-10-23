/**
 * Horse record boards — win percentage and number of wins (Equoria-xxdqh).
 *
 * Owner ruling 2026-10-22 (Stacey): the win-rate leaderboard does not rank by
 * best competition score. It has two categories:
 *   - win percentage = wins / shows entered, for horses with at least
 *     winPercentageMinShows (100) shows entered;
 *   - number of wins.
 * Ranking, qualification and the total are computed in SQL
 * (leaderboardCompetitionQueries.rankHorseRecords); ties break on horseId.
 *
 * Responses use the shape the LeaderboardsPage consumes directly:
 * `{ entries, currentPage, totalPages, totalEntries }`.
 */

import logger from '../../../utils/logger.mjs';
import { getCachedQuery } from '../../../utils/cacheHelper.mjs';
import { parsePaginationParams } from '../../../utils/paginationHelper.mjs';
import {
  fetchHorseDetailsByIds,
  rankHorsesByWinPercentage,
  rankHorsesByWins,
} from '../services/leaderboardCompetitionQueries.mjs';

const cacheTtl = 300; // 5 minutes, the leaderboard convention

/** Win percentage to one decimal place, for display only (ranking uses the exact ratio). */
const toPercent = (wins, showsEntered) => Math.round((wins / showsEntered) * 1000) / 10;

const BOARDS = {
  winPercentage: {
    rank: rankHorsesByWinPercentage,
    toEntryStats: ({ wins, showsEntered }) => {
      const winRate = toPercent(wins, showsEntered);
      return {
        primaryStat: winRate,
        secondaryStats: { wins, totalCompetitions: showsEntered, winRate },
      };
    },
  },
  wins: {
    rank: rankHorsesByWins,
    toEntryStats: ({ wins, showsEntered }) => ({
      primaryStat: wins,
      secondaryStats: { wins, totalCompetitions: showsEntered },
    }),
  },
};

function boardHandler(boardName) {
  const board = BOARDS[boardName];
  return async (req, res) => {
    const { page, limit, skip } = parsePaginationParams(req, { defaultLimit: 50, maxLimit: 100 });
    try {
      const ranked = await getCachedQuery(
        `leaderboard:horses:${boardName}:${limit}:${skip}`,
        async () => {
          const { rows, total } = await board.rank({ take: limit, skip });
          const horses = await fetchHorseDetailsByIds(rows.map(r => r.horseId));
          const horseById = new Map(horses.map(h => [h.id, h]));
          const entries = rows.map((row, index) => {
            const horse = horseById.get(row.horseId);
            return {
              rank: skip + index + 1,
              horseId: row.horseId,
              horseName: horse?.name ?? null,
              ownerId: horse?.userId ?? null,
              ownerName: horse?.user?.username ?? null,
              ...board.toEntryStats(row),
            };
          });
          return { entries, total };
        },
        cacheTtl,
      );

      return res.json({
        success: true,
        data: {
          entries: ranked.entries.map(entry => ({
            ...entry,
            isCurrentUser: entry.ownerId !== null && entry.ownerId === req.user?.id,
          })),
          currentPage: page,
          totalPages: Math.ceil(ranked.total / limit),
          totalEntries: ranked.total,
        },
      });
    } catch (error) {
      logger.error(`[horseRecordBoardsController.${boardName}] ${error.message}`);
      return res
        .status(500)
        .json({ success: false, message: 'Failed to retrieve the leaderboard' });
    }
  };
}

/** GET /api/v1/leaderboards/win-rate — win percentage, 100-show minimum. */
export const winPercentageBoard = boardHandler('winPercentage');

/** GET /api/v1/leaderboards/wins — number of wins. */
export const winsBoard = boardHandler('wins');
