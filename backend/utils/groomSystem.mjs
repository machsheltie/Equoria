/**
 * Groom Management System
 * Groom constants and assignment helpers. Bond is changed only by groomCareService (+5 per daily groom, cap 100).
 */

import prisma from '../../packages/database/prismaClient.mjs';
import logger from './logger.mjs';
import { ELIGIBLE_FOAL_ENRICHMENT_TASKS, FOAL_GROOMING_TASKS } from '../config/groomConfig.mjs';
// Equoria-95yrv fix round 1 (F1): the foal-assignment door moved to its own module
// when it became transactional — see that file's header. Re-exported here so every
// importer (the handlers, foalController, the suites) is unchanged.
export {
  assignGroomToFoal,
  ensureDefaultGroomAssignment,
} from '../modules/grooms/services/groomFoalAssignmentService.mjs';

/**
 * Groom specialties and their bonding modifiers
 */
export const GROOM_SPECIALTIES = {
  foalCare: {
    name: 'Foal Care Specialist',
    description: 'Specialized in caring for young horses',
    bondingModifier: 1.5,
    preferredActivities: ['dailyCare', 'feeding', 'grooming'],
  },
  general: {
    name: 'General Caretaker',
    description: 'well-rounded horse care experience',
    bondingModifier: 1.0,
    preferredActivities: ['dailyCare', 'grooming', 'exercise'],
  },
  training: {
    name: 'Training Assistant',
    description: 'Focused on training and exercise',
    bondingModifier: 1.2,
    preferredActivities: ['exercise', 'training', 'dailyCare'],
  },
  medical: {
    name: 'Veterinary Assistant',
    description: 'Medical care and health monitoring',
    bondingModifier: 0.9,
    preferredActivities: ['medicalCheck', 'dailyCare', 'feeding'],
  },
};

/**
 * Skill level modifiers for bonding and cost
 */
export const SKILL_LEVELS = {
  novice: {
    name: 'Novice',
    bondingModifier: 0.8,
    costModifier: 0.7,
    errorChance: 0.15,
    description: 'New to horse care',
  },
  intermediate: {
    name: 'Intermediate',
    bondingModifier: 1.0,
    costModifier: 1.0,
    errorChance: 0.08,
    description: 'Experienced caretaker',
  },
  expert: {
    name: 'Expert',
    bondingModifier: 1.3,
    costModifier: 1.5,
    errorChance: 0.03,
    description: 'Highly skilled professional',
  },
  master: {
    name: 'Master',
    bondingModifier: 1.6,
    costModifier: 2.0,
    errorChance: 0.01,
    description: 'Elite horse care specialist',
  },
};

/**
 * Personality traits and their effects
 */
export const PERSONALITY_TRAITS = {
  gentle: {
    name: 'Gentle',
    bondingModifier: 1.2,
    description: 'Calm and patient approach',
  },
  energetic: {
    name: 'Energetic',
    bondingModifier: 1.1,
    description: 'Active and enthusiastic',
  },
  patient: {
    name: 'Patient',
    bondingModifier: 1.3,
    description: 'Takes time with each horse',
  },
  strict: {
    name: 'Strict',
    bondingModifier: 0.9,
    description: 'Disciplined and structured',
  },
};

/**
 * Default groom profiles for automatic assignment
 */
export const DEFAULT_GROOMS = [
  {
    name: 'Sarah Johnson',
    speciality: 'foalCare',
    experience: 5,
    skillLevel: 'intermediate',
    personality: 'gentle',
    sessionRate: 18.0,
    bio: 'Experienced foal care specialist with a gentle touch.',
    availability: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: false,
    },
  },
  {
    name: 'Mike Rodriguez',
    speciality: 'general',
    experience: 8,
    skillLevel: 'expert',
    personality: 'patient',
    sessionRate: 25.0,
    bio: 'Veteran horse caretaker with extensive experience.',
    availability: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: true,
    },
  },
  {
    name: 'Emma Thompson',
    speciality: 'training',
    experience: 3,
    skillLevel: 'intermediate',
    personality: 'energetic',
    sessionRate: 20.0,
    bio: 'Young trainer focused on exercise and development.',
    availability: {
      monday: true,
      tuesday: true,
      wednesday: false,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: true,
    },
  },
];

/**
 * Get or create a default groom for a user
 * @deprecated This function is disabled to increase player engagement. Players must manually hire grooms.
 * @param {string} userId - ID of the user
 * @returns {Object} Groom object
 */
export async function getOrCreateDefaultGroom(userId) {
  logger.warn(
    `[groomSystem.getOrCreateDefaultGroom] DEPRECATED: Auto-creation disabled for user ${userId}. Players must manually hire grooms.`,
  );

  // Check if user already has grooms
  const existingGroom = await prisma.groom.findFirst({
    where: {
      userId,
      isActive: true,
      speciality: 'foalCare',
    },
  });

  if (existingGroom) {
    return existingGroom;
  }

  // No auto-creation - throw error to force manual hiring
  throw new Error(
    'No foal care groom found for user. Please hire a groom manually through the hiring system to increase player engagement.',
  );
}

/**
 * Check if a foal has already completed a foal-specific task today
 * Enforces daily task exclusivity - foals can only complete one task per day from either category
 * @param {Object} foal - Foal object with dailyTaskRecord
 * @param {string} today - Today's date string (YYYY-MM-DD format)
 * @returns {boolean} True if foal has completed any enrichment or grooming task today
 */
export function hasAlreadyCompletedFoalTaskToday(foal, today) {
  try {
    // Handle edge cases
    if (!foal || !today || typeof today !== 'string' || today.trim() === '') {
      return false;
    }

    // Check if foal has a daily task record
    if (!foal.dailyTaskRecord || typeof foal.dailyTaskRecord !== 'object') {
      return false;
    }

    // Get today's task log
    const todayLog = foal.dailyTaskRecord[today];

    // If no tasks recorded for today, return false
    if (!todayLog || !Array.isArray(todayLog) || todayLog.length === 0) {
      return false;
    }

    // Check if any task in today's log is a foal-specific task
    return todayLog.some(
      task => ELIGIBLE_FOAL_ENRICHMENT_TASKS.includes(task) || FOAL_GROOMING_TASKS.includes(task),
    );
  } catch (error) {
    logger.error(`[groomSystem.hasAlreadyCompletedFoalTaskToday] Error: ${error.message}`);
    return false; // Fail safe - allow interaction if there's an error
  }
}
