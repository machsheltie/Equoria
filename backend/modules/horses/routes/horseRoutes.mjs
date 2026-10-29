import express from 'express';
import { getTemperamentDefinitions } from '../controllers/horseController.mjs';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import { mutationRateLimiter, queryRateLimiter } from '../../../middleware/rateLimiting.mjs';
import horseFeedRoutes from './horseFeedRoutes.mjs';
import horseGeneticsRoutes from './horseGeneticsRoutes.mjs';
import horseXpRoutes from './horseXpRoutes.mjs';
import horseBreedingRoutes from './horseBreedingRoutes.mjs';
import horseHistoryRoutes from './horseHistoryRoutes.mjs';
import horseFoalRoutes from './horseFoalRoutes.mjs';
import horseIdentityRoutes from './horseIdentityRoutes.mjs';
import { rejectPollutedRequest, validateHorseId } from './_validators.mjs';
import {
  listHorses,
  getRecentResultsForHorses,
  getPendingStudRequestsForDams,
} from '../services/horseRouteQueries.mjs';
import { breedingStateFields } from '../services/breedingPairRules.mjs';
import logger from '../../../utils/logger.mjs';
import { hasStaffCheckin, satisfiesRole } from '../../staff/index.mjs';
import { withHealth } from '../../../utils/horseHealth.mjs';
import { withAgeYears } from '../../../utils/horseAge.mjs';
import { InvalidCursorError, clampLimit } from '../../../utils/paginationHelper.mjs';

const router = express.Router();

// Equoria-y8u2j: validators once inlined here live in _validators.mjs (imported
// above), so the parent router and the feed/genetics/xp/breeding/identity
// sub-routers share one source of truth.

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

    const { userId: queryUserId, breedId, limit, offset = 0, cursor } = req.query;

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
    //
    // Equoria-n256i (owner ruling q289): the override is an admin tool, so it
    // also needs the emailed staff check-in on this browser. Without it an
    // admin is self-scoped like everyone else.
    const isAdmin =
      Boolean(queryUserId) &&
      satisfiesRole(req.user.role, 'admin') && // the owner too (Equoria-4tleh)
      (await hasStaffCheckin(req, 'admin'));
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

    // Read fresh every time — no server-side list cache (Equoria-de3op, owner
    // ruling 2026-10-13): any writer's committed change is in the next read.
    // Keyset convention (Equoria-cmw85.19): ?cursor continues a list; ?offset still
    // works without one. This list has always defaulted to a whole stable, so its
    // default and cap are 200 rather than the convention's 20 / 100.
    const { items: horses, pageInfo } = await listHorses(where, {
      limit: clampLimit(limit, { def: 200, max: 200 }),
      skip: Math.max(parseInt(offset) || 0, 0),
      cursor: typeof cursor === 'string' && cursor ? cursor : null,
    });

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
    // no extra query, no N+1. `placement` is the Int rank (Equoria-f46tb), so a
    // 1st-place win is `placement === 1`.
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
        if (r.placement === 1) {
          firstPlaceWinsByHorse.set(r.horseId, (firstPlaceWinsByHorse.get(r.horseId) ?? 0) + 1);
        }
      }
    }

    // Equoria-q4uem.9 slice 6 (S-Q4): the pending stud request holding a mare
    // is shown to her OWNER only — an admin listing another player's horses
    // gets null for it.
    const ownedIds = horses.filter(h => h.userId === req.user.id).map(h => h.id);
    const pendingByDam = await getPendingStudRequestsForDams(ownedIds);

    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      message: `Found ${horses.length} horses`,
      pageInfo,
      data: horses.map(h => {
        const firstPlaceWins = firstPlaceWinsByHorse.get(h.id) ?? 0;
        return {
          ...withAgeYears(withHealth(h)),
          studFee: h.studFee ?? 0,
          ...breedingStateFields(h, pendingByDam.get(h.id) ?? null),
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
    if (error instanceof InvalidCursorError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    logger.error(`[horseRoutes] Error getting horses: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});

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

// Breeding / stud routes (POST /:id/stud-listing, DELETE /:id/stud-listing,
// GET /:id/offspring) extracted to horseBreedingRoutes.mjs as part of the
// Equoria-y8u2j god-file split (the colour prediction was removed, Equoria-m13fh).
// All extracted routes are /:id/<sub-path> (2 segments) so they don't conflict
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
      // Equoria-q4uem.9 slice 6: requireOwnership means the caller owns this
      // horse, so the pending stud request (S-Q4) is theirs to see.
      const pendingByDam = await getPendingStudRequestsForDams([req.horse.id]);

      res.json({
        success: true,
        data: {
          ...horse,
          ...breedingStateFields(req.horse, pendingByDam.get(req.horse.id) ?? null),
        },
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
 * POST /horses — CLOSED to players (2026-09-05 audit, Finding 2 / Equoria-6p398.2).
 *
 * This route ran `authenticateToken` + `validateHorseCreation` and handed the
 * body straight to `createHorseFromRequest`: any zero-coin `role=user` account
 * could name a breed/sex/age and receive a persisted horse (201) with no payment,
 * entitlement, onboarding guard or cap — free breeding and sale stock, bypassing
 * the 1,000-coin Horse Trader entirely.
 *
 * No legitimate player caller exists (`horsesApi.create` was an unused client
 * helper). The REAL acquisition paths are untouched — the registration starter
 * horse (auth/services/onboardingService.mjs), the paid Horse Trader purchase
 * (marketplace `buyStoreHorse`: debit + INSERT in one transaction) and
 * breeding/foaling (services/foalingService.mjs) each call the `createHorse`
 * model function directly; only this HTTP entry point closes.
 * The rejection sits BEHIND `authenticateToken` (an anonymous POST is still 401,
 * per backend/__tests__/auth-bypass-attempts.test.mjs) and is payload-independent
 * — no validation or body inspection runs first — so a `userId`, a role claim, a
 * starter-shaped name or half-finished onboarding cannot steer it. Locked by
 * modules/horses/__tests__/horseCreationEndpointClosed.integration.test.mjs.
 */
router.post('/', mutationRateLimiter, authenticateToken, (req, res) => {
  logger.warn(
    `[horseRoutes] Rejected direct horse creation attempt by user ${req.user?.id} (Finding 2: player horse creation is closed)`,
  );
  return res.status(403).json({
    success: false,
    message:
      'Horses cannot be created directly. Visit the Horse Trader or breed a foal to add a horse to your stable.',
  });
});

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
 * PUT /horses/:id — GONE (410, Equoria-h4zni). Its field allow-list shrank to
 * nothing: `breedId` (Equoria-tmyd2), `name` (Equoria-4fnro, renaming lives on
 * PATCH /horses/:id/name), `sex`/`gender`/`dateOfBirth` (Equoria-bvddn.2) and
 * finally `sireId`/`damId` (OWNER RULING 2026-09-30: pedigree is fixed by
 * breeding). A route that may change nothing is closed rather than left as an
 * empty mass-assignment surface; nothing in frontend/src or the backend called
 * it. 410 (not 403) because the operation itself no longer exists — the same
 * idiom as `POST /:id/award-xp` (horseXpRoutes.mjs). Auth ordering mirrors the
 * closed `DELETE /:id` below: BEHIND `authenticateToken` (anonymous is 401) and
 * BEFORE any id validation or ownership lookup, so an owned horse, a stranger's,
 * a missing id and a malformed id share ONE body (no existence/ownership
 * oracle), and the handler writes nothing for any caller or payload.
 * Locked by __tests__/horsePedigreeLocked.integration.test.mjs.
 */
router.put('/:id', mutationRateLimiter, authenticateToken, (req, res) => {
  logger.info(
    `[horseRoutes] 410 Gone — PUT /horses/:id is closed; user ${req.user?.id} (Equoria-h4zni)`,
  );
  return res.status(410).json({
    success: false,
    message:
      "A horse's details can no longer be edited here. Pedigree, breed, sex and birth date are set when a horse is born and never change. To rename a horse, use PATCH /api/v1/horses/:id/name.",
  });
});

/**
 * DELETE /horses/:id — CLOSED to players (owner ruling 2026-09-08, Equoria-9tque:
 * "players are not allowed to delete horses"). It ran `validateHorseId` +
 * `requireOwnership('horse')` then a bare `prisma.horse.delete`; ownership
 * answers "is this my horse", never "may it be destroyed" — the confusion the
 * 2026-09-05 audit closed for free creation (Finding 2, `POST /horses` above)
 * and self-awarded XP (Finding 3) — and cascading children took the horse's
 * staff assignments, XP events and history too. No live caller existed. 403
 * follows Finding 2, not Finding 3's 410: `/horses/:id` is not gone, `GET`
 * still serves the owner; only permission to destroy is withdrawn. It sits
 * BEHIND `authenticateToken` (anonymous is 401) and BEFORE the validator, so an
 * owned horse, a stranger's, a missing id and a malformed id share ONE body (no
 * oracle). Horse rows leave the DB only via the fixture-purge script (account
 * erasure, the other path, was removed in Equoria-81uop); `deleteHorseService` did neither and had no caller, so it was deleted.
 * Locked by __tests__/horseDeletionEndpointClosed.integration.test.mjs, whose
 * matcher needs the words "cannot be deleted" — reword the message with it.
 */
router.delete('/:id', mutationRateLimiter, authenticateToken, (req, res) => {
  logger.warn(`[horseRoutes] Rejected horse deletion by user ${req.user?.id} (Equoria-9tque)`);
  return res.status(403).json({
    success: false,
    message:
      'Horses cannot be deleted. A horse stays in your stable unless you sell it — list it in the marketplace to pass it on to another player.',
  });
});

// GET /:horseId/competition-history, GET /:id/history, GET /:id/overview,
// GET /:id/prize-summary, GET /:id/training-history extracted to
// horseHistoryRoutes.mjs as part of the Equoria-y8u2j god-file split. All
// extracted routes are /:id/<sub-path> (2 segments) so they don't conflict
// with this parent's GET /:id (1 segment). Sub-router mounted at the bottom.

// Feed / equippable routes (POST /:id/equip-feed, /:id/unequip-feed, /:id/feed,
// GET /:id/equippable) extracted to horseFeedRoutes.mjs.

// POST /foals extracted to horseFoalRoutes.mjs (Equoria-y8u2j). Sub-router
// mounted alongside the others below. `/foals` is a specific path (single
// segment) and `/:id` is also a single segment, but POST /foals does NOT
// conflict with GET /:id because the verbs differ — Express dispatches per
// (method, path) tuple.

// Horse XP + personality + trait-card routes extracted to horseXpRoutes.mjs.
// GET /:id/breeding-data extracted to horseBreedingRoutes.mjs (Equoria-y8u2j).

// ---------------------------------------------------------------------------
// Sub-router mounts (Equoria-y8u2j god-file split)
// ---------------------------------------------------------------------------
// All sub-router routes are either /breeding/<sub> or /:id/<sub-path>
// (2+ segments) and therefore do NOT conflict with this parent's GET /:id
// (1 segment) — including horseIdentityRoutes' PATCH /:id/name (Equoria-qkgfh.1).
// Mount order between sub-routers and the parent's /:id is not load-bearing.
router.use(horseFeedRoutes);
router.use(horseGeneticsRoutes);
router.use(horseXpRoutes);
router.use(horseBreedingRoutes);
router.use(horseHistoryRoutes);
router.use(horseFoalRoutes);
router.use(horseIdentityRoutes);

export default router;
