/**
 * GET /api/v1/leaderboards/boards/:board?period=overall|monthly (Equoria-y3nia).
 *
 * One handler serves every board of the redesign (owner rulings q10, q11, q40):
 * the page reads `{ entries, currentPage, totalPages, totalEntries }`, each
 * entry `{ rank, horseId?, horseName?, ownerId, ownerName, primaryStat,
 * secondaryStats, isCurrentUser }`. The ranking itself is boardService.
 *
 * Cached for 300 seconds like every leaderboard (cmw85.6). The key carries the
 * game month, so the monthly boards roll over at the first midnight Eastern
 * without waiting for an entry to expire.
 */

import logger from '../../../utils/logger.mjs';
import { getCachedQuery } from '../../../utils/cacheHelper.mjs';
import { parsePaginationParams } from '../../../utils/paginationHelper.mjs';
import { gameMonthKey } from '../../../utils/gameTime.mjs';
import { isKnownDiscipline } from '../../competition/index.mjs';
import { boardPeriods, isBoardName, loadBoard } from '../services/boardService.mjs';

const cacheTtl = 300; // 5 minutes, the leaderboard convention

export async function boardHandler(req, res) {
  const { board } = req.params;
  if (!isBoardName(board)) {
    return res.status(404).json({ success: false, message: 'Unknown leaderboard' });
  }
  const period = req.query.period ?? 'overall';
  if (!boardPeriods.includes(period)) {
    return res
      .status(400)
      .json({ success: false, message: `Period must be one of: ${boardPeriods.join(', ')}` });
  }
  const { discipline } = req.query;
  if (board === 'discipline' && !isKnownDiscipline(discipline)) {
    return res.status(400).json({ success: false, message: 'A known discipline is required' });
  }

  const { page, limit, skip } = parsePaginationParams(req, { defaultLimit: 50, maxLimit: 100 });
  const monthKey = period === 'monthly' ? gameMonthKey() : '-';
  const cacheKey = `leaderboard:board:${board}:${period}:${monthKey}:${
    board === 'discipline' ? discipline : '-'
  }:${limit}:${skip}`;
  try {
    const ranked = await getCachedQuery(
      cacheKey,
      () => loadBoard(board, period, { take: limit, skip }, { discipline }),
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
    logger.error(`[boardsController.${board}] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve the leaderboard' });
  }
}
