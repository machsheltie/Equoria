import { getResultsByHorse } from '../../../models/resultModel.mjs';
import { createHorse, getHorseById } from '../../../models/horseModel.mjs';
import { getAnyRecentTraining } from '../../../models/trainingModel.mjs';
import { applyEpigeneticTraitsAtBirth } from '../../../utils/applyEpigeneticTraitsAtBirth.mjs';
import {
  generateConformationScores,
  generateInheritedConformationScores,
  hasValidConformationScores,
  CONFORMATION_REGIONS,
  calculateOverallConformation,
} from '../services/conformationService.mjs';
import { BREED_GENETIC_PROFILES, CANONICAL_BREEDS } from '../data/breedGeneticProfiles.mjs';
import {
  generateGaitScores,
  generateInheritedGaitScores,
  hasValidGaitScores,
} from '../services/gaitService.mjs';
import { generateTemperament } from '../services/temperamentService.mjs';
import prisma from '../../../db/index.mjs';
import logger from '../../../utils/logger.mjs';

/**
 * Get competition history for a specific horse
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getHorseHistory(req, res) {
  try {
    const { id } = req.params;

    // Validate horse ID
    const horseId = parseInt(id, 10);
    if (isNaN(horseId) || horseId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid horse ID. Must be a positive integer.',
        data: null,
      });
    }

    // Get competition results for the horse
    const results = await getResultsByHorse(horseId);

    // Transform results for frontend display
    const history = results.map(result => ({
      id: result.id,
      showName: result.showName,
      discipline: result.discipline,
      placement: result.placement,
      score: result.score,
      prize: result.prizeWon,
      statGain: result.statGains ? JSON.parse(result.statGains) : null,
      runDate: result.runDate,
      createdAt: result.createdAt,
    }));

    logger.info(
      `[horseController.getHorseHistory] Retrieved ${history.length} competition results for horse ${horseId}`,
    );

    res.status(200).json({
      success: true,
      message: `Found ${history.length} competition results for horse ${horseId}`,
      data: history,
    });
  } catch (error) {
    logger.error('[horseController.getHorseHistory] Error retrieving horse history: %o', error);

    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving horse history',
      data: null,
    });
  }
}

/**
 * Create a new foal with epigenetic traits applied at birth
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function createFoal(req, res) {
  try {
    const {
      name,
      breedId,
      sireId,
      damId,
      sex,
      ownerId,
      playerId,
      stableId,
      healthStatus = 'Good',
    } = req.body;

    logger.info(
      `[horseController.createFoal] Creating foal: ${name} with sire ${sireId} and dam ${damId}`,
    );

    // Validate required fields
    if (!name || !breedId || !sireId || !damId) {
      return res.status(400).json({
        success: false,
        message: 'Name, breedId, sireId, and damId are required for foal creation',
        data: null,
      });
    }

    // Validate that sire and dam exist
    const [sire, dam] = await Promise.all([getHorseById(sireId), getHorseById(damId)]);

    if (!sire) {
      return res.status(404).json({
        success: false,
        message: `Sire with ID ${sireId} not found`,
        data: null,
      });
    }

    if (!dam) {
      return res.status(404).json({
        success: false,
        message: `Dam with ID ${damId} not found`,
        data: null,
      });
    }

    // Extract mare data (dam)
    const mare = {
      id: dam.id,
      name: dam.name,
      stressLevel: dam.stressLevel || 50,
      bondScore: dam.bondScore || 50,
      healthStatus: dam.healthStatus || 'Good',
    };

    // Gather lineage up to 3 generations
    const lineage = await gatherLineage(sireId, damId, 3);

    // Extract feed quality from mare's health status and care quality
    const feedQuality = assessFeedQualityFromMare(mare);

    // Extract stress level from mare
    const { stressLevel } = mare;

    logger.info(
      `[horseController.createFoal] Mare stress: ${stressLevel}, Feed quality: ${feedQuality}, Lineage count: ${lineage.length}`,
    );

    // Apply epigenetic traits at birth
    const epigeneticTraits = applyEpigeneticTraitsAtBirth({
      mare,
      lineage,
      feedQuality,
      stressLevel,
    });

    logger.info(
      `[horseController.createFoal] Applied epigenetic traits: ${JSON.stringify(epigeneticTraits)}`,
    );

    // Generate conformation scores — use inheritance if both parents have valid region scores, else breed-only.
    // breedId comes from req.body (the foal's assigned breed). Crossbreeding is restricted to specific
    // breed combinations (e.g., Thoroughbred x Arabian = Anglo Arabian) — validation happens upstream.
    // The foal's breed determines breed mean regression, not the parents' breeds.
    const sireConformation = sire.conformationScores;
    const damConformation = dam.conformationScores;
    const conformationScores =
      hasValidConformationScores(sireConformation) && hasValidConformationScores(damConformation)
        ? generateInheritedConformationScores(breedId, sireConformation, damConformation)
        : generateConformationScores(breedId);
    logger.info(
      `[horseController.createFoal] Generated conformation scores for breed ${breedId} (${hasValidConformationScores(sireConformation) && hasValidConformationScores(damConformation) ? 'inherited' : 'breed-only'}): overall=${conformationScores.overallConformation}`,
    );

    // Generate gait scores — use inheritance if both parents have valid gait scores, else breed-only
    const sireGaitScores = sire.gaitScores;
    const damGaitScores = dam.gaitScores;
    const gaitScores =
      hasValidGaitScores(sireGaitScores) && hasValidGaitScores(damGaitScores)
        ? generateInheritedGaitScores(breedId, sireGaitScores, damGaitScores, conformationScores)
        : generateGaitScores(breedId, conformationScores);
    logger.info(
      `[horseController.createFoal] Generated gait scores for breed ${breedId} (${hasValidGaitScores(sireGaitScores) && hasValidGaitScores(damGaitScores) ? 'inherited' : 'breed-only'})`,
    );

    // Generate temperament — always a fresh breed-weighted random roll (not inherited from parents)
    const temperament = generateTemperament(breedId);
    logger.info(
      `[horseController.createFoal] Assigned temperament "${temperament}" for breed ${breedId}`,
    );

    // Prepare horse data for creation
    const horseData = {
      name,
      age: 0, // Newborn foal
      breedId,
      sireId,
      damId,
      sex,
      ownerId,
      playerId,
      stableId,
      healthStatus,
      dateOfBirth: new Date().toISOString(),
      conformationScores,
      gaitScores,
      temperament,
      epigeneticModifiers: {
        positive: epigeneticTraits.positive || [],
        negative: epigeneticTraits.negative || [],
        hidden: [], // Hidden traits are revealed later through trait discovery
      },
      _epigeneticTraitsApplied: true, // Signal to horseModel that traits are already applied
    };

    // Create the foal
    const newFoal = await createHorse(horseData);

    logger.info(
      `[horseController.createFoal] Successfully created foal: ${newFoal.name} (ID: ${newFoal.id})`,
    );

    res.status(201).json({
      success: true,
      message: `Foal ${newFoal.name} created successfully with epigenetic traits`,
      data: {
        foal: newFoal,
        appliedTraits: epigeneticTraits,
        breedingAnalysis: {
          mareStress: stressLevel,
          feedQuality,
          lineageCount: lineage.length,
          sire: { id: sire.id, name: sire.name },
          dam: { id: dam.id, name: dam.name },
        },
      },
    });
  } catch (error) {
    logger.error(`[horseController.createFoal] Error creating foal: ${error.message}`);

    res.status(500).json({
      success: false,
      message: 'Internal server error during foal creation',
      data: null,
    });
  }
}

/**
 * Gather lineage up to specified generations
 * @param {number} sireId - Sire's ID
 * @param {number} damId - Dam's ID
 * @param {number} generations - Number of generations to trace back
 * @returns {Array} - Flattened array of ancestor objects
 */
async function gatherLineage(sireId, damId, generations) {
  try {
    logger.info(
      `[horseController.gatherLineage] Gathering lineage for sire ${sireId} and dam ${damId}, ${generations} generations`,
    );

    const ancestors = [];
    const toProcess = [
      { id: sireId, generation: 0 },
      { id: damId, generation: 0 },
    ];
    const processed = new Set();

    while (toProcess.length > 0) {
      const { id, generation } = toProcess.shift();

      // Skip if already processed or reached generation limit
      if (processed.has(id) || generation >= generations) {
        continue;
      }

      processed.add(id);

      // Get horse data with discipline information
      const horse = await prisma.horse.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          sireId: true,
          damId: true,
          disciplineScores: true,
          // Include any discipline-related fields
          trait: true,
          temperament: true,
        },
      });

      if (horse) {
        // Determine primary discipline from disciplineScores
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

        // Add to ancestors array
        ancestors.push({
          id: horse.id,
          name: horse.name,
          discipline: primaryDiscipline,
          disciplineScores: horse.disciplineScores,
          generation,
          trait: horse.trait,
          temperament: horse.temperament,
        });

        // Add parents to processing queue for next generation
        if (horse.sireId && generation + 1 < generations) {
          toProcess.push({ id: horse.sireId, generation: generation + 1 });
        }
        if (horse.damId && generation + 1 < generations) {
          toProcess.push({ id: horse.damId, generation: generation + 1 });
        }
      }
    }

    logger.info(`[horseController.gatherLineage] Gathered ${ancestors.length} ancestors`);
    return ancestors;
  } catch (error) {
    logger.error(`[horseController.gatherLineage] Error gathering lineage: ${error.message}`);
    return [];
  }
}

/**
 * Assess feed quality from mare's health status and care indicators
 * @param {Object} mare - Mare object with healthStatus and other properties
 * @returns {number} - Feed quality score (0-100)
 */
function assessFeedQualityFromMare(mare) {
  try {
    let feedQuality = 50; // Base quality

    // Assess based on health status
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

    // Adjust based on bond score (higher bond = better care)
    const bondScore = mare.bondScore || 50;
    if (bondScore >= 80) {
      feedQuality += 10;
    } else if (bondScore >= 60) {
      feedQuality += 5;
    } else if (bondScore <= 30) {
      feedQuality -= 10;
    }

    // Cap at 100
    feedQuality = Math.min(feedQuality, 100);
    feedQuality = Math.max(feedQuality, 0);

    logger.info(
      `[horseController.assessFeedQualityFromMare] Mare ${mare.name} feed quality: ${feedQuality} (health: ${mare.healthStatus}, bond: ${bondScore})`,
    );

    return feedQuality;
  } catch (error) {
    logger.error(
      `[horseController.assessFeedQualityFromMare] Error assessing feed quality: ${error.message}`,
    );
    return 50; // Default on error
  }
}

/**
 * Get horse overview data for detailed display
 * Returns everything needed for the horse overview screen
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getHorseOverview(req, res) {
  try {
    const { id } = req.params;

    // Validate horse ID
    const horseId = parseInt(id, 10);
    if (isNaN(horseId) || horseId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid horse ID. Must be a positive integer.',
        data: null,
      });
    }

    logger.info(`[horseController.getHorseOverview] Getting overview for horse ${horseId}`);

    // Get full horse record with all needed data
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: {
        id: true,
        name: true,
        age: true,
        trait: true,
        disciplineScores: true,
        totalEarnings: true,
        tack: true,
        rider: true,
      },
    });

    if (!horse) {
      logger.warn(`[horseController.getHorseOverview] Horse ${horseId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Horse not found',
        data: null,
      });
    }

    // Calculate next training date
    let nextTrainingDate = 'never';
    try {
      const lastTrainingDate = await getAnyRecentTraining(horseId);
      if (lastTrainingDate) {
        const nextTraining = new Date(lastTrainingDate);
        nextTraining.setDate(nextTraining.getDate() + 7); // Add 7 days

        // Only set next training date if it's in the future
        const now = new Date();
        if (nextTraining > now) {
          nextTrainingDate = nextTraining.toISOString();
        }
      }
    } catch (error) {
      logger.warn(
        `[horseController.getHorseOverview] Error calculating next training date: ${error.message}`,
      );
      // Continue with null next training date
    }

    // Get most recent show result
    let lastShowResult = 'never';
    try {
      const recentResult = await prisma.competitionResult.findFirst({
        where: {
          horseId,
        },
        orderBy: {
          runDate: 'desc',
        },
        select: {
          showName: true,
          placement: true,
          runDate: true,
        },
      });

      if (recentResult) {
        lastShowResult = {
          showName: recentResult.showName,
          placement: recentResult.placement,
          runDate: recentResult.runDate.toISOString(),
        };
      }
    } catch (error) {
      logger.warn(
        `[horseController.getHorseOverview] Error getting last show result: ${error.message}`,
      );
      // Continue with null last show result
    }

    // Prepare response data
    const overviewData = {
      id: horse.id,
      name: horse.name,
      age: horse.age,
      trait: horse.trait,
      disciplineScores: horse.disciplineScores || {},
      nextTrainingDate,
      earnings: horse.totalEarnings || 0,
      lastShowResult,
      rider: horse.rider || 'none',
      tack: horse.tack || {},
    };

    logger.info(
      `[horseController.getHorseOverview] Successfully retrieved overview for horse ${horse.name} (ID: ${horseId})`,
    );

    res.status(200).json({
      success: true,
      message: 'Horse overview retrieved successfully',
      data: overviewData,
    });
  } catch (error) {
    logger.error(
      `[horseController.getHorseOverview] Error getting horse overview: ${error.message}`,
    );

    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving horse overview',
      data: null,
    });
  }
}

/**
 * Get most compatible grooms for a horse based on temperament
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getHorsePersonalityImpact(req, res) {
  try {
    const { id } = req.params;
    const horseId = parseInt(id, 10);

    if (isNaN(horseId) || horseId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid horse ID. Must be a positive integer.',
      });
    }

    // Get horse with temperament
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: {
        id: true,
        name: true,
        temperament: true,
        bondScore: true,
        userId: true,
      },
    });

    if (!horse) {
      return res.status(404).json({
        success: false,
        message: 'Horse not found',
      });
    }

    if (!horse.temperament) {
      return res.status(400).json({
        success: false,
        message: 'Horse temperament not set. Cannot calculate personality compatibility.',
      });
    }

    // Get all grooms for the user
    const grooms = await prisma.groom.findMany({
      where: { userId: horse.userId },
      select: {
        id: true,
        name: true,
        personality: true,
        speciality: true,
        skillLevel: true,
        experience: true,
        sessionRate: true,
        isActive: true,
      },
    });

    // Calculate compatibility for each groom
    const { getCompatibleGroomsForTemperament, calculatePersonalityCompatibility } = await import(
      '../../../utils/groomPersonalityTraitBonus.mjs'
    );

    const groomCompatibility = grooms.map(groom => {
      const compatibility = calculatePersonalityCompatibility(
        groom.personality,
        horse.temperament,
        horse.bondScore || 50,
      );

      return {
        groom: {
          id: groom.id,
          name: groom.name,
          personality: groom.personality,
          speciality: groom.speciality,
          skillLevel: groom.skillLevel,
          experience: groom.experience,
          sessionRate: groom.sessionRate,
          isActive: groom.isActive,
        },
        compatibility: {
          isMatch: compatibility.isMatch,
          isStrongMatch: compatibility.isStrongMatch,
          traitModifier: compatibility.traitModifierScore,
          stressReduction: Math.abs(compatibility.stressResistanceBonus * 100), // Convert to percentage
          bondModifier: compatibility.bondModifier,
          description: compatibility.description,
          recommendation: compatibility.isMatch
            ? "Excellent match for this horse's temperament"
            : "May not be the best match for this horse's temperament",
        },
      };
    });

    // Sort by compatibility (matches first, then by trait modifier)
    groomCompatibility.sort((a, b) => {
      if (a.compatibility.isMatch && !b.compatibility.isMatch) {
        return -1;
      }
      if (!a.compatibility.isMatch && b.compatibility.isMatch) {
        return 1;
      }
      return b.compatibility.traitModifier - a.compatibility.traitModifier;
    });

    // Get general compatibility info for this temperament
    const generalCompatibility = getCompatibleGroomsForTemperament(horse.temperament);

    logger.info(
      `[horseController.getHorsePersonalityImpact] Retrieved personality compatibility for horse ${horseId} (${horse.temperament})`,
    );

    res.json({
      success: true,
      horse: {
        id: horse.id,
        name: horse.name,
        temperament: horse.temperament,
        bondScore: horse.bondScore,
      },
      groomCompatibility,
      generalCompatibility,
      totalGrooms: grooms.length,
      compatibleGrooms: groomCompatibility.filter(g => g.compatibility.isMatch).length,
    });
  } catch (error) {
    logger.error(`[horseController.getHorsePersonalityImpact] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate personality compatibility',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
}

/**
 * Get conformation scores for a horse.
 * Returns all 8 region scores + overall conformation average.
 * Horse is pre-attached to req.horse by requireOwnership middleware.
 *
 * @param {Object} req - Express request object (req.horse attached by middleware)
 * @param {Object} res - Express response object
 */
export async function getConformation(req, res) {
  try {
    const horse = req.horse;
    const scores = horse.conformationScores;

    // Legacy horse without conformation scores
    if (!scores) {
      return res.status(200).json({
        success: true,
        message: 'No conformation scores available for this horse',
        data: null,
      });
    }

    // Build response with all 8 regions + overall (null for missing legacy regions)
    const conformationScores = {};
    for (const region of CONFORMATION_REGIONS) {
      conformationScores[region] = scores[region] ?? null;
    }
    conformationScores.overallConformation =
      scores.overallConformation ?? calculateOverallConformation(scores);

    logger.info(
      `[horseController.getConformation] Retrieved conformation for horse ${horse.id}: overall=${conformationScores.overallConformation}`,
    );

    res.status(200).json({
      success: true,
      message: 'Conformation scores retrieved successfully',
      data: {
        horseId: horse.id,
        horseName: horse.name,
        breedId: horse.breedId,
        conformationScores,
      },
    });
  } catch (error) {
    logger.error(`[horseController.getConformation] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving conformation scores',
      data: null,
    });
  }
}

/**
 * Get conformation analysis with percentile rankings compared to the horse's breed.
 * Percentile = percentage of same-breed horses scoring LOWER than this horse per region.
 * Breed mean comes from BREED_GENETIC_PROFILES (designed profile mean, not database average).
 *
 * @param {Object} req - Express request object (req.horse attached by middleware)
 * @param {Object} res - Express response object
 */
export async function getConformationAnalysis(req, res) {
  try {
    const horse = req.horse;
    const scores = horse.conformationScores;

    // Legacy horse without conformation scores
    if (!scores) {
      return res.status(200).json({
        success: true,
        message: 'No conformation scores available for this horse',
        data: null,
      });
    }

    // Guard: breedId must be defined for meaningful percentile analysis
    if (!horse.breedId) {
      return res.status(200).json({
        success: true,
        message: 'No breed assigned — percentile analysis unavailable',
        data: null,
      });
    }

    // Get all same-breed horses for percentile calculation
    // TODO(scalability): When breed populations exceed ~10k, switch to a SQL percentile_cont()
    // aggregate or pre-computed percentile table to avoid loading all horses into memory.
    const sameBreedHorses = await prisma.horse.findMany({
      where: { breedId: horse.breedId },
      select: { conformationScores: true },
    });

    // Filter out horses without conformation scores
    const validHorses = sameBreedHorses.filter(h => h.conformationScores != null);

    // Get breed profile for designed means
    const profile = BREED_GENETIC_PROFILES[horse.breedId];
    const breedConformation = profile ? profile.rating_profiles.conformation : null;

    // Get breed name from CANONICAL_BREEDS
    const breed = CANONICAL_BREEDS.find(b => b.id === horse.breedId);
    const breedName = breed ? breed.name : 'Unknown';

    // Calculate analysis per region
    const analysis = {};
    for (const region of CONFORMATION_REGIONS) {
      const score = scores[region] ?? 0;
      const breedMean = breedConformation ? breedConformation[region].mean : 50;

      // Percentile: count horses scoring lower / total
      let percentile;
      if (validHorses.length <= 1) {
        // Only 1 horse of this breed → default to 50th percentile
        percentile = 50;
      } else {
        const lowerCount = validHorses.filter(
          h => h.conformationScores[region] != null && h.conformationScores[region] < score,
        ).length;
        percentile = Math.round((lowerCount / validHorses.length) * 100);
      }

      analysis[region] = { score, breedMean, percentile };
    }

    // Overall conformation analysis
    const overallScore = scores.overallConformation ?? calculateOverallConformation(scores);
    const overallBreedMean = breedConformation
      ? Math.round(
          CONFORMATION_REGIONS.reduce((sum, r) => sum + breedConformation[r].mean, 0) /
            CONFORMATION_REGIONS.length,
        )
      : 50;

    let overallPercentile;
    if (validHorses.length <= 1) {
      overallPercentile = 50;
    } else {
      const overallLowerCount = validHorses.filter(h => {
        const hOverall =
          h.conformationScores.overallConformation ??
          calculateOverallConformation(h.conformationScores);
        return hOverall < overallScore;
      }).length;
      overallPercentile = Math.round((overallLowerCount / validHorses.length) * 100);
    }

    logger.info(
      `[horseController.getConformationAnalysis] Analysis for horse ${horse.id} (${breedName}): ${validHorses.length} same-breed horses`,
    );

    res.status(200).json({
      success: true,
      message: 'Conformation analysis retrieved successfully',
      data: {
        horseId: horse.id,
        horseName: horse.name,
        breedId: horse.breedId,
        breedName,
        totalHorsesInBreed: validHorses.length,
        analysis,
        overallConformation: {
          score: overallScore,
          breedMean: overallBreedMean,
          percentile: overallPercentile,
        },
      },
    });
  } catch (error) {
    logger.error(`[horseController.getConformationAnalysis] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving conformation analysis',
      data: null,
    });
  }
}

/**
 * Get gait quality scores for a specific horse.
 * Returns walk, trot, canter, gallop scores + gaiting entries for gaited breeds.
 * Horse is pre-attached to req.horse by requireOwnership middleware.
 *
 * @param {Object} req - Express request object (req.horse attached by middleware)
 * @param {Object} res - Express response object
 */
export async function getGaits(req, res) {
  try {
    const horse = req.horse;
    const gaitScores = horse.gaitScores;

    // Legacy horse without gait scores
    if (!gaitScores) {
      return res.status(200).json({
        success: true,
        message: 'No gait scores available for this horse',
        data: null,
      });
    }

    logger.info(`[horseController.getGaits] Retrieved gait scores for horse ${horse.id}`);

    res.status(200).json({
      success: true,
      message: 'Gait scores retrieved successfully',
      data: {
        horseId: horse.id,
        horseName: horse.name,
        breedId: horse.breedId,
        gaitScores,
      },
    });
  } catch (error) {
    logger.error(`[horseController.getGaits] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving gait scores',
      data: null,
    });
  }
}
