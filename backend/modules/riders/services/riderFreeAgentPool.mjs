/**
 * The riders-for-hire pool (owner ruling 2026-10-28, q177; Equoria-xlw03).
 *
 * "A fired or unpaid staff member returns to the hiring list at its current level with
 * its revealed data intact." A dismissed rider, or one who leaves after a full unpaid
 * week, keeps its row: star level, shows, growth profile, career weeks, age and hidden
 * retirement age all stay. It leaves the player's roster (`userId` NULL) and enters the
 * pool (`freeAgentSince` set). Any player may hire it again at its current level's price.
 *
 * The pool is exactly `riderFreeAgentWhere`. Requiring `freeAgentSince` keeps leftover
 * rows with a NULL owner (fixtures, legacy data) out of the pool: only riders a player
 * let go are in it, as the ruling describes. Retirement by age still applies to pool
 * riders (riderRetirementService reads every non-retired rider).
 */

import {
  ensureGrowthProfileTx,
  revealedGrowthViews,
} from '../../../services/staffGrowthService.mjs';
import { hiredStaffFee } from '../../../constants/staffLevels.mjs';
import { publicStaffRow } from '../../../utils/staffPublicView.mjs';

/** The one predicate of the riders-for-hire pool. */
export const riderFreeAgentWhere = Object.freeze({
  userId: null,
  retired: false,
  freeAgentSince: { not: null },
});

/**
 * Move a rider from a player's roster into the pool. Guarded: only a non-retired rider
 * still on `userId`'s roster moves. The caller has already ended its assignments (and
 * locked the horses first, lock order). The growth profile is made now if the rider had
 * none, so the pool always shows its reveals.
 *
 * @param {Object} tx
 * @param {{ riderId: number, userId: string, now?: Date }} params
 * @returns {Promise<number>} 1 when the rider moved, 0 when it was not on that roster
 */
export async function returnRiderToPoolTx(tx, { riderId, userId, now = new Date() }) {
  const moved = await tx.rider.updateMany({
    where: { id: riderId, userId, retired: false },
    data: { userId: null, feeUnpaidSince: null, freeAgentSince: now },
  });
  if (moved.count === 1) {
    await ensureGrowthProfileTx(tx, 'rider', riderId);
  }
  return moved.count;
}

/** Player-facing fields of a pool rider: an explicit projection, never a bare row. */
const poolRiderSelect = Object.freeze({
  id: true,
  firstName: true,
  lastName: true,
  personality: true,
  skillLevel: true,
  starLevel: true,
  speciality: true,
  bio: true,
  freeAgentSince: true,
});

/**
 * List the pool with each rider's price (its current level's) and only its revealed
 * growth items.
 *
 * @param {Object} client
 * @param {{ limit?: number, skip?: number }} [options]
 * @returns {Promise<{ riders: Array, total: number }>}
 */
export async function listFreeAgentRiders(client, { limit = 20, skip = 0 } = {}) {
  const [rows, total] = await Promise.all([
    client.rider.findMany({
      where: riderFreeAgentWhere,
      select: poolRiderSelect,
      orderBy: [{ freeAgentSince: 'desc' }, { id: 'asc' }],
      take: limit,
      skip,
    }),
    client.rider.count({ where: riderFreeAgentWhere }),
  ]);
  const views = await revealedGrowthViews(client, 'rider', rows);
  // Allow-listed fields and authored labels only (Equoria-no441), plus the revealed growth.
  const riders = rows.map(row => ({
    ...publicStaffRow('rider', {
      ...row,
      name: `${row.firstName} ${row.lastName}`,
      weeklyRate: hiredStaffFee(row),
    }),
    growth: views.get(row.id),
  }));
  return { riders, total };
}
