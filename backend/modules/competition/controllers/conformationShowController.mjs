/**
 * Conformation Show Controller
 *
 * Handles HTTP endpoints for conformation show entry and eligibility checking.
 * Reuses scoring/validation logic from conformationShowService.mjs (31F-1).
 *
 * Endpoints:
 *   POST /api/v1/competition/conformation/enter       — register horse in conformation show
 *   GET  /api/v1/competition/conformation/eligibility/:horseId — check if horse can enter
 */

import { validationResult } from 'express-validator';
import prisma from '../../../db/index.mjs';
import logger from '../../../utils/logger.mjs';
import { findOwnedResource } from '../../../middleware/ownership.mjs';
import { getDisplayedHealth } from '../../../utils/horseHealth.mjs';
import {
  validateConformationEntry,
  executeConformationShow as executeShowService,
} from '../../../services/conformationShowService.mjs';

// ---------------------------------------------------------------------------
// POST /api/v1/competition/conformation/enter
// ---------------------------------------------------------------------------

/**
 * Register a horse entry into a conformation show.
 *
 * Body: { horseId, groomId, showId, className }
 * - horseId: must be owned by the authenticated user
 * - groomId: must be owned by the authenticated user
 * - showId: must reference a show with showType === 'conformation'
 * - className: valid conformation sex/category class (e.g. 'Mares', 'Stallions')
 *
 * Returns 201 on success with entry data including ageClass.
 */
export async function enterConformationShow(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn(
        `[conformationShowController.POST /enter] Validation errors: ${JSON.stringify(errors.array())}`,
      );
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { horseId, groomId, showId, className } = req.body;
    const userId = req.user?.id;

    logger.info(
      `[conformationShowController.POST /enter] User ${userId} entering horse ${horseId} in show ${showId}`,
    );

    // Verify horse ownership — returns null on ownership failure (IDOR: 404 not 403)
    const horse = await findOwnedResource('horse', horseId, userId);
    if (!horse) {
      return res.status(404).json({ success: false, message: 'Horse not found' });
    }

    // Critical-health gate (A12): a horse whose displayedHealth has decayed
    // to 'critical' (via stale lastFedDate, stale lastVettedDate, or an
    // explicit vet finding) cannot enter competitions. Fires before the
    // service-level validation so the rejection message specifically calls
    // out critical health (not the older 'must be Excellent or Good' check
    // in conformationShowService.validateConformationEntry).
    if (getDisplayedHealth(horse) === 'critical') {
      logger.info(
        `[conformationShowController.POST /enter] Rejected entry: horse ${horseId} is in critical health`,
      );
      return res.status(400).json({
        success: false,
        message: `${horse.name} is in critical health and cannot enter competitions. Feed and vet to restore health.`,
        data: null,
      });
    }

    // Verify groom ownership
    const groom = await prisma.groom.findFirst({ where: { id: groomId, userId } });
    if (!groom) {
      return res
        .status(400)
        .json({ success: false, message: 'Groom not found or not owned by user' });
    }

    // Load show and check it exists — AC1: missing show is a 400, not 404
    const show = await prisma.show.findUnique({ where: { id: showId } });
    if (!show) {
      return res.status(400).json({ success: false, message: 'Show not found' });
    }

    // Guard: must be a conformation show (AC3)
    if (show.showType !== 'conformation') {
      return res.status(400).json({ success: false, message: 'Show is not a conformation show' });
    }

    // Guard: duplicate entry check before DB constraint (AC1)
    const existing = await prisma.showEntry.findFirst({ where: { showId, horseId } });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: 'Horse is already entered in this show' });
    }

    // Run full validation via service layer
    const result = await validateConformationEntry(horse, groom, className, userId);
    if (!result.valid) {
      logger.warn(
        `[conformationShowController.POST /enter] Entry validation failed for horse ${horseId}: ${result.errors.join(', ')}`,
      );
      return res.status(400).json({
        success: false,
        message: 'Horse does not meet conformation show entry requirements',
        errors: result.errors,
        warnings: result.warnings,
      });
    }

    // Persist the entry (P2002 fallback for race-condition duplicate)
    let entry;
    try {
      entry = await prisma.showEntry.create({
        data: { showId, horseId, userId, feePaid: 0 },
      });
    } catch (err) {
      if (err.code === 'P2002') {
        return res
          .status(409)
          .json({ success: false, message: 'Horse is already entered in this show' });
      }
      throw err;
    }

    logger.info(
      `[conformationShowController.POST /enter] Entry created: id=${entry.id} horse=${horseId} show=${showId} ageClass=${result.ageClass}`,
    );

    return res.status(201).json({
      success: true,
      data: {
        entryId: entry.id,
        horseId,
        showId,
        ageClass: result.ageClass,
        className,
        warnings: result.warnings,
      },
    });
  } catch (error) {
    logger.error(`[conformationShowController.POST /enter] Unexpected error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/competition/conformation/eligibility/:horseId
// ---------------------------------------------------------------------------

/**
 * Check whether a horse is eligible to enter conformation shows.
 *
 * Automatically resolves the horse's active groom assignment — no groomId
 * required in the request. Returns eligibility status with detailed reasons.
 *
 * Returns 200 with eligibility data (eligible, errors, warnings, ageClass, groomAssigned).
 */
export async function checkConformationEligibility(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn(
        `[conformationShowController.GET /eligibility] Validation errors: ${JSON.stringify(errors.array())}`,
      );
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const horseId = parseInt(req.params.horseId, 10);
    const userId = req.user?.id;

    logger.info(
      `[conformationShowController.GET /eligibility] Checking eligibility for horse ${horseId} user ${userId}`,
    );

    // Verify horse ownership — IDOR: 404 on fail
    const horse = await findOwnedResource('horse', horseId, userId);
    if (!horse) {
      return res.status(404).json({ success: false, message: 'Horse not found' });
    }

    // Resolve active groom assignment
    const assignment = await prisma.groomAssignment.findFirst({
      where: { foalId: horseId, userId, isActive: true },
    });

    let groom = null;
    if (assignment) {
      groom = await prisma.groom.findUnique({ where: { id: assignment.groomId } });
    }

    // Run eligibility check via service layer using placeholder class
    // 'Mares' is used as a placeholder — class validation is not the focus of eligibility
    const result = await validateConformationEntry(horse, groom, 'Mares', userId);

    logger.info(
      `[conformationShowController.GET /eligibility] Horse ${horseId}: eligible=${result.valid} groomAssigned=${!!assignment}`,
    );

    return res.status(200).json({
      success: true,
      data: {
        horseId,
        horseName: horse.name,
        eligible: result.valid,
        errors: result.errors,
        warnings: result.warnings,
        ageClass: result.ageClass,
        groomAssigned: !!assignment,
      },
    });
  } catch (error) {
    logger.error(
      `[conformationShowController.GET /eligibility] Unexpected error: ${error.message}`,
    );
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/competition/conformation/execute
// ---------------------------------------------------------------------------

/**
 * Execute a conformation show: score all entries, rank, distribute rewards.
 *
 * Body: { showId }
 * Returns 200 with full results array including ribbon, titlePoints, newTitle, breedingValueBoost.
 * No prize money is awarded (AC4).
 */
export async function executeConformationShowHandler(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn(
        `[conformationShowController.POST /execute] Validation errors: ${JSON.stringify(errors.array())}`,
      );
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { showId } = req.body;

    logger.info(`[conformationShowController.POST /execute] Executing show ${showId}`);

    const results = await executeShowService(showId);

    logger.info(
      `[conformationShowController.POST /execute] Show ${showId} complete — ${results.length} results`,
    );

    return res.status(200).json({
      success: true,
      data: { showId, results },
    });
  } catch (error) {
    const status = error.statusCode === 400 ? 400 : 500;
    logger.error(`[conformationShowController.POST /execute] Error: ${error.message}`);
    return res.status(status).json({
      success: false,
      message: status === 400 ? error.message : 'Internal server error',
      error: process.env.NODE_ENV === 'development' && status === 500 ? error.message : undefined,
    });
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/competition/conformation/titles/:horseId
// ---------------------------------------------------------------------------

/**
 * Query a horse's conformation title data.
 *
 * Returns: { horseId, horseName, titlePoints, currentTitle, breedingValueBoost }
 * IDOR: returns 404 (not 403) on ownership failure.
 */
export async function getConformationTitles(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn(
        `[conformationShowController.GET /titles] Validation errors: ${JSON.stringify(errors.array())}`,
      );
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const horseId = parseInt(req.params.horseId, 10);
    const userId = req.user?.id;

    logger.info(
      `[conformationShowController.GET /titles] User ${userId} querying titles for horse ${horseId}`,
    );

    // Verify horse ownership — IDOR: 404 on failure
    const horse = await findOwnedResource('horse', horseId, userId);
    if (!horse) {
      return res.status(404).json({ success: false, message: 'Horse not found' });
    }

    return res.status(200).json({
      success: true,
      data: {
        horseId: horse.id,
        horseName: horse.name,
        titlePoints: horse.titlePoints ?? 0,
        currentTitle: horse.currentTitle ?? null,
        breedingValueBoost: horse.breedingValueBoost ?? 0,
      },
    });
  } catch (error) {
    logger.error(`[conformationShowController.GET /titles] Unexpected error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
}
