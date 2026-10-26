// Equoria-pq3oi: relocated from backend/models/ to backend/modules/horses/models/.
// Paths adjusted for the new depth (models→horses→modules→backend→repo).
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { computeAgeInWeeks } from '../../../utils/foalAgeUtils.mjs';
import { isFoalAge } from '../../../constants/schema.mjs';
import { detectAndRecordFoalMilestones } from '../services/foalMilestoneService.mjs';
import AppError from '../../../errors/AppError.mjs';

// Equoria-fr2kg (owner ruling 2026-10-14/15): foal enrichment is the groom's
// job and there is no graduation. The player-run getAvailableActivities (day
// 0-6 table), completeActivity, completeEnrichmentActivity and graduateFoal
// were AI inventions and were removed; this model only reads development.

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

  // A horse is a foal while its game age is under 3 (owner ruling 2026-10-22,
  // Equoria-lu6xo: development is served for ages 0-2, every horse under 3;
  // "under 3" uses the game age, owner ruling 2026-10-19 #18).
  // NOTE (Equoria-4xwyi): this is NOT a not-found case — it is a state rejection
  // that the controller still maps to 404 via its retained `'not a foal'` string
  // branch. Left as a plain Error on purpose; converting it would conflate
  // "wrong-state" with "missing-resource".
  if (!isFoalAge(foal.age)) {
    throw new Error('Horse is not a foal (age 3 or older)');
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

  // Equoria-oey96.17 (BB.1/BB.3): surface the age payload ADDITIVELY on the
  // ratified game-year clock (Equoria-oey96.16 — 7 real days = 1 game year,
  // via foalAgeUtils, NOT real weeks), read LIVE from Horse.dateOfBirth.
  // No named life stage (Equoria-fr2kg Q5, owner ruling 2026-10-15); the
  // never-written FoalDevelopment.ageStage column is not read.
  const ageInWeeks = computeAgeInWeeks(foal.dateOfBirth);
  const birthDate = foal.dateOfBirth ? new Date(foal.dateOfBirth).toISOString() : null;

  // BB.3 (Equoria-oey96.18): lazy milestone detection on read. Bond and
  // first-trait milestones are a function of the foal's persisted state, so
  // viewing development is a legitimate detection trigger. Detect + persist idempotently, then surface the
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
    // BB.1 (Equoria-oey96.17): age fields, additive alongside the legacy
    // `development` block below.
    ageInWeeks,
    birthDate,
    development: {
      currentDay: development.currentDay,
      // Equoria-fr2kg Q16 (owner ruling 2026-10-22): the horse's real bond,
      // which grooms write (Horse.bondScore). The legacy
      // FoalDevelopment.bondingLevel column sat frozen at its 50 default; it is
      // kept (C5, owner-deferred drop) but no longer read.
      bondingLevel: foal.bondScore,
      maxDay: 6, // Foal development period is 7 days (0-6)
    },
    activityHistory: activityHistory.map(activity => ({
      id: activity.id,
      day: activity.day,
      activityType: activity.activityType,
      outcome: activity.outcome,
      bondingChange: activity.bondingChange,
      description: activity.description,
      timestamp: activity.createdAt,
    })),
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

export { getFoalDevelopment };
