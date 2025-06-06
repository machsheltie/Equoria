import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

/**
 * Get foal development data including current status and activity history
 * @param {number} foalId - ID of the foal
 * @returns {Object} - Foal development data with current status and activity log
 * @throws {Error} - If validation fails or database error occurs
 */
async function getFoalDevelopment(foalId) {
  try {
    // Validate foalId
    const parsedFoalId = parseInt(foalId, 10);
    if (isNaN(parsedFoalId) || parsedFoalId <= 0) {
      throw new Error('Foal ID must be a positive integer');
    }

    logger.info(`[foalModel.getFoalDevelopment] Getting development data for foal ${parsedFoalId}`);

    // Get foal basic info
    const foal = await prisma.horse.findUnique({
      where: { id: parsedFoalId },
      include: {
        breed: true,
        user: true,
        stable: true,
      },
    });

    if (!foal) {
      throw new Error('Foal not found');
    }

    // Check if this is actually a foal (age 0 or very young)
    if (foal.age > 1) {
      throw new Error('Horse is not a foal (must be 1 year old or younger)');
    }

    // Get foal development record or create default
    let development = await prisma.foalDevelopment.findUnique({
      where: { foalId: parsedFoalId },
    });

    if (!development) {
      // Create default development record for new foal
      development = await prisma.foalDevelopment.create({
        data: {
          foalId: parsedFoalId,
          currentDay: 0,
          bondingLevel: 50,
          stressLevel: 20,
          completedActivities: {},
        },
      });
    }

    // Get activity history
    const activityHistory = await prisma.foalActivity.findMany({
      where: { foalId: parsedFoalId },
      orderBy: { createdAt: 'desc' },
      take: 20, // Last 20 activities
    });

    logger.info(
      `[foalModel.getFoalDevelopment] Retrieved development data for foal ${parsedFoalId}`,
    );

    return {
      foal: {
        id: foal.id,
        name: foal.name,
        age: foal.age,
        breed: foal.breed?.name || 'Unknown',
        owner: foal.user?.firstName || 'Unknown',
      },
      development: {
        currentDay: development.currentDay,
        bondingLevel: development.bondingLevel,
        stressLevel: development.stressLevel,
        completedActivities: development.completedActivities || {},
        maxDay: 6, // Foal development period is 7 days (0-6)
      },
      activityHistory: activityHistory.map(activity => ({
        id: activity.id,
        day: activity.day,
        activityType: activity.activityType,
        outcome: activity.outcome,
        bondingChange: activity.bondingChange,
        stressChange: activity.stressChange,
        description: activity.description,
        timestamp: activity.createdAt,
      })),
      availableActivities: getAvailableActivities(
        development.currentDay,
        development.completedActivities || {},
      ),
    };
  } catch (error) {
    logger.error(`[foalModel.getFoalDevelopment] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Complete a foal enrichment activity (new API for Task 5)
 * @param {number} foalId - ID of the foal
 * @param {number} day - Development day (0-6)
 * @param {string} activity - Activity name/type
 * @returns {Object} - Updated bonding and stress levels
 * @throws {Error} - If validation fails or activity not appropriate
 */
async function completeEnrichmentActivity(foalId, day, activity) {
  try {
    // Validate inputs
    const parsedFoalId = parseInt(foalId, 10);
    if (isNaN(parsedFoalId) || parsedFoalId <= 0) {
      throw new Error('Foal ID must be a positive integer');
    }

    const parsedDay = parseInt(day, 10);
    if (isNaN(parsedDay) || parsedDay < 0 || parsedDay > 6) {
      throw new Error('Day must be between 0 and 6');
    }

    if (!activity || typeof activity !== 'string') {
      throw new Error('Activity is required and must be a string');
    }

    logger.info(
      `[foalModel.completeEnrichmentActivity] Processing enrichment activity "${activity}" for foal ${parsedFoalId} on day ${parsedDay}`,
    );

    // Get foal and verify it exists
    const foal = await prisma.horse.findUnique({
      where: { id: parsedFoalId },
      select: {
        id: true,
        name: true,
        age: true,
        bond_score: true,
        stress_level: true,
      },
    });

    if (!foal) {
      throw new Error('Foal not found');
    }

    // Verify this is actually a foal (age 0 or 1)
    if (foal.age > 1) {
      throw new Error('Horse is not a foal (must be 1 year old or younger)');
    }

    // Validate activity is appropriate for the given day
    const availableActivities = getAvailableActivities(parsedDay, {});
    const activityDefinition = availableActivities.find(
      a =>
        a.type === activity ||
        a.name === activity ||
        a.type.toLowerCase().replace('_', ' ') === activity.toLowerCase() ||
        a.name.toLowerCase() === activity.toLowerCase(),
    );

    if (!activityDefinition) {
      throw new Error(
        `Activity "${activity}" is not appropriate for day ${parsedDay}. Available activities: ${availableActivities.map(a => a.name).join(', ')}`,
      );
    }

    // Calculate activity outcome
    const outcome = calculateActivityOutcome(activityDefinition);

    // Get current bonding and stress levels (use defaults if null)
    const currentBondScore = foal.bond_score ?? 50;
    const currentStressLevel = foal.stress_level ?? 0;

    // Calculate new levels with bounds checking
    const newBondScore = Math.max(0, Math.min(100, currentBondScore + outcome.bondingChange));
    const newStressLevel = Math.max(0, Math.min(100, currentStressLevel + outcome.stressChange));

    // Update horse's bonding and stress levels
    await prisma.horse.update({
      where: { id: parsedFoalId },
      data: {
        bond_score: newBondScore,
        stress_level: newStressLevel,
      },
    });

    // Record activity in foal_training_history
    const trainingRecord = await prisma.foalTrainingHistory.create({
      data: {
        horseId: parsedFoalId,
        day: parsedDay,
        activity: activityDefinition.name,
        outcome: outcome.result,
        bondChange: outcome.bondingChange,
        stressChange: outcome.stressChange,
      },
    });

    logger.info(
      `[foalModel.completeEnrichmentActivity] Activity completed successfully. Bond: ${currentBondScore} -> ${newBondScore}, Stress: ${currentStressLevel} -> ${newStressLevel}`,
    );

    return {
      success: true,
      foal: {
        id: foal.id,
        name: foal.name,
      },
      activity: {
        name: activityDefinition.name,
        day: parsedDay,
        outcome: outcome.result,
        description: outcome.description,
      },
      levels: {
        bond_score: newBondScore,
        stress_level: newStressLevel,
        bond_change: outcome.bondingChange,
        stress_change: outcome.stressChange,
      },
      training_record_id: trainingRecord.id,
    };
  } catch (error) {
    logger.error(`[foalModel.completeEnrichmentActivity] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Complete a foal enrichment activity
 * @param {number} foalId - ID of the foal
 * @param {string} activityType - Type of activity to complete
 * @returns {Object} - Updated foal development data
 * @throws {Error} - If validation fails or activity not available
 */
async function completeActivity(foalId, activityType) {
  try {
    const parsedFoalId = parseInt(foalId, 10);
    if (isNaN(parsedFoalId) || parsedFoalId <= 0) {
      throw new Error('Foal ID must be a positive integer');
    }

    if (!activityType) {
      throw new Error('Activity type is required');
    }

    logger.info(
      `[foalModel.completeActivity] Completing activity ${activityType} for foal ${parsedFoalId}`,
    );

    // Get current development status
    const development = await prisma.foalDevelopment.findUnique({
      where: { foalId: parsedFoalId },
    });

    if (!development) {
      throw new Error('Foal development record not found');
    }

    // Check if activity is available for current day
    const availableActivities = getAvailableActivities(
      development.currentDay,
      development.completedActivities || {},
    );
    const activity = availableActivities.find(a => a.type === activityType);

    if (!activity) {
      throw new Error('Activity not available for current day or already completed');
    }

    // Calculate activity outcome (random with some variance)
    const outcome = calculateActivityOutcome(activity);

    // Update development record
    const completedActivities = { ...development.completedActivities };
    if (!completedActivities[development.currentDay]) {
      completedActivities[development.currentDay] = [];
    }
    completedActivities[development.currentDay].push(activityType);

    const newBondingLevel = Math.max(
      0,
      Math.min(100, development.bondingLevel + outcome.bondingChange),
    );
    const newStressLevel = Math.max(
      0,
      Math.min(100, development.stressLevel + outcome.stressChange),
    );

    await prisma.foalDevelopment.update({
      where: { foalId: parsedFoalId },
      data: {
        bondingLevel: newBondingLevel,
        stressLevel: newStressLevel,
        completedActivities,
      },
    });

    // Log the activity
    await prisma.foalActivity.create({
      data: {
        foalId: parsedFoalId,
        day: development.currentDay,
        activityType,
        outcome: outcome.result,
        bondingChange: outcome.bondingChange,
        stressChange: outcome.stressChange,
        description: outcome.description,
      },
    });

    logger.info(`[foalModel.completeActivity] Activity completed: ${outcome.result}`);

    // Return updated development data
    return await getFoalDevelopment(parsedFoalId);
  } catch (error) {
    logger.error(`[foalModel.completeActivity] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Advance foal to next day (typically called by daily cron job)
 * @param {number} foalId - ID of the foal
 * @returns {Object} - Updated foal development data
 */
async function advanceDay(foalId) {
  try {
    const parsedFoalId = parseInt(foalId, 10);
    if (isNaN(parsedFoalId) || parsedFoalId <= 0) {
      throw new Error('Foal ID must be a positive integer');
    }

    logger.info(`[foalModel.advanceDay] Advancing day for foal ${parsedFoalId}`);

    const development = await prisma.foalDevelopment.findUnique({
      where: { foalId: parsedFoalId },
    });

    if (!development) {
      throw new Error('Foal development record not found');
    }

    if (development.currentDay >= 6) {
      throw new Error('Foal has already completed development period');
    }

    // Advance to next day
    await prisma.foalDevelopment.update({
      where: { foalId: parsedFoalId },
      data: {
        currentDay: development.currentDay + 1,
      },
    });

    logger.info(
      `[foalModel.advanceDay] Foal ${parsedFoalId} advanced to day ${development.currentDay + 1}`,
    );

    return await getFoalDevelopment(parsedFoalId);
  } catch (error) {
    logger.error(`[foalModel.advanceDay] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Get available activities for a specific day
 * @param {number} currentDay - Current day (0-6)
 * @param {Object} completedActivities - Already completed activities by day
 * @returns {Array} - Available activities for the day
 */
function getAvailableActivities(currentDay, completedActivities = {}) {
  const allActivities = {
    0: [
      // Day 0 - Birth and initial bonding
      {
        type: 'gentle_touch',
        name: 'Gentle Touch',
        description: 'Softly touch and stroke the foal',
        bondingRange: [3, 7],
        stressRange: [-2, 1],
      },
      {
        type: 'quiet_presence',
        name: 'Quiet Presence',
        description: 'Sit quietly near the foal',
        bondingRange: [1, 4],
        stressRange: [-3, 0],
      },
      {
        type: 'soft_voice',
        name: 'Soft Voice',
        description: 'Speak gently to the foal',
        bondingRange: [2, 5],
        stressRange: [-1, 2],
      },
    ],
    1: [
      // Day 1 - Basic interaction
      {
        type: 'feeding_assistance',
        name: 'Feeding Assistance',
        description: 'Help with feeding routine',
        bondingRange: [4, 8],
        stressRange: [-1, 3],
      },
      {
        type: 'grooming_intro',
        name: 'Grooming Introduction',
        description: 'Introduce basic grooming',
        bondingRange: [3, 6],
        stressRange: [0, 4],
      },
      {
        type: 'play_interaction',
        name: 'Play Interaction',
        description: 'Gentle play and interaction',
        bondingRange: [5, 9],
        stressRange: [-2, 2],
      },
    ],
    2: [
      // Day 2 - Movement and exploration
      {
        type: 'walking_practice',
        name: 'Walking Practice',
        description: 'Encourage walking and movement',
        bondingRange: [3, 7],
        stressRange: [1, 5],
      },
      {
        type: 'environment_exploration',
        name: 'Environment Exploration',
        description: 'Explore the stable area',
        bondingRange: [4, 8],
        stressRange: [0, 3],
      },
      {
        type: 'social_introduction',
        name: 'Social Introduction',
        description: 'Meet other horses safely',
        bondingRange: [2, 6],
        stressRange: [2, 6],
      },
    ],
    3: [
      // Day 3 - Learning and training basics
      {
        type: 'halter_introduction',
        name: 'Halter Introduction',
        description: 'Introduce wearing a halter',
        bondingRange: [3, 7],
        stressRange: [2, 6],
      },
      {
        type: 'leading_practice',
        name: 'Leading Practice',
        description: 'Practice being led',
        bondingRange: [5, 9],
        stressRange: [1, 4],
      },
      {
        type: 'handling_exercises',
        name: 'Handling Exercises',
        description: 'Practice being handled',
        bondingRange: [4, 8],
        stressRange: [0, 3],
      },
      {
        type: 'trailer_exposure',
        name: 'Trailer Exposure',
        description: 'Introduce the foal to a horse trailer',
        bondingRange: [2, 6],
        stressRange: [3, 7],
      },
    ],
    4: [
      // Day 4 - Advanced interaction
      {
        type: 'obstacle_introduction',
        name: 'Obstacle Introduction',
        description: 'Navigate simple obstacles',
        bondingRange: [4, 8],
        stressRange: [2, 5],
      },
      {
        type: 'grooming_advanced',
        name: 'Advanced Grooming',
        description: 'More thorough grooming session',
        bondingRange: [5, 9],
        stressRange: [-1, 2],
      },
      {
        type: 'training_games',
        name: 'Training Games',
        description: 'Fun learning activities',
        bondingRange: [6, 10],
        stressRange: [0, 3],
      },
    ],
    5: [
      // Day 5 - Confidence building
      {
        type: 'confidence_building',
        name: 'Confidence Building',
        description: 'Activities to build confidence',
        bondingRange: [5, 9],
        stressRange: [-2, 1],
      },
      {
        type: 'new_experiences',
        name: 'New Experiences',
        description: 'Introduce new sights and sounds',
        bondingRange: [3, 7],
        stressRange: [1, 4],
      },
      {
        type: 'independence_practice',
        name: 'Independence Practice',
        description: 'Practice being independent',
        bondingRange: [4, 8],
        stressRange: [0, 3],
      },
    ],
    6: [
      // Day 6 - Final preparation
      {
        type: 'final_assessment',
        name: 'Final Assessment',
        description: 'Evaluate development progress',
        bondingRange: [3, 7],
        stressRange: [-1, 2],
      },
      {
        type: 'graduation_ceremony',
        name: 'Graduation Ceremony',
        description: 'Celebrate completion',
        bondingRange: [7, 12],
        stressRange: [-3, 0],
      },
      {
        type: 'future_planning',
        name: 'Future Planning',
        description: 'Plan next steps',
        bondingRange: [2, 5],
        stressRange: [-2, 1],
      },
    ],
  };

  const dayActivities = allActivities[currentDay] || [];
  const completedToday = completedActivities[currentDay] || [];

  // Filter out already completed activities
  return dayActivities.filter(activity => !completedToday.includes(activity.type));
}

/**
 * Calculate the outcome of an activity with some randomness
 * @param {Object} activity - Activity definition
 * @returns {Object} - Activity outcome
 */
function calculateActivityOutcome(activity) {
  const bondingChange =
    Math.floor(Math.random() * (activity.bondingRange[1] - activity.bondingRange[0] + 1)) +
    activity.bondingRange[0];
  const stressChange =
    Math.floor(Math.random() * (activity.stressRange[1] - activity.stressRange[0] + 1)) +
    activity.stressRange[0];

  let result = 'success';
  let description = `${activity.description} completed successfully.`;

  // Determine outcome based on changes
  if (bondingChange >= 6 && stressChange <= 1) {
    result = 'excellent';
    description = `${activity.description} went exceptionally well! Strong bonding achieved.`;
  } else if (bondingChange <= 2 || stressChange >= 4) {
    result = 'challenging';
    description = `${activity.description} was challenging but provided learning experience.`;
  }

  return {
    result,
    description,
    bondingChange,
    stressChange,
  };
}

export {
  getFoalDevelopment,
  completeActivity,
  advanceDay,
  getAvailableActivities,
  completeEnrichmentActivity,
};
