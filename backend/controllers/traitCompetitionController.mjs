/**
 * Trait Competition Controller
 * Handles trait-based competition analysis and impact calculations
 */

import {
  calculateTraitCompetitionImpact,
  getAllTraitCompetitionEffects,
  hasSpecializedEffect,
} from '../utils/traitCompetitionImpact.mjs';
import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

/**
 * Analyze trait impact for a specific horse and discipline
 * GET /api/traits/competition-impact/:horseId
 */
export async function analyzeHorseTraitImpact(req, res) {
  try {
    const { horseId } = req.params;
    const { discipline } = req.query;

    // Validate inputs
    if (!horseId || isNaN(parseInt(horseId))) {
      return res.status(400).json({
        success: false,
        message: 'Valid horse ID is required',
        data: null,
      });
    }

    if (!discipline) {
      return res.status(400).json({
        success: false,
        message: 'Discipline parameter is required',
        data: null,
      });
    }

    // Horse ownership already validated by requireOwnership middleware
    // Fetch full horse data with needed fields (ownership check already done by middleware)
    const horse = await prisma.horse.findUnique({
      where: { id: parseInt(horseId) },
      select: {
        id: true,
        name: true,
        epigenetic_modifiers: true,
        // Include basic stats for base score calculation
        stamina: true,
        balance: true,
        boldness: true,
        flexibility: true,
        obedience: true,
        focus: true,
      },
    });

    if (!horse) {
      logger.error(
        `[traitCompetitionController.analyzeHorseTraitImpact] Horse ${horseId} not found after middleware validation`,
      );
      return res.status(404).json({
        success: false,
        message: 'Horse not found',
        data: null,
      });
    }

    // Calculate base score for reference (simplified)
    const baseScore = 100; // Use a standard base score for analysis

    // Calculate trait impact
    const traitImpact = calculateTraitCompetitionImpact(horse, discipline, baseScore);

    // Prepare response
    const response = {
      horseId: horse.id,
      horseName: horse.name,
      discipline,
      analysis: {
        baseScore,
        traitModifier: traitImpact.totalScoreModifier,
        scoreAdjustment: traitImpact.finalScoreAdjustment,
        finalScore: baseScore + traitImpact.finalScoreAdjustment,
        percentageChange: (traitImpact.totalScoreModifier * 100).toFixed(2),
      },
      traits: {
        total: traitImpact.appliedTraits.length,
        bonuses: traitImpact.traitBonuses.length,
        penalties: traitImpact.traitPenalties.length,
        details: traitImpact.appliedTraits.map(trait => ({
          name: trait.name,
          type: trait.type,
          modifier: trait.modifier,
          percentageEffect: `${(trait.modifier * 100).toFixed(2)}%`,
          isSpecialized: trait.isSpecialized,
          discipline: trait.discipline,
          description: trait.description,
        })),
      },
      summary: {
        hasPositiveTraits: traitImpact.traitBonuses.length > 0,
        hasNegativeTraits: traitImpact.traitPenalties.length > 0,
        netEffect:
          traitImpact.totalScoreModifier > 0
            ? 'positive'
            : traitImpact.totalScoreModifier < 0
              ? 'negative'
              : 'neutral',
        specializedTraits: traitImpact.appliedTraits.filter(t => t.isSpecialized).length,
        generalTraits: traitImpact.appliedTraits.filter(t => !t.isSpecialized).length,
      },
    };

    logger.info(
      `[traitCompetitionController] Analyzed trait impact for horse ${horse.name} in ${discipline}: ${response.analysis.percentageChange}% effect`,
    );

    res.json({
      success: true,
      message: 'Trait impact analysis completed',
      data: response,
    });
  } catch (error) {
    logger.error(`[traitCompetitionController.analyzeHorseTraitImpact] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze trait impact',
      data: null,
    });
  }
}

/**
 * Compare trait impact across multiple disciplines for a horse
 * GET /api/traits/competition-comparison/:horseId
 */
export async function compareTraitImpactAcrossDisciplines(req, res) {
  try {
    const { horseId } = req.params;
    const disciplines = [
      'Dressage',
      'Show Jumping',
      'Cross Country',
      'Racing',
      'Endurance',
      'Reining',
      'Driving',
      'Trail',
      'Eventing',
    ];

    // Validate horse ID
    if (!horseId || isNaN(parseInt(horseId))) {
      return res.status(400).json({
        success: false,
        message: 'Valid horse ID is required',
        data: null,
      });
    }

    // Horse ownership already validated by requireOwnership middleware
    // Fetch full horse data with needed fields (ownership check already done by middleware)
    const horse = await prisma.horse.findUnique({
      where: { id: parseInt(horseId) },
      select: {
        id: true,
        name: true,
        epigenetic_modifiers: true,
      },
    });

    if (!horse) {
      logger.error(
        `[traitCompetitionController.compareTraitImpactAcrossDisciplines] Horse ${horseId} not found after middleware validation`,
      );
      return res.status(404).json({
        success: false,
        message: 'Horse not found',
        data: null,
      });
    }

    const baseScore = 100;
    const comparisons = [];

    // Calculate impact for each discipline
    disciplines.forEach(discipline => {
      const traitImpact = calculateTraitCompetitionImpact(horse, discipline, baseScore);

      comparisons.push({
        discipline,
        modifier: traitImpact.totalScoreModifier,
        adjustment: traitImpact.finalScoreAdjustment,
        percentageEffect: `${(traitImpact.totalScoreModifier * 100).toFixed(2)}%`,
        specializedTraits: traitImpact.appliedTraits.filter(t => t.isSpecialized).length,
        totalTraits: traitImpact.appliedTraits.length,
        netEffect:
          traitImpact.totalScoreModifier > 0
            ? 'positive'
            : traitImpact.totalScoreModifier < 0
              ? 'negative'
              : 'neutral',
      });
    });

    // Sort by impact (best to worst)
    comparisons.sort((a, b) => b.modifier - a.modifier);

    // Find best and worst disciplines
    const [bestDiscipline] = comparisons;
    const worstDiscipline = comparisons[comparisons.length - 1];

    const response = {
      horseId: horse.id,
      horseName: horse.name,
      comparison: comparisons,
      summary: {
        bestDiscipline: {
          name: bestDiscipline.discipline,
          effect: bestDiscipline.percentageEffect,
          specializedTraits: bestDiscipline.specializedTraits,
        },
        worstDiscipline: {
          name: worstDiscipline.discipline,
          effect: worstDiscipline.percentageEffect,
          specializedTraits: worstDiscipline.specializedTraits,
        },
        averageEffect: `${((comparisons.reduce((sum, comp) => sum + comp.modifier, 0) / comparisons.length) * 100).toFixed(2)}%`,
        disciplinesWithBonuses: comparisons.filter(comp => comp.modifier > 0).length,
        disciplinesWithPenalties: comparisons.filter(comp => comp.modifier < 0).length,
      },
    };

    logger.info(
      `[traitCompetitionController] Compared trait impact for horse ${horse.name} across ${disciplines.length} disciplines`,
    );

    res.json({
      success: true,
      message: 'Trait impact comparison completed',
      data: response,
    });
  } catch (error) {
    logger.error(
      `[traitCompetitionController.compareTraitImpactAcrossDisciplines] Error: ${error.message}`,
    );
    res.status(500).json({
      success: false,
      message: 'Failed to compare trait impact',
      data: null,
    });
  }
}

/**
 * Get discipline recommendations based on specialized trait effects
 * GET /api/traits/discipline-recommendations/:horseId
 */
export async function getDisciplineRecommendations(req, res) {
  try {
    const { horseId } = req.params;

    // Validate horse ID
    if (!horseId || isNaN(parseInt(horseId))) {
      return res.status(400).json({
        success: false,
        message: 'Valid horse ID is required',
        data: null,
      });
    }

    // Fetch horse data with traits
    const horse = await prisma.horse.findUnique({
      where: { id: parseInt(horseId) },
      select: {
        id: true,
        name: true,
        epigenetic_modifiers: true,
      },
    });

    if (!horse) {
      return res.status(404).json({
        success: false,
        message: 'Horse not found',
        data: null,
      });
    }

    // Get all visible traits
    const traits = horse.epigenetic_modifiers || { positive: [], negative: [], hidden: [] };
    const allVisibleTraits = [...(traits.positive || []), ...(traits.negative || [])];

    if (allVisibleTraits.length === 0) {
      return res.json({
        success: true,
        message: 'No traits available for analysis',
        data: {
          horseId: horse.id,
          horseName: horse.name,
          recommendations: [],
          summary: {
            totalTraits: 0,
            specializedTraits: 0,
            recommendedDisciplines: 0,
          },
        },
      });
    }

    // Define all competition disciplines
    const disciplines = [
      'Dressage',
      'Show Jumping',
      'Cross Country',
      'Racing',
      'Endurance',
      'Reining',
      'Driving',
      'Trail',
      'Eventing',
    ];

    // Analyze each discipline for specialized traits
    const disciplineAnalysis = {};

    disciplines.forEach(discipline => {
      const specializedTraits = [];
      let positiveCount = 0;
      let negativeCount = 0;

      allVisibleTraits.forEach(traitName => {
        if (hasSpecializedEffect(traitName, discipline)) {
          const traitImpact = calculateTraitCompetitionImpact(horse, discipline, 100);
          const traitDetail = traitImpact.appliedTraits.find(
            t => t.name === traitName && t.isSpecialized,
          );

          if (traitDetail) {
            specializedTraits.push({
              name: traitName,
              type: traitDetail.type,
              modifier: traitDetail.modifier,
              percentageEffect: `${(traitDetail.modifier * 100).toFixed(2)}%`,
              description: traitDetail.description,
            });

            if (traitDetail.type === 'positive') {
              positiveCount++;
            } else {
              negativeCount++;
            }
          }
        }
      });

      if (specializedTraits.length > 0) {
        // Calculate overall recommendation score
        const totalModifier = specializedTraits.reduce((sum, t) => sum + t.modifier, 0);

        disciplineAnalysis[discipline] = {
          discipline,
          specializedTraits,
          totalSpecialized: specializedTraits.length,
          positiveTraits: positiveCount,
          negativeTraits: negativeCount,
          overallModifier: totalModifier,
          percentageEffect: `${(totalModifier * 100).toFixed(2)}%`,
          recommendationScore: totalModifier,
          recommendation:
            totalModifier > 0.05
              ? 'highly_recommended'
              : totalModifier > 0
                ? 'recommended'
                : totalModifier < -0.05
                  ? 'not_recommended'
                  : 'neutral',
        };
      }
    });

    // Sort disciplines by recommendation score (best to worst)
    const recommendations = Object.values(disciplineAnalysis).sort(
      (a, b) => b.recommendationScore - a.recommendationScore,
    );

    // Calculate summary statistics
    const summary = {
      totalTraits: allVisibleTraits.length,
      specializedTraits: new Set(recommendations.flatMap(r => r.specializedTraits.map(t => t.name)))
        .size,
      recommendedDisciplines: recommendations.filter(r => r.recommendationScore > 0).length,
      notRecommendedDisciplines: recommendations.filter(r => r.recommendationScore < -0.05).length,
      bestDiscipline:
        recommendations.length > 0
          ? {
            name: recommendations[0].discipline,
            effect: recommendations[0].percentageEffect,
            specializedTraits: recommendations[0].totalSpecialized,
          }
          : null,
    };

    logger.info(
      `[traitCompetitionController] Generated discipline recommendations for horse ${horse.name}: ${recommendations.length} disciplines analyzed`,
    );

    res.json({
      success: true,
      message: 'Discipline recommendations generated',
      data: {
        horseId: horse.id,
        horseName: horse.name,
        recommendations,
        summary,
      },
    });
  } catch (error) {
    logger.error(
      `[traitCompetitionController.getDisciplineRecommendations] Error: ${error.message}`,
    );
    res.status(500).json({
      success: false,
      message: 'Failed to generate discipline recommendations',
      data: null,
    });
  }
}

/**
 * Get all trait competition effects and definitions
 * GET /api/traits/competition-effects
 */
export async function getTraitCompetitionEffects(req, res) {
  try {
    const { type, discipline } = req.query;

    const allEffects = getAllTraitCompetitionEffects();
    let filteredEffects = allEffects;

    // Filter by trait type if specified
    if (type && ['positive', 'negative'].includes(type)) {
      filteredEffects = Object.fromEntries(
        Object.entries(allEffects).filter(([, effect]) => effect.type === type),
      );
    }

    // Transform for response
    const effectsArray = Object.entries(filteredEffects).map(([traitName, effect]) => {
      const traitInfo = {
        name: traitName,
        displayName: effect.name,
        type: effect.type,
        general: {
          scoreModifier: effect.general.scoreModifier,
          percentageEffect: `${(effect.general.scoreModifier * 100).toFixed(2)}%`,
          description: effect.general.description,
        },
        disciplines: {},
      };

      // Add discipline-specific effects
      if (effect.disciplines) {
        Object.entries(effect.disciplines).forEach(([disciplineName, disciplineEffect]) => {
          traitInfo.disciplines[disciplineName] = {
            scoreModifier: disciplineEffect.scoreModifier,
            percentageEffect: `${(disciplineEffect.scoreModifier * 100).toFixed(2)}%`,
            description: disciplineEffect.description,
            isSpecialized: true,
          };
        });
      }

      // If specific discipline requested, highlight it
      if (discipline && traitInfo.disciplines[discipline]) {
        traitInfo.forDiscipline = traitInfo.disciplines[discipline];
      }

      return traitInfo;
    });

    // Sort by type and then by effect strength
    effectsArray.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'positive' ? -1 : 1;
      }
      return Math.abs(b.general.scoreModifier) - Math.abs(a.general.scoreModifier);
    });

    const response = {
      totalTraits: effectsArray.length,
      positiveTraits: effectsArray.filter(t => t.type === 'positive').length,
      negativeTraits: effectsArray.filter(t => t.type === 'negative').length,
      filter: { type: type || 'all', discipline: discipline || 'all' },
      effects: effectsArray,
    };

    res.json({
      success: true,
      message: 'Trait competition effects retrieved',
      data: response,
    });
  } catch (error) {
    logger.error(`[traitCompetitionController.getTraitCompetitionEffects] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve trait effects',
      data: null,
    });
  }
}
