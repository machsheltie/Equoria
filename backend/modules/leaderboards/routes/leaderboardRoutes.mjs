import express from 'express';
import { query, validationResult } from 'express-validator';
import { MS_PER_WEEK } from '../../../constants/time.mjs';
import {
  getTopPlayersByLevel,
  getTopPlayersByXP,
  getTopHorsesByEarnings,
  getTopHorsesByPerformance,
  getTopPlayersByHorseEarnings,
  getRecentWinners,
  getLeaderboardStats,
  getUserRankSummary,
  getUserRankHistory,
  captureRankSnapshots,
} from '../controllers/leaderboardController.mjs';
import { getAllDisciplines } from '../../../utils/competitionLogic.mjs';
import { getHorseAgeYears } from '../../../utils/horseAge.mjs';
import auth, { requireRole } from '../../../middleware/auth.mjs';
import logger from '../../../utils/logger.mjs';
import {
  fetchHorseDetailsByIds,
  groupWinsByHorse,
  groupEarningsByHorse,
  groupTopThreePlacementsByHorse,
  groupAveragePlacementByHorse,
  groupDistinctHorseCount,
  getHorseProfileForLeaderboard,
} from '../services/leaderboardCompetitionQueries.mjs';

const router = express.Router();

/** Aliases for frontend compatibility (matches LeaderboardCategorySelector.tsx) */
router.get('/level', auth, getTopPlayersByLevel);
router.get('/prize-money', auth, getTopHorsesByEarnings);
router.get('/win-rate', auth, (req, res, next) => {
  req.query.metric = 'wins'; // Default win-rate to wins for now
  getTopHorsesByPerformance(req, res, next);
});
router.get('/owner', auth, getTopPlayersByHorseEarnings);

/**
 * @swagger
 * /api/leaderboard/players/level:
 *   get:
 *     summary: Get top players ranked by level and XP
 *     tags: [Leaderboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of players to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of players to skip for pagination
 *     responses:
 *       200:
 *         description: List of top players by level
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     players:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           rank:
 *                             type: integer
 *                           playerId:
 *                             type: integer
 *                           username:
 *                             type: string
 *                           level:
 *                             type: integer
 *                           xp:
 *                             type: integer
 *                           progressToNext:
 *                             type: number
 *                           xpToNext:
 *                             type: integer
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         offset:
 *                           type: integer
 *                         hasMore:
 *                           type: boolean
 */
router.get('/players/level', auth, getTopPlayersByLevel);

/**
 * @swagger
 * /api/leaderboards/user-summary/{userId}:
 *   get:
 *     summary: Get a user's rank summary across all leaderboard categories
 *     description: |
 *       Returns rankings per category (level, xp, horse-earnings, horse-performance)
 *       plus best ranking achievements (Top 10 / Top 100). Story 21S-1.
 *     tags: [Leaderboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Target user UUID
 *     responses:
 *       200:
 *         description: User rank summary. Returns empty arrays when the user does not exist.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                 userName:
 *                   type: string
 *                 rankings:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       category: { type: string }
 *                       categoryLabel: { type: string }
 *                       rank: { type: integer }
 *                       totalEntries: { type: integer }
 *                       rankChange: { type: integer }
 *                       primaryStat: { type: number }
 *                       statLabel: { type: string }
 *                 bestRankings:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       category: { type: string }
 *                       categoryLabel: { type: string }
 *                       rank: { type: integer }
 *                       achievement: { type: string }
 *       401:
 *         description: Unauthenticated
 */
router.get('/user-summary/:userId', auth, getUserRankSummary);

/**
 * Ownership guard for rank-history: a user may only read their own
 * historical rank snapshots (Equoria-l332). Mirrors the selfAccess
 * pattern in userRoutes.mjs (req.user.id must equal :userId).
 */
const requireSelfRankHistory = (req, res, next) => {
  const targetUserId = req.params.userId;
  if (!req.user?.id || req.user.id !== targetUserId) {
    logger.warn(
      `[leaderboardRoutes] rank-history self-access violation: user ${req.user?.id} → ${targetUserId}`,
    );
    return res.status(403).json({
      success: false,
      message: 'You can only access your own rank history',
    });
  }
  return next();
};

/**
 * @swagger
 * /api/leaderboards/rank-history/{userId}:
 *   get:
 *     summary: Get a user's historical rank time-series per category
 *     description: |
 *       Returns UserRankSnapshot rows grouped into one ascending series per
 *       category (level / xp / horse-earnings / horse-performance). Powers the
 *       rank-trend LineChart on the profile page. Ownership-enforced — a user
 *       may only read their own history. Equoria-l332.
 *     tags: [Leaderboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *         description: Lookback window in days (default + max 365)
 *     responses:
 *       200:
 *         description: Historical rank series. Empty series when no snapshots exist.
 *       403:
 *         description: Attempted to read another user's rank history
 */
router.get('/rank-history/:userId', auth, requireSelfRankHistory, getUserRankHistory);

/**
 * @swagger
 * /api/leaderboard/players/xp:
 *   get:
 *     summary: Get top players ranked by XP earned
 *     tags: [Leaderboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, year, all]
 *           default: all
 *         description: Time period for XP ranking
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of players to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of players to skip for pagination
 *     responses:
 *       200:
 *         description: List of top players by XP
 */
router.get('/players/xp', auth, getTopPlayersByXP);

/**
 * @swagger
 * /api/leaderboard/horses/earnings:
 *   get:
 *     summary: Get top horses ranked by total earnings
 *     tags: [Leaderboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: breed
 *         schema:
 *           type: string
 *         description: Filter by specific breed
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of horses to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of horses to skip for pagination
 *     responses:
 *       200:
 *         description: List of top horses by earnings
 */
router.get('/horses/earnings', auth, getTopHorsesByEarnings);

/**
 * @swagger
 * /api/leaderboard/horses/performance:
 *   get:
 *     summary: Get top horses ranked by performance metrics
 *     tags: [Leaderboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: metric
 *         schema:
 *           type: string
 *           enum: [wins, placements, average_score]
 *           default: wins
 *         description: Performance metric to rank by
 *       - in: query
 *         name: discipline
 *         schema:
 *           type: string
 *         description: Filter by specific discipline
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of horses to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of horses to skip for pagination
 *     responses:
 *       200:
 *         description: List of top horses by performance
 */
router.get('/horses/performance', auth, getTopHorsesByPerformance);

/**
 * @swagger
 * /api/leaderboard/players/horse-earnings:
 *   get:
 *     summary: Get top players ranked by combined horse earnings
 *     tags: [Leaderboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of players to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of players to skip for pagination
 *     responses:
 *       200:
 *         description: List of top players by horse earnings
 */
router.get('/players/horse-earnings', auth, getTopPlayersByHorseEarnings);

/**
 * @swagger
 * /api/leaderboard/recent-winners:
 *   get:
 *     summary: Get recent competition winners
 *     tags: [Leaderboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: discipline
 *         schema:
 *           type: string
 *         description: Filter by specific discipline
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Number of recent winners to return
 *     responses:
 *       200:
 *         description: List of recent competition winners
 */
router.get('/recent-winners', auth, getRecentWinners);

/**
 * @swagger
 * /api/leaderboard/stats:
 *   get:
 *     summary: Get comprehensive leaderboard statistics
 *     tags: [Leaderboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Comprehensive leaderboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     playerStats:
 *                       type: object
 *                     horseStats:
 *                       type: object
 *                     competitionStats:
 *                       type: object
 *                     topPerformers:
 *                       type: object
 */
router.get('/stats', auth, getLeaderboardStats);

/**
 * @swagger
 * /api/leaderboard/competition:
 *   get:
 *     summary: Get competition leaderboards with enhanced filtering
 *     tags: [Leaderboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: discipline
 *         schema:
 *           type: string
 *         description: Filter by specific discipline
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, year, all]
 *           default: all
 *         description: Time period for competition results
 *       - in: query
 *         name: metric
 *         schema:
 *           type: string
 *           enum: [wins, earnings, placements, average_placement]
 *           default: wins
 *         description: Metric to rank by
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of results to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of results to skip for pagination
 *     responses:
 *       200:
 *         description: Competition leaderboard results
 */
router.get(
  '/competition',
  auth,
  [
    query('discipline')
      .optional()
      .isString()
      .custom(value => {
        if (value && !getAllDisciplines().includes(value)) {
          throw new Error('Invalid discipline');
        }
        return true;
      }),
    query('period')
      .optional()
      .isIn(['week', 'month', 'year', 'all'])
      .withMessage('Period must be one of: week, month, year, all'),
    query('metric')
      .optional()
      .isIn(['wins', 'earnings', 'placements', 'average_placement'])
      .withMessage('Metric must be one of: wins, earnings, placements, average_placement'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn(
          `[leaderboardRoutes.GET /competition] Validation errors: ${JSON.stringify(errors.array())}`,
        );
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { discipline, period = 'all', metric = 'wins', limit = 20, offset = 0 } = req.query;

      logger.info(
        `[leaderboardRoutes.GET /competition] Getting competition leaderboard: discipline=${discipline}, period=${period}, metric=${metric}`,
      );

      // Calculate date filter based on period
      let dateFilter = {};
      if (period !== 'all') {
        const now = new Date();
        let startDate;

        switch (period) {
          case 'week':
            startDate = new Date(now.getTime() - MS_PER_WEEK);
            break;
          case 'month':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case 'year':
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
        }

        if (startDate) {
          dateFilter = {
            runDate: {
              gte: startDate.toISOString().split('T')[0],
            },
          };
        }
      }

      // Build where clause
      const whereClause = {
        placement: { not: null }, // Only completed competitions
        ...dateFilter,
      };

      if (discipline) {
        whereClause.discipline = discipline;
      }

      // Get competition results based on metric
      let results = [];

      if (metric === 'wins') {
        // Count wins (1st place) per horse
        const winCounts = await groupWinsByHorse(whereClause, {
          take: parseInt(limit),
          skip: parseInt(offset),
        });

        // Get horse details for winners
        const horseIds = winCounts.map(w => w.horseId);
        const horses = await fetchHorseDetailsByIds(horseIds);

        results = winCounts.map((winCount, index) => {
          const horse = horses.find(h => h.id === winCount.horseId);
          return {
            rank: parseInt(offset) + index + 1,
            horseId: winCount.horseId,
            horseName: horse?.name || 'Unknown',
            userId: horse?.userId,
            userName: horse?.user?.username || 'Unknown',
            wins: winCount._count.id,
            metric: 'wins',
            value: winCount._count.id,
          };
        });
      } else if (metric === 'earnings') {
        // Sum earnings per horse
        const earnings = await groupEarningsByHorse(whereClause, {
          take: parseInt(limit),
          skip: parseInt(offset),
        });

        // Get horse details
        const horseIds = earnings.map(e => e.horseId);
        const horses = await fetchHorseDetailsByIds(horseIds);

        results = earnings.map((earning, index) => {
          const horse = horses.find(h => h.id === earning.horseId);
          return {
            rank: parseInt(offset) + index + 1,
            horseId: earning.horseId,
            horseName: horse?.name || 'Unknown',
            userId: horse?.userId,
            userName: horse?.user?.username || 'Unknown',
            totalEarnings: Number(earning._sum.prizeWon) || 0,
            metric: 'earnings',
            value: Number(earning._sum.prizeWon) || 0,
          };
        });
      } else if (metric === 'placements') {
        // Count top 3 placements per horse
        const placements = await groupTopThreePlacementsByHorse(whereClause, {
          take: parseInt(limit),
          skip: parseInt(offset),
        });

        // Get horse details
        const horseIds = placements.map(p => p.horseId);
        const horses = await fetchHorseDetailsByIds(horseIds);

        results = placements.map((placement, index) => {
          const horse = horses.find(h => h.id === placement.horseId);
          return {
            rank: parseInt(offset) + index + 1,
            horseId: placement.horseId,
            horseName: horse?.name || 'Unknown',
            userId: horse?.userId,
            userName: horse?.user?.username || 'Unknown',
            topPlacements: placement._count.id,
            metric: 'placements',
            value: placement._count.id,
          };
        });
      } else if (metric === 'average_placement') {
        // Calculate average placement per horse
        const avgPlacements = await groupAveragePlacementByHorse(whereClause, {
          take: parseInt(limit),
          skip: parseInt(offset),
        });

        // Get horse details
        const horseIds = avgPlacements.map(a => a.horseId);
        const horses = await fetchHorseDetailsByIds(horseIds);

        results = avgPlacements.map((avgPlacement, index) => {
          const horse = horses.find(h => h.id === avgPlacement.horseId);
          return {
            rank: parseInt(offset) + index + 1,
            horseId: avgPlacement.horseId,
            horseName: horse?.name || 'Unknown',
            userId: horse?.userId,
            userName: horse?.user?.username || 'Unknown',
            averagePlacement: Number(avgPlacement._avg.placement) || 0,
            competitionCount: avgPlacement._count.id,
            metric: 'average_placement',
            value: Number(avgPlacement._avg.placement) || 0,
          };
        });
      }

      // Get total count for pagination (service-layer, Equoria-becrm)
      const totalCount = await groupDistinctHorseCount(whereClause);

      logger.info(
        `[leaderboardRoutes.GET /competition] Retrieved ${results.length} leaderboard entries`,
      );

      res.status(200).json({
        success: true,
        data: {
          leaderboard: results,
          filters: {
            discipline,
            period,
            metric,
          },
          pagination: {
            total: totalCount.length,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: parseInt(offset) + parseInt(limit) < totalCount.length,
          },
        },
      });
    } catch (error) {
      logger.error(`[leaderboardRoutes.GET /competition] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * @swagger
 * /api/leaderboards/horse/{horseId}:
 *   get:
 *     summary: Get horse leaderboard profile
 *     tags: [Leaderboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: horseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Horse ID
 *     responses:
 *       200:
 *         description: Horse profile with stats and competition history
 */
router.get(
  '/horse/:horseId',
  auth,
  [
    query('horseId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Horse ID must be a positive integer'),
  ],
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.horseId, 10);

      if (isNaN(horseId) || horseId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Horse ID must be a positive integer',
        });
      }

      logger.info(`[leaderboardRoutes.GET /horse/:horseId] Fetching profile for horse ${horseId}`);

      const horse = await getHorseProfileForLeaderboard(horseId);

      if (!horse) {
        return res.status(404).json({
          success: false,
          message: 'Horse not found',
        });
      }

      // Age in game-years via the canonical helper (7 real days = 1
      // game-year, date-only UTC). Equoria-rkld: previously used raw
      // Math.floor(ms / 365.25 days) calendar math, which both used the
      // wrong unit (calendar years, not game-years) and was off-by-one for
      // any dateOfBirth not stored at midnight UTC. getHorseAgeYears() is
      // the same helper the canonical horse serializer uses
      // (horseController.mjs), keeping the `age` field consistent across
      // the API. See PATTERN_LIBRARY.md / Equoria-vdw5 for the convention.
      const ageYears = getHorseAgeYears(horse.dateOfBirth);

      // Aggregate competition wins and top-three finishes
      let competitionWins = 0;
      let topThreeFinishes = 0;

      for (const result of horse.competitionResults) {
        const p = parseInt(result.placement);
        if (p === 1) {
          competitionWins++;
        }
        if (p <= 3) {
          topThreeFinishes++;
        }
      }

      logger.info(
        `[leaderboardRoutes.GET /horse/:horseId] Retrieved profile for horse ${horse.name} (ID: ${horseId})`,
      );

      return res.status(200).json({
        success: true,
        data: {
          horseId: horse.id,
          name: horse.name,
          breed: horse.breed?.name || null,
          age: ageYears,
          sex: horse.sex,
          stats: {
            speed: horse.speed,
            stamina: horse.stamina,
            agility: horse.agility,
            balance: horse.balance,
            precision: horse.precision,
            intelligence: horse.intelligence,
            boldness: horse.boldness,
            flexibility: horse.flexibility,
            obedience: horse.obedience,
            focus: horse.focus,
          },
          totalEarnings: Number(horse.totalEarnings) || 0,
          competitionWins,
          topThreeFinishes,
        },
      });
    } catch (error) {
      logger.error(`[leaderboardRoutes.GET /horse/:horseId] Error: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * POST /api/v1/leaderboards/admin/capture-rank-snapshots
 * Admin-only: capture current ranks for all users into user_rank_snapshots.
 * Intended for nightly scheduled invocation.  Equoria-uptj.
 */
router.post('/admin/capture-rank-snapshots', auth, requireRole('admin'), captureRankSnapshots);

export default router;
