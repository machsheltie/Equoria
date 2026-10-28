import express from 'express';
import { query } from 'express-validator';
import { getUserRankSummary } from '../controllers/leaderboardController.mjs';
import { boardHandler } from '../controllers/boardsController.mjs';
import { getHorseAgeYears } from '../../../utils/horseAge.mjs';
import auth from '../../../middleware/auth.mjs';
import logger from '../../../utils/logger.mjs';
import { getHorseProfileForLeaderboard } from '../services/leaderboardCompetitionQueries.mjs';

const router = express.Router();

/**
 * The page boards (Equoria-y3nia): playerXp, playerEarnings, playerWins,
 * playerWinPercentage, horsePoints, horseEarnings, horseWins, horseWinPercentage
 * and discipline, each with ?period=overall|monthly. They answer
 * { entries, currentPage, totalPages, totalEntries }.
 *
 * The older ranked lists (/players/xp, /players/horse-earnings, /horses/earnings,
 * /horses/performance, /recent-winners, /stats, /competition) copied what these
 * boards show and were removed (owner ruling 2026-10-28, q151, Equoria-a7f1p).
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
