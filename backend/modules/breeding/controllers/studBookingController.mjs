/**
 * Stud bookings (Equoria-q4uem.9).
 *
 * Owner rulings (Stacey):
 *   2026-10-12  Breeding a mare to ANOTHER player's stallion charges that
 *               stallion's player-set studFee, paid by the mare owner to the
 *               stallion owner. Breeding a pair you own is free. The game never
 *               derives a fee.
 *   2026-10-15  Public Stud completes automatically. S1 the fee shown at
 *               confirm is a contract (a changed fee answers 409 with the new
 *               fee). S2 no limit on how often a stallion is bred. S3 the foal
 *               belongs to the mare's owner at birth. S4 a fee of 0 is a free
 *               stud. S5 notify the stallion owner of a public booking.
 *   2026-10-16  S-Q4 a mare with a pending private request may not be bred
 *               elsewhere. S-Q7 one BreedingRecord per breeding records the
 *               breeding and the stud fee paid.
 *
 * Money correctness (design ws9 v4 §3):
 *   - Every failure after the snapshot read THROWS: a value returned from the
 *     $transaction callback commits, and the debit and credit happen before the
 *     horse pins, so a return there would mint or burn coin.
 *   - User rows first, ascending id (the repository lock ruling; enforced by
 *     txUserBeforeHorseLockOrder.sentinel), then horse rows in ascending id,
 *     then the BreedingRecord insert. All writes are inline in this file so the
 *     sentinel sees them.
 *   - The debit is a guarded `updateMany` (money >= fee, count must be 1); no
 *     row is locked with SELECT…FOR-UPDATE.
 *   - The sire pin re-proves the listing at commit (owner, Public Stud, fee),
 *     so an unlist, reprice or sale that lands mid-request rolls everything
 *     back and the fee only ever reaches the stallion's owner at commit.
 *   - The dam claim (inFoalSinceDate IS NULL, owner pinned) is the idempotency
 *     point: a double submit's loser matches 0 rows and its money rolls back.
 */
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { GESTATION_DAYS } from '../../../constants/time.mjs';
import { gameDayIndex, startOfGameDayIndex } from '../../../utils/gameTime.mjs';
import {
  withRetryableTxMapping,
  RetryableTransactionError,
} from '../../../utils/retryableTransaction.mjs';
import {
  createNotificationTx,
  finalizeNotificationAfterCommit,
} from '../../../utils/notificationService.mjs';
import {
  validateBreedingPair,
  pregnancyClaimData,
  pendingRequestMessage,
} from '../../horses/index.mjs';
import { recordTransactionTx } from '../../economy/index.mjs';
import {
  PUBLIC_STUD,
  BUSY_MESSAGE,
  STALLION_UNAVAILABLE,
  MARE_NOT_FOUND,
  BookingRefusal,
  ClaimLost,
  feeOf,
  feePredicate,
  feeChanged,
  resolveLostClaim,
} from '../services/studBookingShared.mjs';

/**
 * POST /api/v1/studs/:sireId/bookings
 * Body: { damId: int >= 1, expectedStudFee: int >= 0 }
 * Book the caller's mare to another player's PUBLIC stud.
 */
export async function bookPublicStud(req, res) {
  const requesterId = req.user.id;
  const sireId = Number(req.params.sireId);
  const damId = Number(req.body.damId);
  const expectedStudFee = Number(req.body.expectedStudFee);
  let stallionOwnerId = null;

  try {
    const now = new Date();
    const result = await withRetryableTxMapping(
      prisma.$transaction(
        async tx => {
          // ── Snapshot reads (every value is re-proved by a guarded write) ──
          const dam = await tx.horse.findUnique({ where: { id: damId } });
          if (!dam || dam.userId !== requesterId) {
            throw new BookingRefusal(404, MARE_NOT_FOUND);
          }
          const sire = await tx.horse.findUnique({ where: { id: sireId } });
          if (!sire || sire.studStatus !== PUBLIC_STUD || !sire.userId) {
            throw new BookingRefusal(404, STALLION_UNAVAILABLE);
          }
          if (sire.userId === requesterId) {
            throw new BookingRefusal(400, {
              success: false,
              code: 'OWN_STALLION',
              message:
                'This is your own stallion. Breeding your own pair is free from the Breeding Hall.',
            });
          }
          const fee = feeOf(sire);
          if (fee !== expectedStudFee) {
            throw feeChanged(fee);
          }
          stallionOwnerId = sire.userId;

          const verdict = await validateBreedingPair({ sire, dam, client: tx });
          if (!verdict.ok) {
            throw new BookingRefusal(verdict.status, { success: false, message: verdict.message });
          }

          const [mareOwner, stallionOwner] = await Promise.all([
            tx.user.findUnique({ where: { id: requesterId }, select: { username: true } }),
            tx.user.findUnique({ where: { id: stallionOwnerId }, select: { username: true } }),
          ]);

          // ── Money: User rows first, ascending id ──
          const debitMareOwner = async () => {
            const debit = await tx.user.updateMany({
              where: { id: requesterId, money: { gte: fee } },
              data: { money: { decrement: fee } },
            });
            if (debit.count !== 1) {
              // Review M-d: a booking that queued behind another breeding of
              // this mare (a double submit) can find the money already spent.
              // A fresh read (it sees that breeding's commit) says which loss
              // it really is: the mare, not the money.
              const current = await tx.horse.findUnique({
                where: { id: damId },
                select: { userId: true, inFoalSinceDate: true },
              });
              if (!current || current.userId !== requesterId || current.inFoalSinceDate) {
                throw new ClaimLost('DAM');
              }
              throw new BookingRefusal(400, {
                success: false,
                code: 'INSUFFICIENT_FUNDS',
                message: `You need ${fee} coins to pay this stud fee.`,
              });
            }
          };
          const creditStallionOwner = async () => {
            const credit = await tx.user.updateMany({
              where: { id: stallionOwnerId },
              data: { money: { increment: fee } },
            });
            if (credit.count !== 1) {
              throw new BookingRefusal(409, {
                success: false,
                code: 'STUD_OWNER_UNAVAILABLE',
                message: "The stallion's owner can't take bookings right now.",
              });
            }
          };
          if (fee > 0) {
            if (requesterId < stallionOwnerId) {
              await debitMareOwner();
              await creditStallionOwner();
            } else {
              await creditStallionOwner();
              await debitMareOwner();
            }
          }

          // ── Horses second, ascending id ──
          const pinSire = async () => {
            const pinned = await tx.horse.updateMany({
              where: {
                id: sireId,
                userId: stallionOwnerId,
                studStatus: PUBLIC_STUD,
                ...feePredicate(fee),
              },
              data: { studFee: fee },
            });
            if (pinned.count !== 1) {
              throw new ClaimLost('SIRE');
            }
          };
          const claimDam = async () => {
            const claimed = await tx.horse.updateMany({
              where: { id: damId, userId: requesterId, inFoalSinceDate: null },
              data: pregnancyClaimData({ sireId, effectiveBreedId: verdict.effectiveBreedId, now }),
            });
            if (claimed.count !== 1) {
              throw new ClaimLost('DAM');
            }
          };
          if (sireId < damId) {
            await pinSire();
            await claimDam();
          } else {
            await claimDam();
            await pinSire();
          }

          // Owner ruling S-Q4: with the dam row held, a fresh read sees any
          // committed PENDING private request for her.
          const pending = await tx.breedingRecord.findFirst({
            where: { damId, status: 'PENDING' },
            select: { id: true },
          });
          if (pending) {
            throw new BookingRefusal(409, {
              success: false,
              code: 'MARE_HAS_PENDING_REQUEST',
              message: pendingRequestMessage(dam.name),
            });
          }

          // ── Last claim write: the record of this breeding (S-Q7) ──
          const record = await tx.breedingRecord.create({
            data: {
              kind: 'PUBLIC_STUD',
              status: 'COMPLETED',
              fee,
              sireId,
              damId,
              mareOwnerId: requesterId,
              stallionOwnerId,
              sireName: sire.name,
              damName: dam.name,
              mareOwnerName: mareOwner?.username ?? '',
              stallionOwnerName: stallionOwner?.username ?? '',
              resolvedAt: now,
            },
          });

          if (fee > 0) {
            const metadata = { recordId: record.id, damId, sireId };
            await recordTransactionTx(tx, {
              userId: requesterId,
              type: 'debit',
              amount: fee,
              category: 'stud_fee_paid',
              description: `Stud fee: ${dam.name} to ${sire.name}`,
              metadata: { ...metadata, counterpartyId: stallionOwnerId },
            });
            await recordTransactionTx(tx, {
              userId: stallionOwnerId,
              type: 'credit',
              amount: fee,
              category: 'stud_fee_received',
              description: `Stud fee: ${sire.name} covered ${dam.name}`,
              metadata: { ...metadata, counterpartyId: requesterId },
            });
          }

          const notification = {
            userId: stallionOwnerId,
            type: 'stud_booked',
            payload: {
              recordId: record.id,
              sireId,
              sireName: sire.name,
              damName: dam.name,
              mareOwnerName: mareOwner?.username ?? '',
              fee,
            },
          };
          await createNotificationTx(
            tx,
            notification.userId,
            notification.type,
            notification.payload,
          );

          const balance = await tx.user.findUnique({
            where: { id: requesterId },
            select: { money: true },
          });
          return {
            record,
            fee,
            damName: dam.name,
            stallionOwnerName: stallionOwner?.username ?? '',
            newBalance: Number(balance.money),
            notification,
          };
        },
        { timeout: 30000 },
      ),
      { message: BUSY_MESSAGE },
    );

    finalizeNotificationAfterCommit(
      result.notification.userId,
      result.notification.type,
      result.notification.payload,
    );

    const foalDueDate = startOfGameDayIndex(gameDayIndex(now) + GESTATION_DAYS);
    logger.info(
      `[studBooking] dam ${damId} booked to public stud ${sireId}; fee ${result.fee}; record ${result.record.id}`,
    );
    return res.status(200).json({
      success: true,
      message: `${result.damName} is now in foal. The foal will be born in 7 days.`,
      data: {
        pregnancyStarted: true,
        damId,
        sireId,
        foalDueDate: foalDueDate.toISOString(),
        studFeePaid: result.fee,
        newBalance: result.newBalance,
        recordId: result.record.id,
        stallionOwner: { username: result.stallionOwnerName },
      },
    });
  } catch (error) {
    if (error instanceof BookingRefusal) {
      return res.status(error.status).json(error.body);
    }
    if (error instanceof ClaimLost) {
      // Review M-a: this read runs inside the catch, so its own failure must
      // be caught too (Express 4 would leave the request hanging).
      try {
        const [status, body] = await resolveLostClaim(error.which, {
          sireId,
          damId,
          requesterId,
          stallionOwnerId,
          expectedStudFee,
          studStatus: PUBLIC_STUD,
        });
        return res.status(status).json(body);
      } catch (readError) {
        logger.error(
          `[studBooking] could not resolve a lost ${error.which} claim: ${readError.message}`,
        );
        return res.status(500).json({ success: false, message: 'Internal server error' });
      }
    }
    if (error instanceof RetryableTransactionError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    logger.error(`[studBooking] bookPublicStud failed: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
