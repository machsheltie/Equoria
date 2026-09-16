/**
 * Enhanced Groom Assignment Service
 * Manages groom-horse assignments with limits, validation, and performance tracking
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import NotFoundError from '../../../errors/NotFoundError.mjs';
// Equoria-95yrv: the cap, the rate and the refusal wording are the fee's, so they
// are DEFINED with the fee and imported here. Two copies would drift.
import {
  FEE_PER_HORSE_PER_WEEK,
  MAX_HORSES_PER_GROOM,
  acquireGroomRosterLockTx,
  assertGroomHasRoomForAnotherHorse,
  atCapacityMessage,
} from './groomFeeBasisService.mjs';
// Equoria-95yrv fix round 1 (F1): the assignment is now a transaction, and a
// client-facing mutation's transient timeout must surface as a retryable 503.
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';

/**
 * Assignment configuration.
 *
 * Equoria-95yrv, owner ruling 2026-09-14 10:23: "$70 per horse per week, up to 10
 * horses per groom." ONE cap, the same for every groom, and it is the ruling's.
 *
 * WHAT WENT, AND WHY:
 *   - `MAX_ASSIGNMENTS_BY_SKILL` (2/3/4/5 by skill) contradicted the owner's
 *     ten-horse rule outright: no groom could reach ten, so the cap the fee is
 *     priced against was unreachable. Skill decides how WELL a groom works, not
 *     how many horses they may hold.
 *   - `WEEKLY_SALARY_BY_SKILL` (100/200/350/500) and `SALARY_MULTIPLIERS` were a
 *     second, never-charged pay table — nothing computed a fee from them; the real
 *     one lives in groomSalaryService, and it is now 70 per horse with no
 *     multipliers. A published rate nobody charges is a lie to whoever reads
 *     GET /api/groom-assignments/config.
 */
export const ASSIGNMENT_CONFIG = {
  // The most horses one groom may be working at a time.
  MAX_HORSES_PER_GROOM,

  // What each of those horses costs the player per week.
  FEE_PER_HORSE_PER_WEEK,
};

/**
 * Get assignment limits for a groom
 * @param {Object} groom - Groom object with skillLevel
 * @returns {Object} Assignment limits and current status
 */
export async function getGroomAssignmentLimits(groom) {
  // Equoria-95yrv: one cap for every groom, whatever their skill.
  const maxAssignments = MAX_HORSES_PER_GROOM;

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
}

/**
 * Validate assignment eligibility
 * @param {number} groomId - Groom ID
 * @param {number} horseId - Horse ID
 * @param {string} userId - User ID
 * @returns {Object} Validation result
 */
export async function validateAssignmentEligibility(groomId, horseId, userId) {
  // CWE-639: Single-query ownership-scoped fetch. WHERE includes userId so
  // not-found AND not-owned collapse to null — error message is identical
  // for both, attacker cannot enumerate IDs by error wording.
  const [groom, horse] = await Promise.all([
    prisma.groom.findFirst({
      where: { id: groomId, userId },
      select: {
        id: true,
        name: true,
        skillLevel: true,
        isActive: true,
        userId: true,
      },
    }),
    prisma.horse.findFirst({
      where: { id: horseId, userId },
      select: {
        id: true,
        name: true,
        userId: true,
      },
    }),
  ]);

  // Validation checks
  const errors = [];

  if (!groom) {
    errors.push('Groom not found');
  } else if (!groom.isActive) {
    errors.push('Groom is not active');
  }

  if (!horse) {
    errors.push('Horse not found');
  }

  // Check assignment limits
  if (groom && errors.length === 0) {
    const limits = await getGroomAssignmentLimits(groom);
    if (!limits.canTakeMore) {
      // Equoria-95yrv: said to the player, in the player's terms — horses, not
      // "assignments", and the number they can count on their own roster.
      errors.push(atCapacityMessage(groom.name));
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
  const { priority = 1, notes = null, replacePrimary = false } = options;

  // Validate assignment eligibility
  const validation = await validateAssignmentEligibility(groomId, horseId, userId);
  if (!validation.valid) {
    // CWE-639: horse not-found (or not-owned) → 404 to prevent ID enumeration
    if (!validation.horse) {
      throw new NotFoundError('Horse');
    }
    throw new Error(validation.errors.join(', '));
  }

  // Equoria-95yrv fix round 1 (F1) — THE CAP AND THE CREATE ARE ONE ACT.
  //
  // The eligibility read above still reports the cap, but it cannot ENFORCE it: it
  // is a count on the autocommit client whose answer is stale the moment it returns.
  // Two requests for a groom at nine horses both passed it and both created — eleven
  // active assignments, billed at 11 x 70 with no path back, because the over-cap
  // fee is deliberately unclamped.
  //
  // So the roster lock, the re-count and the create commit together. The lock is the
  // FIRST statement (see acquireGroomRosterLockTx for why a guarded
  // `INSERT ... SELECT ... WHERE (COUNT) < 10` does not hold under READ COMMITTED),
  // and the optional primary-assignment retirement joins them rather than standing
  // as its own uncommitted statement.
  const assignment = await withRetryableTxMapping(
    prisma.$transaction(async tx => {
      await acquireGroomRosterLockTx(tx, groomId);
      await assertGroomHasRoomForAnotherHorse(tx, groomId, validation.groom.name);

      // If this is a primary assignment (priority 1) and replacePrimary is true,
      // deactivate existing primary assignments for this horse
      if (priority === 1 && replacePrimary) {
        await tx.groomAssignment.updateMany({
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
      return tx.groomAssignment.create({
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
    }),
    { message: 'Could not assign the groom just now. Please try again.' },
  );

  logger.info(
    `[groomAssignmentService] Created assignment: ${validation.groom.name} -> ${validation.horse.name}`,
  );

  return {
    success: true,
    assignment,
    message: `${validation.groom.name} has been assigned to ${validation.horse.name}`,
  };
}

/**
 * Remove a groom assignment
 * @param {number} assignmentId - Assignment ID
 * @param {string} userId - User ID
 * @param {string} reason - Reason for removal
 * @returns {Object} Removal result
 */
export async function removeAssignment(assignmentId, userId, reason = 'Manual removal') {
  // Get assignment with related data
  const assignment = await prisma.groomAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      groom: {
        select: { id: true, name: true, userId: true },
      },
      foal: {
        select: { id: true, name: true, userId: true },
      },
    },
  });

  if (!assignment) {
    throw new Error('Assignment not found');
  }

  // CWE-639 hardening: ownership is enforced upstream by
  // requireOwnership('groom-assignment', { idParam: 'assignmentId' })
  // middleware in groomAssignmentRoutes.mjs:84, which returns 404 for
  // both not-found and not-owned (matching on GroomAssignment.userId).
  // The previous OR-check (groom.userId OR foal.userId) was a more
  // permissive contract that is unreachable for the removeAssignment
  // route — middleware would have already 404'd. Collapse to a
  // disclosure-resistant 'Assignment not found' instead of the leaky
  // 'You do not have permission' wording, in case middleware is ever
  // bypassed or this service grows another caller.
  if (assignment.groom.userId !== userId && assignment.foal.userId !== userId) {
    throw new Error('Assignment not found');
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

  logger.info(
    `[groomAssignmentService] Removed assignment: ${assignment.groom.name} -> ${assignment.foal.name}`,
  );

  return {
    success: true,
    assignment: updatedAssignment,
    message: `${assignment.groom.name} has been unassigned from ${assignment.foal.name}`,
  };
}

/**
 * Get all assignments for a user
 * @param {string} userId - User ID
 * @param {Object} filters - Filter options
 * @returns {Object} Assignments data
 */
export async function getUserAssignments(userId, filters = {}) {
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
    orderBy: [{ isActive: 'desc' }, { priority: 'asc' }, { createdAt: 'desc' }],
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
    averageAssignmentsPerGroom:
      Object.keys(assignmentsByGroom).length > 0
        ? assignments.filter(a => a.isActive).length / Object.keys(assignmentsByGroom).length
        : 0,
  };

  return {
    assignments,
    assignmentsByGroom,
    stats,
  };
}

/**
 * Calculate weekly fee costs for all of a user's groom assignments.
 *
 * Equoria-95yrv: $70 per horse per week. The old shape multiplied a per-skill base
 * salary (100/200/350/500) by an assignment-count "efficiency" multiplier — a pay
 * table nothing ever charged, sitting on the assignment dashboard next to the real
 * fee. Both keys are kept (`baseSalary` is now the per-horse rate, `totalSalary`
 * the groom's fee) so the dashboard reader is unchanged; the numbers are the ones
 * the player is actually billed.
 *
 * @param {string} userId - User ID
 * @returns {Object} Fee calculation
 */
export async function calculateWeeklySalaryCosts(userId) {
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
        baseSalary: FEE_PER_HORSE_PER_WEEK,
        totalSalary: 0,
      };
    }
    groomCosts[groomId].assignmentCount++;
  });

  // Equoria-95yrv: 70 per horse, no multipliers.
  Object.values(groomCosts).forEach(groomCost => {
    groomCost.totalSalary = groomCost.assignmentCount * FEE_PER_HORSE_PER_WEEK;
    totalWeeklyCost += groomCost.totalSalary;
  });

  return {
    totalWeeklyCost,
    groomCosts: Object.values(groomCosts),
    assignmentCount: assignments.length,
    groomCount: Object.keys(groomCosts).length,
  };
}

/**
 * Aggregate raw assignment statistics for the GET /api/groom-assignments/statistics
 * endpoint. Returns three parallel datasets:
 *   - totalAssignments: count of all-time assignments for this user
 *   - recentAssignments: count of assignments created within `startDate..now`
 *   - assignmentHistory: rows in the same window with the columns the caller
 *     reduces over (skill-level / speciality distributions, active/completed
 *     counts).
 *
 * Extracted from groomAssignmentRoutes.mjs so the routes layer no longer
 * imports prisma directly (Equoria-becrm).
 *
 * @param {number|string} userId - owning user id
 * @param {Date} startDate - lower bound for createdAt (inclusive)
 * @returns {Promise<{ totalAssignments: number, recentAssignments: number, assignmentHistory: Array<object> }>}
 */
export async function getAssignmentStatisticsRaw(userId, startDate) {
  const [totalAssignments, recentAssignments, assignmentHistory] = await Promise.all([
    prisma.groomAssignment.count({
      where: { userId },
    }),
    prisma.groomAssignment.count({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
    }),
    prisma.groomAssignment.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        createdAt: true,
        endDate: true,
        isActive: true,
        priority: true,
        groom: {
          select: {
            skillLevel: true,
            speciality: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return { totalAssignments, recentAssignments, assignmentHistory };
}
