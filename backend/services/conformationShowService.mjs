/**
 * Conformation Show Service
 * 
 * Handles conformation-based competitions where grooms act as handlers
 * This is a SEPARATE competition system from performance disciplines
 * 
 * Scoring breakdown per conformationshows.md:
 * - 60-70% conformation stats
 * - 15-25% groom's show handling skill
 * - 5-10% bond score with groom
 * - 5-10% temperament synergy
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';
import { CONFORMATION_CLASSES } from '../constants/schema.mjs';

// Conformation show configuration per specification
export const CONFORMATION_SHOW_CONFIG = {
  // Scoring weights (per conformationshows.md)
  CONFORMATION_WEIGHT: 0.65,  // 65% - horse's physical conformation (60-70% range)
  HANDLER_WEIGHT: 0.20,       // 20% - groom's show handling skill (15-25% range)
  BOND_WEIGHT: 0.08,          // 8% - bond score with groom (5-10% range)
  TEMPERAMENT_WEIGHT: 0.07,   // 7% - temperament synergy (5-10% range)

  // Minimum days groom must be assigned before show
  MIN_GROOM_ASSIGNMENT_DAYS: 2,

  // Age requirements
  MIN_AGE: 1, // 1 year old minimum
  MAX_AGE: 999 // No maximum age
};

/**
 * Check if a class name is a valid conformation show class
 * @param {string} className - Class name to check
 * @returns {boolean} True if valid conformation class
 */
export function isValidConformationClass(className) {
  return Object.values(CONFORMATION_CLASSES).includes(className);
}

/**
 * Validate conformation show entry requirements
 * @param {Object} horse - Horse object
 * @param {Object} groom - Groom handler object
 * @param {string} className - Conformation class name
 * @param {string} userId - User ID
 * @returns {Object} Validation result
 */
export async function validateConformationEntry(horse, groom, className, userId) {
  try {
    const errors = [];
    const warnings = [];

    // Check if class is valid conformation show
    if (!isValidConformationClass(className)) {
      errors.push(`${className} is not a valid conformation show class`);
    }

    // Check horse ownership
    if (horse.ownerId !== userId) {
      errors.push('You do not own this horse');
    }

    // Check groom ownership and assignment
    if (groom.userId !== userId) {
      errors.push('You do not own this groom');
    }

    // Check if groom is assigned to horse
    const assignment = await prisma.groomAssignment.findFirst({
      where: {
        groomId: groom.id,
        foalId: horse.id,
        userId,
        isActive: true
      }
    });

    if (!assignment) {
      errors.push('Groom must be assigned to this horse before entering conformation shows');
    } else {
      // Check assignment duration (must be assigned at least 2 days before)
      const assignmentDate = new Date(assignment.createdAt);
      const daysSinceAssignment = (Date.now() - assignmentDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceAssignment < CONFORMATION_SHOW_CONFIG.MIN_GROOM_ASSIGNMENT_DAYS) {
        errors.push(`Groom must be assigned to horse for at least ${CONFORMATION_SHOW_CONFIG.MIN_GROOM_ASSIGNMENT_DAYS} days before show entry`);
      }
    }

    // Check horse age (conformation shows for 1+ years)
    const age = horse.age || 0;
    if (age < CONFORMATION_SHOW_CONFIG.MIN_AGE) {
      errors.push(`Horse must be at least ${CONFORMATION_SHOW_CONFIG.MIN_AGE} year old for conformation shows`);
    }

    // Check horse health requirements
    if (horse.health !== 'Excellent' && horse.health !== 'Good') {
      errors.push('Horse must be healthy (weekly vet requirement met)');
    }

    // Check for injuries or burnout
    if (horse.stressLevel && horse.stressLevel > 80) {
      warnings.push('Horse has high stress levels - may affect performance');
    }

    // Check conformation scores exist
    if (!horse.conformationScores) {
      warnings.push('Horse has no conformation scores - default scores will be used');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      assignment
    };

  } catch (error) {
    logger.error(`[conformationShowService] Error validating conformation entry: ${error.message}`);
    return {
      valid: false,
      errors: ['Validation error occurred'],
      warnings: [],
      assignment: null
    };
  }
}
