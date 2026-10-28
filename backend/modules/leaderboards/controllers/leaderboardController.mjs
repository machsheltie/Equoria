/**
 * Leaderboard Controller — the player's rank summary.
 *
 * The page boards are served by boardsController (GET /leaderboards/boards/:board).
 * The older ranked lists (players/xp, players/horse-earnings, horses/earnings,
 * horses/performance, recent-winners, stats, competition) were removed with the
 * duplicate lookups (owner ruling 2026-10-28, q151, Equoria-a7f1p).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import {
  loadPlayerStanding,
  playerBoardLabels,
  playerBoardNames,
} from '../services/boardService.mjs';

/**
 * GET /api/leaderboards/user-summary/:userId
 *
 * Returns a user's rank across all leaderboard categories plus their best
 * ranking achievements. Response shape matches frontend
 * `UserRankSummaryResponse` at frontend/src/lib/api/leaderboards.ts.
 *
 * Story 21S-1: closes the missing backend endpoint that
 * /leaderboards (classified beta-live) depends on.
 *
 * Not cached: user-specific, high cardinality.
 */
export const getUserRankSummary = async (req, res) => {
  const { userId } = req.params;

  // Validate UUID format before hitting Prisma to avoid PrismaClientKnownRequestError → 500
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(userId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid userId format',
    });
  }

  try {
    // 1) Fetch the target user. If missing, return 200 + empty arrays so the
    //    frontend dashboard can render an honest empty state instead of a 404
    //    during beta. (Frontend hook type is `UserRankSummaryResponse | null`.)
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    });

    if (!targetUser) {
      return res.json({
        userId,
        userName: 'Unknown',
        rankings: [],
        bestRankings: [],
      });
    }

    const userName = targetUser.username || 'Unknown';

    // Equoria-3kfne: the player's place on each player board (owner rulings
    // q10, q11), counted exactly as the board page counts it. A board the player
    // is not on (no XP, no earnings, no wins, fewer than 100 shows) is left out
    // rather than given a made-up place.
    const standings = await Promise.all(
      playerBoardNames.map(board => loadPlayerStanding(board, targetUser.id)),
    );

    const rankings = [];
    playerBoardNames.forEach((category, index) => {
      const standing = standings[index];
      if (!standing) {
        return;
      }
      rankings.push({
        category,
        categoryLabel: playerBoardLabels[category].categoryLabel,
        rank: standing.rank,
        totalEntries: standing.total,
        primaryStat: standing.primaryStat,
        statLabel: playerBoardLabels[category].statLabel,
      });
    });

    // Best rankings — rank ≤ 10 → "Top 10", ≤ 100 → "Top 100", else omit.
    const bestRankings = rankings
      .filter(r => r.rank <= 100)
      .map(r => ({
        category: r.category,
        categoryLabel: r.categoryLabel,
        rank: r.rank,
        achievement: r.rank <= 10 ? 'Top 10' : 'Top 100',
      }));

    return res.json({
      userId: targetUser.id,
      userName,
      rankings,
      bestRankings,
    });
  } catch (error) {
    logger.error(`[leaderboardController.getUserRankSummary] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user rank summary',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

export default {
  getUserRankSummary,
};
