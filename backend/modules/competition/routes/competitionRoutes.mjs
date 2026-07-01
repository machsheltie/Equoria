import express from 'express';
import { body, param, validationResult } from 'express-validator';
import conformationShowRoutes from './conformationShowRoutes.mjs';
import { getResultsByShow, getResultsByHorse } from '../services/resultModelService.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
// Equoria-kacla: enterAndRunShow / executeEnhancedCompetition /
// validateCompetitionEntry are no longer imported — the legacy instant
// enter-and-run (/enter-show) and on-demand execute (/execute) paths were
// removed (410 Gone) and /enter now performs a canonical deferred ShowEntry.
// getCompetitionEligibilitySummary is still used by GET /eligibility.
import { getCompetitionEligibilitySummary } from '../../../logic/enhancedCompetitionSimulation.mjs';
import {
  getAllDisciplines,
  getDisciplineConfig,
  calculateHorseLevel,
} from '../../../utils/competitionLogic.mjs';
import auth from '../../../middleware/auth.mjs';
import { queryRateLimiter, mutationRateLimiter } from '../../../middleware/rateLimiting.mjs';
import logger from '../../../utils/logger.mjs';
import {
  listShowsPaginated,
  getShowMetadata,
  getShowEntriesWithHorseStats,
  getShowForEntry,
  hasExistingShowEntry,
  enterShowDeferredTx,
} from '../services/competitionRouteQueries.mjs';
import { parsePaginationParams, buildPaginatedResponse } from '../../../utils/paginationHelper.mjs';

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

    const { shows, total } = await listShowsPaginated({ where, skip, take: limit });

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

/**
 * POST /enter-show — REMOVED (Equoria-kacla, 410 Gone)
 *
 * This was the legacy instant enter-and-run path: it synchronously called
 * `enterAndRunShow` and returned competition results immediately. That
 * directly contradicts the canonical 7-day deferred-window show model
 * (Equoria-nx8t1, commit 68a86c66b): a beta player hitting it got instant,
 * exploitable results outside the cron-scored window.
 *
 * Resolution chosen (OPTIMAL_FIX §1/§5): hard-deprecate with 410 Gone.
 * Nothing beta-facing called this — the frontend `competitionsApi` never
 * referenced `/enter-show`; only test mocks/backend tests did. There is no
 * UI to keep working, so the instant path is removed outright rather than
 * delegated. Players use `POST /api/shows/create` then
 * `POST /api/shows/:id/enter`; the nightly cron scores shows at day 7.
 *
 * `mutationRateLimiter` is kept so the deprecation response still carries
 * standard rate-limit headers (locked by competition-rate-limiting.test).
 */
router.post('/enter-show', mutationRateLimiter, auth, (req, res) => {
  logger.info(
    `[competitionRoutes.POST /enter-show] 410 Gone — legacy instant path removed (Equoria-kacla); user ${req.user?.id}`,
  );
  return res.status(410).json({
    success: false,
    message:
      'The instant enter-and-run competition path has been removed. Shows now use a 7-day deferred window: create a show with POST /api/shows/create, enter horses with POST /api/shows/:id/enter, and the nightly cron scores it 7 days after creation.',
  });
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

      const show = await getShowMetadata(showId);

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

      const entries = await getShowEntriesWithHorseStats(showId);

      const field = entries.map(e => {
        const h = e.horse;
        const allStats = STAT_KEYS.map(k => ({ name: k, value: h?.[k] ?? 0 }));
        const topStats = [...allStats].sort((a, b) => b.value - a.value).slice(0, 3);
        // Real, discipline-relative competitive level — the same
        // calculateHorseLevel() the entry-eligibility check uses, so the
        // scouted level matches what gates entry (no fabricated number).
        let level;
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

      // ── Equoria-kacla: DEFERRED ENTRY ONLY ──────────────────────────────
      //
      // This endpoint used to write a pre-scored row into competitionResult
      // (score 0, placement null) — a parallel, NON-canonical entry record
      // the nightly cron never reads, AND it never credited the show creator
      // (violating nx8t1 R7). The frontend `competitionsApi.enter` still
      // calls this route, so per the 21R doctrine it must keep working — but
      // on the CORRECT semantics. We now perform the exact canonical
      // deferred-entry transaction (mirrors showController.enterShow): open +
      // window guards, ShowEntry row (the table the cron executes), entrant
      // debited, creator credited. NO instant execution, NO results returned.
      const show = await getShowForEntry(showId);

      if (!show) {
        return res.status(404).json({
          success: false,
          message: 'Show not found',
        });
      }

      // 7-day window guards (nx8t1): only an open show inside its entry
      // window accepts entries; scoring is exclusively the cron's job.
      if (show.status !== 'open') {
        return res.status(409).json({
          success: false,
          message: 'This show is no longer accepting entries',
        });
      }
      if (show.closeDate && new Date(show.closeDate) <= new Date()) {
        return res.status(409).json({
          success: false,
          message: 'Entry period has closed',
        });
      }

      // Health/age eligibility (mirrors canonical enterShow).
      if (typeof horse.age === 'number' && horse.age < 3) {
        return res.status(400).json({
          success: false,
          message: 'Horse must be at least 3 years old to compete',
        });
      }
      if (String(horse.healthStatus).toLowerCase() === 'injured') {
        return res.status(400).json({
          success: false,
          message: 'Injured horses cannot compete',
        });
      }

      // Already entered? Canonical uniqueness lives on ShowEntry
      // (@@unique([showId, horseId])).
      const alreadyEntered = await hasExistingShowEntry(showId, horseId);
      if (alreadyEntered) {
        return res.status(409).json({
          success: false,
          message: 'Horse is already entered in this competition',
        });
      }

      // Equoria-nx8t1 R7: atomically debit the entrant the entryFee, CREDIT
      // the show creator the same amount, and create the canonical ShowEntry
      // — all in one transaction. The conditional updateMany (money >=
      // entryFee) is the atomic insufficient-funds guard and closes a
      // concurrent-spend race.
      let entry;
      try {
        // Service-layer atomic deferred-entry transaction (Equoria-becrm)
        entry = await enterShowDeferredTx({ show, showId, horseId, userId });
      } catch (txError) {
        if (txError.message === 'INSUFFICIENT_FUNDS') {
          return res.status(402).json({
            success: false,
            message: 'Insufficient funds for entry fee',
          });
        }
        if (txError.code === 'P2002') {
          return res.status(409).json({
            success: false,
            message: 'Horse is already entered in this competition',
          });
        }
        throw txError;
      }

      logger.info(
        `[competitionRoutes.POST /enter] Horse ${horseId} entered show ${showId} by user ${userId} (deferred — cron will score at closeDate)`,
      );

      // Same response shape the frontend `competitionsApi.enter` expects:
      // { entryId, horseId, showId, entryFee }. Crucially NO results /
      // placement / score — the cron produces those at day 7.
      res.status(201).json({
        success: true,
        message: 'Horse entered. The show runs 7 days after it was created.',
        data: {
          entryId: entry.id,
          horseId,
          showId,
          entryFee: show.entryFee,
        },
      });
    } catch (error) {
      // Equoria-7x9po: surface the retryable 503 from withRetryableTxMapping.
      if (error?.status === 503) {
        return res.status(503).json({ success: false, message: error.message });
      }
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
 * POST /api/competition/execute — REMOVED (Equoria-kacla, 410 Gone)
 *
 * This was a host-triggered instant executor: it called
 * `executeEnhancedCompetition` synchronously, scoring and paying out a show
 * on demand. That bypasses the canonical 7-day window entirely — a show
 * creator could score their own show the moment entries existed, defeating
 * the deferred model (Equoria-nx8t1).
 *
 * Resolution (OPTIMAL_FIX §1/§5): hard-deprecate with 410 Gone. The ONLY
 * sanctioned executor is the nightly cron `executeClosedShows` in
 * showController.mjs, which runs every show exactly once at `closeDate`
 * (createdAt + 7d) and is idempotent. Nothing beta-facing called this
 * endpoint (no frontend reference); removing it closes the on-demand-execute
 * exploit. `mutationRateLimiter` is kept so the response carries rate-limit
 * headers (locked by competition-rate-limiting.test).
 */
router.post('/execute', mutationRateLimiter, auth, (req, res) => {
  logger.info(
    `[competitionRoutes.POST /execute] 410 Gone — on-demand execution removed (Equoria-kacla); user ${req.user?.id}`,
  );
  return res.status(410).json({
    success: false,
    message:
      'On-demand competition execution has been removed. Shows are scored automatically by the nightly cron 7 days after creation (the 7-day deferred-window model). Use POST /api/shows/create and POST /api/shows/:id/enter.',
  });
});

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
// Keep this mounted BEFORE any future parameterised `/:competitionId/*` route
// so the literal `/conformation` prefix is matched before express could bind it
// as a `competitionId`. (The former `POST /:competitionId/claim-prizes` route
// that this comment used to guard was removed under Equoria-m1jmb — the
// frontend claim concept was deleted under Equoria-o3try and prizes now
// auto-credit at show settlement — but the ordering discipline stays so a new
// parameterised route can't shadow this sub-router.) Auth + csrfProtection are
// inherited from the parent authRouter in app.mjs.
router.use('/conformation', conformationShowRoutes);

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
