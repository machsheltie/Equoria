/**
 * Population Genetic Health
 *
 * Aggregate population-level health metrics + grading:
 *   - Cross-population inbreeding distribution analysis
 *   - Genetic-bottleneck identification (trait concentration, founder dominance)
 *   - Composite health score → A-F grade
 *   - Population-level recommendations (semantic action records)
 *
 * Refs Equoria-1743t (god-file split AC #1: populationHealth.mjs).
 */

import prisma from '../../../packages/database/prismaClient.mjs';
import logger from '../../utils/logger.mjs';

import {
  calculateAdvancedGeneticDiversity,
  calculateEffectivePopulationSize,
  identifyGeneticFounders,
} from './geneticDiversityMetrics.mjs';
import { calculateDetailedInbreedingCoefficient } from './inbreedingAnalysis.mjs';

/**
 * Population genetic-health snapshot: diversity, effective size, inbreeding,
 * bottlenecks, recommendations, and a composite A-F grade.
 * @param {Array<number>} horseIds
 * @returns {Promise<Object>}
 */
export async function trackPopulationGeneticHealth(horseIds) {
  logger.info(
    `[populationHealth.trackPopulationGeneticHealth] Tracking health for ${horseIds.length} horses`,
  );

  const diversity = await calculateAdvancedGeneticDiversity(horseIds);
  const effectiveSize = await calculateEffectivePopulationSize(horseIds);
  const inbreedingLevels = await analyzePopulationInbreeding(horseIds);
  const geneticBottlenecks = await identifyPopulationBottlenecks(horseIds);

  const overallHealth = calculatePopulationHealthScore(diversity, effectiveSize, inbreedingLevels);

  const recommendations = generatePopulationRecommendations(
    overallHealth,
    diversity,
    inbreedingLevels,
    geneticBottlenecks,
  );

  return {
    overallHealth,
    diversityTrends: {
      current: diversity.diversityScore,
      trend: 'stable', // historical trend tracking is future work
      effectiveSize: effectiveSize.effectiveSize,
    },
    inbreedingLevels,
    geneticBottlenecks,
    recommendations,
  };
}

/**
 * Population-level inbreeding distribution. Walks every horse with both
 * parents known, computes per-individual coefficient, and bins by risk level.
 * @param {Array<number>} horseIds
 * @returns {Promise<Object>}
 */
export async function analyzePopulationInbreeding(horseIds) {
  const horses = await prisma.horse.findMany({
    where: { id: { in: horseIds } },
    select: { id: true, sireId: true, damId: true },
  });

  let totalInbreeding = 0;
  let inbredHorses = 0;
  const inbreedingDistribution = { low: 0, medium: 0, high: 0, critical: 0 };

  for (const horse of horses) {
    if (horse.sireId && horse.damId) {
      try {
        const inbreeding = await calculateDetailedInbreedingCoefficient(horse.sireId, horse.damId);
        totalInbreeding += inbreeding.coefficient;

        if (inbreeding.coefficient > 0) {
          inbredHorses++;
          inbreedingDistribution[inbreeding.riskAssessment.level]++;
        } else {
          inbreedingDistribution.low++;
        }
      } catch (_error) {
        // skip horses with calculation errors
        inbreedingDistribution.low++;
      }
    } else {
      inbreedingDistribution.low++;
    }
  }

  const averageInbreeding = horses.length > 0 ? totalInbreeding / horses.length : 0;

  return {
    averageCoefficient: Math.round(averageInbreeding * 1000) / 1000,
    inbredPercentage: horses.length > 0 ? Math.round((inbredHorses / horses.length) * 100) : 0,
    distribution: inbreedingDistribution,
    riskLevel: averageInbreeding > 0.125 ? 'high' : averageInbreeding > 0.0625 ? 'medium' : 'low',
  };
}

/**
 * Identify genetic bottlenecks: over-represented traits (>75% frequency)
 * and founder-dominance (>50% of population descended from one founder).
 * @param {Array<number>} horseIds
 * @returns {Promise<Array<Object>>}
 */
export async function identifyPopulationBottlenecks(horseIds) {
  const horses = await prisma.horse.findMany({
    where: { id: { in: horseIds } },
    select: { id: true, name: true, epigeneticModifiers: true, sireId: true, damId: true },
  });

  const bottlenecks = [];

  const traitCounts = {};
  horses.forEach(horse => {
    const traits = horse.epigeneticModifiers || { positive: [], negative: [], hidden: [] };
    [...traits.positive, ...traits.negative, ...traits.hidden].forEach(trait => {
      traitCounts[trait] = (traitCounts[trait] || 0) + 1;
    });
  });

  Object.entries(traitCounts).forEach(([trait, count]) => {
    const frequency = count / horses.length;
    if (frequency > 0.75) {
      bottlenecks.push({
        type: 'trait_concentration',
        trait,
        frequency: Math.round(frequency * 100),
        severity: frequency > 0.9 ? 'critical' : 'high',
        description: `Trait '${trait}' appears in ${Math.round(frequency * 100)}% of population`,
        recommendation: 'Introduce genetic diversity through outcrossing',
      });
    }
  });

  const founders = await identifyGeneticFounders(horseIds);
  const dominantFounders = founders.filter(f => f.contribution > 50);

  dominantFounders.forEach(founder => {
    bottlenecks.push({
      type: 'founder_dominance',
      founderId: founder.id,
      founderName: founder.name,
      contribution: founder.contribution,
      severity: founder.contribution > 75 ? 'critical' : 'high',
      description: `Founder '${founder.name}' contributes to ${founder.contribution}% of population`,
      recommendation: 'Reduce reliance on this founder line through diversified breeding',
    });
  });

  return bottlenecks;
}

/**
 * Composite weighted health score: 40% diversity, 30% effective-size,
 * 30% inbreeding (inverted). Mapped to A-F grade.
 * @param {Object} diversity
 * @param {Object} effectiveSize
 * @param {Object} inbreedingLevels
 * @returns {Object}
 */
export function calculatePopulationHealthScore(diversity, effectiveSize, inbreedingLevels) {
  let score = 0;
  score += diversity.diversityScore * 0.4;
  const sizeScore = Math.min(100, (effectiveSize.effectiveSize / 50) * 100); // Ne=50 is good
  score += sizeScore * 0.3;
  const inbreedingScore = Math.max(0, 100 - inbreedingLevels.averageCoefficient * 1000);
  score += inbreedingScore * 0.3;

  const finalScore = Math.round(score);

  let grade = 'F';
  if (finalScore >= 90) {
    grade = 'A';
  } else if (finalScore >= 80) {
    grade = 'B';
  } else if (finalScore >= 70) {
    grade = 'C';
  } else if (finalScore >= 60) {
    grade = 'D';
  }

  return {
    score: finalScore,
    grade,
    components: {
      diversity: Math.round(diversity.diversityScore),
      effectiveSize: Math.round(sizeScore),
      inbreeding: Math.round(inbreedingScore),
    },
  };
}

/**
 * Population-level recommendations (action records, not raw strings).
 * @param {Object} overallHealth
 * @param {Object} diversity
 * @param {Object} inbreedingLevels
 * @param {Array<Object>} geneticBottlenecks
 * @returns {Array<Object>}
 */
function generatePopulationRecommendations(
  overallHealth,
  diversity,
  inbreedingLevels,
  geneticBottlenecks,
) {
  const recommendations = [];

  if (overallHealth.score < 60) {
    recommendations.push({
      priority: 'urgent',
      category: 'population_health',
      action: 'Implement genetic rescue program',
      description:
        'Population health is critically low - introduce new genetic material immediately',
    });
  } else if (overallHealth.score < 80) {
    recommendations.push({
      priority: 'high',
      category: 'population_health',
      action: 'Increase genetic diversity',
      description: 'Population health is below optimal - focus on diversifying breeding program',
    });
  }

  if (diversity.diversityScore < 50) {
    recommendations.push({
      priority: 'high',
      category: 'genetic_diversity',
      action: 'Outcrossing program',
      description: 'Low genetic diversity detected - implement systematic outcrossing',
    });
  }

  if (inbreedingLevels.riskLevel === 'high') {
    recommendations.push({
      priority: 'high',
      category: 'inbreeding',
      action: 'Reduce inbreeding',
      description: 'High population inbreeding levels - avoid close relative breeding',
    });
  }

  geneticBottlenecks.forEach(bottleneck => {
    recommendations.push({
      priority: bottleneck.severity === 'critical' ? 'urgent' : 'medium',
      category: 'genetic_bottleneck',
      action: bottleneck.recommendation,
      description: bottleneck.description,
    });
  });

  return recommendations;
}
