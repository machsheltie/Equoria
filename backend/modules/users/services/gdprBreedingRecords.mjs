/**
 * GDPR handling of BreedingRecord rows (Equoria-q4uem.9).
 *
 * A breeding record belongs to BOTH players: one paid the stud fee, the other
 * received it (owner rulings 2026-10-12 / S-Q7 2026-10-16). Erasing one player
 * must therefore keep the counterparty's record: the foreign keys to the
 * erased user and their horses go NULL by themselves (onDelete: SetNull), the
 * erased side's name snapshot is blanked here, and their PENDING private
 * requests are resolved so no request waits on a closed account (a pending
 * request also holds the mare's one-pending-request slot, ruling S7).
 */
import prisma from '../../../../packages/database/prismaClient.mjs';

/**
 * The user's breeding records, both sides, for the Article 15/20 export.
 *
 * @param {string} userId
 */
export async function exportBreedingRecords(userId) {
  const [asMareOwner, asStallionOwner] = await Promise.all([
    prisma.breedingRecord.findMany({ where: { mareOwnerId: userId } }),
    prisma.breedingRecord.findMany({ where: { stallionOwnerId: userId } }),
  ]);
  return { asMareOwner, asStallionOwner };
}

/**
 * Inside the erasure transaction, BEFORE the user row is deleted.
 *
 * @param {object} tx - the erasure transaction client
 * @param {string} userId
 */
export async function closeBreedingRecordsForErasureTx(tx, userId) {
  const resolvedAt = new Date();
  await tx.breedingRecord.updateMany({
    where: { stallionOwnerId: userId, status: 'PENDING' },
    data: { status: 'DECLINED', declineReason: 'ACCOUNT_CLOSED', resolvedAt },
  });
  await tx.breedingRecord.updateMany({
    where: { mareOwnerId: userId, status: 'PENDING' },
    data: { status: 'CANCELLED', declineReason: 'ACCOUNT_CLOSED', resolvedAt },
  });
  await tx.breedingRecord.updateMany({
    where: { mareOwnerId: userId },
    data: { mareOwnerName: '' },
  });
  await tx.breedingRecord.updateMany({
    where: { stallionOwnerId: userId },
    data: { stallionOwnerName: '' },
  });
}
