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
 *   POST /api/foals/:foalId/activity      — complete a foal enrichment activity
 *   POST /api/foals/:foalId/advance-day   — advance foal to next day (admin/cron)
 *   POST /api/foals/:foalId/enrichment    — complete enrichment activity (Task 5 API)
 *   POST /api/foals/:foalId/enrich        — alias for /enrichment (frontend contract)
 *   POST /api/foals/:foalId/reveal-traits — trigger trait discovery for the foal
 *   PUT  /api/foals/:foalId/develop       — update developable fields (currentDay/bonding/stress)
 *   POST /api/foals/:foalId/graduate      — graduate a foal at age 3
 */

import { validationResult } from 'express-validator';
import {
  getFoalDevelopment,
  completeActivity,
  advanceDay,
  completeEnrichmentActivity,
  graduateFoal,
} from '../../../models/foalModel.mjs';
import { ensureDefaultGroomAssignment } from '../../../utils/groomSystem.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { revealTraits } from '../../../utils/traitDiscovery.mjs';
import {
  validateActivityForFoalAge,
  getActivitiesForStage,
  computeAgeStage,
} from '../../../utils/foalAgeUtils.mjs';
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
 * POST /api/foals/:foalId/activity
 * Complete a foal enrichment activity
 */
export async function completeFoalActivity(req, res) {
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
    const { activityType } = req.body;
    logger.info(`[foalController] POST /api/foals/${foalId}/activity - ${activityType}`);

    // Equoria-4kzik: enforce age-stage gating server-side. The frontend
    // DevelopmentTracker only shows stage-appropriate activities, but a
    // client could POST an out-of-stage activity directly. requireOwnership
    // attached the full foal record (incl. dateOfBirth) to req.foal.
    // Only KNOWN age-stage activities are gated here; an unrecognised
    // activityType is deferred to completeActivity() (it may be a valid
    // day-based enrichment activity handled by the separate Task-5 system).
    const foal = req.foal;
    const ageCheck = validateActivityForFoalAge(activityType, foal?.dateOfBirth);
    if (!ageCheck.allowed && ageCheck.reason !== 'unknown_activity') {
      const currentStage = computeAgeStage(foal?.dateOfBirth);
      const allowedNow = getActivitiesForStage(currentStage).map(a => a.id);
      let message;
      if (ageCheck.reason === 'graduated') {
        message =
          `Activity "${activityType}" cannot be performed: this horse has ` +
          'graduated from the foal development window (age 3+).';
      } else {
        message =
          `Activity "${activityType}" is a ${ageCheck.requiredStage} activity ` +
          `and cannot be performed on a ${ageCheck.currentStage} foal. ` +
          `Age-appropriate activities right now: ${allowedNow.join(', ') || 'none'}.`;
      }
      logger.warn(
        `[foalController] Rejected out-of-stage activity "${activityType}" for ` +
          `foal ${foalId} (required=${ageCheck.requiredStage}, ` +
          `current=${ageCheck.currentStage ?? 'graduated'})`,
      );
      return res.status(400).json({
        success: false,
        message,
        reason: ageCheck.reason,
        requiredStage: ageCheck.requiredStage,
        currentStage: ageCheck.currentStage ?? null,
        allowedActivities: allowedNow,
      });
    }

    const updatedData = await completeActivity(foalId, activityType);

    res.json({
      success: true,
      message: `Activity "${activityType}" completed successfully`,
      data: updatedData,
    });
  } catch (error) {
    logger.error(`[foalController] POST /api/foals/:foalId/activity error: ${error.message}`);
    // Equoria-4xwyi: TYPE-based 404 detection. completeActivity throws a typed
    // AppError(404) for the missing development-record case. The `'not available'`
    // (wrong-state) case stays a plain Error and is preserved verbatim, including
    // its pre-existing quirk that the 404 branch wins over the 400 branch below
    // (registration order unchanged). Fail-closed: any other error surfaces as 500
    // rather than being string-matched into a misleading 404.
    if (
      (AppError.isAppError(error) && error.statusCode === 404) ||
      error.message.includes('not available')
    ) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes('already completed') || error.message.includes('not available')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * POST /api/foals/:foalId/advance-day
 * Advance foal to next day (admin/cron endpoint)
 */
export async function advanceFoalDay(req, res) {
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
    logger.info(`[foalController] POST /api/foals/${foalId}/advance-day`);

    const updatedData = await advanceDay(foalId);

    res.json({
      success: true,
      message: `Foal advanced to day ${updatedData.development.currentDay}`,
      data: updatedData,
    });
  } catch (error) {
    logger.error(`[foalController] POST /api/foals/:foalId/advance-day error: ${error.message}`);
    // Equoria-4xwyi: TYPE-based 404 detection. advanceDay throws a typed
    // AppError(404) for the missing development-record case. Fail-closed: any
    // other error surfaces as 500 rather than being string-matched into a
    // misleading 404. The `'already completed'` 400 branch is unchanged.
    if (AppError.isAppError(error) && error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes('already completed')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * POST /api/foals/:foalId/enrichment
 * Complete a foal enrichment activity (Task 5 API)
 */
export async function completeFoalEnrichment(req, res) {
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
    const { activity } = req.body;
    // The enrichment day is derived server-side from the foal's age
    // (Equoria-g89vy) — any client-supplied `day` is intentionally ignored.
    logger.info(`[foalController] POST /api/foals/${foalId}/enrichment - Activity: ${activity}`);

    const result = await completeEnrichmentActivity(foalId, activity);

    res.json({
      success: true,
      message: `Enrichment activity "${result.activity.name}" completed successfully`,
      data: {
        foal: result.foal,
        activity: result.activity,
        updatedLevels: {
          bondScore: result.levels.bondScore,
          stressLevel: result.levels.stressLevel,
        },
        changes: {
          bondChange: result.levels.bondChange,
          stressChange: result.levels.stressChange,
        },
        trainingRecordId: result.trainingRecordId,
      },
    });
  } catch (error) {
    logger.error(`[foalController] POST /api/foals/:foalId/enrichment error: ${error.message}`);
    // Equoria-4xwyi: TYPE-based 404 detection. completeEnrichmentActivity throws a
    // typed AppError(404) for the missing-foal case. The `'not a foal'`
    // (wrong-state) string branch is retained (completeEnrichmentActivity does not
    // currently throw it, but the controller keeps the contract defensively).
    // Fail-closed: any other error surfaces as 500 rather than being string-
    // matched into a misleading 404.
    if (
      (AppError.isAppError(error) && error.statusCode === 404) ||
      error.message.includes('not a foal')
    ) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (
      error.message.includes('not appropriate') ||
      error.message.includes('must be between') ||
      error.message.includes('window closed') ||
      error.message.includes('already completed')
    ) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * POST /api/foals/:foalId/graduate
 * Graduate a foal — closes development window and clears groom assignments.
 * Called when a foal reaches age 3 (104 weeks).
 */
export async function graduateFoalHandler(req, res) {
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
    const userId = req.user?.id;
    logger.info(`[foalController] POST /api/foals/${foalId}/graduate`);

    const result = await graduateFoal(foalId, userId);

    res.json({
      success: true,
      message: `${result.horse.name} has graduated! Now eligible for training and competition.`,
      data: result,
    });
  } catch (error) {
    logger.error(`[foalController] POST /api/foals/:foalId/graduate error: ${error.message}`);
    // Equoria-4xwyi: TYPE-based 404 detection. graduateFoal throws a typed
    // AppError(404) for the missing-horse case. Fail-closed: any other error
    // surfaces as 500 rather than being string-matched into a misleading 404. The
    // graduation-age / already-graduated 400 branch is unchanged.
    if (AppError.isAppError(error) && error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (
      error.message.includes('not reached graduation age') ||
      error.message.includes('already graduated')
    ) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * GET /api/foals/:foalId
 * Get foal basic record. Ownership middleware already attached the horse to req.foal.
 * Returns 404 if the horse has graduated (age ≥ 3 / DOB ≥ 104 weeks).
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

    // Reject horses that are no longer foals (graduated at age 3 / 104 weeks).
    // Use the same age-stage logic used elsewhere in the foal system.
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
        epigeneticModifiers: foal.epigeneticModifiers || { positive: [], negative: [], hidden: [] },
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

    // Equoria-4kzik: surface the server-enforced age-stage rule so the
    // client filter becomes a presentation layer over a real backend
    // constraint (not the source of truth). requireOwnership attached the
    // foal record to req.foal.
    const currentStage = computeAgeStage(req.foal?.dateOfBirth);
    const availableActivities = getActivitiesForStage(currentStage);

    res.json({
      success: true,
      ageStage: currentStage,
      availableActivities,
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

/**
 * POST /api/foals/:foalId/reveal-traits
 * Trigger trait discovery for a foal. Returns currently-discovered (positive + negative)
 * traits plus any newly-revealed traits found in the same run.
 *
 * Equoria-xgf0
 */
export async function revealFoalTraitsHandler(req, res) {
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
    logger.info(`[foalController] POST /api/foals/${parsedFoalId}/reveal-traits`);

    // Try to run discovery — if no hidden traits, this returns { revealed: [] }
    let discovery;
    try {
      discovery = await revealTraits(parsedFoalId, { checkAllConditions: true });
    } catch (discoveryError) {
      // Discovery may fail if the horse isn't found at the DB layer; surface as 404.
      if (
        discoveryError?.message?.includes('not found') ||
        discoveryError?.message?.includes('does not exist')
      ) {
        return res.status(404).json({ success: false, message: 'Foal not found' });
      }
      logger.warn(
        `[foalController] revealTraits failed for foal ${parsedFoalId}: ${discoveryError.message}`,
      );
      discovery = { revealed: [] };
    }

    // Always return the current full set of visible traits as ground-truth.
    const foal = await prisma.horse.findUnique({
      where: { id: parsedFoalId },
      select: { epigeneticModifiers: true },
    });

    const modifiers = foal?.epigeneticModifiers ?? {
      positive: [],
      negative: [],
      hidden: [],
    };
    const visibleTraits = [...(modifiers.positive || []), ...(modifiers.negative || [])];

    res.json({
      success: true,
      data: {
        traits: visibleTraits,
        revealed: discovery?.revealed || [],
        hidden: modifiers.hidden || [],
      },
    });
  } catch (error) {
    logger.error(`[foalController] POST /api/foals/:foalId/reveal-traits error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * PUT /api/foals/:foalId/develop
 * Update developable fields on a foal's FoalDevelopment record.
 *
 * Allowed updates: { currentDay, bondingLevel, stressLevel }
 * Anything else in the payload is ignored.
 *
 * Equoria-rkmh
 */
export async function developFoalHandler(req, res) {
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
    const updates = req.body || {};
    logger.info(`[foalController] PUT /api/foals/${parsedFoalId}/develop`);

    // Whitelist of mutable fields on FoalDevelopment that the client may update.
    const ALLOWED_FIELDS = ['currentDay', 'bondingLevel', 'stressLevel'];
    const updateData = {};

    for (const field of ALLOWED_FIELDS) {
      if (updates[field] === undefined || updates[field] === null) {
        continue;
      }
      const value = Number(updates[field]);
      if (!Number.isFinite(value) || !Number.isInteger(value)) {
        return res.status(400).json({ success: false, message: `${field} must be an integer` });
      }
      // Range validation
      if (field === 'currentDay' && (value < 0 || value > 6)) {
        return res
          .status(400)
          .json({ success: false, message: 'currentDay must be between 0 and 6' });
      }
      if ((field === 'bondingLevel' || field === 'stressLevel') && (value < 0 || value > 100)) {
        return res
          .status(400)
          .json({ success: false, message: `${field} must be between 0 and 100` });
      }
      updateData[field] = value;
    }

    if (Object.keys(updateData).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: 'No valid fields supplied for update' });
    }

    // Ensure a FoalDevelopment record exists; upsert to be safe.
    const development = await prisma.foalDevelopment.upsert({
      where: { foalId: parsedFoalId },
      update: updateData,
      create: {
        foalId: parsedFoalId,
        currentDay: updateData.currentDay ?? 0,
        bondingLevel: updateData.bondingLevel ?? 50,
        stressLevel: updateData.stressLevel ?? 20,
        completedActivities: {},
      },
    });

    res.json({
      success: true,
      data: {
        currentDay: development.currentDay,
        bondingLevel: development.bondingLevel,
        stressLevel: development.stressLevel,
        completedActivities: development.completedActivities || {},
        maxDay: 6,
      },
    });
  } catch (error) {
    logger.error(`[foalController] PUT /api/foals/:foalId/develop error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
