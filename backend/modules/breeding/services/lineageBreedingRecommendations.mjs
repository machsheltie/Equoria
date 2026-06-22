/**
 * Lineage Breeding Recommendations Service
 * (Equoria-urqic.6 split from advancedLineageAnalysisService.mjs)
 *
 * Owns the breeding-recommendation aggregator and its scoring helpers:
 * compatibility scoring, strength/risk identification, actionable suggestions,
 * and expected-outcome prediction. This is the orchestration entrypoint that
 * composes lineageData (lineageTree.mjs), diversity + inbreeding metrics
 * (lineageDiversity.mjs), and performance analysis (lineagePerformance.mjs)
 * into the recommendation envelope the breeding route returns.
 *
 * Split out of lineagePerformance.mjs so both files stay under the urqic.6
 * ~500-line target: per-generation performance ANALYSIS (lineagePerformance)
 * and breeding RECOMMENDATION synthesis (this file) are distinct concerns even
 * though the latter consumes the former.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { asFlagArray } from '../../../utils/jsonbArrayGuard.mjs';
import AppError from '../../../errors/AppError.mjs';
import { organizeByGenerations } from './lineageTree.mjs';
import {
  calculateGeneticDiversityMetrics,
  calculateInbreedingCoefficient,
} from './lineageDiversity.mjs';
import { analyzeLineagePerformance } from './lineagePerformance.mjs';

/**
 * Generate comprehensive breeding recommendations.
 *
 * Equoria-axad9.2: renamed from generateBreedingRecommendations to a distinct
 * canonical name. The enhancedGeneticProbabilityService also exported a
 * generateBreedingRecommendations (sync, object-based) and both were `export *`'d
 * through breeding/index.mjs — one silently shadowed the other at the barrel.
 * This ASYNC, ID-consuming, real-DB lineage variant is now
 * generateLineageBreedingRecommendations; the sync genetic variant is
 * generateGeneticBreedingRecommendations.
 * @param {number} stallionId - Stallion ID
 * @param {number} mareId - Mare ID
 * @returns {Object} Breeding recommendations and analysis
 */
export async function generateLineageBreedingRecommendations(stallionId, mareId) {
  logger.info(
    `[lineageBreedingRecommendations.generateLineageBreedingRecommendations] Generating recommendations for stallion ${stallionId} and mare ${mareId}`,
  );

  // Get detailed horse data
  const [stallion, mare] = await Promise.all([
    prisma.horse.findUnique({
      where: { id: stallionId },
      include: { competitionResults: true },
    }),
    prisma.horse.findUnique({
      where: { id: mareId },
      include: { competitionResults: true },
    }),
  ]);

  if (!stallion || !mare) {
    // Equoria-4xwyi: throw a TYPED 404 (AppError, statusCode 404) instead of a
    // plain Error so the advancedBreedingGeneticsRoutes breeding-recommendations
    // handler can detect not-found by type (AppError.isAppError + statusCode===404)
    // rather than the fragile error.message.includes('not found') string-sniff
    // (the Equoria-93lhj antipattern). A raw AppError preserves the exact message
    // 'One or both horses not found' (NotFoundError would rewrite it to
    // '<resource> with ID <id> not found'), so the existing 404 body is unchanged.
    throw new AppError('One or both horses not found', 404);
  }

  // Get lineage data
  const lineageData = await organizeByGenerations(stallionId, mareId, 3);

  // Calculate various metrics
  const diversityMetrics = await calculateGeneticDiversityMetrics(lineageData);
  const inbreedingCoeff = await calculateInbreedingCoefficient(stallionId, mareId);
  const performanceAnalysis = await analyzeLineagePerformance(lineageData);

  // Calculate compatibility score
  const compatibility = calculateBreedingCompatibility(
    stallion,
    mare,
    diversityMetrics,
    inbreedingCoeff,
  );

  // Identify strengths
  const strengths = identifyBreedingStrengths(stallion, mare, performanceAnalysis);

  // Identify risks
  const risks = identifyBreedingRisks(stallion, mare, diversityMetrics, inbreedingCoeff);

  // Generate actionable suggestions
  const suggestions = generateBreedingSuggestions(stallion, mare, risks, strengths);

  // Predict expected outcomes
  const expectedOutcomes = predictBreedingOutcomes(stallion, mare, performanceAnalysis);

  return {
    compatibility,
    strengths,
    risks,
    suggestions,
    expectedOutcomes,
  };
}

/**
 * Calculate breeding compatibility score
 * @param {Object} stallion - Stallion data
 * @param {Object} mare - Mare data
 * @param {Object} diversityMetrics - Genetic diversity metrics
 * @param {number} inbreedingCoeff - Inbreeding coefficient
 * @returns {Object} Compatibility assessment
 */
function calculateBreedingCompatibility(stallion, mare, diversityMetrics, inbreedingCoeff) {
  const factors = [];
  let totalScore = 0;

  // Genetic diversity factor (40% weight)
  const diversityScore = diversityMetrics.overallDiversity;
  const diversityFactor = diversityScore * 0.4;
  totalScore += diversityFactor;
  factors.push({
    name: 'Genetic Diversity',
    score: diversityScore,
    weight: 40,
    description: `Overall genetic diversity: ${diversityScore}%`,
  });

  // Inbreeding risk factor (30% weight)
  const inbreedingScore = Math.max(0, 100 - inbreedingCoeff * 100);
  const inbreedingFactor = inbreedingScore * 0.3;
  totalScore += inbreedingFactor;
  factors.push({
    name: 'Inbreeding Risk',
    score: inbreedingScore,
    weight: 30,
    description: `Low inbreeding risk: ${Math.round(inbreedingScore)}%`,
  });

  // Complementary traits factor (20% weight)
  const traitCompatibility = calculateTraitCompatibility(stallion, mare);
  const traitFactor = traitCompatibility * 0.2;
  totalScore += traitFactor;
  factors.push({
    name: 'Trait Compatibility',
    score: traitCompatibility,
    weight: 20,
    description: `Complementary traits: ${Math.round(traitCompatibility)}%`,
  });

  // Performance potential factor (10% weight)
  const performancePotential = calculatePerformancePotential(stallion, mare);
  const performanceFactor = performancePotential * 0.1;
  totalScore += performanceFactor;
  factors.push({
    name: 'Performance Potential',
    score: performancePotential,
    weight: 10,
    description: `Expected performance: ${Math.round(performancePotential)}%`,
  });

  return {
    score: Math.round(totalScore),
    factors,
  };
}

/**
 * Calculate trait compatibility between horses
 * @param {Object} stallion - Stallion data
 * @param {Object} mare - Mare data
 * @returns {number} Compatibility score (0-100)
 */
function calculateTraitCompatibility(stallion, mare) {
  const stallionTraits = [
    ...asFlagArray(stallion.positiveTraits),
    ...asFlagArray(stallion.negativeTraits),
    ...asFlagArray(stallion.hiddenTraits),
  ];
  const mareTraits = [
    ...asFlagArray(mare.positiveTraits),
    ...asFlagArray(mare.negativeTraits),
    ...asFlagArray(mare.hiddenTraits),
  ];

  const sharedTraits = stallionTraits.filter(trait => mareTraits.includes(trait));
  const totalUniqueTraits = new Set([...stallionTraits, ...mareTraits]).size;

  // Moderate overlap is good (complementary), too much overlap reduces diversity
  const overlapRatio = sharedTraits.length / Math.max(1, totalUniqueTraits);

  if (overlapRatio < 0.2) {
    return 60;
  } // Too different
  if (overlapRatio > 0.8) {
    return 40;
  } // Too similar
  return 85; // Good balance
}

/**
 * Calculate performance potential
 * @param {Object} stallion - Stallion data
 * @param {Object} mare - Mare data
 * @returns {number} Performance potential score (0-100)
 */
function calculatePerformancePotential(stallion, mare) {
  const stallionAvg = calculateAverageStats(stallion);
  const mareAvg = calculateAverageStats(mare);

  return Math.min(100, (stallionAvg + mareAvg) / 2);
}

/**
 * Calculate average stats for a horse
 * @param {Object} horse - Horse data
 * @returns {number} Average stat value
 */
function calculateAverageStats(horse) {
  // Equoria-qrb08: `??` preserves legitimate stat-0 (undeveloped/injured)
  // instead of silently boosting it to 50, which skewed the average.
  const stats = [
    horse.speed ?? 50,
    horse.stamina ?? 50,
    horse.agility ?? 50,
    horse.intelligence ?? 50,
  ];
  return stats.reduce((sum, stat) => sum + stat, 0) / stats.length;
}

/**
 * Identify breeding strengths
 * @param {Object} stallion - Stallion data
 * @param {Object} mare - Mare data
 * @param {Object} performanceAnalysis - Performance analysis
 * @returns {Array} Array of strengths
 */
function identifyBreedingStrengths(stallion, mare, performanceAnalysis) {
  const strengths = [];

  // Check for complementary stats
  // Equoria-qrb08: `??` preserves legitimate stat-0 instead of silently
  // boosting it to 50 — otherwise an injured horse falsely appears to have
  // average stats in breeding-strength analysis.
  const stallionStats = {
    speed: stallion.speed ?? 50,
    stamina: stallion.stamina ?? 50,
    agility: stallion.agility ?? 50,
    intelligence: stallion.intelligence ?? 50,
  };
  const mareStats = {
    speed: mare.speed ?? 50,
    stamina: mare.stamina ?? 50,
    agility: mare.agility ?? 50,
    intelligence: mare.intelligence ?? 50,
  };

  Object.keys(stallionStats).forEach(stat => {
    if (stallionStats[stat] > 80 || mareStats[stat] > 80) {
      strengths.push({
        type: 'stat',
        description: `Strong ${stat} genetics from ${stallionStats[stat] > mareStats[stat] ? 'stallion' : 'mare'}`,
        value: Math.max(stallionStats[stat], mareStats[stat]),
      });
    }
  });

  // Check for discipline strengths
  if (performanceAnalysis.disciplineStrengths.strongest.length > 0) {
    strengths.push({
      type: 'discipline',
      description: `Strong lineage in ${performanceAnalysis.disciplineStrengths.strongest[0].discipline}`,
      value: performanceAnalysis.disciplineStrengths.strongest[0].averageScore,
    });
  }

  return strengths;
}

/**
 * Identify breeding risks
 * @param {Object} stallion - Stallion data
 * @param {Object} mare - Mare data
 * @param {Object} diversityMetrics - Diversity metrics
 * @param {number} inbreedingCoeff - Inbreeding coefficient
 * @returns {Array} Array of risks
 */
function identifyBreedingRisks(stallion, mare, diversityMetrics, inbreedingCoeff) {
  const risks = [];

  // Inbreeding risk
  if (inbreedingCoeff > 0.1) {
    risks.push({
      type: 'inbreeding',
      severity: inbreedingCoeff > 0.25 ? 'high' : 'medium',
      description: `Elevated inbreeding risk (${Math.round(inbreedingCoeff * 100)}%)`,
      mitigation: 'Consider alternative breeding partners with more distant lineage',
    });
  }

  // Low genetic diversity
  if (diversityMetrics.overallDiversity < 40) {
    risks.push({
      type: 'diversity',
      severity: 'medium',
      description: 'Limited genetic diversity in combined lineage',
      mitigation: 'Introduce new bloodlines to increase genetic variation',
    });
  }

  // Genetic bottlenecks
  if (diversityMetrics.geneticBottlenecks.length > 0) {
    risks.push({
      type: 'bottleneck',
      severity: 'medium',
      description: `${diversityMetrics.geneticBottlenecks.length} genetic bottlenecks identified`,
      mitigation: 'Monitor offspring for trait concentration and diversify future breeding',
    });
  }

  return risks;
}

/**
 * Generate breeding suggestions
 * @param {Object} stallion - Stallion data
 * @param {Object} mare - Mare data
 * @param {Array} risks - Identified risks
 * @param {Array} strengths - Identified strengths
 * @returns {Array} Array of suggestions
 */
function generateBreedingSuggestions(stallion, mare, risks, strengths) {
  const suggestions = [];

  // Risk-based suggestions
  risks.forEach(risk => {
    suggestions.push({
      type: 'risk_mitigation',
      description: risk.mitigation,
      priority: risk.severity === 'high' ? 'high' : 'medium',
    });
  });

  // Strength-based suggestions
  if (strengths.length > 0) {
    suggestions.push({
      type: 'strength_optimization',
      description: 'Focus on developing identified genetic strengths in offspring',
      priority: 'medium',
    });
  }

  // General suggestions
  suggestions.push({
    type: 'monitoring',
    description: 'Monitor offspring development closely during first 6 months',
    priority: 'low',
  });

  return suggestions;
}

/**
 * Predict breeding outcomes
 * @param {Object} stallion - Stallion data
 * @param {Object} mare - Mare data
 * @param {Object} performanceAnalysis - Performance analysis
 * @returns {Object} Expected outcomes
 */
function predictBreedingOutcomes(stallion, mare, performanceAnalysis) {
  const stallionAvg = calculateAverageStats(stallion);
  const mareAvg = calculateAverageStats(mare);

  return {
    expectedStats: {
      // Equoria-qrb08: two issues fixed together. (1) `??` preserves
      // legitimate stat-0 instead of silently boosting to 50. (2) Explicit
      // parens around each side of `+` — without them, JS operator precedence
      // evaluated the original `a || 50 + b || 50` as `a || (50 + b) || 50`
      // (binary `+` binds tighter than `||`/`??`), so the "average" math was
      // wrong for any stallion with a falsy/nullish stat. Both forms are now
      // corrected together.
      speed: Math.round(((stallion.speed ?? 50) + (mare.speed ?? 50)) / 2),
      stamina: Math.round(((stallion.stamina ?? 50) + (mare.stamina ?? 50)) / 2),
      agility: Math.round(((stallion.agility ?? 50) + (mare.agility ?? 50)) / 2),
      intelligence: Math.round(((stallion.intelligence ?? 50) + (mare.intelligence ?? 50)) / 2),
    },
    expectedPerformance: Math.round((stallionAvg + mareAvg) / 2),
    likelyDisciplines: performanceAnalysis.disciplineStrengths.strongest
      .slice(0, 2)
      .map(d => d.discipline),
    confidenceLevel: 75,
  };
}
