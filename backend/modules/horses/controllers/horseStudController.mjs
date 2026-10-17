/**
 * Horse Stud Controller
 *
 * Equoria-xod8b (child A of Equoria-mh937): extracted from horseController.mjs.
 * Owns stud-listing endpoints (Equoria-q072).
 *
 * Equoria-q4uem.9 (owner rulings, Stacey 2026-10-02 / 2026-10-15): the PLAYER
 * decides whether her stallion stands at stud and for what fee, and a sale
 * clears the listing. `requireOwnership` only READS the horse; an old owner's
 * request that passed it before a sale used to land a plain
 * `update({ where: { id } })` on the buyer's horse afterwards (re-list,
 * re-price or unlist). Every listing write is now a guarded claim that pins the
 * CURRENT owner — `updateMany` with `userId: req.user.id` in the WHERE, inside
 * a retryable transaction — and a claim that matches no row answers the same
 * 404 the ownership middleware gives a horse the caller does not own.
 */
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import {
  withRetryableTxMapping,
  RetryableTransactionError,
} from '../../../utils/retryableTransaction.mjs';
import { AppError } from '../../../errors/index.mjs';
import { finalizeNotificationAfterCommit } from '../../../utils/notificationService.mjs';
import { declinePendingRequestsForSire } from '../services/studRequestCleanup.mjs';

/** Owner ruling 2026-10-15: the stallion owner chooses Public Stud or Private Stud. */
const STUD_STATUS_BY_MODE = Object.freeze({ public: 'At Public Stud', private: 'At Private Stud' });

const STUD_LISTING_SELECT = { id: true, name: true, sex: true, studStatus: true, studFee: true };
const BUSY_MESSAGE = 'The stud barn is busy right now, please retry in a moment.';

/** The error `requireOwnership('horse')` throws for a horse the caller cannot see (CWE-639). */
function horseNotFound() {
  return new AppError('Horse not found', 404);
}

/**
 * Map an error thrown out of a listing transaction. A retryable 503 keeps its
 * `{ success, message }` body; any other AppError (the guarded-claim 404) gets
 * exactly the body the ownership middleware sends (ownership.mjs, its
 * `AppError.isAppError` branch), so a horse sold mid-request is
 * indistinguishable from a horse the caller never owned. Returns null for an
 * unexpected error, which the caller logs as a 500.
 */
function sendMappedError(res, error) {
  if (error instanceof RetryableTransactionError) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  if (AppError.isAppError(error)) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      status: error.status,
    });
  }
  return null;
}

/**
 * List a stallion at stud (Equoria-q072), or change its fee or mode.
 * POST /api/v1/horses/:id/stud-listing
 * Body: { studFee: number (non-negative integer), mode?: 'public' | 'private' }
 * (mode omitted: the current mode is kept; a first listing is Public)
 *
 * Owner ruling S-Q2 (2026-10-16): leaving Private Stud (here: switching to
 * Public) declines its pending requests in the same transaction; a fee change
 * that stays Private leaves them (S6 pins the requested fee).
 */
export async function listHorseAtStud(req, res) {
  try {
    if (!req.horse) {
      logger.error(
        '[horseController.listHorseAtStud] req.horse not set — requireOwnership middleware did not run',
      );
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }

    if (req.horse.sex !== 'Stallion') {
      return res.status(400).json({
        success: false,
        message: 'Only stallions can be listed at stud',
      });
    }

    const studFee = Number(req.body?.studFee);
    if (!Number.isFinite(studFee) || !Number.isInteger(studFee) || studFee < 0) {
      return res.status(400).json({
        success: false,
        message: 'studFee must be a non-negative integer',
      });
    }

    // An omitted mode KEEPS the stallion's current mode (a fee edit must not
    // flip a Private stallion to Public and decline its requests); only a
    // horse with no listing yet defaults to Public. Resolved in the tx below.
    const mode = req.body?.mode;
    const requestedStatus = mode === undefined ? null : STUD_STATUS_BY_MODE[mode];
    if (mode !== undefined && !requestedStatus) {
      return res
        .status(400)
        .json({ success: false, message: "mode must be 'public' or 'private'" });
    }

    const horseId = req.horse.id;
    const ownerId = req.user.id;
    const { updated, notifications } = await withRetryableTxMapping(
      prisma.$transaction(
        async tx => {
          const current = await tx.horse.findUnique({
            where: { id: horseId },
            select: { studStatus: true },
          });
          const studStatus =
            requestedStatus ??
            (Object.values(STUD_STATUS_BY_MODE).includes(current?.studStatus)
              ? current.studStatus
              : STUD_STATUS_BY_MODE.public);
          // Guarded claim: the caller must STILL own this stallion at write time.
          const claim = await tx.horse.updateMany({
            where: { id: horseId, userId: ownerId, sex: 'Stallion' },
            data: { studStatus, studFee },
          });
          if (claim.count !== 1) {
            throw horseNotFound();
          }
          const declined =
            studStatus === STUD_STATUS_BY_MODE.private
              ? []
              : await declinePendingRequestsForSire(tx, {
                  sireId: horseId,
                  reason: 'LISTING_CHANGED',
                });
          return {
            updated: await tx.horse.findUnique({
              where: { id: horseId },
              select: STUD_LISTING_SELECT,
            }),
            notifications: declined,
          };
        },
        { timeout: 30000 },
      ),
      { message: BUSY_MESSAGE },
    );
    for (const note of notifications) {
      finalizeNotificationAfterCommit(note.userId, note.type, note.payload);
    }

    logger.info(
      `[horseController.listHorseAtStud] horse ${updated.id} listed at stud for fee ${studFee}`,
    );

    return res.status(200).json({
      success: true,
      message: `Horse ${updated.name} listed at stud`,
      data: updated,
    });
  } catch (error) {
    const mapped = sendMappedError(res, error);
    if (mapped) {
      return mapped;
    }
    logger.error(
      `[horseController.listHorseAtStud] Error: ${error.message}\nStack: ${error.stack}`,
    );
    return res.status(500).json({ success: false, message: 'Failed to list horse at stud' });
  }
}

/**
 * Unlist a stallion from stud (Equoria-q072).
 * DELETE /api/v1/horses/:id/stud-listing
 */
export async function unlistHorseAtStud(req, res) {
  try {
    if (!req.horse) {
      logger.error(
        '[horseController.unlistHorseAtStud] req.horse not set — requireOwnership middleware did not run',
      );
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }

    const horseId = req.horse.id;
    const ownerId = req.user.id;
    const { updated, notifications } = await withRetryableTxMapping(
      prisma.$transaction(
        async tx => {
          // Guarded claim: the caller must STILL own this horse at write time.
          const claim = await tx.horse.updateMany({
            where: { id: horseId, userId: ownerId },
            data: { studStatus: 'Not at Stud', studFee: 0 },
          });
          if (claim.count !== 1) {
            throw horseNotFound();
          }
          // Owner ruling S-Q2 (2026-10-16): unlisting declines pending requests.
          const declined = await declinePendingRequestsForSire(tx, {
            sireId: horseId,
            reason: 'LISTING_CHANGED',
          });
          return {
            updated: await tx.horse.findUnique({
              where: { id: horseId },
              select: STUD_LISTING_SELECT,
            }),
            notifications: declined,
          };
        },
        { timeout: 30000 },
      ),
      { message: BUSY_MESSAGE },
    );
    for (const note of notifications) {
      finalizeNotificationAfterCommit(note.userId, note.type, note.payload);
    }

    logger.info(`[horseController.unlistHorseAtStud] horse ${updated.id} unlisted from stud`);

    return res.status(200).json({
      success: true,
      message: `Horse ${updated.name} unlisted from stud`,
      data: updated,
    });
  } catch (error) {
    const mapped = sendMappedError(res, error);
    if (mapped) {
      return mapped;
    }
    logger.error(
      `[horseController.unlistHorseAtStud] Error: ${error.message}\nStack: ${error.stack}`,
    );
    return res.status(500).json({ success: false, message: 'Failed to unlist horse from stud' });
  }
}
