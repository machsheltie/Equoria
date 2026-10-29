/**
 * Pieces shared by the public-booking and private-request controllers
 * (Equoria-q4uem.9). No guarded pin, claim or money write lives here: each
 * stays inline in its controller's transaction, where the lock-order sentinel
 * can see it. `notify` only adds a notification row inside the caller's tx.
 */
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { studStatuses } from '../../../constants/schema.mjs';
import { RetryableTransactionError } from '../../../utils/retryableTransaction.mjs';
import {
  createNotificationTx,
  finalizeNotificationAfterCommit,
} from '../../../utils/notificationService.mjs';

export const PUBLIC_STUD = studStatuses.public;
export const PRIVATE_STUD = studStatuses.private;
export const BUSY_MESSAGE = 'The stud barn is busy right now, please retry in a moment.';

/**
 * Same body for a stallion that does not exist and one that is not at stud in
 * the mode asked for, so the endpoints cannot be used to probe which horse ids
 * exist (design review M-1). Every 404 here carries the AppError body shape
 * ({ success, message, status: 'fail' }) that requireOwnership and the other
 * AppError 404s send, so the shape gives nothing away either.
 */
export const STALLION_UNAVAILABLE = Object.freeze({
  success: false,
  message: 'Stallion not available at stud',
  status: 'fail',
});
export const MARE_NOT_FOUND = Object.freeze({
  success: false,
  message: 'Mare not found',
  status: 'fail',
});

/** A refusal with its exact response body; thrown out of a transaction so it rolls back. */
export class BookingRefusal extends Error {
  /**
   * @param {number} status
   * @param {object} body - the exact response body
   */
  constructor(status, body) {
    super(body.message);
    this.status = status;
    this.body = body;
  }
}

/** A guarded pin or claim matched no row; resolved to a response after the rollback. */
export class ClaimLost extends Error {
  /** @param {'SIRE' | 'DAM'} which */
  constructor(which) {
    super(which);
    this.which = which;
  }
}

/** A null studFee is a legacy row meaning 0 (design R5). */
export function feeOf(horse) {
  return horse.studFee ?? 0;
}

/** The sire-pin predicate for a fee: a null studFee counts as 0. */
export function feePredicate(fee) {
  return fee === 0 ? { OR: [{ studFee: 0 }, { studFee: null }] } : { studFee: fee };
}

/** Owner ruling S1 (2026-10-15): a changed fee answers 409 with the new fee. */
export function feeChanged(studFee) {
  return new BookingRefusal(409, {
    success: false,
    code: 'studFeeChanged',
    message: `This stallion's stud fee is now ${studFee}. Confirm the new fee to book.`,
    data: { studFee },
  });
}

/**
 * After a rolled-back booking or request whose guarded pin or claim matched no
 * row, read the committed state once and say why (design §3.1 step 7).
 *
 * @param {'SIRE' | 'DAM'} which
 * @param {{ sireId: number, damId: number, requesterId: string,
 *   stallionOwnerId: string | null, expectedStudFee: number, studStatus: string }} context
 * @returns {Promise<[number, object]>} the status and the exact response body
 */
export async function resolveLostClaim(
  which,
  { sireId, damId, requesterId, stallionOwnerId, expectedStudFee, studStatus },
) {
  if (which === 'SIRE') {
    const sire = await prisma.horse.findUnique({
      where: { id: sireId },
      select: { userId: true, studStatus: true, studFee: true },
    });
    if (
      sire &&
      sire.userId === stallionOwnerId &&
      sire.studStatus === studStatus &&
      feeOf(sire) !== expectedStudFee
    ) {
      return [409, feeChanged(feeOf(sire)).body];
    }
    return [404, STALLION_UNAVAILABLE];
  }
  const dam = await prisma.horse.findUnique({
    where: { id: damId },
    select: { userId: true, name: true },
  });
  if (!dam || dam.userId !== requesterId) {
    return [404, MARE_NOT_FOUND];
  }
  return [400, { success: false, message: `${dam.name} is already in foal.` }];
}

// ── Private-request helpers (shared by the request and queue controllers) ──

export const REQUEST_NOT_FOUND = Object.freeze({
  success: false,
  message: 'Request not found',
  status: 'fail',
});
export const REQUEST_NOT_PENDING = Object.freeze({
  success: false,
  code: 'requestNotPending',
  message: 'This request has already been answered or withdrawn.',
});

export function finalizeAll(notifications) {
  for (const note of notifications) {
    finalizeNotificationAfterCommit(note.userId, note.type, note.payload);
  }
}

export async function notify(tx, notifications, userId, type, payload) {
  if (!userId) {
    return;
  }
  await createNotificationTx(tx, userId, type, payload);
  notifications.push({ userId, type, payload });
}

export function requestPayload(record, extra = {}) {
  return {
    requestId: record.id,
    sireId: record.sireId,
    sireName: record.sireName,
    damId: record.damId,
    damName: record.damName,
    fee: record.fee,
    ...extra,
  };
}

export function sendUnexpected(res, label, error) {
  if (error instanceof RetryableTransactionError) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  logger.error(`[studRequest] ${label} failed: ${error.message}`);
  return res.status(500).json({ success: false, message: 'Internal server error' });
}
