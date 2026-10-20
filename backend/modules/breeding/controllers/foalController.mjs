/**
 * FoalController
 *
 * Extracted from inline route handlers in foalRoutes.mjs.
 * Validation middleware (express-validator) and ownership checks remain in foalRoutes.mjs.
 *
 * Routes:
 *   GET  /api/foals/:foalId               — get foal record (basic)
 *   GET  /api/foals/:foalId/development   — get foal development data
 *   GET  /api/foals/:foalId/activities    — get foal activity log
 *
 * The former POST /reveal-traits handler was removed (Equoria-gu8jk; owner
 * ruling 2026-10-20: players must never write traits for themselves — traits
 * will be activated by grooms, not a player button).
 *
 * The former PUT /develop (client-set day/bond/stress) and POST /advance-day
 * handlers were removed (Equoria-mwjst): foals wait out the full development
 * week, and only the nightly trait job advances the day. The player-run
 * POST /activity, /enrichment, /enrich and /graduate handlers were removed
 * too (Equoria-fr2kg; owner ruling 2026-10-14/15: foal enrichment is the
 * groom's job, and there is no graduation).
 */

import { validationResult } from 'express-validator';
// Equoria-pq3oi: foalModel moved into the horses module; this cross-module
// (breeding → horses) import now routes through the horses public-API barrel.
import { getFoalDevelopment } from '../../horses/index.mjs';
import { ensureDefaultGroomAssignment } from '../../../utils/groomSystem.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { publicTraitModifiers } from '../../../utils/publicTraitView.mjs';
import { computeAgeStage } from '../../../utils/foalAgeUtils.mjs';
import logger from '../../../utils/logger.mjs';
import AppError from '../../../errors/AppError.mjs';

/**
 * GET /api/foals/:foalId/development
 * Get foal development data including current status and activity history
 */
export async function getFoalDevelopmentHandler(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { foalId } = req.params;
    logger.info(`[foalController] GET /api/foals/${foalId}/development`);

    const developmentData = await getFoalDevelopment(foalId);

    // Ensure foal has a groom assignment (requires authenticated user)
    if (req.user?.id) {
      try {
        await ensureDefaultGroomAssignment(parseInt(foalId, 10), req.user.id);
      } catch (groomError) {
        logger.warn(
          `[foalController] Failed to ensure groom assignment for foal ${foalId}: ${groomError.message}`,
        );
      }
    }

    res.json({ success: true, data: developmentData });
  } catch (error) {
    logger.error(`[foalController] GET /api/foals/:foalId/development error: ${error.message}`);
    // Equoria-4xwyi: TYPE-based 404 detection. getFoalDevelopment throws a typed
    // AppError(404) for the missing-foal case. The `'not a foal'` (wrong-state)
    // case stays a plain Error and is still mapped to 404 by the retained string
    // branch — converting that status is out of scope. Fail-closed: any other
    // error (e.g. a future ERR_MODULE_NOT_FOUND import failure) is NOT string-
    // matched into a misleading 404; it surfaces loudly as 500.
    if (
      (AppError.isAppError(error) && error.statusCode === 404) ||
      error.message.includes('not a foal')
    ) {
      return res.status(404).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * GET /api/foals/:foalId
 * Get foal basic record. Ownership middleware already attached the horse to req.foal.
 * Returns 404 if the horse has graduated (age ≥ 3 game-years / ≥ 21 real days; Equoria-oey96.16).
 *
 * Equoria-149w
 */
export async function getFoalHandler(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { foalId } = req.params;
    logger.info(`[foalController] GET /api/foals/${foalId}`);

    // requireOwnership attached the horse to req.foal
    const foal = req.foal;
    if (!foal) {
      return res.status(404).json({ success: false, message: 'Foal not found' });
    }

    // Reject horses no longer foals (graduated at age 3 game-years / 21 real days;
    // Equoria-oey96.16). Same age-stage logic used elsewhere in the foal system.
    const { computeAgeStage, computeAgeInWeeks } = await import('../../../utils/foalAgeUtils.mjs');
    const ageStage = computeAgeStage(foal.dateOfBirth);
    if (ageStage === null) {
      return res
        .status(404)
        .json({ success: false, message: 'Horse is not a foal (already graduated)' });
    }

    const ageInWeeks = computeAgeInWeeks(foal.dateOfBirth);

    res.json({
      success: true,
      data: {
        id: foal.id,
        name: foal.name,
        sex: foal.sex,
        dateOfBirth: foal.dateOfBirth,
        ageInDays: ageInWeeks * 7,
        sireId: foal.sireId,
        damId: foal.damId,
        userId: foal.userId,
        breedId: foal.breedId,
        ageStage,
        bondScore: foal.bondScore,
        stressLevel: foal.stressLevel,
        epigeneticFlags: foal.epigeneticFlags || [],
        // Unrevealed hidden traits are never named, to anyone (Equoria-6dace).
        epigeneticModifiers: publicTraitModifiers(foal.epigeneticModifiers),
      },
    });
  } catch (error) {
    logger.error(`[foalController] GET /api/foals/:foalId error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * GET /api/foals/:foalId/activities
 * Return the foal's activity log (most-recent-first).
 *
 * Equoria-sqvy
 */
export async function getFoalActivitiesHandler(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { foalId } = req.params;
    const parsedFoalId = parseInt(foalId, 10);
    logger.info(`[foalController] GET /api/foals/${foalId}/activities`);

    const activities = await prisma.foalActivity.findMany({
      where: { foalId: parsedFoalId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // requireOwnership attached the foal record to req.foal. The player-run
    // stage-activity list that used to ride along here was removed
    // (Equoria-fr2kg); the age stage stays.
    const currentStage = computeAgeStage(req.foal?.dateOfBirth);

    res.json({
      success: true,
      ageStage: currentStage,
      data: activities.map(a => ({
        id: a.id,
        day: a.day,
        activityType: a.activityType,
        activity: a.activityType, // alias for frontend FoalActivity.activity
        outcome: a.outcome,
        bondingChange: a.bondingChange,
        stressChange: a.stressChange,
        description: a.description,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    logger.error(`[foalController] GET /api/foals/:foalId/activities error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
