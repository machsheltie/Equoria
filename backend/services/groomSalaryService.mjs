/**
 * Groom Salary Service
 * 
 * Handles weekly salary deductions for hired grooms
 * Implements automatic salary processing and payment tracking
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

// Salary configuration
export const SALARY_CONFIG = {
  // Base weekly salaries by skill level
  WEEKLY_SALARIES: {
    novice: 50,      // $50/week
    intermediate: 75, // $75/week
    expert: 100,     // $100/week
    master: 150      // $150/week
  },

  // Specialty bonuses (added to base salary)
  SPECIALTY_BONUSES: {
    foalCare: 10,        // +$10/week for foal care specialty
    showHandling: 15,    // +$15/week for show handling specialty
    general: 0           // No bonus for general grooms
  },

  // Payment processing day (0 = Sunday, 1 = Monday, etc.)
  PAYMENT_DAY: 1, // Monday

  // Grace period before termination (days)
  GRACE_PERIOD_DAYS: 7,

  // Minimum balance required to keep grooms
  MINIMUM_BALANCE: 0
};

/**
 * Calculate weekly salary for a groom
 * @param {Object} groom - Groom object with skillLevel and speciality
 * @returns {number} Weekly salary amount
 */
export function calculateWeeklySalary(groom) {
  try {
    const baseSalary = SALARY_CONFIG.WEEKLY_SALARIES[groom.skillLevel] || SALARY_CONFIG.WEEKLY_SALARIES.novice;
    const specialtyBonus = SALARY_CONFIG.SPECIALTY_BONUSES[groom.speciality] || 0;
    
    return baseSalary + specialtyBonus;
  } catch (error) {
    logger.error(`[groomSalaryService] Error calculating salary for groom ${groom.id}: ${error.message}`);
    return SALARY_CONFIG.WEEKLY_SALARIES.novice; // Default to novice salary
  }
}

/**
 * Process weekly salary payments for all active grooms
 * @returns {Object} Processing results
 */
export async function processWeeklySalaries() {
  try {
    logger.info('[groomSalaryService] Starting weekly salary processing...');

    // Get all active groom assignments
    const activeAssignments = await prisma.groomAssignment.findMany({
      where: {
        isActive: true
      },
      include: {
        groom: true,
        user: true
      }
    });

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      terminated: 0,
      totalAmount: 0,
      errors: []
    };

    // Group assignments by user to batch process payments
    const userGroups = {};
    for (const assignment of activeAssignments) {
      const userId = assignment.userId;
      if (!userGroups[userId]) {
        userGroups[userId] = {
          user: assignment.user,
          assignments: [],
          totalSalary: 0
        };
      }
      
      const salary = calculateWeeklySalary(assignment.groom);
      userGroups[userId].assignments.push({
        assignment,
        groom: assignment.groom,
        salary
      });
      userGroups[userId].totalSalary += salary;
    }

    // Process payments for each user
    for (const [userId, userGroup] of Object.entries(userGroups)) {
      try {
        results.processed++;

        // Check if user has sufficient funds
        const user = userGroup.user;
        if (user.money < userGroup.totalSalary) {
          // Insufficient funds - start grace period or terminate
          await handleInsufficientFunds(userId, userGroup);
          results.failed++;
          results.errors.push(`User ${user.username} has insufficient funds for groom salaries`);
          continue;
        }

        // Deduct total salary from user's money
        await prisma.user.update({
          where: { id: userId },
          data: {
            money: {
              decrement: userGroup.totalSalary
            }
          }
        });

        // Log individual salary payments
        for (const { assignment, groom, salary } of userGroup.assignments) {
          await prisma.groomSalaryPayment.create({
            data: {
              groomId: groom.id,
              userId: userId,
              amount: salary,
              paymentDate: new Date(),
              paymentType: 'weekly_salary',
              status: 'paid'
            }
          });

          logger.info(`[groomSalaryService] Paid $${salary} salary to groom ${groom.name} for user ${user.username}`);
        }

        results.successful++;
        results.totalAmount += userGroup.totalSalary;

        logger.info(`[groomSalaryService] Processed $${userGroup.totalSalary} in salaries for user ${user.username}`);

      } catch (error) {
        results.failed++;
        results.errors.push(`Error processing salaries for user ${userId}: ${error.message}`);
        logger.error(`[groomSalaryService] Error processing salaries for user ${userId}: ${error.message}`);
      }
    }

    logger.info(`[groomSalaryService] Weekly salary processing complete. Processed: ${results.processed}, Successful: ${results.successful}, Failed: ${results.failed}, Total: $${results.totalAmount}`);

    return results;

  } catch (error) {
    logger.error(`[groomSalaryService] Error in weekly salary processing: ${error.message}`);
    return {
      processed: 0,
      successful: 0,
      failed: 0,
      terminated: 0,
      totalAmount: 0,
      errors: [error.message]
    };
  }
}

/**
 * Handle insufficient funds for groom salaries
 * @param {string} userId - User ID
 * @param {Object} userGroup - User group with assignments and total salary
 */
async function handleInsufficientFunds(userId, userGroup) {
  try {
    // Check if user is already in grace period
    const user = userGroup.user;
    const gracePeriodStart = user.groomSalaryGracePeriod;

    if (!gracePeriodStart) {
      // Start grace period
      await prisma.user.update({
        where: { id: userId },
        data: {
          groomSalaryGracePeriod: new Date()
        }
      });

      logger.warn(`[groomSalaryService] Started grace period for user ${user.username} - insufficient funds for groom salaries`);

      // Log missed payment
      for (const { groom, salary } of userGroup.assignments) {
        await prisma.groomSalaryPayment.create({
          data: {
            groomId: groom.id,
            userId: userId,
            amount: salary,
            paymentDate: new Date(),
            paymentType: 'weekly_salary',
            status: 'missed_insufficient_funds'
          }
        });
      }

    } else {
      // Check if grace period has expired
      const gracePeriodEnd = new Date(gracePeriodStart);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + SALARY_CONFIG.GRACE_PERIOD_DAYS);

      if (new Date() > gracePeriodEnd) {
        // Grace period expired - terminate all groom assignments
        await terminateGroomsForNonPayment(userId, userGroup);
        logger.warn(`[groomSalaryService] Terminated all grooms for user ${user.username} - grace period expired`);
      } else {
        // Still in grace period
        logger.warn(`[groomSalaryService] User ${user.username} still in grace period for groom salary payments`);
        
        // Log missed payment
        for (const { groom, salary } of userGroup.assignments) {
          await prisma.groomSalaryPayment.create({
            data: {
              groomId: groom.id,
              userId: userId,
              amount: salary,
              paymentDate: new Date(),
              paymentType: 'weekly_salary',
              status: 'missed_grace_period'
            }
          });
        }
      }
    }

  } catch (error) {
    logger.error(`[groomSalaryService] Error handling insufficient funds for user ${userId}: ${error.message}`);
  }
}

/**
 * Terminate all groom assignments for a user due to non-payment
 * @param {string} userId - User ID
 * @param {Object} userGroup - User group with assignments
 */
async function terminateGroomsForNonPayment(userId, userGroup) {
  try {
    // Deactivate all groom assignments
    await prisma.groomAssignment.updateMany({
      where: {
        userId: userId,
        isActive: true
      },
      data: {
        isActive: false,
        endDate: new Date(),
        terminationReason: 'non_payment'
      }
    });

    // Clear grace period
    await prisma.user.update({
      where: { id: userId },
      data: {
        groomSalaryGracePeriod: null
      }
    });

    // Log termination payments
    for (const { groom, salary } of userGroup.assignments) {
      await prisma.groomSalaryPayment.create({
        data: {
          groomId: groom.id,
          userId: userId,
          amount: salary,
          paymentDate: new Date(),
          paymentType: 'weekly_salary',
          status: 'terminated_non_payment'
        }
      });
    }

    logger.info(`[groomSalaryService] Terminated ${userGroup.assignments.length} groom assignments for user ${userId} due to non-payment`);

  } catch (error) {
    logger.error(`[groomSalaryService] Error terminating grooms for user ${userId}: ${error.message}`);
  }
}

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
        userId: userId
      },
      include: {
        groom: {
          select: {
            id: true,
            name: true,
            skillLevel: true,
            speciality: true
          }
        }
      },
      orderBy: {
        paymentDate: 'desc'
      },
      take: limit
    });

    return payments;

  } catch (error) {
    logger.error(`[groomSalaryService] Error getting salary payment history for user ${userId}: ${error.message}`);
    return [];
  }
}

/**
 * Calculate total weekly salary cost for a user
 * @param {string} userId - User ID
 * @returns {Object} Salary cost breakdown
 */
export async function calculateUserSalaryCost(userId) {
  try {
    const activeAssignments = await prisma.groomAssignment.findMany({
      where: {
        userId: userId,
        isActive: true
      },
      include: {
        groom: true
      }
    });

    let totalWeeklyCost = 0;
    const breakdown = [];

    for (const assignment of activeAssignments) {
      const salary = calculateWeeklySalary(assignment.groom);
      totalWeeklyCost += salary;
      
      breakdown.push({
        groomId: assignment.groom.id,
        groomName: assignment.groom.name,
        skillLevel: assignment.groom.skillLevel,
        speciality: assignment.groom.speciality,
        weeklySalary: salary
      });
    }

    return {
      totalWeeklyCost,
      groomCount: activeAssignments.length,
      breakdown
    };

  } catch (error) {
    logger.error(`[groomSalaryService] Error calculating salary cost for user ${userId}: ${error.message}`);
    return {
      totalWeeklyCost: 0,
      groomCount: 0,
      breakdown: []
    };
  }
}
