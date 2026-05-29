/**
 * Recommendation Generators & Trend Analysis
 *
 * Time-series + executive-report layer:
 *   - Per-generation genetic-trend analysis (linear regression on diversity / inbreeding)
 *   - Trait-evolution analysis (emerging / declining)
 *   - Per-cohort genetic predictions
 *   - Diversity-over-time timeline + alerts + milestones
 *   - Comprehensive genetic-diversity report (executive summary + action plan)
 *
 * Action lists use semantic codes from `backend/config/geneticActionCodes.mjs`
 * (AC #2: "Action-list strings moved to a config/locale file; service emits
 * semantic codes"). Each action record is `{code, text, params?}` so existing
 * consumers that read `.text` still see the canonical English copy while new
 * consumers (frontend, locale layer) can switch on `.code`.
 *
 * Refs Equoria-1743t.
 */

import prisma from '../../../packages/database/prismaClient.mjs';
import logger from '../../utils/logger.mjs';

import { GENETIC_ACTION_CODES, resolveGeneticAction } from '../../config/geneticActionCodes.mjs';
import { calculateAdvancedGeneticDiversity } from './geneticDiversityMetrics.mjs';
import { trackPopulationGeneticHealth, analyzePopulationInbreeding } from './populationHealth.mjs';
import { generateOptimalBreedingRecommendations } from './breedingCompatibility.mjs';

// ── Genetic trends over time ────────────────────────────────────────────────

/**
 * Generational analysis + diversity/inbreeding progression + predictions.
 * @param {Array<number>} horseIds
 * @returns {Promise<Object>}
 */
export async function analyzeGeneticTrends(horseIds) {
  try {
    logger.info(
      `[recommendationGenerators.analyzeGeneticTrends] Analyzing trends for ${horseIds.length} horses`,
    );

    const horses = await prisma.horse.findMany({
      where: { id: { in: horseIds } },
      select: {
        id: true,
        name: true,
        dateOfBirth: true,
        epigeneticModifiers: true,
        speed: true,
        stamina: true,
        agility: true,
        intelligence: true,
        sireId: true,
        damId: true,
      },
      orderBy: { dateOfBirth: 'asc' },
    });

    const generationMap = {};
    horses.forEach(horse => {
      const year = new Date(horse.dateOfBirth).getFullYear();
      if (!generationMap[year]) {
        generationMap[year] = [];
      }
      generationMap[year].push(horse);
    });

    const generationalAnalysis = [];
    const years = Object.keys(generationMap).sort();

    for (const year of years) {
      const yearHorses = generationMap[year];
      const yearIds = yearHorses.map(h => h.id);

      const diversity = await calculateAdvancedGeneticDiversity(yearIds);
      const inbreeding = await analyzePopulationInbreeding(yearIds);

      generationalAnalysis.push({
        generation: parseInt(year),
        year: parseInt(year),
        populationSize: yearHorses.length,
        diversity: diversity.diversityScore,
        inbreeding: inbreeding.averageCoefficient,
        averageStats: calculateAverageStats(yearHorses),
        traitFrequency: calculateTraitFrequency(yearHorses),
      });
    }

    const diversityProgression = calculateProgression(generationalAnalysis.map(g => g.diversity));
    const inbreedingProgression = calculateProgression(generationalAnalysis.map(g => g.inbreeding));
    const traitEvolution = analyzeTraitEvolution(generationalAnalysis);
    const predictions = generateGeneticPredictions(generationalAnalysis);

    return {
      generationalAnalysis,
      diversityProgression,
      inbreedingProgression,
      traitEvolution,
      predictions,
    };
  } catch (error) {
    logger.error(`[recommendationGenerators.analyzeGeneticTrends] Error: ${error.message}`);
    throw error;
  }
}

function calculateAverageStats(horses) {
  if (horses.length === 0) {
    return { speed: 50, stamina: 50, agility: 50, intelligence: 50 };
  }
  const totals = { speed: 0, stamina: 0, agility: 0, intelligence: 0 };
  horses.forEach(horse => {
    totals.speed += horse.speed || 50;
    totals.stamina += horse.stamina || 50;
    totals.agility += horse.agility || 50;
    totals.intelligence += horse.intelligence || 50;
  });
  return {
    speed: Math.round(totals.speed / horses.length),
    stamina: Math.round(totals.stamina / horses.length),
    agility: Math.round(totals.agility / horses.length),
    intelligence: Math.round(totals.intelligence / horses.length),
  };
}

function calculateTraitFrequency(horses) {
  const traitCounts = {};
  let totalTraits = 0;
  horses.forEach(horse => {
    const traits = horse.epigeneticModifiers || { positive: [], negative: [], hidden: [] };
    [...traits.positive, ...traits.negative, ...traits.hidden].forEach(trait => {
      traitCounts[trait] = (traitCounts[trait] || 0) + 1;
      totalTraits++;
    });
  });
  const frequencies = {};
  Object.entries(traitCounts).forEach(([trait, count]) => {
    frequencies[trait] = totalTraits > 0 ? Math.round((count / totalTraits) * 100) / 100 : 0;
  });
  return frequencies;
}

/**
 * Linear-regression progression analysis on a numeric series.
 * @param {Array<number>} values
 * @returns {Object}
 */
function calculateProgression(values) {
  if (values.length < 2) {
    return { trend: 'stable', slope: 0, correlation: 0 };
  }
  const n = values.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  let trend = 'stable';
  if (slope > 0.5) {
    trend = 'increasing';
  } else if (slope < -0.5) {
    trend = 'decreasing';
  }

  return {
    trend,
    slope: Math.round(slope * 100) / 100,
    correlation: calculateCorrelation(x, values),
  };
}

function calculateCorrelation(x, y) {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 100) / 100;
}

function analyzeTraitEvolution(generationalAnalysis) {
  const traitTrends = {};
  const allTraits = new Set();

  generationalAnalysis.forEach(generation => {
    Object.keys(generation.traitFrequency).forEach(trait => allTraits.add(trait));
  });

  allTraits.forEach(trait => {
    const frequencies = generationalAnalysis.map(g => g.traitFrequency[trait] || 0);
    const progression = calculateProgression(frequencies);

    traitTrends[trait] = {
      trend: progression.trend,
      currentFrequency: frequencies[frequencies.length - 1] || 0,
      change:
        frequencies.length > 1
          ? Math.round((frequencies[frequencies.length - 1] - frequencies[0]) * 100) / 100
          : 0,
      significance: Math.abs(progression.slope) > 0.1 ? 'significant' : 'minor',
    };
  });

  return {
    traitTrends,
    emergingTraits: Object.entries(traitTrends)
      .filter(([_, data]) => data.trend === 'increasing' && data.significance === 'significant')
      .map(([trait, _]) => trait),
    decliningTraits: Object.entries(traitTrends)
      .filter(([_, data]) => data.trend === 'decreasing' && data.significance === 'significant')
      .map(([trait, _]) => trait),
  };
}

function generateGeneticPredictions(generationalAnalysis) {
  if (generationalAnalysis.length < 3) {
    return {
      nextGeneration: { confidence: 'low', predictions: [] },
      longTerm: { confidence: 'low', predictions: [] },
    };
  }
  const recent = generationalAnalysis.slice(-3);
  const diversityTrend = calculateProgression(recent.map(g => g.diversity));
  const inbreedingTrend = calculateProgression(recent.map(g => g.inbreeding));

  const nextGenPredictions = [];
  const longTermPredictions = [];

  if (diversityTrend.trend === 'decreasing') {
    nextGenPredictions.push('Genetic diversity likely to continue declining');
    longTermPredictions.push('Risk of genetic bottleneck if trend continues');
  } else if (diversityTrend.trend === 'increasing') {
    nextGenPredictions.push('Genetic diversity expected to improve');
    longTermPredictions.push('Population genetic health likely to strengthen');
  }
  if (inbreedingTrend.trend === 'increasing') {
    nextGenPredictions.push('Inbreeding levels may increase');
    longTermPredictions.push('Genetic depression risk if inbreeding continues');
  }

  return {
    nextGeneration: {
      confidence: Math.abs(diversityTrend.correlation) > 0.7 ? 'high' : 'medium',
      predictions: nextGenPredictions,
    },
    longTerm: { confidence: 'medium', predictions: longTermPredictions },
  };
}

// ── Diversity over time ─────────────────────────────────────────────────────

/**
 * Diversity-over-time timeline + alerts + milestones.
 * @param {Array<number>} horseIds
 * @returns {Promise<Object>}
 */
export async function trackGeneticDiversityOverTime(horseIds) {
  try {
    logger.info(
      `[recommendationGenerators.trackGeneticDiversityOverTime] Tracking diversity for ${horseIds.length} horses`,
    );

    const horses = await prisma.horse.findMany({
      where: { id: { in: horseIds } },
      select: {
        id: true,
        name: true,
        dateOfBirth: true,
        createdAt: true,
        epigeneticModifiers: true,
      },
      orderBy: { dateOfBirth: 'asc' },
    });

    const timeline = [];
    const yearGroups = {};

    horses.forEach(horse => {
      const year = new Date(horse.dateOfBirth).getFullYear();
      if (!yearGroups[year]) {
        yearGroups[year] = [];
      }
      yearGroups[year].push(horse);
    });

    for (const [year, yearHorses] of Object.entries(yearGroups)) {
      const yearIds = yearHorses.map(h => h.id);
      const diversity = await calculateAdvancedGeneticDiversity(yearIds);

      timeline.push({
        date: `${year}-01-01`,
        year: parseInt(year),
        diversity: diversity.diversityScore,
        populationSize: yearHorses.length,
        events: [`${yearHorses.length} horses born`],
      });
    }

    const currentDiversity = await calculateAdvancedGeneticDiversity(horseIds);
    const populationHealth = await trackPopulationGeneticHealth(horseIds);
    const alerts = generateGeneticAlerts(currentDiversity, populationHealth);
    const milestones = identifyGeneticMilestones(timeline);

    return {
      timeline,
      diversityMetrics: {
        current: currentDiversity.diversityScore,
        trend:
          timeline.length > 1
            ? timeline[timeline.length - 1].diversity > timeline[0].diversity
              ? 'improving'
              : 'declining'
            : 'stable',
        volatility: calculateVolatility(timeline.map(t => t.diversity)),
      },
      milestones,
      alerts,
    };
  } catch (error) {
    logger.error(
      `[recommendationGenerators.trackGeneticDiversityOverTime] Error: ${error.message}`,
    );
    throw error;
  }
}

function generateGeneticAlerts(diversity, health) {
  const alerts = [];

  if (diversity.diversityScore < 30) {
    alerts.push({
      level: 'critical',
      type: 'low_diversity',
      message: 'Critical genetic diversity levels detected',
      action: 'Immediate intervention required',
    });
  } else if (diversity.diversityScore < 50) {
    alerts.push({
      level: 'warning',
      type: 'declining_diversity',
      message: 'Genetic diversity below optimal levels',
      action: 'Implement diversity improvement program',
    });
  }

  if (health.inbreedingLevels.riskLevel === 'high') {
    alerts.push({
      level: 'warning',
      type: 'high_inbreeding',
      message: 'Elevated inbreeding levels in population',
      action: 'Reduce close relative breeding',
    });
  }

  if (health.geneticBottlenecks.length > 0) {
    alerts.push({
      level: 'info',
      type: 'genetic_bottleneck',
      message: `${health.geneticBottlenecks.length} genetic bottlenecks identified`,
      action: 'Review breeding strategies',
    });
  }

  return alerts;
}

function identifyGeneticMilestones(timeline) {
  const milestones = [];

  if (timeline.length > 0) {
    const [firstEntry] = timeline;
    const _lastEntry = timeline[timeline.length - 1];

    milestones.push({
      date: firstEntry.date,
      type: 'population_start',
      description: `Population tracking began with ${firstEntry.populationSize} horses`,
    });

    if (timeline.length > 1) {
      const maxDiversity = Math.max(...timeline.map(t => t.diversity));
      const maxEntry = timeline.find(t => t.diversity === maxDiversity);

      milestones.push({
        date: maxEntry.date,
        type: 'peak_diversity',
        description: `Peak genetic diversity reached: ${Math.round(maxDiversity)}%`,
      });
    }
  }

  return milestones;
}

function calculateVolatility(values) {
  if (values.length < 2) {
    return 0;
  }
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.round(Math.sqrt(variance) * 100) / 100;
}

// ── Comprehensive report ────────────────────────────────────────────────────

/**
 * Executive-summary + action-plan + metrics roll-up.
 * @param {Array<number>} horseIds
 * @returns {Promise<Object>}
 */
export async function generateGeneticDiversityReport(horseIds) {
  try {
    logger.info(
      `[recommendationGenerators.generateGeneticDiversityReport] Generating report for ${horseIds.length} horses`,
    );

    const [diversity, populationHealth, trends, breedingRecommendations, tracking] =
      await Promise.all([
        calculateAdvancedGeneticDiversity(horseIds),
        trackPopulationGeneticHealth(horseIds),
        analyzeGeneticTrends(horseIds),
        generateOptimalBreedingRecommendations(horseIds),
        trackGeneticDiversityOverTime(horseIds),
      ]);

    const executiveSummary = {
      overallHealth: populationHealth.overallHealth.grade,
      keyFindings: generateKeyFindings(diversity, populationHealth, trends),
      urgentActions: generateUrgentActions(populationHealth, breedingRecommendations),
    };

    const actionPlan = {
      immediate: generateImmediateActions(populationHealth, breedingRecommendations),
      shortTerm: generateShortTermActions(trends, diversity),
      longTerm: generateLongTermActions(trends, populationHealth),
    };

    return {
      executiveSummary,
      currentStatus: {
        diversityScore: diversity.diversityScore,
        populationSize: horseIds.length,
        healthGrade: populationHealth.overallHealth.grade,
        inbreedingLevel: populationHealth.inbreedingLevels.riskLevel,
      },
      historicalAnalysis: {
        trends: trends.diversityProgression,
        milestones: tracking.milestones,
        volatility: tracking.diversityMetrics.volatility,
      },
      recommendations: breedingRecommendations,
      actionPlan,
      metrics: {
        diversity,
        populationHealth,
        tracking: tracking.diversityMetrics,
      },
    };
  } catch (error) {
    logger.error(
      `[recommendationGenerators.generateGeneticDiversityReport] Error: ${error.message}`,
    );
    throw error;
  }
}

function generateKeyFindings(diversity, health, trends) {
  const findings = [];
  findings.push(`Population genetic diversity: ${diversity.diversityScore}%`);
  findings.push(`Overall health grade: ${health.overallHealth.grade}`);

  if (trends.diversityProgression.trend === 'decreasing') {
    findings.push('Genetic diversity is declining over time');
  } else if (trends.diversityProgression.trend === 'increasing') {
    findings.push('Genetic diversity is improving over time');
  }

  if (health.geneticBottlenecks.length > 0) {
    findings.push(`${health.geneticBottlenecks.length} genetic bottlenecks identified`);
  }

  return findings;
}

/**
 * Build a semantic action record `{code, text, params?}` so consumers can
 * key off `.code` while legacy callers reading `.text` still see the
 * canonical English copy.
 * @param {string} code
 * @param {Object} [params]
 * @returns {Object}
 */
function makeAction(code, params) {
  const action = { code, text: resolveGeneticAction({ code, params }) };
  if (params) {
    action.params = params;
  }
  return action;
}

function generateUrgentActions(health, recommendations) {
  const actions = [];

  if (health.overallHealth.grade === 'F') {
    actions.push(makeAction(GENETIC_ACTION_CODES.IMPLEMENT_GENETIC_RESCUE_PROGRAM));
  }
  if (health.inbreedingLevels.riskLevel === 'high') {
    actions.push(makeAction(GENETIC_ACTION_CODES.HALT_CLOSE_RELATIVE_BREEDING));
  }
  if (recommendations.avoidPairs.length > 0) {
    actions.push(
      makeAction(GENETIC_ACTION_CODES.AVOID_HIGH_RISK_PAIRS, {
        count: recommendations.avoidPairs.length,
      }),
    );
  }

  return actions;
}

function generateImmediateActions(health, recommendations) {
  const actions = [];

  if (recommendations.priorityBreedings.length > 0) {
    actions.push(
      makeAction(GENETIC_ACTION_CODES.EXECUTE_PRIORITY_BREEDINGS, {
        count: recommendations.priorityBreedings.length,
      }),
    );
  }
  actions.push(makeAction(GENETIC_ACTION_CODES.REVIEW_BREEDING_PROTOCOLS));
  actions.push(makeAction(GENETIC_ACTION_CODES.IMPLEMENT_GENETIC_MONITORING));

  return actions;
}

function generateShortTermActions(_trends, diversity) {
  const actions = [];

  if (diversity.diversityScore < 70) {
    actions.push(makeAction(GENETIC_ACTION_CODES.DEVELOP_OUTCROSSING_PROGRAM));
  }
  actions.push(makeAction(GENETIC_ACTION_CODES.ESTABLISH_MONITORING_PROTOCOLS));
  actions.push(makeAction(GENETIC_ACTION_CODES.TRAIN_STAFF_GENETIC_MANAGEMENT));

  return actions;
}

function generateLongTermActions(_trends, health) {
  const actions = [];

  actions.push(makeAction(GENETIC_ACTION_CODES.DEVELOP_TEN_YEAR_GENETIC_PLAN));
  actions.push(makeAction(GENETIC_ACTION_CODES.ESTABLISH_GENETIC_DATABASE));
  actions.push(makeAction(GENETIC_ACTION_CODES.CREATE_BREEDING_ADVISORY_COMMITTEE));

  if (health.overallHealth.score < 80) {
    actions.push(makeAction(GENETIC_ACTION_CODES.IMPLEMENT_POPULATION_IMPROVEMENT));
  }

  return actions;
}
