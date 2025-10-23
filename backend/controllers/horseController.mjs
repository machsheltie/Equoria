import { getResultsByHorse } from '../models/resultModel.mjs';
import { createHorse, getHorseById } from '../models/horseModel.mjs';
import { getAnyRecentTraining } from '../models/trainingModel.mjs';
import { applyEpigeneticTraitsAtBirth } from '../utils/applyEpigeneticTraitsAtBirth.mjs';
import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

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
      epigeneticModifiers: {
        positive: epigeneticTraits.positive || [],
        negative: epigeneticTraits.negative || [],
        hidden: [], // Hidden traits are revealed later through trait discovery
      },
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
        ownerId: true,
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
      where: { userId: horse.ownerId },
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
    const { getCompatibleGroomsForTemperament, calculatePersonalityCompatibility } = await import('../utils/groomPersonalityTraitBonus.mjs');

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
            ? 'Excellent match for this horse\'s temperament'
            : 'May not be the best match for this horse\'s temperament',
        },
      };
    });

    // Sort by compatibility (matches first, then by trait modifier)
    groomCompatibility.sort((a, b) => {
      if (a.compatibility.isMatch && !b.compatibility.isMatch) { return -1; }
      if (!a.compatibility.isMatch && b.compatibility.isMatch) { return 1; }
      return b.compatibility.traitModifier - a.compatibility.traitModifier;
    });

    // Get general compatibility info for this temperament
    const generalCompatibility = getCompatibleGroomsForTemperament(horse.temperament);

    logger.info(`[horseController.getHorsePersonalityImpact] Retrieved personality compatibility for horse ${horseId} (${horse.temperament})`);

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
