/**
 * Resolving pending private-stud requests when the horses they name change
 * (Equoria-q4uem.9).
 *
 * Owner rulings (Stacey, 2026-10-16):
 *   S-Q2  Unlisting a stallion, selling it, or switching it from Private to
 *         Public auto-declines its pending requests and notifies each mare
 *         owner. A fee change leaves them (S6 pins the requested fee).
 *   S-Q4  A sale of the mare cancels her pending request; S-Q5 the stallion
 *         owner is told when a request is cancelled.
 *
 * Both helpers run INSIDE the caller's transaction (`tx`) and return the
 * notifications they wrote, which the caller must finalize after its commit
 * (notificationService createNotificationTx contract). Each request is claimed
 * with its own guarded `updateMany` (status still PENDING), so a request an
 * approval completed concurrently is never declined and never notified.
 */
import { createNotificationTx } from '../../../utils/notificationService.mjs';

/**
 * Decline every PENDING request on a stallion.
 *
 * @param {object} tx - the caller's interactive transaction client
 * @param {{ sireId: number, reason: string }} params
 * @returns {Promise<Array<{ userId: string, type: string, payload: object }>>}
 */
export async function declinePendingRequestsForSire(tx, { sireId, reason }) {
  const pending = await tx.breedingRecord.findMany({
    where: { sireId, status: 'PENDING' },
    select: { id: true, mareOwnerId: true, sireName: true, damName: true, fee: true },
  });
  const notifications = [];
  const now = new Date();
  for (const request of pending) {
    const claimed = await tx.breedingRecord.updateMany({
      where: { id: request.id, status: 'PENDING' },
      data: { status: 'DECLINED', declineReason: reason, resolvedAt: now },
    });
    if (claimed.count === 1 && request.mareOwnerId) {
      const note = {
        userId: request.mareOwnerId,
        type: 'stud_request_declined',
        payload: {
          requestId: request.id,
          sireName: request.sireName,
          damName: request.damName,
          fee: request.fee,
          declineReason: reason,
        },
      };
      await createNotificationTx(tx, note.userId, note.type, note.payload);
      notifications.push(note);
    }
  }
  return notifications;
}

/**
 * Cancel the PENDING request on a mare (there is at most one: S7).
 *
 * @param {object} tx - the caller's interactive transaction client
 * @param {{ damId: number, reason: string }} params
 * @returns {Promise<Array<{ userId: string, type: string, payload: object }>>}
 */
export async function cancelPendingRequestForMare(tx, { damId, reason }) {
  const pending = await tx.breedingRecord.findMany({
    where: { damId, status: 'PENDING' },
    select: { id: true, stallionOwnerId: true, sireName: true, damName: true, fee: true },
  });
  const notifications = [];
  const now = new Date();
  for (const request of pending) {
    const claimed = await tx.breedingRecord.updateMany({
      where: { id: request.id, status: 'PENDING' },
      data: { status: 'CANCELLED', declineReason: reason, resolvedAt: now },
    });
    if (claimed.count === 1 && request.stallionOwnerId) {
      const note = {
        userId: request.stallionOwnerId,
        type: 'stud_request_cancelled',
        payload: {
          requestId: request.id,
          sireName: request.sireName,
          damName: request.damName,
          fee: request.fee,
          reason,
        },
      };
      await createNotificationTx(tx, note.userId, note.type, note.payload);
      notifications.push(note);
    }
  }
  return notifications;
}
