/**
 * Enhanced Groom Assignment Service
 * Manages groom-horse assignments with limits, validation, and performance tracking
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

// Assignment configuration
export const ASSIGNMENT_CONFIG = {
  // Maximum assignments per groom based on skill level
  MAX_ASSIGNMENTS_BY_SKILL: {
    novice: 2,
    intermediate: 3,
    expert: 4,
    master: 5,
  },

  // Base weekly salary by skill level (in currency units)
  WEEKLY_SALARY_BY_SKILL: {
    novice: 100,
    intermediate: 200,
    expert: 350,
    master: 500,
  },

  // Salary multipliers based on assignment count
  SALARY_MULTIPLIERS: {
    1: 1.0,    // Base rate for 1 assignment
    2: 1.8,    // 80% of base rate per assignment for 2 assignments
    3: 2.4,    // 80% of base rate per assignment for 3 assignments
    4: 2.8,    // 70% of base rate per assignment for 4 assignments
    5: 3.0,     // 60% of base rate per assignment for 5 assignments
  },
};

/**
 * Get assignment limits for a groom
 * @param {Object} groom - Groom object with skillLevel
 * @returns {Object} Assignment limits and current status
 */
export async function getGroomAssignmentLimits(groom) {
  try {
    const maxAssignments = ASSIGNMENT_CONFIG.MAX_ASSIGNMENTS_BY_SKILL[groom.skillLevel] || 2;

    // Count current active assignments
    const currentAssignments = await prisma.groomAssignment.count({
      where: {
        groomId: groom.id,
        isActive: true,
      },
    });

    return {
      maxAssignments,
      currentAssignments,
      availableSlots: maxAssignments - currentAssignments,
      canTakeMore: currentAssignments < maxAssignments,
    };

  } catch (error) {
    logger.error(`[groomAssignmentService] Error getting assignment limits: ${error.message}`);
    throw error;
  }
}

/**
 * Validate assignment eligibility
 * @param {number} groomId - Groom ID
 * @param {number} horseId - Horse ID
 * @param {string} userId - User ID
 * @returns {Object} Validation result
 */
export async function validateAssignmentEligibility(groomId, horseId, userId) {
  try {
    // Get groom and horse data
    const [groom, horse] = await Promise.all([
      prisma.groom.findUnique({
        where: { id: groomId },
        select: {
          id: true,
          name: true,
          skillLevel: true,
          isActive: true,
          userId: true,
        },
      }),
      prisma.horse.findUnique({
        where: { id: horseId },
        select: {
          id: true,
          name: true,
          ownerId: true,
        },
      }),
    ]);

    // Validation checks
    const errors = [];

    if (!groom) {
      errors.push('Groom not found');
    } else {
      if (groom.userId !== userId) {
        errors.push('You do not own this groom');
      }
      if (!groom.isActive) {
        errors.push('Groom is not active');
      }
    }

    if (!horse) {
      errors.push('Horse not found');
    } else if (horse.ownerId !== userId) {
      errors.push('You do not own this horse');
    }

    // Check assignment limits
    if (groom && errors.length === 0) {
      const limits = await getGroomAssignmentLimits(groom);
      if (!limits.canTakeMore) {
        errors.push(`Groom ${groom.name} has reached maximum assignments (${limits.maxAssignments})`);
      }
    }

    // Check for existing assignment
    if (groom && horse && errors.length === 0) {
      const existingAssignment = await prisma.groomAssignment.findFirst({
        where: {
          groomId,
          foalId: horseId,
          isActive: true,
        },
      });

      if (existingAssignment) {
        errors.push('Groom is already assigned to this horse');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      groom,
      horse,
    };

  } catch (error) {
    logger.error(`[groomAssignmentService] Error validating assignment: ${error.message}`);
    throw error;
  }
}

/**
 * Create a new groom assignment
 * @param {number} groomId - Groom ID
 * @param {number} horseId - Horse ID
 * @param {string} userId - User ID
 * @param {Object} options - Assignment options
 * @returns {Object} Assignment result
 */
export async function createAssignment(groomId, horseId, userId, options = {}) {
  try {
    const { priority = 1, notes = null, replacePrimary = false } = options;

    // Validate assignment eligibility
    const validation = await validateAssignmentEligibility(groomId, horseId, userId);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    // If this is a primary assignment (priority 1) and replacePrimary is true,
    // deactivate existing primary assignments for this horse
    if (priority === 1 && replacePrimary) {
      await prisma.groomAssignment.updateMany({
        where: {
          foalId: horseId,
          priority: 1,
          isActive: true,
        },
        data: {
          isActive: false,
          endDate: new Date(),
        },
      });
    }

    // Create the assignment
    const assignment = await prisma.groomAssignment.create({
      data: {
        groomId,
        foalId: horseId,
        userId,
        priority,
        notes,
        isActive: true,
      },
      include: {
        groom: {
          select: {
            id: true,
            name: true,
            skillLevel: true,
            speciality: true,
            personality: true,
          },
        },
        foal: {
          select: {
            id: true,
            name: true,
            bondScore: true,
            stressLevel: true,
          },
        },
      },
    });

    logger.info(`[groomAssignmentService] Created assignment: ${validation.groom.name} -> ${validation.horse.name}`);

    return {
      success: true,
      assignment,
      message: `${validation.groom.name} has been assigned to ${validation.horse.name}`,
    };

  } catch (error) {
    logger.error(`[groomAssignmentService] Error creating assignment: ${error.message}`);
    throw error;
  }
}

/**
 * Remove a groom assignment
 * @param {number} assignmentId - Assignment ID
 * @param {string} userId - User ID
 * @param {string} reason - Reason for removal
 * @returns {Object} Removal result
 */
export async function removeAssignment(assignmentId, userId, reason = 'Manual removal') {
  try {
    // Get assignment with related data
    const assignment = await prisma.groomAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        groom: {
          select: { id: true, name: true, userId: true },
        },
        foal: {
          select: { id: true, name: true, ownerId: true },
        },
      },
    });

    if (!assignment) {
      throw new Error('Assignment not found');
    }

    // Validate ownership
    if (assignment.groom.userId !== userId && assignment.foal.ownerId !== userId) {
      throw new Error('You do not have permission to remove this assignment');
    }

    if (!assignment.isActive) {
      throw new Error('Assignment is already inactive');
    }

    // Deactivate the assignment
    const updatedAssignment = await prisma.groomAssignment.update({
      where: { id: assignmentId },
      data: {
        isActive: false,
        endDate: new Date(),
        notes: assignment.notes ? `${assignment.notes} | Removed: ${reason}` : `Removed: ${reason}`,
      },
      include: {
        groom: {
          select: { id: true, name: true },
        },
        foal: {
          select: { id: true, name: true },
        },
      },
    });

    logger.info(`[groomAssignmentService] Removed assignment: ${assignment.groom.name} -> ${assignment.foal.name}`);

    return {
      success: true,
      assignment: updatedAssignment,
      message: `${assignment.groom.name} has been unassigned from ${assignment.foal.name}`,
    };

  } catch (error) {
    logger.error(`[groomAssignmentService] Error removing assignment: ${error.message}`);
    throw error;
  }
}

/**
 * Get all assignments for a user
 * @param {string} userId - User ID
 * @param {Object} filters - Filter options
 * @returns {Object} Assignments data
 */
export async function getUserAssignments(userId, filters = {}) {
  try {
    const { includeInactive = false, groomId = null, horseId = null } = filters;

    const whereClause = {
      userId,
      ...(groomId && { groomId }),
      ...(horseId && { foalId: horseId }),
      ...(includeInactive ? {} : { isActive: true }),
    };

    const assignments = await prisma.groomAssignment.findMany({
      where: whereClause,
      include: {
        groom: {
          select: {
            id: true,
            name: true,
            skillLevel: true,
            speciality: true,
            personality: true,
            sessionRate: true,
          },
        },
        foal: {
          select: {
            id: true,
            name: true,
            bondScore: true,
            stressLevel: true,
            dateOfBirth: true,
          },
        },
      },
      orderBy: [
        { isActive: 'desc' },
        { priority: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // Group assignments by groom
    const assignmentsByGroom = assignments.reduce((acc, assignment) => {
      const groomId = assignment.groom.id;
      if (!acc[groomId]) {
        acc[groomId] = {
          groom: assignment.groom,
          assignments: [],
        };
      }
      acc[groomId].assignments.push(assignment);
      return acc;
    }, {});

    // Calculate statistics
    const stats = {
      totalAssignments: assignments.length,
      activeAssignments: assignments.filter(a => a.isActive).length,
      groomsWithAssignments: Object.keys(assignmentsByGroom).length,
      averageAssignmentsPerGroom: Object.keys(assignmentsByGroom).length > 0
        ? assignments.filter(a => a.isActive).length / Object.keys(assignmentsByGroom).length
        : 0,
    };

    return {
      assignments,
      assignmentsByGroom,
      stats,
    };

  } catch (error) {
    logger.error(`[groomAssignmentService] Error getting user assignments: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate weekly salary costs for all groom assignments
 * @param {string} userId - User ID
 * @returns {Object} Salary calculation
 */
export async function calculateWeeklySalaryCosts(userId) {
  try {
    // Get all active assignments with groom data
    const assignments = await prisma.groomAssignment.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
        groom: {
          select: {
            id: true,
            name: true,
            skillLevel: true,
          },
        },
      },
    });

    // Group by groom and calculate costs
    const groomCosts = {};
    let totalWeeklyCost = 0;

    assignments.forEach(assignment => {
      const groomId = assignment.groom.id;
      if (!groomCosts[groomId]) {
        groomCosts[groomId] = {
          groom: assignment.groom,
          assignmentCount: 0,
          baseSalary: ASSIGNMENT_CONFIG.WEEKLY_SALARY_BY_SKILL[assignment.groom.skillLevel] || 100,
          totalSalary: 0,
        };
      }
      groomCosts[groomId].assignmentCount++;
    });

    // Calculate final salaries with multipliers
    Object.values(groomCosts).forEach(groomCost => {
      const multiplier = ASSIGNMENT_CONFIG.SALARY_MULTIPLIERS[groomCost.assignmentCount] || 1.0;
      groomCost.totalSalary = Math.round(groomCost.baseSalary * multiplier);
      totalWeeklyCost += groomCost.totalSalary;
    });

    return {
      totalWeeklyCost,
      groomCosts: Object.values(groomCosts),
      assignmentCount: assignments.length,
      groomCount: Object.keys(groomCosts).length,
    };

  } catch (error) {
    logger.error(`[groomAssignmentService] Error calculating salary costs: ${error.message}`);
    throw error;
  }
}
