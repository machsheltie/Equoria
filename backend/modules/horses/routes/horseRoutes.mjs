import express from 'express';
import { param, body, query, validationResult } from 'express-validator';
import { getTrainableHorses } from '../../../controllers/trainingController.mjs';
import {
  getHorseOverview,
  getTemperamentDefinitions,
  getHorseCompetitionHistory,
} from '../controllers/horseController.mjs';
import { trainingAnalyticsService } from '../../../services/trainingAnalyticsService.mjs';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership, findOwnedResource } from '../../../middleware/ownership.mjs';
import {
  foalRateLimiter,
  mutationRateLimiter,
  queryRateLimiter,
} from '../../../middleware/rateLimiting.mjs';
import horseFeedRoutes from './horseFeedRoutes.mjs';
import horseGeneticsRoutes from './horseGeneticsRoutes.mjs';
import horseXpRoutes from './horseXpRoutes.mjs';
import horseBreedingRoutes from './horseBreedingRoutes.mjs';
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
import prisma from '../../../../packages/database/prismaClient.mjs';
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
      () =>
        prisma.horse.findMany({
          where,
          take: parseInt(limit),
          skip: parseInt(offset),
          // Field selection: excludes large JSONB (colorGenotype, epigeneticFlags, etc.)
          // — but INCLUDES phenotype (~500 bytes/row) because HorseCard.tsx
          // reads phenotype.colorName to render the coat-color chip on every
          // horse-list view (Equoria-tkyx).
          select: {
            id: true,
            name: true,
            age: true,
            // dateOfBirth required by withAgeYears() to compute ageYears
            // for HorseCard.tsx / StableView.tsx / MyStablePage.tsx /
            // BreedingPairSelection.tsx (Equoria-lvjy).
            dateOfBirth: true,
            sex: true,
            healthStatus: true,
            lastFedDate: true,
            lastVettedDate: true,
            forSale: true,
            salePrice: true,
            breedId: true,
            userId: true,
            createdAt: true,
            // Core competition stats
            speed: true,
            stamina: true,
            agility: true,
            balance: true,
            precision: true,
            intelligence: true,
            boldness: true,
            flexibility: true,
            obedience: true,
            focus: true,
            strength: true,
            endurance: true,
            totalEarnings: true,
            trait: true,
            temperament: true,
            // Conformation titles (Epic 31F, Equoria-u7e6) — small scalars
            // read by HorseCard to render the title chip + breeding-value tooltip.
            titlePoints: true,
            currentTitle: true,
            breedingValueBoost: true,
            // Coat-color phenotype — small JSONB needed by HorseCard chip.
            phenotype: true,
            breed: { select: { id: true, name: true } },
            user: { select: { id: true, username: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
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
      const recentResults = await prisma.competitionResult.findMany({
        where: { horseId: { in: horseIds } },
        orderBy: { runDate: 'desc' },
        select: {
          horseId: true,
          showName: true,
          discipline: true,
          placement: true,
          runDate: true,
        },
      });
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

      // Ownership already validated by middleware
      const updatedHorse = await prisma.horse.update({
        where: { id: horseId },
        data: req.body,
        include: {
          breed: true,
          user: {
            select: { id: true, username: true },
          },
        },
      });

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
      if (
        error.name === 'PrismaClientValidationError' ||
        error.message?.includes('Invalid `prisma.horse.update()`') ||
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

/**
 * GET /api/horses/:horseId/competition-history
 *
 * Per-horse competition history + statistics for the /my-stable Hall of
 * Fame career display (Story 21S-4). Response shape matches the
 * `CompetitionHistoryData` TypeScript interface used by
 * `useHorseCompetitionHistory` on the frontend.
 *
 * Security: horse ownership required.
 */
router.get(
  '/:horseId/competition-history',
  queryRateLimiter,
  authenticateToken,
  [
    param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ success: false, message: 'Validation failed', errors: errors.array() });
      }
      return next();
    },
  ],
  requireOwnership('horse', { idParam: 'horseId' }),
  getHorseCompetitionHistory,
);

/**
 * GET /horses/:id/history
 * Get competition history for a specific horse
 *
 * Security: Validates horse ownership before returning history
 */
router.get(
  '/:id/history',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      // Dynamic import for ES module
      const { getHorseHistory } = await import('../controllers/horseController.mjs');
      await getHorseHistory(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * Validation middleware for foal creation
 */
const validateFoalCreation = [
  body('name')
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('breedId').isInt({ min: 1 }).withMessage('Breed ID must be a positive integer'),
  body('sireId').isInt({ min: 1 }).withMessage('Sire ID must be a positive integer'),
  body('damId').isInt({ min: 1 }).withMessage('Dam ID must be a positive integer'),
  body('sex')
    .optional()
    .custom(async value => {
      const { isValidHorseSex } = await import('../../../constants/schema.mjs');
      if (value && !isValidHorseSex(value)) {
        const { HORSE_SEX_VALUES } = await import('../../../constants/schema.mjs');
        throw new Error(`Sex must be one of: ${HORSE_SEX_VALUES.join(', ')}`);
      }
      return true;
    }),
  body('userId')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('User ID must be between 1 and 50 characters'),
  body('stableId').optional().isInt({ min: 1 }).withMessage('Stable ID must be a positive integer'),
  body('healthStatus')
    .optional()
    .isIn(['Excellent', 'Good', 'Fair', 'Poor', 'Critical'])
    .withMessage('Health status must be one of: Excellent, Good, Fair, Poor, Critical'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

/**
 * POST /horses/foals
 * Create a new foal with epigenetic traits applied at birth
 *
 * Security: dual ownership validation on sireId + damId via findOwnedResource
 * (CWE-284 Equoria-b4q6 + CWE-639 disclosure resistance — same 404 'Sire not
 * found' / 'Dam not found' for both not-found and not-owned cases). Mirrors
 * the dual-ownership pattern at groomRoutes.mjs `POST /assign`.
 */
router.post(
  '/foals',
  foalRateLimiter,
  authenticateToken,
  validateFoalCreation,
  // Dual ownership validation middleware (CWE-284 + CWE-639)
  async (req, res, next) => {
    try {
      const { sireId, damId } = req.body;
      const userId = req.user.id;

      // Validate sire ownership — 404 byte-identical for both not-found and
      // cross-user (CWE-639 disclosure resistance).
      const sire = await findOwnedResource('horse', sireId, userId);
      if (!sire) {
        return res.status(404).json({
          success: false,
          message: 'Sire not found',
        });
      }

      // Validate dam ownership.
      const dam = await findOwnedResource('horse', damId, userId);
      if (!dam) {
        return res.status(404).json({
          success: false,
          message: 'Dam not found',
        });
      }

      // Attach validated resources for the controller (createFoal still
      // re-fetches via getHorseById for breed checks etc., but having them
      // here lets future refactors skip the re-fetch).
      req.sire = sire;
      req.dam = dam;
      next();
      return null;
    } catch (error) {
      logger.error('[horseRoutes POST /foals] ownership validation error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },
  async (req, res) => {
    try {
      // Set the owner from the authenticated user
      req.body.userId = req.user.id;

      // Dynamic import for ES module
      const { createFoal } = await import('../controllers/horseController.mjs');
      await createFoal(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error during foal creation',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

// Feed / equippable routes (POST /:id/equip-feed, /:id/unequip-feed, /:id/feed,
// /:id/reset-last-fed, GET /:id/equippable) extracted to horseFeedRoutes.mjs
// as part of the Equoria-y8u2j god-file split. All extracted routes are
// /:id/<sub-path> (2 segments), so they don't conflict with this parent's
// GET /:id (1 segment) — mount position is therefore not load-bearing for
// Express ordering. Sub-router is mounted at the bottom of the file alongside
// the other ordering-insensitive use() statements.

/**
 * GET /horses/:id/overview
 * Get comprehensive overview data for a specific horse
 *
 * Security: Validates horse ownership before returning overview
 */
router.get(
  '/:id/overview',
  queryRateLimiter,
  validateHorseId,
  authenticateToken,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      await getHorseOverview(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

// Horse XP System Routes (require authentication)

// Horse XP + personality + trait-card routes (GET /:id/xp, POST
// /:id/allocate-stat, GET /:id/xp-history, POST /:id/award-xp,
// GET /:id/personality-impact, GET /:id/legacy-score, GET /:id/trait-card)
// extracted to horseXpRoutes.mjs as part of the Equoria-y8u2j god-file split.
// All extracted routes are /:id/<sub-path> (2 segments), so they don't conflict
// with this parent's GET /:id (1 segment). Sub-router mounted at the bottom
// alongside horseFeedRoutes / horseGeneticsRoutes.

// GET /:id/breeding-data extracted to horseBreedingRoutes.mjs (Equoria-y8u2j).

/**
 * GET /api/horses/:id/prize-summary
 * Return aggregated prize statistics for a horse.
 * Includes totalPrizeMoney, firstPlaces, secondPlaces, thirdPlaces, bestPlacement.
 *
 * Security: Validates horse ownership before returning data.
 */
router.get(
  '/:id/prize-summary',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id, 10);

      const results = await prisma.competitionResult.findMany({
        where: { horseId },
        select: {
          placement: true,
          prizeWon: true,
        },
      });

      let totalPrizeMoney = 0;
      let firstPlaces = 0;
      let secondPlaces = 0;
      let thirdPlaces = 0;
      let bestPlacement = null;

      for (const result of results) {
        totalPrizeMoney += Number(result.prizeWon) || 0;

        const placement = parseInt(result.placement);
        if (!isNaN(placement)) {
          if (placement === 1) {
            firstPlaces++;
          }
          if (placement === 2) {
            secondPlaces++;
          }
          if (placement === 3) {
            thirdPlaces++;
          }
          if (bestPlacement === null || placement < bestPlacement) {
            bestPlacement = placement;
          }
        }
      }

      logger.info(
        `[horseRoutes.GET /:id/prize-summary] Retrieved prize summary for horse ${horseId}`,
      );

      return res.json({
        success: true,
        data: {
          horseId,
          totalPrizeMoney,
          firstPlaces,
          secondPlaces,
          thirdPlaces,
          bestPlacement,
          totalCompetitions: results.length,
        },
      });
    } catch (error) {
      logger.error(`[horseRoutes.GET /:id/prize-summary] Error: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * GET /horses/:id/training-history
 *
 * Returns training history and discipline analytics for a specific horse.
 * Delegates to trainingAnalyticsService.getTrainingHistory() which queries
 * TrainingLog records for the horse.
 *
 * Wired in Equoria-kbr0: the service existed but had no HTTP route.
 *
 * Security: Validates horse ownership before returning training data.
 */
router.get(
  '/:id/training-history',
  queryRateLimiter,
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ success: false, message: 'Validation failed', errors: errors.array() });
      }
      return next();
    },
  ],
  requireOwnership('horse'),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id, 10);
      const data = await trainingAnalyticsService.getTrainingHistory(horseId);
      return res.json({
        success: true,
        message: 'Training history retrieved successfully',
        data,
      });
    } catch (error) {
      if (error.message && error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      logger.error(`[horseRoutes GET /:id/training-history] Error: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve training history',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

// POST /:id/foal-now extracted to horseBreedingRoutes.mjs (Equoria-y8u2j).

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

export default router;
