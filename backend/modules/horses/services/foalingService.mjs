/**
 * foalingService — materialises a foal record from a delayed pregnancy.
 *
 * Phase B (feed-system redesign 2026-04-29): breeding no longer creates a
 * foal Horse row immediately. POST /api/horses/foals only sets the mare's
 * pregnancy state (`inFoalSinceDate`, `pregnancySireId`,
 * `pregnancyFeedingsByTier`). Seven days later the foaling job (B5) calls
 * `createFoalFromPregnancy()` here, which contains the foal-generation
 * pipeline previously inlined in `horseController.createFoal`:
 *
 *   - lineage gathering (3 generations)
 *   - epigenetic-trait roll at birth (mare stress + lineage + feed quality)
 *   - conformation, gait, temperament generation (or inherited)
 *   - the actual `createHorse()` insert
 *   - resetting the dam's pregnancy columns
 *
 * Note: B4 (per-feeding tier counters → epigenetic adjustments) and B5
 * (cron job that fires at +7 days) are pending; this service exposes the
 * function shape so they can call it without further refactoring.
 *
 * @module modules/horses/services/foalingService
 */

import { createHorse, getHorseById } from '../../../models/horseModel.mjs';
import { applyEpigeneticTraitsAtBirth } from '../../../utils/applyEpigeneticTraitsAtBirth.mjs';
import {
  generateConformationScores,
  generateInheritedConformationScores,
  hasValidConformationScores,
} from './conformationService.mjs';
import {
  generateGaitScores,
  generateInheritedGaitScores,
  hasValidGaitScores,
} from './gaitService.mjs';
import { generateTemperament } from './temperamentService.mjs';
import prisma from '../../../db/index.mjs';
import logger from '../../../utils/logger.mjs';

/**
 * Map a mare's healthStatus + bondScore to the 0-100 feedQuality metric used
 * by `applyEpigeneticTraitsAtBirth`. Mirrors the implementation that lived
 * inline in `horseController.createFoal` before the B3 refactor.
 */
function assessFeedQualityFromMare(mare) {
  try {
    let feedQuality = 50;
    switch (mare.healthStatus) {
      case 'Excellent':
        feedQuality = 90;
        break;
      case 'Good':
        feedQuality = 75;
        break;
      case 'Fair':
        feedQuality = 55;
        break;
      case 'Poor':
        feedQuality = 30;
        break;
      case 'Critical':
        feedQuality = 15;
        break;
      default:
        feedQuality = 50;
    }
    const bondScore = mare.bondScore || 50;
    if (bondScore >= 80) {
      feedQuality += 10;
    } else if (bondScore >= 60) {
      feedQuality += 5;
    } else if (bondScore <= 30) {
      feedQuality -= 10;
    }
    return Math.max(0, Math.min(100, feedQuality));
  } catch (error) {
    logger.error(`[foalingService.assessFeedQualityFromMare] ${error.message}`);
    return 50;
  }
}

/**
 * Walk the sire/dam ancestry up to `generations` generations and return a
 * flattened array of ancestor records keyed by id (cycle-guarded). The
 * returned shape matches the legacy controller output so trait roll logic
 * keeps its existing behavior.
 */
async function gatherLineage(sireId, damId, generations) {
  try {
    const ancestors = [];
    const toProcess = [
      { id: sireId, generation: 0 },
      { id: damId, generation: 0 },
    ];
    const processed = new Set();

    while (toProcess.length > 0) {
      const { id, generation } = toProcess.shift();
      if (processed.has(id) || generation >= generations) {
        continue;
      }
      processed.add(id);

      const horse = await prisma.horse.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          sireId: true,
          damId: true,
          disciplineScores: true,
          trait: true,
          temperament: true,
        },
      });
      if (!horse) {
        continue;
      }

      let primaryDiscipline = null;
      if (horse.disciplineScores && typeof horse.disciplineScores === 'object') {
        let maxScore = 0;
        Object.entries(horse.disciplineScores).forEach(([discipline, score]) => {
          if (typeof score === 'number' && score > maxScore) {
            maxScore = score;
            primaryDiscipline = discipline;
          }
        });
      }

      ancestors.push({
        id: horse.id,
        name: horse.name,
        discipline: primaryDiscipline,
        disciplineScores: horse.disciplineScores,
        generation,
        trait: horse.trait,
        temperament: horse.temperament,
      });

      if (horse.sireId && generation + 1 < generations) {
        toProcess.push({ id: horse.sireId, generation: generation + 1 });
      }
      if (horse.damId && generation + 1 < generations) {
        toProcess.push({ id: horse.damId, generation: generation + 1 });
      }
    }
    return ancestors;
  } catch (error) {
    logger.error(`[foalingService.gatherLineage] Error: ${error.message}`);
    return [];
  }
}

/**
 * Materialise a foal from a mare's pregnancy state.
 *
 * Reads the dam's `inFoalSinceDate` / `pregnancySireId` /
 * `pregnancyFeedingsByTier`, generates the foal exactly as the legacy
 * `createFoal` controller did, inserts the Horse row, and clears the dam's
 * pregnancy columns. The B5 foaling job is the expected caller.
 *
 * @param {object} params
 * @param {number} params.damId - id of the in-foal mare
 * @param {object} [params.options] - currently { name?, breedId?, sex? } so
 *   B5 can inject the in-flight breed payload (or queue stored data) when
 *   ready. For B3 the controller writes the original breed/name/sex into a
 *   pending-pregnancy payload column or passes them through here.
 * @returns {Promise<object>} the created foal Horse row + applied traits
 */
export async function createFoalFromPregnancy({ damId, options = {} } = {}) {
  if (!damId) {
    throw new Error('createFoalFromPregnancy: damId is required');
  }

  const dam = await prisma.horse.findUnique({ where: { id: damId } });
  if (!dam) {
    throw new Error(`createFoalFromPregnancy: dam ${damId} not found`);
  }
  if (!dam.inFoalSinceDate || !dam.pregnancySireId) {
    throw new Error(`createFoalFromPregnancy: mare ${damId} is not in foal`);
  }

  const sireId = dam.pregnancySireId;
  const sire = await getHorseById(sireId);
  if (!sire) {
    throw new Error(`createFoalFromPregnancy: pregnancy sire ${sireId} not found`);
  }

  const mareStats = {
    id: dam.id,
    name: dam.name,
    stressLevel: dam.stressLevel || 50,
    bondScore: dam.bondScore || 50,
    healthStatus: dam.healthStatus || 'Good',
  };
  const lineage = await gatherLineage(sireId, damId, 3);
  const feedQuality = assessFeedQualityFromMare(mareStats);
  const { stressLevel } = mareStats;

  const epigeneticTraits = applyEpigeneticTraitsAtBirth({
    mare: mareStats,
    lineage,
    feedQuality,
    stressLevel,
  });

  // Resolve breed name. B3 uses the dam's breed by default; B5 can pass a
  // different breed via options when the original breed payload is stored.
  const requestedBreedId =
    options.breedId !== undefined ? Number.parseInt(options.breedId, 10) : dam.breedId;
  if (!Number.isInteger(requestedBreedId) || requestedBreedId <= 0) {
    throw new Error(`createFoalFromPregnancy: invalid breedId ${requestedBreedId}`);
  }
  const breedRecord = await prisma.breed.findUnique({
    where: { id: requestedBreedId },
    select: { name: true },
  });
  if (!breedRecord?.name) {
    throw new Error(`createFoalFromPregnancy: breed ${requestedBreedId} not found`);
  }
  const breedName = breedRecord.name;

  const sireConformation = sire.conformationScores;
  const damConformation = dam.conformationScores;
  const conformationScores =
    hasValidConformationScores(sireConformation) && hasValidConformationScores(damConformation)
      ? generateInheritedConformationScores(breedName, sireConformation, damConformation)
      : generateConformationScores(breedName);

  const sireGaitScores = sire.gaitScores;
  const damGaitScores = dam.gaitScores;
  const gaitScores =
    hasValidGaitScores(sireGaitScores) && hasValidGaitScores(damGaitScores)
      ? generateInheritedGaitScores(breedName, sireGaitScores, damGaitScores, conformationScores)
      : generateGaitScores(breedName, conformationScores);

  const temperament = generateTemperament(breedName);

  const horseData = {
    name: options.name || `${dam.name} Foal`,
    age: 0,
    breedId: requestedBreedId,
    sireId,
    damId,
    sex: options.sex,
    ownerId: options.ownerId,
    userId: options.userId || dam.userId,
    playerId: options.playerId,
    stableId: options.stableId,
    healthStatus: options.healthStatus || 'Good',
    dateOfBirth: new Date().toISOString(),
    conformationScores,
    gaitScores,
    temperament,
    epigeneticModifiers: {
      positive: epigeneticTraits.positive || [],
      negative: epigeneticTraits.negative || [],
      hidden: [],
    },
    _epigeneticTraitsApplied: true,
  };

  const newFoal = await createHorse(horseData);

  // Clear the mare's pregnancy state.
  await prisma.horse.update({
    where: { id: damId },
    data: {
      inFoalSinceDate: null,
      pregnancySireId: null,
      pregnancyFeedingsByTier: {},
    },
  });

  logger.info(
    `[foalingService.createFoalFromPregnancy] Foaled ${newFoal.name} (id=${newFoal.id}) from dam ${damId}/sire ${sireId}`,
  );

  return {
    foal: newFoal,
    appliedTraits: epigeneticTraits,
    breedingAnalysis: {
      mareStress: stressLevel,
      feedQuality,
      lineageCount: lineage.length,
      sire: { id: sire.id, name: sire.name },
      dam: { id: dam.id, name: dam.name },
    },
  };
}

export default { createFoalFromPregnancy };
