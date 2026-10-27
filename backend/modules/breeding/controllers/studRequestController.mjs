/**
 * Private stud request queue (Equoria-q4uem.9).
 *
 * Owner rulings (Stacey):
 *   2026-10-15  Private Stud: the mare owner requests, the stallion owner
 *               approves or rejects. S1 the confirm-time fee is a contract.
 *               S6 the request pins the fee she saw; money moves only on
 *               approval; if she cannot pay then, the approval fails, the
 *               request is declined and both are notified. S7 one pending
 *               request per mare; eligibility re-checked at approval. S8
 *               requests never expire; she may cancel any time. S10 notify the
 *               stallion owner of each request; the mare owner on
 *               approve/reject.
 *   2026-10-16  S-Q3 a non-money ineligibility at approval declines and
 *               notifies both. S-Q4 a mare with a pending request may not be
 *               bred elsewhere (the other breeding paths check it). S-Q5 the
 *               stallion owner is told when a request is cancelled.
 *
 * Money and races (design ws9 v4 §3.2-3.6): every failure after a snapshot
 * read THROWS (a returned value commits); User rows before Horse rows, each in
 * ascending id, inline here so txUserBeforeHorseLockOrder sees them; the
 * BreedingRecord insert or request claim is the last claim write. A decline is
 * a SECOND short transaction after the approval rolled back, and only for a
 * 400-class reason about the mare or the stallion, or insufficient funds; a
 * server fault answers 500/503 and leaves the request PENDING.
 */
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { GESTATION_DAYS } from '../../../constants/time.mjs';
import { gameDayIndex, startOfGameDayIndex } from '../../../utils/gameTime.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
import { validateBreedingPair, pregnancyClaimData } from '../../horses/index.mjs';
import {
  InsufficientFundsError,
  TransferPayeeNotFoundError,
  transferUserMoneyOrThrow,
} from '../../economy/index.mjs';
import {
  PRIVATE_STUD,
  BUSY_MESSAGE,
  STALLION_UNAVAILABLE,
  MARE_NOT_FOUND,
  BookingRefusal,
  ClaimLost,
  feeOf,
  feePredicate,
  feeChanged,
  resolveLostClaim,
  REQUEST_NOT_FOUND,
  REQUEST_NOT_PENDING,
  finalizeAll,
  notify,
  requestPayload,
  sendUnexpected,
} from '../services/studBookingShared.mjs';

const PENDING_INDEX = 'breeding_records_one_pending_per_dam';
/** An approval that must end the request (S6 / S-Q3 / M-2), decided inside the rolled-back transaction. */
class Decline extends Error {
  /**
   * @param {string} reason - the stored declineReason
   * @param {string} message - what the players are told
   */
  constructor(reason, message) {
    super(message);
    this.reason = reason;
  }
}

/** Only the one-pending-per-mare partial index maps to MARE_HAS_PENDING_REQUEST (review M-5). */
function isPendingIndexViolation(error) {
  // Duck-typed: under Jest's ESM VM a Prisma error class can be a different
  // realm's copy, so `instanceof` is not reliable; the code is.
  if (error?.code !== 'P2002') {
    return false;
  }
  const target = error.meta?.target;
  if (typeof target === 'string') {
    return target === PENDING_INDEX;
  }
  return Array.isArray(target) && target.length === 1 && target[0] === 'damId';
}

/**
 * POST /api/v1/studs/:sireId/requests
 * Body: { damId: int >= 1, expectedStudFee: int >= 0 }
 */
export async function requestPrivateStud(req, res) {
  const requesterId = req.user.id;
  const sireId = Number(req.params.sireId);
  const damId = Number(req.body.damId);
  const expectedStudFee = Number(req.body.expectedStudFee);
  let stallionOwnerId = null;

  try {
    const result = await withRetryableTxMapping(
      prisma.$transaction(
        async tx => {
          const dam = await tx.horse.findUnique({ where: { id: damId } });
          if (!dam || dam.userId !== requesterId) {
            throw new BookingRefusal(404, MARE_NOT_FOUND);
          }
          const sire = await tx.horse.findUnique({ where: { id: sireId } });
          if (!sire || sire.studStatus !== PRIVATE_STUD || !sire.userId) {
            throw new BookingRefusal(404, STALLION_UNAVAILABLE);
          }
          if (sire.userId === requesterId) {
            throw new BookingRefusal(400, {
              success: false,
              code: 'OWN_STALLION',
              message: 'This is your own stallion. Breed your mare to him free from his page.',
            });
          }
          if (feeOf(sire) !== expectedStudFee) {
            throw feeChanged(feeOf(sire));
          }
          stallionOwnerId = sire.userId;

          // Canon: validate before creating any state (a doomed request is refused now).
          const verdict = await validateBreedingPair({ sire, dam, client: tx });
          if (!verdict.ok) {
            throw new BookingRefusal(verdict.status, { success: false, message: verdict.message });
          }

          // Owner ruling q106 (2026-10-27): she needs the fee in hand to send the
          // request. Advisory only — the money moves, and is proved, at approval (S6).
          const requester = await tx.user.findUnique({
            where: { id: requesterId },
            select: { money: true },
          });
          if (!requester || Number(requester.money) < expectedStudFee) {
            throw new BookingRefusal(400, {
              success: false,
              code: 'insufficientFunds',
              message: `You need ${expectedStudFee} coins to ask for this stallion.`,
            });
          }

          // ── Pins (design review I-2): both horses, ascending id ──
          const pinSire = async () => {
            const pinned = await tx.horse.updateMany({
              where: {
                id: sireId,
                userId: stallionOwnerId,
                studStatus: PRIVATE_STUD,
                ...feePredicate(expectedStudFee),
              },
              data: { studFee: expectedStudFee },
            });
            if (pinned.count !== 1) {
              throw new ClaimLost('SIRE');
            }
          };
          const pinDam = async () => {
            const pinned = await tx.horse.updateMany({
              where: { id: damId, userId: requesterId, inFoalSinceDate: null },
              data: { userId: requesterId },
            });
            if (pinned.count !== 1) {
              throw new ClaimLost('DAM');
            }
          };
          if (sireId < damId) {
            await pinSire();
            await pinDam();
          } else {
            await pinDam();
            await pinSire();
          }

          // With the mare row held, re-read her (a new statement sees anything
          // committed while this request waited) and re-check her eligibility.
          const heldDam = await tx.horse.findUnique({ where: { id: damId } });
          const recheck = await validateBreedingPair({ sire, dam: heldDam, client: tx });
          if (!recheck.ok) {
            throw new BookingRefusal(recheck.status, { success: false, message: recheck.message });
          }

          const [mareOwner, stallionOwner] = await Promise.all([
            tx.user.findUnique({ where: { id: requesterId }, select: { username: true } }),
            tx.user.findUnique({ where: { id: stallionOwnerId }, select: { username: true } }),
          ]);

          // ── Last claim write: the PENDING request (S7: one per mare, partial unique index) ──
          const record = await tx.breedingRecord.create({
            data: {
              kind: 'PRIVATE_STUD',
              status: 'PENDING',
              fee: expectedStudFee,
              sireId,
              damId,
              mareOwnerId: requesterId,
              stallionOwnerId,
              sireName: sire.name,
              damName: dam.name,
              mareOwnerName: mareOwner?.username ?? '',
              stallionOwnerName: stallionOwner?.username ?? '',
            },
          });

          const notifications = [];
          await notify(
            tx,
            notifications,
            stallionOwnerId,
            'studRequestReceived',
            requestPayload(record, { mareOwnerName: mareOwner?.username ?? '' }),
          );
          return { record, notifications };
        },
        { timeout: 30000 },
      ),
      { message: BUSY_MESSAGE },
    );

    finalizeAll(result.notifications);
    return res.status(201).json({
      success: true,
      message: `Your request was sent to ${result.record.stallionOwnerName}.`,
      data: {
        requestId: result.record.id,
        status: result.record.status,
        fee: result.record.fee,
        sireId,
        damId,
        createdAt: result.record.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof BookingRefusal) {
      return res.status(error.status).json(error.body);
    }
    if (error instanceof ClaimLost) {
      try {
        const [status, body] = await resolveLostClaim(error.which, {
          sireId,
          damId,
          requesterId,
          stallionOwnerId,
          expectedStudFee,
          studStatus: PRIVATE_STUD,
        });
        return res.status(status).json(body);
      } catch (readError) {
        return sendUnexpected(res, 'resolving a lost request pin', readError);
      }
    }
    if (isPendingIndexViolation(error)) {
      return res.status(409).json({
        success: false,
        code: 'MARE_HAS_PENDING_REQUEST',
        message:
          'This mare already has a pending stud request. Cancel it before asking another stallion.',
      });
    }
    return sendUnexpected(res, 'requestPrivateStud', error);
  }
}

/**
 * POST /api/v1/studs/requests/:id/approve — the stallion owner accepts; the
 * pinned fee moves and the pregnancy starts, or the request is declined.
 */
export async function approveStudRequest(req, res) {
  const approverId = req.user.id;
  const requestId = Number(req.params.id);

  try {
    const now = new Date();
    const result = await withRetryableTxMapping(
      prisma.$transaction(
        async tx => {
          const request = await tx.breedingRecord.findUnique({ where: { id: requestId } });
          if (
            !request ||
            request.kind !== 'PRIVATE_STUD' ||
            request.stallionOwnerId !== approverId
          ) {
            throw new BookingRefusal(404, REQUEST_NOT_FOUND);
          }
          if (request.status !== 'PENDING') {
            throw new BookingRefusal(409, REQUEST_NOT_PENDING);
          }
          const mareOwnerId = request.mareOwnerId;
          const fee = request.fee;
          const dam = request.damId
            ? await tx.horse.findUnique({ where: { id: request.damId } })
            : null;
          const sire = request.sireId
            ? await tx.horse.findUnique({ where: { id: request.sireId } })
            : null;

          if (dam && dam.userId === approverId) {
            throw new Decline(
              'OWN_STALLION',
              `You now own ${dam.name}; breed her to your stallion free from his page.`,
            );
          }
          if (!sire || sire.userId !== approverId || sire.studStatus !== PRIVATE_STUD) {
            throw new Decline('STALLION_UNAVAILABLE', 'The stallion is no longer at private stud.');
          }
          if (!dam || !mareOwnerId || dam.userId !== mareOwnerId) {
            throw new Decline(
              'MARE_TRANSFERRED',
              'The mare no longer belongs to the player who asked.',
            );
          }
          const verdict = await validateBreedingPair({ sire, dam, client: tx });
          if (!verdict.ok) {
            if (verdict.kind === 'server') {
              throw new BookingRefusal(verdict.status, {
                success: false,
                message: verdict.message,
              });
            }
            throw new Decline(
              verdict.kind === 'sire' ? 'STALLION_UNAVAILABLE' : 'MARE_INELIGIBLE',
              verdict.message,
            );
          }

          /** After a lost debit or dam claim: the mare, not the money, is what was lost. */
          const declineForMareState = async () => {
            const current = await tx.horse.findUnique({
              where: { id: dam.id },
              select: { userId: true, inFoalSinceDate: true },
            });
            if (!current || current.userId !== mareOwnerId) {
              return new Decline(
                'MARE_TRANSFERRED',
                'The mare no longer belongs to the player who asked.',
              );
            }
            if (current.inFoalSinceDate) {
              return new Decline('MARE_INELIGIBLE', `${dam.name} is already in foal.`);
            }
            return null;
          };

          // ── Money: User rows first (the helper locks them in ascending id);
          //    the PINNED fee, S6 ──
          if (fee > 0) {
            try {
              await transferUserMoneyOrThrow(tx, {
                fromUserId: mareOwnerId,
                toUserId: approverId,
                amount: fee,
                debitCategory: 'studFeePaid',
                creditCategory: 'studFeeReceived',
                debitDescription: `Stud fee: ${dam.name} to ${sire.name}`,
                creditDescription: `Stud fee: ${sire.name} covered ${dam.name}`,
                metadata: { recordId: requestId, damId: dam.id, sireId: sire.id },
              });
            } catch (error) {
              if (error instanceof TransferPayeeNotFoundError) {
                throw new BookingRefusal(409, {
                  success: false,
                  code: 'STUD_OWNER_UNAVAILABLE',
                  message: 'Your account could not take the stud fee right now.',
                });
              }
              if (!(error instanceof InsufficientFundsError)) {
                throw error;
              }
              throw (
                (await declineForMareState()) ??
                new Decline(
                  'INSUFFICIENT_FUNDS',
                  `The mare's owner could not pay the ${fee}-coin stud fee.`,
                )
              );
            }
          }

          // ── Horses second, ascending id ──
          const pinSire = async () => {
            const pinned = await tx.horse.updateMany({
              where: { id: sire.id, userId: approverId, studStatus: PRIVATE_STUD },
              data: { userId: approverId },
            });
            if (pinned.count !== 1) {
              throw new Decline(
                'STALLION_UNAVAILABLE',
                'The stallion is no longer at private stud.',
              );
            }
          };
          const claimDam = async () => {
            const claimed = await tx.horse.updateMany({
              where: { id: dam.id, userId: mareOwnerId, inFoalSinceDate: null },
              data: pregnancyClaimData({
                sireId: sire.id,
                now,
              }),
            });
            if (claimed.count !== 1) {
              throw (
                (await declineForMareState()) ??
                new Decline('MARE_INELIGIBLE', `${dam.name} can no longer be bred.`)
              );
            }
          };
          if (sire.id < dam.id) {
            await pinSire();
            await claimDam();
          } else {
            await claimDam();
            await pinSire();
          }

          // ── Last claim write: the request itself ──
          const claimed = await tx.breedingRecord.updateMany({
            where: { id: requestId, status: 'PENDING' },
            data: { status: 'COMPLETED', resolvedAt: now },
          });
          if (claimed.count !== 1) {
            throw new BookingRefusal(409, REQUEST_NOT_PENDING);
          }

          const foalDueDate = startOfGameDayIndex(gameDayIndex(now) + GESTATION_DAYS).toISOString();
          const notifications = [];
          await notify(
            tx,
            notifications,
            mareOwnerId,
            'studRequestApproved',
            requestPayload(request, { foalDueDate }),
          );
          const balance = await tx.user.findUnique({
            where: { id: approverId },
            select: { money: true },
          });
          return { fee, foalDueDate, newBalance: Number(balance.money), notifications };
        },
        { timeout: 30000 },
      ),
      { message: BUSY_MESSAGE },
    );

    finalizeAll(result.notifications);
    return res.status(200).json({
      success: true,
      message: 'Request approved. The mare is now in foal.',
      data: {
        requestId,
        status: 'COMPLETED',
        fee: result.fee,
        newBalance: result.newBalance,
        foalDueDate: result.foalDueDate,
      },
    });
  } catch (error) {
    if (error instanceof BookingRefusal) {
      return res.status(error.status).json(error.body);
    }
    if (error instanceof Decline) {
      return declineAfterFailedApproval(res, { requestId, approverId, decline: error });
    }
    return sendUnexpected(res, 'approveStudRequest', error);
  }
}

/**
 * S6 / S-Q3: the approval rolled back for a reason that ends the request.
 * Decline it in a second short transaction and notify both players. If the
 * request is no longer PENDING (another answer won), say so; if this
 * transaction itself fails, answer 503 and leave the request PENDING.
 */
async function declineAfterFailedApproval(res, { requestId, approverId, decline }) {
  try {
    const outcome = await withRetryableTxMapping(
      prisma.$transaction(
        async tx => {
          const claimed = await tx.breedingRecord.updateMany({
            where: { id: requestId, status: 'PENDING', stallionOwnerId: approverId },
            data: { status: 'DECLINED', declineReason: decline.reason, resolvedAt: new Date() },
          });
          if (claimed.count !== 1) {
            return { declined: false, notifications: [] };
          }
          const record = await tx.breedingRecord.findUnique({ where: { id: requestId } });
          const notifications = [];
          const payload = requestPayload(record, {
            declineReason: decline.reason,
            message: decline.message,
          });
          await notify(tx, notifications, record.mareOwnerId, 'studRequestDeclined', payload);
          await notify(tx, notifications, record.stallionOwnerId, 'studRequestDeclined', payload);
          return { declined: true, notifications };
        },
        { timeout: 30000 },
      ),
      { message: BUSY_MESSAGE },
    );
    if (!outcome.declined) {
      return res.status(409).json(REQUEST_NOT_PENDING);
    }
    finalizeAll(outcome.notifications);
    return res.status(409).json({
      success: false,
      code: 'REQUEST_DECLINED',
      message: decline.message,
      data: { declineReason: decline.reason },
    });
  } catch (error) {
    logger.error(`[studRequest] decline of request ${requestId} failed: ${error.message}`);
    return res.status(503).json({ success: false, message: BUSY_MESSAGE });
  }
}
