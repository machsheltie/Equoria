/**
 * Groom Salary Reads — what a player's staff COSTS, and what they have paid.
 *
 * Split out of groomSalaryService.mjs (Equoria-95yrv) for the same reason
 * groomRetirementStatsService was split out of the retirement service: these two
 * functions only READ rows the weekly pass has already written, they share no
 * transaction, lock or consequence with it, and the collection file is at its
 * 600-line cap. `groomSalaryService` re-exports both, so every existing importer
 * and both routes are unchanged.
 *
 * `calculateUserSalaryCost` MUST agree with what `processWeeklySalaries` actually
 * charges — 70 per horse in each groom's care — or the salary summary lies to the
 * player about `weeksAffordable`, which PRODUCT.md principle 7 forbids.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import {
  FEE_PER_HORSE_PER_WEEK,
  MAX_HORSES_PER_GROOM,
  calculateWeeklyFee,
  countActiveAssignments,
} from './groomFeeBasisService.mjs';

/**
 * Get salary payment history for a user
 * @param {string} userId - User ID
 * @param {number} limit - Number of records to return (default: 50)
 * @returns {Array} Payment history
 */
export async function getSalaryPaymentHistory(userId, limit = 50) {
  try {
    const payments = await prisma.groomSalaryPayment.findMany({
      where: {
        userId,
      },
      include: {
        groom: {
          select: {
            id: true,
            name: true,
            skillLevel: true,
            speciality: true,
          },
        },
      },
      orderBy: {
        paymentDate: 'desc',
      },
      take: limit,
    });

    return payments;
  } catch (error) {
    logger.error(
      `[groomSalaryService] Error getting salary payment history for user ${userId}: ${error.message}`,
    );
    return [];
  }
}

/**
 * Calculate the total weekly fee a user owes for their groom staff.
 *
 * Equoria-ypb7d.3: this MUST match what `processWeeklySalaries` actually charges,
 * or the salary summary lies to the player about `weeksAffordable` — which
 * PRODUCT.md principle 7 forbids. So it counts the same thing the pass counts.
 *
 * Equoria-95yrv: that is now 70 x the horses each groom is working. Every groom on
 * staff still appears in the breakdown — a groom you employ but have not put on a
 * horse is still yours — but theirs is a fee of 0, and the breakdown says how many
 * horses each fee was computed from so a player can check it against their roster.
 *
 * `feeUnpaidSince` is included in the breakdown because a groom in arrears still
 * costs the fee — that is what "one week of grace" means — and because the surface
 * needs to be able to say which groom cannot work.
 *
 * @param {string} userId - User ID
 * @returns {Object} Weekly fee breakdown
 */
export async function calculateUserSalaryCost(userId) {
  try {
    const staff = await prisma.groom.findMany({
      where: { userId, retired: false, isActive: true },
      select: {
        id: true,
        name: true,
        skillLevel: true,
        speciality: true,
        feeUnpaidSince: true,
      },
    });

    const assignmentCounts = await countActiveAssignments(
      prisma,
      staff.map(groom => groom.id),
    );

    let totalWeeklyCost = 0;
    const breakdown = [];

    for (const groom of staff) {
      const assignedHorses = assignmentCounts.get(groom.id) ?? 0;
      const weeklyFee = calculateWeeklyFee(assignedHorses);
      totalWeeklyCost += weeklyFee;

      breakdown.push({
        groomId: groom.id,
        groomName: groom.name,
        skillLevel: groom.skillLevel,
        speciality: groom.speciality,
        assignedHorses,
        weeklyFee,
        feeUnpaid: groom.feeUnpaidSince !== null,
      });
    }

    return {
      totalWeeklyCost,
      groomCount: staff.length,
      // Equoria-95yrv: the RULE travels with the numbers, so a surface can explain
      // the fee ("70 per horse, up to 10 horses a groom") from the API rather than
      // restating a rate the frontend would have to keep in step by hand.
      feePerHorsePerWeek: FEE_PER_HORSE_PER_WEEK,
      maxHorsesPerGroom: MAX_HORSES_PER_GROOM,
      breakdown,
    };
  } catch (error) {
    logger.error(
      `[groomSalaryService] Error calculating salary cost for user ${userId}: ${error.message}`,
    );
    return {
      totalWeeklyCost: 0,
      groomCount: 0,
      feePerHorsePerWeek: FEE_PER_HORSE_PER_WEEK,
      maxHorsesPerGroom: MAX_HORSES_PER_GROOM,
      breakdown: [],
    };
  }
}

export default { getSalaryPaymentHistory, calculateUserSalaryCost };
