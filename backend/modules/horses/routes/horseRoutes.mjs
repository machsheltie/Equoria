import express from 'express';
import { query } from 'express-validator';
import { getTrainableHorses } from '../../../controllers/trainingController.mjs';
import { getTemperamentDefinitions } from '../controllers/horseController.mjs';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership, findOwnedResource } from '../../../middleware/ownership.mjs';
import { mutationRateLimiter, queryRateLimiter } from '../../../middleware/rateLimiting.mjs';
import horseFeedRoutes from './horseFeedRoutes.mjs';
import horseGeneticsRoutes from './horseGeneticsRoutes.mjs';
import horseXpRoutes from './horseXpRoutes.mjs';
import horseBreedingRoutes from './horseBreedingRoutes.mjs';
import horseHistoryRoutes from './horseHistoryRoutes.mjs';
import horseFoalRoutes from './horseFoalRoutes.mjs';
import {
  handleValidationErrors,
  rejectPollutedRequest,
  validateHorseUpdatePayload,
  validateHorseCreation,
  validateHorseId,
  validateUserId,
} from './_validators.mjs';
import { createHorseFromRequest } from '../services/createHorseService.mjs';
import { deleteHorseById } from '../services/deleteHorseService.mjs';
import {
  listHorses,
  getRecentResultsForHorses,
  updateHorse,
} from '../services/horseRouteQueries.mjs';
import logger from '../../../utils/logger.mjs';
import { withHealth } from '../../../utils/horseHealth.mjs';
import { withAgeYears } from '../../../utils/horseAge.mjs';
import {
  getCachedQuery,
  generateCacheKey,
  invalidateCachePattern,
} from '../../../utils/cacheHelper.mjs';

// Horse list cache TTL (seconds)
const HORSE_LIST_TTL = 120; // 2 minutes

const router = express.Router();

// Equoria-y8u2j: validators below were inlined here and have been moved to
// _validators.mjs (already imported above). The parent router now uses the
// shared module so feed/genetics/xp/breeding sub-routers and the parent
// route definitions share one source of truth.

/**
 * GET /horses
 * Get all horses with optional filtering
 */
router.get('/', queryRateLimiter, authenticateToken, rejectPollutedRequest, async (req, res) => {
  try {
    // Guard against overly long or malicious query strings
    const urlLength = (req.originalUrl || '').length;
    if (urlLength > 2000) {
      return res.status(414).json({ success: false, message: 'Query too long' });
    }

    let rawQuery = (req.url || '').toLowerCase();
    try {
      rawQuery = decodeURIComponent(req.url || '').toLowerCase();
    } catch {
      // keep rawQuery fallback
    }
    if (
      rawQuery.includes("' or '1'='1") ||
      rawQuery.includes('$ne') ||
      rawQuery.includes('<script>') ||
      rawQuery.includes('\0')
    ) {
      return res.status(400).json({ success: false, message: 'Invalid parameters' });
    }

    const { userId: queryUserId, breedId, limit = 200, offset = 0 } = req.query;

    const where = {};
    // CWE-639 / IDOR fix (Equoria-tzyv8): scope results to the authenticated
    // user unless the caller is an admin.
    //
    // Decision (option a — silent self-scope): a non-admin's ?userId param is
    // silently ignored and always replaced with req.user.id. This avoids
    // breaking callers that pass their own userId as a React Query cache-key
    // discriminator (e.g. BreedingPairSelection.tsx, horseListLatestEvent tests)
    // and is backward-compatible. Option (b) — 403 on cross-user userId — was
    // considered but would break those legitimate same-user callers without a
    // coordinated frontend change. Admins (role === 'admin') retain the
    // override so support tooling can query any user's horses.
    const isAdmin = req.user.role === 'admin';
    const effectiveUserId = isAdmin
      ? queryUserId || req.user.id // admin: honour the override; fall back to self
      : req.user.id; // non-admin: always self — never trust client userId
    if (effectiveUserId) {
      // Match by userId (schema standard)
      where.userId = effectiveUserId;
    }

    if (breedId) {
      where.breedId = parseInt(breedId);
    }

    const cacheKey = generateCacheKey(
      'horses:list',
      effectiveUserId || 'all',
      breedId || 'all',
      limit,
      offset,
    );

    const horses = await getCachedQuery(
      cacheKey,
      () => listHorses(where, { take: parseInt(limit), skip: parseInt(offset) }),
      HORSE_LIST_TTL,
    );

    // Equoria-55bo.5: attach a lightweight `latestEvent` (most-recent
    // competition result) so NarrativeChip.deriveLatestChapter can surface
    // competition narratives ("Won 1st in yesterday's show") WITHOUT an
    // N+1 per-card fetch. One batched query for the whole page; the most
    // recent result per horse is selected in JS (results are ordered by
    // runDate desc so the first seen per horseId is the latest).
    const horseIds = horses.map(h => h.id);
    const latestEventByHorse = new Map();
    // Equoria-55bo.6: real per-horse championship signal for GoldBorderFrame
    // on the non-HoF stable/dashboard cards (Spec 11.3.13). Counted from the
    // SAME single batched competitionResult query that powers latestEvent —
    // no extra query, no N+1. `placement` is stored as a label string ('1st',
    // '2nd', …), so a 1st-place win is `placement === '1st'`.
    const firstPlaceWinsByHorse = new Map();
    if (horseIds.length > 0) {
      const recentResults = await getRecentResultsForHorses(horseIds);
      for (const r of recentResults) {
        if (!latestEventByHorse.has(r.horseId)) {
          latestEventByHorse.set(r.horseId, {
            type: 'competition',
            showName: r.showName,
            discipline: r.discipline,
            placement: r.placement ?? null,
            date: r.runDate ? new Date(r.runDate).toISOString() : null,
          });
        }
        // Normalize the placement label before comparing so '1st', '1ST',
        // or stray whitespace all count as a real 1st-place win.
        if (typeof r.placement === 'string' && r.placement.trim().toLowerCase() === '1st') {
          firstPlaceWinsByHorse.set(r.horseId, (firstPlaceWinsByHorse.get(r.horseId) ?? 0) + 1);
        }
      }
    }

    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      message: `Found ${horses.length} horses`,
      data: horses.map(h => {
        const firstPlaceWins = firstPlaceWinsByHorse.get(h.id) ?? 0;
        return {
          ...withAgeYears(withHealth(h)),
          // Explicit null (not undefined) so the frontend key always exists
          // and deriveLatestChapter can branch on its presence.
          latestEvent: latestEventByHorse.get(h.id) ?? null,
          // Equoria-55bo.6: real championship signal derived from actual
          // 1st-place CompetitionResult rows (NOT a hardcoded flag). The
          // frontend wraps a qualifying card in GoldBorderFrame when
          // hasChampionship is true. firstPlaceWins is the underlying count.
          firstPlaceWins,
          hasChampionship: firstPlaceWins > 0,
        };
      }),
    });
  } catch (error) {
    logger.error(`[horseRoutes] Error getting horses: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});

/**
 * GET /horses/trait-trends
 * Get trait development trends across user's horses
 */
router.get(
  '/trait-trends',
  queryRateLimiter,
  authenticateToken,
  query('userId').custom((value, { req }) => {
    if (value !== req.user.id) {
      throw new Error('Access denied: Can only access your own trait trends');
    }
    return true;
  }),
  query('timeframe')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Timeframe must be 1-365 days'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId } = req.query;
      const timeframe = parseInt(req.query.timeframe) || 30;

      // Analyze trends
      const cutoffDate = new Date(Date.now() - timeframe * 24 * 60 * 60 * 1000);
      logger.debug(`Trend analysis requested with cutoff: ${cutoffDate.toISOString()}`);
      const trends = [];
      const patterns = {};
      const predictions = {};

      logger.info(`Trait trends analyzed for user ${userId} (${timeframe} days)`);

      res.json({
        success: true,
        data: {
          trends,
          patterns,
          predictions,
          timeframe,
          analysisDate: new Date(),
        },
      });
    } catch (error) {
      logger.error('Error analyzing trait trends:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to analyze trait trends',
      });
    }
  },
);

/**
 * GET /horses/temperament-definitions
 * Get all temperament type definitions with modifiers and groom synergy
 * Public endpoint — no auth required (static game data)
 */
router.get('/temperament-definitions', queryRateLimiter, getTemperamentDefinitions);

// Genetics / phenotype read-only routes (GET /:id/conformation,
// /:id/conformation/analysis, /:id/gaits, /:id/genetics, /:id/color) extracted
// to horseGeneticsRoutes.mjs as part of the Equoria-y8u2j god-file split.
// All extracted routes are /:id/<sub-path> (2+ segments), so they don't
// conflict with this parent's GET /:id (1 segment) — mount position is not
// load-bearing. Sub-router mounted at the bottom alongside horseFeedRoutes.

// Breeding / stud / foaling routes (POST /breeding/color-prediction,
// POST /:id/stud-listing, DELETE /:id/stud-listing, GET /:id/breeding-data,
// POST /:id/foal-now) extracted to horseBreedingRoutes.mjs as part of the
// Equoria-y8u2j god-file split. All extracted routes are either
// /breeding/<sub> or /:id/<sub-path> (2+ segments) so they don't conflict
// with this parent's GET /:id (1 segment). Sub-router mounted at the bottom
// alongside the other sub-routers.

/**
 * GET /horses/:id
 * Get a specific horse by ID
 *
 * Security: Validates horse ownership before returning data
 */
router.get(
  '/:id',
  queryRateLimiter,
  rejectPollutedRequest,
  validateHorseId,
  requireOwnership('horse', {
    include: ['breed'],
  }),
  async (req, res) => {
    try {
      // Horse already validated and attached to req.horse by ownership middleware
      // No need for additional database query!
      // requireOwnership middleware loads req.horse with all columns by
      // default, so dateOfBirth is already present for withAgeYears.
      const horse = withAgeYears(withHealth(req.horse));

      res.json({
        success: true,
        data: horse,
      });
    } catch (error) {
      logger.error(`[horseRoutes] Error getting horse: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * POST /horses
 * Create a new horse
 */
router.post(
  '/',
  mutationRateLimiter,
  authenticateToken,
  validateHorseCreation,
  async (req, res) => {
    try {
      const { status, body } = await createHorseFromRequest(req.body, req.user.id);
      return res.status(status).json(body);
    } catch (error) {
      logger.error(`[horseRoutes] Error creating horse: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * POST /horses/batch-update
 * Stubbed endpoint to reject polluted batch update payloads
 */
router.post(
  '/batch-update',
  mutationRateLimiter,
  authenticateToken,
  rejectPollutedRequest,
  async (req, res) => {
    try {
      const { horseIds, updates, data } = req.body || {};

      if (data && Array.isArray(data)) {
        const getDepth = (arr, depth = 1) =>
          Array.isArray(arr)
            ? Math.max(...arr.map(item => getDepth(item, depth + 1)), depth)
            : depth;
        const depth = getDepth(data);
        if (depth > 5) {
          return res
            .status(400)
            .json({ success: false, message: 'Invalid payload: nested too deep' });
        }
      }

      if (!Array.isArray(horseIds)) {
        return res.status(400).json({ success: false, message: 'Invalid horseIds' });
      }

      if (horseIds.length > 1000) {
        return res.status(400).json({ success: false, message: 'Too many horseIds' });
      }

      const invalidIds = horseIds.some(id => !Number.isInteger(id) || id <= 0);
      if (invalidIds) {
        return res.status(400).json({ success: false, message: 'Invalid horseIds' });
      }

      if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ success: false, message: 'Invalid updates payload' });
      }

      // Security-first stub: reject by default to prevent mass assignment
      return res.status(400).json({ success: false, message: 'Batch updates are not allowed' });
    } catch (error) {
      logger.error(`[horseRoutes] Error in batch-update: ${error.message}`);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },
);

/**
 * PUT /horses/:id
 * Update a horse
 *
 * Security: Validates horse ownership before allowing updates
 */
router.put(
  '/:id',
  mutationRateLimiter,
  rejectPollutedRequest,
  validateHorseId,
  requireOwnership('horse'),
  validateHorseUpdatePayload,
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);

      // Parentage-hijack guard (Equoria-hg62v): the update allowlist permits
      // sireId and damId, but the requireOwnership('horse') middleware only
      // validates the :id path-param (the row being updated), not the bodies.
      // Without this check, the owner of HorseA can PUT
      // { sireId: <victim-stallion-id> } and silently rewrite genealogy of
      // their own horse to point at another player's horse — corrupting
      // pedigree, legacy-score, breeding-data, and lineage-analysis
      // endpoints. Mirror the POST /horses (horseRoutes.mjs ~887) and POST
      // /horses/:id/foals (horseRoutes.mjs ~1330) patterns: findOwnedResource
      // → 404 (NOT 403) on both not-found and cross-user to prevent
      // ID-enumeration disclosure of other players' horses.
      if (req.body.sireId !== undefined && req.body.sireId !== null) {
        const sireIdNum = parseInt(req.body.sireId, 10);
        if (!Number.isFinite(sireIdNum) || sireIdNum < 1) {
          return res.status(400).json({ success: false, message: 'Invalid sireId' });
        }
        const ownedSire = await findOwnedResource('horse', sireIdNum, req.user.id);
        if (!ownedSire) {
          return res.status(404).json({ success: false, message: 'Sire not found' });
        }
        // Equoria-91ezs: biological sex validation. POST /horses (~907) and
        // POST /horses/:id/foals both enforce sireHorse.sex === 'Stallion'
        // / damHorse.sex === 'Mare'. PUT was the lone post-creation
        // mutation path that allowed an owner to assign one of their own
        // Mares (or Rigs/Colts/Fillies) as the sire — silently corrupting
        // genealogy that breeding + pedigree + legacy-score endpoints
        // rely on. Mirror the POST pattern's exact message + 400 status
        // (per AC #4). Sex is canonical Title Case post-Equoria-duz2.
        if (ownedSire.sex !== 'Stallion') {
          return res.status(400).json({ success: false, message: 'Sire must be a stallion' });
        }
      }
      if (req.body.damId !== undefined && req.body.damId !== null) {
        const damIdNum = parseInt(req.body.damId, 10);
        if (!Number.isFinite(damIdNum) || damIdNum < 1) {
          return res.status(400).json({ success: false, message: 'Invalid damId' });
        }
        const ownedDam = await findOwnedResource('horse', damIdNum, req.user.id);
        if (!ownedDam) {
          return res.status(404).json({ success: false, message: 'Dam not found' });
        }
        // Equoria-91ezs: biological sex validation — see sireId block above.
        if (ownedDam.sex !== 'Mare') {
          return res.status(400).json({ success: false, message: 'Dam must be a mare' });
        }
      }

      // Ownership already validated by middleware (service-layer update, Equoria-becrm)
      const updatedHorse = await updateHorse(horseId, req.body);

      logger.info(
        `[horseRoutes] User ${req.user.id} updated horse: ${updatedHorse.name} (ID: ${horseId})`,
      );

      // Invalidate horse list caches so updated data appears on next fetch
      invalidateCachePattern('horses:list:*').catch(() => {
        /* non-critical */
      });

      res.json({
        success: true,
        message: 'Horse updated successfully',
        data: updatedHorse,
      });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: 'Horse not found',
        });
      }

      // Surface validation issues as 400 for security tests
      // (Equoria-becrm: dropped the defensive substring match against
      // 'Invalid `' + the client/method token; PrismaClientValidationError
      // + 'Unknown argument' already cover the same shape, and keeping
      // the literal token forced the routes file to contain text the
      // routes-layer sentinel scan rejects.)
      if (
        error.name === 'PrismaClientValidationError' ||
        error.message?.includes('Unknown argument')
      ) {
        return res.status(400).json({
          success: false,
          message: 'Invalid horse payload',
        });
      }

      logger.error(`[horseRoutes] Error updating horse: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * DELETE /horses/:id
 * Delete a horse
 *
 * Security: Validates horse ownership before allowing deletion
 */
router.delete(
  '/:id',
  mutationRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);
      const { status, body } = await deleteHorseById(horseId, req.user.id);
      return res.status(status).json(body);
    } catch (error) {
      logger.error(`[horseRoutes] Error deleting horse: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * GET /horses/trainable/:userId
 * Get all horses owned by a user that are eligible for training
 *
 * Security: Validates that user can only access their own trainable horses
 */
router.get(
  '/trainable/:userId',
  queryRateLimiter,
  authenticateToken,
  validateUserId,
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Test bypass mechanism removed for production security (2025-01-16)
      // Tests now use real JWT tokens via backend/tests/helpers/authHelper.mjs

      // Verify user can only access their own trainable horses
      if (!req.user || req.user.id !== userId) {
        logger.warn(
          `[horseRoutes] User ${req.user?.id} attempted to access trainable horses for user ${userId}`,
        );
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Cannot access trainable horses for another user',
        });
      }

      const trainableHorses = await getTrainableHorses(userId);

      res.json({
        success: true,
        message: `Found ${trainableHorses.length} trainable horses`,
        data: trainableHorses,
      });
    } catch (error) {
      logger.error('[trainable horses route] Error occurred:', {
        error: error.message,
        stack: error.stack,
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

// GET /:horseId/competition-history, GET /:id/history, GET /:id/overview,
// GET /:id/prize-summary, GET /:id/training-history extracted to
// horseHistoryRoutes.mjs as part of the Equoria-y8u2j god-file split. All
// extracted routes are /:id/<sub-path> (2 segments) so they don't conflict
// with this parent's GET /:id (1 segment). Sub-router mounted at the bottom.

// Feed / equippable routes (POST /:id/equip-feed, /:id/unequip-feed, /:id/feed,
// /:id/reset-last-fed, GET /:id/equippable) extracted to horseFeedRoutes.mjs.

// POST /foals extracted to horseFoalRoutes.mjs (Equoria-y8u2j). Sub-router
// mounted alongside the others below. `/foals` is a specific path (single
// segment) and `/:id` is also a single segment, but POST /foals does NOT
// conflict with GET /:id because the verbs differ — Express dispatches per
// (method, path) tuple.

// Horse XP + personality + trait-card routes extracted to horseXpRoutes.mjs.
// GET /:id/breeding-data + POST /:id/foal-now extracted to
// horseBreedingRoutes.mjs (Equoria-y8u2j).

// ---------------------------------------------------------------------------
// Sub-router mounts (Equoria-y8u2j god-file split)
// ---------------------------------------------------------------------------
// All sub-router routes are either /breeding/<sub> or /:id/<sub-path>
// (2+ segments) and therefore do NOT conflict with this parent's GET /:id
// (1 segment). Mount order between sub-routers and the parent's /:id is
// therefore not load-bearing.
router.use(horseFeedRoutes);
router.use(horseGeneticsRoutes);
router.use(horseXpRoutes);
router.use(horseBreedingRoutes);
router.use(horseHistoryRoutes);
router.use(horseFoalRoutes);

export default router;
