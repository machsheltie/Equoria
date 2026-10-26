import express from 'express';
import { query, validationResult } from 'express-validator';
import {
  getTopPlayersByXP,
  getTopHorsesByEarnings,
  getTopHorsesByPerformance,
  getTopPlayersByHorseEarnings,
  getLeaderboardStats,
  getUserRankSummary,
} from '../controllers/leaderboardController.mjs';
import * as pageBoards from '../controllers/pageBoardsController.mjs';
import { boardHandler } from '../controllers/boardsController.mjs';
import { isKnownDiscipline } from '../../competition/index.mjs';
import { getHorseAgeYears } from '../../../utils/horseAge.mjs';
import auth from '../../../middleware/auth.mjs';
import logger from '../../../utils/logger.mjs';
import { getHorseProfileForLeaderboard } from '../services/leaderboardCompetitionQueries.mjs';
import {
  competitionBoardCacheTtl,
  buildCompetitionBoard,
  competitionBoardCacheKey,
} from '../services/competitionBoard.mjs';
import { getCachedQuery } from '../../../utils/cacheHelper.mjs';

const router = express.Router();

/**
 * The page boards (Equoria-y3nia): playerXp, playerEarnings, playerWins,
 * playerWinPercentage, horsePoints, horseEarnings, horseWins, horseWinPercentage
 * and discipline, each with ?period=overall|monthly. They answer
 * { entries, currentPage, totalPages, totalEntries }; /players/*, /horses/*
 * keep their shapes.
 */
router.get('/boards/:board', auth, boardHandler);

/**
 * @swagger
 * /api/leaderboards/user-summary/{userId}:
 *   get:
 *     summary: Get a user's rank summary across all leaderboard categories
 *     description: |
 *       Returns the player's place on each player board they are on (playerXp, playerEarnings, playerWins, playerWinPercentage)
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
 *     summary: Get top horses ranked by their best competition score
 *     tags: [Leaderboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: discipline
 *         schema:
 *           type: string
 *         description: Only consider results from this discipline
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
router.get('/recent-winners', auth, pageBoards.recentWinnersBoard);

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
        if (value && !isKnownDiscipline(value)) {
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
      .withMessage('That is not a ranking the leaderboards keep'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  ],
  async (req, res) => {
    try {
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

      // Equoria-cmw85.6: the whole page (ranking, horse details, count) is served from
      // the server query cache, keyed on every parameter, at the sibling boards' 300s.
      // The HTTP response stays no-store (Equoria-cmw85.28).
      const params = {
        discipline,
        period,
        metric,
        limit: parseInt(limit),
        offset: parseInt(offset),
      };
      const data = await getCachedQuery(
        competitionBoardCacheKey(params),
        () => buildCompetitionBoard(params),
        competitionBoardCacheTtl,
      );

      logger.info(
        `[leaderboardRoutes.GET /competition] Retrieved ${data.leaderboard.length} leaderboard entries`,
      );

      res.status(200).json({ success: true, data });
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
      // game-year, date-only, Eastern game clock). Equoria-rkld: previously used raw
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

export default router;
