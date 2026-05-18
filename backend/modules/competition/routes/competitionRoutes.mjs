import express from 'express';
import { body, param, validationResult } from 'express-validator';
import prisma from '../../../db/index.mjs';
import { getUserById } from '../../../models/userModel.mjs';
import { enterAndRunShow } from '../controllers/competitionController.mjs';
import conformationShowRoutes from './conformationShowRoutes.mjs';
import { getResultsByShow, getResultsByHorse } from '../../../models/resultModel.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import {
  validateCompetitionEntry,
  executeEnhancedCompetition,
  getCompetitionEligibilitySummary,
} from '../../../logic/enhancedCompetitionSimulation.mjs';
import {
  getAllDisciplines,
  getDisciplineConfig,
  calculateHorseLevel,
} from '../../../utils/competitionLogic.mjs';
import auth from '../../../middleware/auth.mjs';
import { queryRateLimiter, mutationRateLimiter } from '../../../middleware/rateLimiting.mjs';
import logger from '../../../utils/logger.mjs';
import { recordTransaction } from '../../../services/financialLedgerService.mjs';
import { parsePaginationParams, buildPaginatedResponse } from '../../../utils/paginationHelper.mjs';
import { invalidateCachePattern } from '../../../utils/cacheHelper.mjs';

const router = express.Router();

/**
 * GET /api/competition (and /api/v1/competition via the v1 mount)
 * List shows that are currently open for entry. Used by the frontend
 * CompetitionBrowserPage which renders cards from this response.
 *
 * Equoria-nj0y triage: this list endpoint was missing and the frontend
 * `competitionsApi.list()` call was 404'ing, leaving the browser in
 * permanent loading state and breaking the broader E2E specs that wait
 * for filter controls. The shape here matches the Competition type the
 * client expects (id, name, discipline, dates, fee, prize, status).
 */
router.get('/', queryRateLimiter, auth, async (req, res) => {
  try {
    const { page, limit, skip } = parsePaginationParams(req, { defaultLimit: 20, maxLimit: 100 });

    const where = { status: 'open' };

    const [shows, total] = await Promise.all([
      prisma.show.findMany({
        where,
        orderBy: { runDate: 'asc' },
        skip,
        take: limit,
      }),
      prisma.show.count({ where }),
    ]);

    return buildPaginatedResponse(res, shows, { page, limit, total });
  } catch (error) {
    logger.error(`[competitionRoutes.GET /] Error listing competitions: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to load competitions',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal error',
    });
  }
});

// Validation middleware for entering a show
const validateEnterShow = [
  body('showId').isInt({ min: 1 }).withMessage('Show ID must be a positive integer'),
  body('horseIds').isArray({ min: 1 }).withMessage('Horse IDs must be a non-empty array'),
  body('horseIds.*').isInt({ min: 1 }).withMessage('Each horse ID must be a positive integer'),
];

/**
 * POST /enter-show
 * Enter horses into a show and run the competition
 *
 * Request body:
 * {
 *   "showId": 1,
 *   "horseIds": [1, 2, 3, 4, 5]
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Competition completed successfully",
 *   "results": [...],
 *   "summary": {
 *     "totalEntries": 5,
 *     "validEntries": 5,
 *     "skippedEntries": 0,
 *     "topThree": [...]
 *   }
 * }
 */
router.post('/enter-show', mutationRateLimiter, auth, validateEnterShow, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn(
        `[competitionRoutes.POST /enter-show] Validation errors: ${JSON.stringify(errors.array())}`,
      );
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { showId, horseIds } = req.body;
    const userId = req.user.id;

    // IDOR Protection: Batch ownership validation for all horses
    const { validateBatchOwnership } = await import('../../../middleware/ownership.mjs');
    const ownedHorses = await validateBatchOwnership('horse', horseIds, userId);

    // Verify all horses are owned by the user
    if (ownedHorses.length !== horseIds.length) {
      logger.warn(
        `[competitionRoutes.POST /enter-show] Ownership violation: user ${userId} attempted to enter ${horseIds.length} horses but only owns ${ownedHorses.length}`,
      );
      return res.status(404).json({
        success: false,
        message: 'One or more horses not found', // Prevent ownership disclosure
      });
    }

    logger.info(
      `[competitionRoutes.POST /enter-show] Entering ${horseIds.length} horses into show ${showId}`,
    );

    // Get show details from database
    const show = await prisma.show.findUnique({
      where: { id: showId },
    });

    if (!show) {
      return res.status(404).json({
        success: false,
        message: 'Show not found',
      });
    }

    // Call the controller function
    const result = await enterAndRunShow(horseIds, show);

    // Log the result
    if (result.success) {
      logger.info(
        `[competitionRoutes.POST /enter-show] Competition completed successfully: ${result.summary.validEntries} entries, ${result.summary.skippedEntries} skipped`,
      );
    } else {
      logger.warn(`[competitionRoutes.POST /enter-show] Competition failed: ${result.message}`);
    }

    // Invalidate competition and leaderboard caches after a successful run
    if (result.success) {
      invalidateCachePattern('competition:*').catch(() => {
        /* non-critical */
      });
      invalidateCachePattern('leaderboard:*').catch(() => {
        /* non-critical */
      });
    }

    // Return appropriate status code based on success
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error) {
    logger.error(`[competitionRoutes.POST /enter-show] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});

/**
 * GET /show/:showId/results
 * Get all results for a specific show
 */
router.get('/show/:showId/results', queryRateLimiter, async (req, res) => {
  try {
    const showId = parseInt(req.params.showId, 10);

    if (isNaN(showId) || showId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid show ID',
      });
    }

    const results = await getResultsByShow(showId);

    logger.info(
      `[competitionRoutes.GET /show/${showId}/results] Retrieved ${results.length} results`,
    );

    res.json({
      success: true,
      showId,
      results,
      count: results.length,
    });
  } catch (error) {
    logger.error(`[competitionRoutes.GET /show/:showId/results] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});

/**
 * GET /show/:showId/entries
 * Scouting endpoint (Equoria-lfkw1, UX-spec 11.3.5 / Journey 4).
 *
 * Returns the REAL list of horses currently entered in an open show so
 * players can scout the field during the 7-day entry window. Per entered
 * horse: breed, level, top-3 stats, owner. Plus header data (entry count,
 * max entries, days remaining, show status).
 *
 * Authenticated (the whole /api/competition router is mounted under the
 * app's authRouter, which applies authenticateToken). Scouting is a
 * logged-in player action during the 7-day entry window. No ownership data
 * beyond the owner's display name is exposed.
 */
router.get(
  '/show/:showId/entries',
  queryRateLimiter,
  [param('showId').isInt({ min: 1 }).withMessage('Show ID must be a positive integer')],
  async (req, res) => {
    try {
      const validationErrors = validationResult(req);
      if (!validationErrors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid show ID',
          errors: validationErrors.array(),
        });
      }

      const showId = parseInt(req.params.showId, 10);

      const show = await prisma.show.findUnique({
        where: { id: showId },
        select: {
          id: true,
          name: true,
          discipline: true,
          entryFee: true,
          maxEntries: true,
          status: true,
          closeDate: true,
        },
      });

      if (!show) {
        return res.status(404).json({ success: false, message: 'Show not found' });
      }

      const STAT_KEYS = [
        'precision',
        'strength',
        'speed',
        'agility',
        'endurance',
        'intelligence',
        'stamina',
        'balance',
        'boldness',
        'flexibility',
        'obedience',
        'focus',
      ];

      const entries = await prisma.showEntry.findMany({
        where: { showId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          createdAt: true,
          horse: {
            select: {
              id: true,
              name: true,
              epigeneticModifiers: true,
              breed: { select: { name: true } },
              user: { select: { id: true, username: true } },
              precision: true,
              strength: true,
              speed: true,
              agility: true,
              endurance: true,
              intelligence: true,
              stamina: true,
              balance: true,
              boldness: true,
              flexibility: true,
              obedience: true,
              focus: true,
            },
          },
        },
      });

      const field = entries.map(e => {
        const h = e.horse;
        const allStats = STAT_KEYS.map(k => ({ name: k, value: h?.[k] ?? 0 }));
        const topStats = [...allStats].sort((a, b) => b.value - a.value).slice(0, 3);
        // Real, discipline-relative competitive level — the same
        // calculateHorseLevel() the entry-eligibility check uses, so the
        // scouted level matches what gates entry (no fabricated number).
        let level = null;
        try {
          level = h ? calculateHorseLevel(h, show.discipline) : null;
        } catch {
          level = null;
        }
        return {
          entryId: e.id,
          enteredAt: e.createdAt,
          horseId: h?.id,
          name: h?.name ?? 'Unknown',
          breed: h?.breed?.name ?? null,
          level,
          ownerId: h?.user?.id ?? null,
          ownerName: h?.user?.username ?? null,
          topStats,
        };
      });

      let daysRemaining = null;
      if (show.closeDate) {
        const ms = new Date(show.closeDate).getTime() - Date.now();
        daysRemaining = ms > 0 ? Math.ceil(ms / (24 * 60 * 60 * 1000)) : 0;
      }

      logger.info(
        `[competitionRoutes.GET /show/${showId}/entries] ${field.length} entries (status=${show.status})`,
      );

      res.json({
        success: true,
        show: {
          id: show.id,
          name: show.name,
          discipline: show.discipline,
          entryFee: show.entryFee,
          maxEntries: show.maxEntries,
          status: show.status,
          closeDate: show.closeDate,
        },
        entryCount: field.length,
        maxEntries: show.maxEntries ?? null,
        daysRemaining,
        entries: field,
      });
    } catch (error) {
      logger.error(`[competitionRoutes.GET /show/:showId/entries] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * GET /horse/:horseId/results
 * Get all competition results for a specific horse
 *
 * Security: Validates horse ownership before returning results
 */
router.get(
  '/horse/:horseId/results',
  queryRateLimiter,
  auth,
  [param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer')],
  requireOwnership('horse', { idParam: 'horseId' }),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.horseId, 10);

      const results = await getResultsByHorse(horseId);

      logger.info(
        `[competitionRoutes.GET /horse/${horseId}/results] Retrieved ${results.length} results`,
      );

      res.json({
        success: true,
        horseId,
        results,
        count: results.length,
      });
    } catch (error) {
      logger.error(`[competitionRoutes.GET /horse/:horseId/results] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * POST /api/competition/enter
 * Enter a horse in a competition with enhanced validation
 *
 * Request body:
 * {
 *   "horseId": 1,
 *   "showId": 1
 * }
 *
 * Security: Validates horse ownership via requireOwnership middleware
 * (atomic single-query check from req.body; Equoria-8ug7 / spec-5oll).
 */
router.post(
  '/enter',
  mutationRateLimiter,
  auth,
  [
    body('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    body('showId').isInt({ min: 1 }).withMessage('Show ID must be a positive integer'),
  ],
  // Express-validator only attaches results to the request; it doesn't
  // short-circuit. We need this in a dedicated middleware BEFORE
  // requireOwnership so a non-numeric horseId returns 400 "Validation
  // failed" (express-validator's contract) instead of 400 "Invalid horse
  // ID" (requireOwnership's contract for malformed IDs).
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn(
        `[competitionRoutes.POST /enter] Validation errors: ${JSON.stringify(errors.array())}`,
      );
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
  requireOwnership('horse', { idParam: 'horseId', from: 'body' }),
  async (req, res) => {
    try {
      const { horseId, showId } = req.body;
      const userId = req.user.id;

      logger.info(
        `[competitionRoutes.POST /enter] User ${userId} entering horse ${horseId} in show ${showId}`,
      );

      // Ownership validated by requireOwnership middleware (Equoria-8ug7).
      // The resolved Horse row is attached to req.horse — no second query.
      const horse = req.horse;

      // Get show details
      const show = await prisma.show.findUnique({
        where: { id: showId },
      });

      if (!show) {
        return res.status(404).json({
          success: false,
          message: 'Show not found',
        });
      }

      // Get user details
      const user = await getUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Validate competition entry using enhanced validation
      const validation = await validateCompetitionEntry(horse, show, user);

      if (!validation.eligible) {
        return res.status(400).json({
          success: false,
          message: 'Horse is not eligible for this competition',
          errors: validation.errors,
          eligibilityDetails: {
            horseLevel: validation.horseLevel,
            disciplineScore: validation.disciplineScore,
          },
        });
      }

      // Check if horse is already entered
      const existingEntry = await prisma.competitionResult.findFirst({
        where: {
          horseId,
          showId,
        },
      });

      if (existingEntry) {
        return res.status(400).json({
          success: false,
          message: 'Horse is already entered in this competition',
        });
      }

      const entry = await prisma.$transaction(
        async tx => {
          const updatedUser = await tx.user.update({
            where: { id: userId },
            data: {
              money: { decrement: show.entryFee },
            },
            select: { money: true },
          });

          const createdEntry = await tx.competitionResult.create({
            data: {
              horseId,
              showId,
              score: 0, // Will be updated when competition runs
              placement: null,
              discipline: show.discipline,
              runDate: show.runDate,
              showName: show.name,
              prizeWon: 0,
            },
          });

          if (show.entryFee > 0) {
            await recordTransaction(
              {
                userId,
                type: 'debit',
                amount: show.entryFee,
                category: 'competition_entry',
                description: `Entry fee for ${show.name}`,
                balanceAfter: updatedUser.money,
                metadata: {
                  horseId,
                  showId,
                  entryId: createdEntry.id,
                  discipline: show.discipline,
                },
              },
              tx,
            );
          }

          return createdEntry;
        },
        { timeout: 30000 },
      );

      logger.info(
        `[competitionRoutes.POST /enter] Successfully entered horse ${horseId} in show ${showId}`,
      );

      res.status(201).json({
        success: true,
        message: 'Horse successfully entered in competition',
        data: {
          entryId: entry.id,
          horseId,
          showId,
          entryFee: show.entryFee,
          eligibilityDetails: {
            horseLevel: validation.horseLevel,
            disciplineScore: validation.disciplineScore,
          },
        },
      });
    } catch (error) {
      logger.error(`[competitionRoutes.POST /enter] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * POST /api/competition/execute
 * Execute a competition with all entered horses
 *
 * Request body:
 * {
 *   "showId": 1
 * }
 */
router.post(
  '/execute',
  mutationRateLimiter,
  auth,
  [body('showId').isInt({ min: 1 }).withMessage('Show ID must be a positive integer')],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn(
          `[competitionRoutes.POST /execute] Validation errors: ${JSON.stringify(errors.array())}`,
        );
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { showId } = req.body;
      const userId = req.user.id;

      logger.info(
        `[competitionRoutes.POST /execute] User ${userId} executing competition for show ${showId}`,
      );

      // CWE-639 (Equoria-c4g3): scope show lookup by hostUserId so non-host
      // execute attempts are indistinguishable from not-found — same 404 + body.
      const show = await prisma.show.findFirst({
        where: { id: showId, hostUserId: userId },
      });

      if (!show) {
        return res.status(404).json({
          success: false,
          message: 'Show not found',
        });
      }

      // Get all entries for this show
      const entries = await prisma.competitionResult.findMany({
        where: {
          showId,
          placement: null, // Only get entries that haven't been processed yet
        },
        include: {
          horse: {
            include: {
              user: true,
              breed: true,
            },
          },
        },
      });

      if (entries.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No entries found for this competition',
        });
      }

      // Prepare entries for enhanced competition execution
      const competitionEntries = entries.map(entry => ({
        horse: entry.horse,
        user: entry.horse.user,
      }));

      logger.info(
        `[competitionRoutes.POST /execute] Executing competition with ${competitionEntries.length} entries`,
      );

      // Execute enhanced competition
      const competitionResult = await executeEnhancedCompetition(show, competitionEntries);

      if (!competitionResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Competition execution failed',
          error: competitionResult.error,
        });
      }

      logger.info(
        `[competitionRoutes.POST /execute] Competition executed successfully for show ${showId}`,
      );

      // Return results without scores (hidden from users)
      res.status(200).json({
        success: true,
        message: 'Competition executed successfully',
        data: {
          showId,
          showName: show.name,
          discipline: show.discipline,
          totalEntries: competitionResult.totalEntries,
          results: competitionResult.results, // Already filtered to hide scores
          statGains: competitionResult.statGains,
          totalPrizeDistributed: competitionResult.totalPrizeDistributed,
          totalXPAwarded: competitionResult.totalXPAwarded,
        },
      });
    } catch (error) {
      logger.error(`[competitionRoutes.POST /execute] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * GET /api/competition/eligibility/:horseId/:discipline
 * Check horse eligibility for a specific discipline
 *
 * Security: Validates horse ownership before checking eligibility
 */
router.get(
  '/eligibility/:horseId/:discipline',
  queryRateLimiter,
  auth,
  [
    param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    param('discipline')
      .isString()
      .isLength({ min: 1 })
      .withMessage('Discipline must be a non-empty string'),
  ],
  requireOwnership('horse', { idParam: 'horseId' }),
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn(
          `[competitionRoutes.GET /eligibility] Validation errors: ${JSON.stringify(errors.array())}`,
        );
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { horseId, discipline } = req.params;
      const horse = req.horse; // Cached by requireOwnership middleware

      logger.info(
        `[competitionRoutes.GET /eligibility] Checking eligibility for horse ${horseId} in ${discipline}`,
      );

      // Validate discipline
      const availableDisciplines = getAllDisciplines();
      if (!availableDisciplines.includes(discipline)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid discipline',
          availableDisciplines,
        });
      }

      // Get eligibility summary
      const eligibility = getCompetitionEligibilitySummary(horse, discipline);

      logger.info(
        `[competitionRoutes.GET /eligibility] Horse ${horseId} eligibility checked for ${discipline}`,
      );

      res.status(200).json({
        success: true,
        data: {
          horseId: parseInt(horseId),
          horseName: horse.name,
          discipline,
          eligibility,
        },
      });
    } catch (error) {
      logger.error(`[competitionRoutes.GET /eligibility] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// /conformation/* — conformation-show sub-router (Equoria-pety, 31F-2 Task 3)
// ---------------------------------------------------------------------------
// Mounted BEFORE the parameterised `/:competitionId/claim-prizes` route so
// the literal `/conformation` prefix is matched before express attempts to
// bind it as a `competitionId`. Without this ordering, an authenticated
// POST /competition/conformation/enter would be routed to the claim-prizes
// handler, which would then 400 on a non-numeric `competitionId` param —
// shadowing the real sub-router. Auth + csrfProtection are inherited from
// the parent authRouter in app.mjs.
router.use('/conformation', conformationShowRoutes);

/**
 * POST /api/competition/:competitionId/claim-prizes
 * Claim prizes from a competition result.
 * Validates the competition result belongs to a horse owned by the calling user.
 *
 * Security: Only the horse's owner may claim prizes.
 */
router.post(
  '/:competitionId/claim-prizes',
  mutationRateLimiter,
  auth,
  [
    param('competitionId')
      .isInt({ min: 1 })
      .withMessage('Competition ID must be a positive integer'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn(
          `[competitionRoutes.POST /:competitionId/claim-prizes] Validation errors: ${JSON.stringify(errors.array())}`,
        );
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const competitionId = parseInt(req.params.competitionId, 10);
      const userId = req.user.id;

      // Fetch the competition result and verify the horse belongs to the calling user
      const result = await prisma.competitionResult.findUnique({
        where: { id: competitionId },
        include: {
          horse: {
            select: { id: true, name: true, userId: true },
          },
        },
      });

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Competition result not found',
        });
      }

      if (result.horse.userId !== userId) {
        logger.warn(
          `[competitionRoutes.POST /:competitionId/claim-prizes] Ownership violation: user ${userId} attempted to claim prizes for competition ${competitionId}`,
        );
        return res.status(404).json({
          success: false,
          message: 'Competition result not found', // Prevent ownership disclosure
        });
      }

      const prizeAmount = Number(result.prizeWon) || 0;

      logger.info(
        `[competitionRoutes.POST /:competitionId/claim-prizes] User ${userId} claimed $${prizeAmount} for competition result ${competitionId}`,
      );

      return res.status(200).json({
        success: true,
        message: 'Prizes claimed successfully',
        data: {
          competitionResultId: result.id,
          competitionName: result.showName,
          horseName: result.horse.name,
          horseId: result.horse.id,
          placement: result.placement,
          prizeMoney: prizeAmount,
          discipline: result.discipline,
          runDate: result.runDate,
        },
      });
    } catch (error) {
      logger.error(`[competitionRoutes.POST /:competitionId/claim-prizes] Error: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * GET /api/competition/disciplines
 * Get all available competition disciplines
 */
router.get('/disciplines', queryRateLimiter, async (req, res) => {
  try {
    const disciplines = getAllDisciplines();
    const disciplineDetails = disciplines.map(discipline => ({
      name: discipline,
      config: getDisciplineConfig(discipline),
    }));

    res.status(200).json({
      success: true,
      data: {
        disciplines,
        disciplineDetails,
        total: disciplines.length,
      },
    });
  } catch (error) {
    logger.error(`[competitionRoutes.GET /disciplines] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});

export default router;
