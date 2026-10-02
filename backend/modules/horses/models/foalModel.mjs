// Equoria-pq3oi: relocated from backend/models/ to backend/modules/horses/models/.
// Paths adjusted for the new depth (models→horses→modules→backend→repo).
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { updateUserSettingsPaths } from '../../../utils/userSettingsPaths.mjs';
import {
  hasGraduated,
  computeAgeStage,
  computeAgeInWeeks,
  getActivitiesForStage,
} from '../../../utils/foalAgeUtils.mjs';
import { FOAL_ACTIVITY_SOURCE } from '../../../utils/foalActivityStore.mjs';
import { getHorseAgeDays } from '../../../utils/horseAge.mjs';
import {
  detectAndRecordFoalMilestones,
  detectAndRecordFoalMilestonesCore,
} from '../services/foalMilestoneService.mjs';
import AppError from '../../../errors/AppError.mjs';
import {
  RetryableTransactionError,
  runRetryableTransaction,
} from '../../../utils/retryableTransaction.mjs';

// Enrichment window: development days 0-6 (the foal's first real week of life).
const ENRICHMENT_MAX_DAY = 6;

function parseFoalId(foalId) {
  const parsedFoalId = parseInt(foalId, 10);
  if (isNaN(parsedFoalId) || parsedFoalId <= 0) {
    throw new Error('Foal ID must be a positive integer');
  }
  return parsedFoalId;
}

/**
 * Get foal development data including current status and activity history
 * @param {number} foalId - ID of the foal
 * @returns {Object} - Foal development data with current status and activity log
 * @throws {Error} - If validation fails or database error occurs
 */
async function getFoalDevelopment(foalId) {
  const parsedFoalId = parseFoalId(foalId);

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
    // Equoria-4xwyi: typed 404 (AppError) so foalController.getFoalDevelopmentHandler
    // can detect not-found by type, not error.message.includes('not found'). Raw
    // AppError preserves the exact 'Foal not found' message the controller echoes.
    throw new AppError('Foal not found', 404);
  }

  // Check if this is actually a foal (age 0 or very young).
  // NOTE (Equoria-4xwyi): this is NOT a not-found case — it is a state rejection
  // that the controller still maps to 404 via its retained `'not a foal'` string
  // branch. Left as a plain Error on purpose; converting it would conflate
  // "wrong-state" with "missing-resource". Not-foal 404 behavior is unchanged.
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

  logger.info(`[foalModel.getFoalDevelopment] Retrieved development data for foal ${parsedFoalId}`);

  // Equoria-g89vy: the enrichment day is DERIVED from the foal's age
  // (date-only UTC), not the manually-incremented FoalDevelopment.currentDay.
  // Surface it (and the day's enrichment activities) additively so the
  // frontend Enrich action has a real source of truth instead of guessing.
  const enrichmentDay = getHorseAgeDays(foal.dateOfBirth);
  const enrichmentWindowOpen = enrichmentDay <= ENRICHMENT_MAX_DAY;
  const availableEnrichmentActivities = enrichmentWindowOpen
    ? getAvailableActivities(enrichmentDay, {})
    : [];

  // Equoria-oey96.17 (BB.1/BB.2/BB.3): surface the age-stage payload the
  // Epic-29 UI needs, ADDITIVELY on the ratified game-year clock
  // (Equoria-oey96.16 — 7 real days = 1 game year, via foalAgeUtils, NOT real
  // weeks). computeAgeStage/computeAgeInWeeks read the LIVE age from
  // Horse.dateOfBirth; FoalDevelopment.ageStage is a never-written @default
  // cache and is intentionally NOT read here.
  const ageStage = computeAgeStage(foal.dateOfBirth);
  const ageInWeeks = computeAgeInWeeks(foal.dateOfBirth);
  const birthDate = foal.dateOfBirth ? new Date(foal.dateOfBirth).toISOString() : null;

  // BB.3 (Equoria-oey96.18): lazy milestone detection on read. Bond / stage /
  // first-trait milestones are a function of the foal's persisted state, so
  // viewing development is a legitimate detection trigger (stage change is a
  // function of time). Detect + persist idempotently, then surface the
  // up-to-date store below instead of the pre-detection `development` snapshot.
  const { completedMilestones: milestoneStore } = await detectAndRecordFoalMilestones(parsedFoalId);

  return {
    foal: {
      id: foal.id,
      name: foal.name,
      age: foal.age,
      breed: foal.breed?.name || 'Unknown',
      owner: foal.user?.firstName || 'Unknown',
    },
    // BB.1 (Equoria-oey96.17): age-stage fields, additive alongside the legacy
    // `development` block below. `ageStage` is null once the foal graduates
    // (age 3+ game-years) — the development window is closed.
    ageStage,
    ageInWeeks,
    birthDate,
    development: {
      currentDay: development.currentDay,
      bondingLevel: development.bondingLevel,
      stressLevel: development.stressLevel,
      completedActivities: development.completedActivities || {},
      maxDay: 6, // Foal development period is 7 days (0-6)
      enrichmentDay,
      enrichmentWindowOpen,
    },
    availableEnrichmentActivities,
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
    // BB.2 (Equoria-oey96.17): availableActivities is now the STAGE-appropriate
    // set (getActivitiesForStage on the game-year clock), NOT the day-based
    // enrichment list. The day-based enrichment activities remain surfaced under
    // `availableEnrichmentActivities` above. `getActivitiesForStage(null)`
    // returns [] for a graduated foal (development window closed).
    availableActivities: getActivitiesForStage(ageStage),
    // BB.3 (Equoria-oey96.17): surface the REAL persisted milestone store as
    // Array<{ id, timestamp }>. The milestone DETECTION/WRITE path is
    // Equoria-oey96.18 (still open) — until it lands, FoalDevelopment
    // .completedMilestones stays `{}` and this returns [] HONESTLY (never a
    // fabricated value). When .18 begins writing entries, they surface here
    // automatically with no further change.
    completedMilestones: toCompletedMilestonesArray(milestoneStore),
  };
}

/**
 * Transform the persisted FoalDevelopment.completedMilestones JSONB store into
 * the persisted response contract: Array<{ id, timestamp }>.
 *
 * The store is a JSONB map of `{ <milestoneId>: <ISO timestamp> }`. Prisma
 * returns JSONB as JsonValue (may be null / primitive / array / object), so a
 * full four-part type guard (CONTRIBUTING.md § JSONB) precedes any read.
 *
 * @param {import('@prisma/client').Prisma.JsonValue} store
 * @returns {Array<{ id: string, timestamp: unknown }>}
 */
function toCompletedMilestonesArray(store) {
  if (store === null || store === undefined || typeof store !== 'object' || Array.isArray(store)) {
    return [];
  }
  return Object.entries(store).map(([id, timestamp]) => ({ id, timestamp }));
}

/**
 * Complete a foal enrichment activity (Task 5 API).
 *
 * The enrichment "day" is NOT supplied by the caller — it is DERIVED from the
 * foal's dateOfBirth using canonical date-only UTC age math (Equoria-g89vy).
 * This makes the foal's age the single source of truth for which activities
 * are available and prevents a client from harvesting any day's activities
 * regardless of the foal's real age.
 *
 * One transaction: the anti-farming history row is reserved first (its unique
 * constraint rejects a duplicate before any reward), bond/stress move by one
 * clamped in-place UPDATE (concurrent activities cannot overwrite each other),
 * and milestones record on the same transaction.
 *
 * @param {number} foalId - ID of the foal
 * @param {string} activity - Activity name/type
 * @returns {Object} - Updated bonding and stress levels
 * @throws {Error} - If validation fails, the window is closed, the activity is
 *   not appropriate for the derived day, or the activity was already completed
 *   on that day (anti-farming).
 */
async function completeEnrichmentActivity(foalId, activity) {
  // Validate inputs
  const parsedFoalId = parseFoalId(foalId);

  if (!activity || typeof activity !== 'string') {
    throw new Error('Activity is required and must be a string');
  }

  const now = new Date();

  return runRetryableTransaction(
    prisma,
    async tx => {
      const foal = await tx.horse.findUnique({
        where: { id: parsedFoalId },
        select: { id: true, name: true, dateOfBirth: true },
      });

      if (!foal) {
        // Equoria-4xwyi: typed 404 (AppError) so foalController.completeFoalEnrichment
        // detects not-found by type, not error.message.includes('not found'). Raw
        // AppError preserves the exact 'Foal not found' message the controller echoes.
        throw new AppError('Foal not found', 404);
      }

      // Derive the development day from the foal's age (date-only UTC).
      // Day 0 = just born; day 6 = end of the enrichment window.
      const day = getHorseAgeDays(foal.dateOfBirth, now);

      logger.info(
        `[foalModel.completeEnrichmentActivity] Processing enrichment activity "${activity}" for foal ${parsedFoalId} on derived day ${day}`,
      );

      // The enrichment window is days 0-6 (the first week). Past that, the foal
      // has aged out (age >= 1 game-year) and the window is closed.
      if (day > ENRICHMENT_MAX_DAY) {
        throw new Error(
          `Enrichment window closed: this foal is ${day} days old (enrichment is only available on days 0-${ENRICHMENT_MAX_DAY}).`,
        );
      }

      const availableActivities = getAvailableActivities(day, {});
      const activityDefinition = availableActivities.find(
        a =>
          a.type === activity ||
          a.name === activity ||
          a.type.toLowerCase().replace('_', ' ') === activity.toLowerCase() ||
          a.name.toLowerCase() === activity.toLowerCase(),
      );

      if (!activityDefinition) {
        throw new Error(
          `Activity "${activity}" is not appropriate for day ${day}. Available activities: ${availableActivities.map(a => a.name).join(', ')}`,
        );
      }

      const outcome = calculateActivityOutcome(activityDefinition);

      // Anti-farming (Equoria-g89vy): the unique constraint is the authority.
      let trainingRecord;
      try {
        trainingRecord = await tx.foalTrainingHistory.create({
          data: {
            horseId: parsedFoalId,
            day,
            activity: activityDefinition.name,
            outcome: outcome.result,
            bondChange: outcome.bondingChange,
            stressChange: outcome.stressChange,
          },
        });
      } catch (error) {
        if (error?.code === 'P2002') {
          throw new Error(
            `Activity "${activityDefinition.name}" already completed for day ${day}.`,
            { cause: error },
          );
        }
        throw error;
      }

      // Clamp to 0-100 in the statement so the delta lands on the committed value.
      const [levels] = await tx.$queryRaw`
        UPDATE "horses"
        SET "bondScore" = LEAST(100, GREATEST(0, "bondScore" + ${outcome.bondingChange})),
            "stressLevel" = LEAST(100, GREATEST(0, "stressLevel" + ${outcome.stressChange})),
            "updatedAt" = NOW()
        WHERE "id" = ${parsedFoalId}
        RETURNING "bondScore", "stressLevel"`;

      // BB.3 (Equoria-oey96.18): the new bondScore can cross a bond milestone.
      await detectAndRecordFoalMilestonesCore(tx, parsedFoalId, { now });

      logger.info(
        `[foalModel.completeEnrichmentActivity] Activity completed successfully. Bond: ${levels.bondScore} (${outcome.bondingChange}), Stress: ${levels.stressLevel} (${outcome.stressChange})`,
      );

      return {
        success: true,
        foal: { id: foal.id, name: foal.name },
        activity: {
          name: activityDefinition.name,
          day,
          outcome: outcome.result,
          description: outcome.description,
        },
        levels: {
          bondScore: levels.bondScore,
          stressLevel: levels.stressLevel,
          bondChange: outcome.bondingChange,
          stressChange: outcome.stressChange,
        },
        trainingRecordId: trainingRecord.id,
      };
    },
    { message: 'Could not complete enrichment right now; please retry.' },
  );
}

/**
 * Complete a foal enrichment activity
 * @param {number} foalId - ID of the foal
 * @param {string} activityType - Type of activity to complete
 * @returns {Object} - Updated foal development data
 * @throws {Error} - If validation fails or activity not available
 */
async function completeActivity(foalId, activityType) {
  const parsedFoalId = parseFoalId(foalId);

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
    // Equoria-4xwyi: typed 404 (AppError) so foalController.completeFoalActivity
    // detects not-found by type, not error.message.includes('not found'). Raw
    // AppError preserves the exact 'Foal development record not found' message.
    throw new AppError('Foal development record not found', 404);
  }

  // Check if activity is available for current day
  const availableActivities = getAvailableActivities(
    development.currentDay,
    development.completedActivities || {},
  );
  const activity = availableActivities.find(a => a.type === activityType);

  if (!activity) {
    // NOTE (Equoria-4xwyi): NOT a not-found case — an availability/already-done
    // state rejection. The controller maps this to 404 via its retained
    // `'not available'` string branch (a pre-existing quirk: this is arguably a
    // 400, but converting the status is out of scope — see what-was-NOT-done).
    // Left as a plain Error so behavior is unchanged.
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
  const newStressLevel = Math.max(0, Math.min(100, development.stressLevel + outcome.stressChange));

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
      // Equoria-8yhe3: tag this as the legacy ENRICHMENT stream. It does NOT
      // feed Horse.taskLog; the source discriminator guarantees the taskLog
      // count derivation excludes these rows even if an enrichment
      // activityType ever collides with a groom interactionType string.
      source: FOAL_ACTIVITY_SOURCE.ENRICHMENT_ACTIVITY,
    },
  });

  logger.info(`[foalModel.completeActivity] Activity completed: ${outcome.result}`);

  // Return updated development data
  return await getFoalDevelopment(parsedFoalId);
}

/**
 * Advance foal to next day (typically called by daily cron job)
 * @param {number} foalId - ID of the foal
 * @returns {Object} - Updated foal development data
 */
async function advanceDay(foalId) {
  const parsedFoalId = parseFoalId(foalId);

  logger.info(`[foalModel.advanceDay] Advancing day for foal ${parsedFoalId}`);

  const development = await prisma.foalDevelopment.findUnique({
    where: { foalId: parsedFoalId },
  });

  if (!development) {
    // Equoria-4xwyi: typed 404 (AppError) so foalController.advanceFoalDay detects
    // not-found by type, not error.message.includes('not found'). Raw AppError
    // preserves the exact 'Foal development record not found' message.
    throw new AppError('Foal development record not found', 404);
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

/**
 * Graduate a foal — closes the development window and clears groom assignments.
 * One transaction: window closure, assignments, the user's firstGraduation flag
 * and foal milestones commit together. The window closes by a conditional
 * transition, so a repeated or concurrent graduation is rejected.
 *
 * @param {number} foalId - ID of the foal/horse
 * @param {string} userId - Owner's user ID (for milestone tracking)
 * @returns {Object} - Graduation result with horse data and milestone info
 * @throws {Error} - If horse not found, not old enough, or already graduated
 */
async function graduateFoal(foalId, userId) {
  const parsedFoalId = parseFoalId(foalId);

  logger.info(`[foalModel.graduateFoal] Graduating foal ${parsedFoalId}`);

  const now = new Date();

  return runRetryableTransaction(
    prisma,
    async tx => {
      const horse = await tx.horse.findUnique({
        where: { id: parsedFoalId },
        include: { breed: true },
      });

      if (!horse) {
        // Equoria-4xwyi: typed 404 (AppError) so foalController.graduateFoalHandler
        // detects not-found by type, not error.message.includes('not found'). Raw
        // AppError preserves the exact 'Horse not found' message the controller echoes.
        throw new AppError('Horse not found', 404);
      }

      // Verify horse reached graduation age (3 game-years / 21 real days; was 104 real weeks — Equoria-oey96.16)
      if (!hasGraduated(horse.dateOfBirth)) {
        throw new Error('Horse has not reached graduation age (3 years)');
      }

      const development = await closeDevelopmentWindow(tx, parsedFoalId);

      // Clear active groom assignments for this horse
      const clearedAssignments = await tx.groomAssignment.updateMany({
        where: { foalId: parsedFoalId, isActive: true },
        data: { isActive: false, endDate: now },
      });

      logger.info(
        `[foalModel.graduateFoal] Cleared ${clearedAssignments.count} groom assignments for horse ${parsedFoalId}`,
      );

      const isFirstGraduation = userId ? await recordFirstGraduation(tx, userId, now) : false;

      // BB.3 (Equoria-oey96.18): the FOAL-level `graduation` milestone, distinct
      // from the USER-level firstGraduation flag above.
      await detectAndRecordFoalMilestonesCore(tx, parsedFoalId, { now });

      return {
        success: true,
        horse: {
          id: horse.id,
          name: horse.name,
          breed: horse.breed?.name || 'Unknown',
        },
        graduation: {
          clearedAssignments: clearedAssignments.count,
          bondScore: development?.bondScore ?? development?.bondingLevel ?? 0,
          isFirstGraduation,
        },
      };
    },
    { message: 'Could not graduate this foal right now; please retry.' },
  );
}

/** Close the development window in `tx`; returns the pre-close row (or null). */
async function closeDevelopmentWindow(tx, foalId) {
  const development = await tx.foalDevelopment.findUnique({ where: { foalId } });

  if (development) {
    const { count } = await tx.foalDevelopment.updateMany({
      where: { foalId, isActive: true },
      data: { isActive: false },
    });
    if (count === 0) {
      throw new Error('Horse has already graduated');
    }
    return development;
  }

  try {
    await tx.foalDevelopment.create({ data: { foalId, isActive: false } });
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new Error('Horse has already graduated', { cause: error });
    }
    throw error;
  }
  return null;
}

/** Set the user's firstGraduation milestone; true when this is their first. */
async function recordFirstGraduation(tx, userId, now) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  });
  if (!user) {
    return false;
  }

  const settings = user.settings ?? {};
  const milestones = settings.milestones ?? {};
  if (milestones.firstGraduation) {
    return false;
  }

  // Finding 1 (Equoria-6p398.1): `milestones` path only, compare-and-swap so a
  // concurrent change to `milestones` is never overwritten.
  const updated = await updateUserSettingsPaths(tx, userId, {
    set: { milestones: { ...milestones, firstGraduation: now.toISOString() } },
    expect: { milestones: { equals: settings.milestones ?? null } },
  });
  if (updated !== 1) {
    throw new RetryableTransactionError('Could not graduate this foal right now; please retry.');
  }

  logger.info(`[foalModel.graduateFoal] Set firstGraduation milestone for user ${userId}`);
  return true;
}

export {
  getFoalDevelopment,
  completeActivity,
  advanceDay,
  getAvailableActivities,
  completeEnrichmentActivity,
  graduateFoal,
};
