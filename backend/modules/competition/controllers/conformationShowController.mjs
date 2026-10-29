/**
 * Conformation Show Controller
 *
 * Handles HTTP endpoints for conformation show entry and eligibility checking.
 * Reuses scoring/validation logic from conformationShowService.mjs (31F-1).
 *
 * Endpoints:
 *   POST /api/v1/competition/conformation/enter       — register horse in conformation show
 *   GET  /api/v1/competition/conformation/eligibility/:horseId — check if horse can enter
 *   GET  /api/v1/competition/conformation/titles/:horseId      — a horse's title data
 *
 * There is no player settlement endpoint (Equoria-mwjst): the nightly show job
 * settles a conformation show once its closeDate passes
 * (showExecutionService.executeClosedShows → executeConformationShow).
 */

import { validationResult } from 'express-validator';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { findOwnedResource } from '../../../middleware/ownership.mjs';
import { badHealthMessage, hasBadHealth } from '../../../utils/horseHealth.mjs';
import { sendEntryRefusal } from '../services/entryEligibility.mjs';
import {
  validateConformationEntry,
  checkConformationEntryInTx,
} from '../services/conformationShowService.mjs';
import { enterShowDeferredTx } from '../services/competitionRouteQueries.mjs';

/**
 * Resolve the owned Horse for the request: prefer req.horse populated by the
 * requireOwnership middleware (production / route-level wiring). Fall back to
 * findOwnedResource() when the controller is invoked directly (most existing
 * integration tests bypass the routing layer and pass a raw req object).
 * Returns the horse row or null on miss. Per Equoria-s433 / spec-5oll.
 */
async function resolveOwnedHorse(req, horseId, userId) {
  if (req.horse) {
    return req.horse;
  }
  return findOwnedResource('horse', horseId, userId);
}

// ---------------------------------------------------------------------------
// POST /api/v1/competition/conformation/enter
// ---------------------------------------------------------------------------

/**
 * Register a horse entry into a conformation show.
 *
 * Body: { horseId, groomId, showId }
 * - horseId: must be owned by the authenticated user
 * - groomId: must be on the authenticated user's STAFF (Equoria-ypb7d.2: players
 *   engage grooms, they never own them)
 * - showId: must reference a show with showType === 'conformation'
 * There is no class: conformation classes are not settled yet, and entry takes
 * none (owner ruling 2026-10-20, Equoria-mwjst).
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

    const { horseId, groomId, showId } = req.body;
    const userId = req.user?.id;

    logger.info(
      `[conformationShowController.POST /enter] User ${userId} entering horse ${horseId} in show ${showId}`,
    );

    // Horse ownership validated by requireOwnership({from:'body'}) middleware
    // (Equoria-s433); the resolved Horse row is attached to req.horse. The
    // fallback path is for unit tests that invoke the controller directly.
    const horse = await resolveOwnedHorse(req, horseId, userId);
    if (!horse) {
      return res.status(404).json({ success: false, message: 'Horse not found' });
    }

    // Health gate (A12): a horse must be Fair or better to enter; displayed
    // health Bad (via stale lastFedDate, stale lastVettedDate, or a vet
    // finding of Poor/Bad/Critical) is refused. This is the only health bar
    // (owner rulings 2026-10-23, Equoria-0d4wa / Equoria-u0jop: the same one
    // as breeding, training and ridden shows; was 'critical' only);
    // checkConformationEntryInTx decides it again inside the entry transaction.
    if (hasBadHealth(horse)) {
      logger.info(
        `[conformationShowController.POST /enter] Rejected entry: horse ${horseId} is in Bad health`,
      );
      const healthMsg = badHealthMessage(horse.name, 'enter competitions');
      return res.status(400).json({
        success: false,
        message: healthMsg,
        errors: [healthMsg],
        data: null,
      });
    }

    // Verify groom ownership
    const groom = await prisma.groom.findFirst({ where: { id: groomId, userId } });
    if (!groom) {
      return (
        res
          .status(400)
          // Equoria-ypb7d.2: players do not own grooms — they engage them. The not-found/not-yours collapse is deliberate and preserved (CWE-639).
          .json({ success: false, message: 'Groom not found or not on your staff' })
      );
    }

    // Load show and check it exists — AC1: missing show is a 400, not 404.
    // The select is what the canonical entry transaction below consumes.
    const show = await prisma.show.findUnique({
      where: { id: showId },
      select: {
        id: true,
        showType: true,
        status: true,
        openDate: true,
        closeDate: true,
        entryFee: true,
        createdByUserId: true,
        levelMin: true,
        levelMax: true,
      },
    });
    if (!show) {
      return res.status(400).json({ success: false, message: 'Show not found' });
    }

    // Guard: must be a conformation show (AC3)
    if (show.showType !== 'conformation') {
      return res.status(400).json({ success: false, message: 'Show is not a conformation show' });
    }

    // Entry window (Equoria-mwjst): the same reads and messages as the regular
    // show entry. The entry transaction re-checks all three atomically.
    const now = new Date();
    if (show.status !== 'open') {
      return res
        .status(409)
        .json({ success: false, message: 'This show is no longer accepting entries' });
    }
    if (show.openDate && new Date(show.openDate) > now) {
      return res
        .status(409)
        .json({ success: false, message: 'This show is not open for entries yet' });
    }
    // Owner ruling 2026-10-12: settlement waits for closeDate, so a show
    // without one could never settle the fees it took.
    if (!show.closeDate) {
      return res.status(409).json({
        success: false,
        message: 'This show has no closing date and is not taking entries',
      });
    }
    if (new Date(show.closeDate) <= now) {
      return res.status(409).json({ success: false, message: 'Entry period has closed' });
    }

    // Guard: duplicate entry check before DB constraint (AC1)
    const existing = await prisma.showEntry.findFirst({ where: { showId, horseId } });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: 'Horse is already entered in this show' });
    }

    // Run full validation via service layer
    const result = await validateConformationEntry(horse, groom, userId);
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

    // Equoria-mwjst (owner ruling 2026-10-05: conformation entry follows the
    // regular-show rules). The canonical entry transaction — the one behind
    // POST /competition/enter — runs the shared entry rules (for conformation
    // only the double-entry rule, C11; Equoria-576c0 B9), debits exactly
    // the configured entryFee with a guarded update, credits show escrow with
    // its ledger rows, re-checks the entry window and creates the entry with
    // feePaid = entryFee, all in ONE transaction; any refusal rolls all of it
    // back. Conformation keeps its own groom/health/age-class rules, so the
    // ridden age-3 minimum is deliberately not applied.
    //
    // The checks above are only a fast refusal. checkConformationEntryInTx
    // decides them again inside the transaction, on the rows as they are when
    // the fee is taken: the horse still this player's, the groom still on
    // staff, allowed to work and assigned, the horse still eligible
    // (Equoria-mwjst). The entry keeps that groom for settlement (owner ruling
    // 2026-10-12), with a snapshot of its scoring fields in case the groom row
    // is deleted.
    let entry;
    let decided;
    try {
      entry = await enterShowDeferredTx({
        show,
        showId,
        horseId,
        userId,
        prepareEntry: async tx => {
          decided = await checkConformationEntryInTx(tx, { horseId, groomId: groom.id, userId });
          return decided;
        },
      });
    } catch (txError) {
      if (sendEntryRefusal(res, txError)) {
        return res;
      }
      if (txError.message === 'insufficientFunds') {
        return res
          .status(402)
          .json({ success: false, message: 'Insufficient funds for entry fee' });
      }
      if (txError.message === 'entryClosed') {
        return res
          .status(409)
          .json({ success: false, message: 'This show is no longer accepting entries' });
      }
      // A concurrent duplicate loses on @@unique([showId, horseId]); its
      // debit and escrow credit roll back with the transaction.
      if (txError.code === 'P2002') {
        return res
          .status(409)
          .json({ success: false, message: 'Horse is already entered in this show' });
      }
      throw txError;
    }

    logger.info(
      `[conformationShowController.POST /enter] Entry created: id=${entry.id} horse=${horseId} show=${showId} ageClass=${decided.ageClass} feePaid=${entry.feePaid}`,
    );

    // ageClass and warnings as decided inside the entry transaction.
    return res.status(201).json({
      success: true,
      data: {
        entryId: entry.id,
        horseId,
        showId,
        ageClass: decided.ageClass,
        feePaid: entry.feePaid,
        warnings: decided.warnings,
      },
    });
  } catch (error) {
    // Equoria-7x9po: surface the retryable 503 from withRetryableTxMapping.
    if (error?.status === 503 || error?.statusCode === 503) {
      return res.status(503).json({ success: false, message: error.message });
    }
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

    // Horse ownership validated by requireOwnership middleware (Equoria-s433).
    // The fallback path is for unit tests that invoke the controller directly.
    const horse = await resolveOwnedHorse(req, horseId, userId);
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

    // Run eligibility check via service layer, plus the entry route's health
    // bar (Fair or better, owner ruling 2026-10-23, Equoria-u0jop) so this
    // never calls a horse eligible for an entry the route refuses.
    const result = await validateConformationEntry(horse, groom, userId);
    if (hasBadHealth(horse)) {
      result.valid = false;
      result.errors.push(badHealthMessage(horse.name, 'enter competitions'));
    }

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

    // Horse ownership validated by requireOwnership middleware (Equoria-s433).
    // The fallback path is for unit tests that invoke the controller directly.
    const horse = await resolveOwnedHorse(req, horseId, userId);
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
