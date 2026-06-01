/**
 * Breeding Compatibility & Optimal Pair Search
 *
 * Pair-level scoring and population-wide pair search:
 *   - Pair compatibility (genetic + diversity + inbreeding-penalty)
 *   - Predicted offspring trait + stat outcomes
 *   - Population-wide optimal breeding-pair search
 *   - Diversity goals + breeding timeline
 *
 * Inbreeding-coefficient calculation itself lives in
 * `./inbreedingAnalysis.mjs` and is re-exported here for back-compat with
 * the facade.
 *
 * Refs Equoria-1743t.
 */

import prisma from '../../../../../packages/database/prismaClient.mjs';
import logger from '../../../../utils/logger.mjs';

import { calculateAdvancedGeneticDiversity } from './geneticDiversityMetrics.mjs';
import { calculateDetailedInbreedingCoefficient } from './inbreedingAnalysis.mjs';

// Re-export for back-compat: the facade exports
// calculateDetailedInbreedingCoefficient from this module to preserve the
// pre-split public surface.
export { calculateDetailedInbreedingCoefficient };

// ── Pair compatibility ─────────────────────────────────────────────────────

/**
 * Compatibility assessment for a single stallion × mare pair.
 * @param {number} stallionId
 * @param {number} mareId
 * @returns {Promise<Object>}
 */
export async function assessBreedingPairCompatibility(stallionId, mareId) {
  logger.info(
    `[breedingCompatibility.assessBreedingPairCompatibility] Assessing stallion ${stallionId} and mare ${mareId}`,
  );

  const [stallion, mare] = await Promise.all([
    prisma.horse.findUnique({
      where: { id: stallionId },
      select: {
        id: true,
        name: true,
        epigeneticModifiers: true,
        speed: true,
        stamina: true,
        agility: true,
        intelligence: true,
      },
    }),
    prisma.horse.findUnique({
      where: { id: mareId },
      select: {
        id: true,
        name: true,
        epigeneticModifiers: true,
        speed: true,
        stamina: true,
        agility: true,
        intelligence: true,
      },
    }),
  ]);

  if (!stallion || !mare) {
    throw new Error('One or both horses not found');
  }

  const geneticCompatibility = calculateGeneticCompatibility(stallion, mare);
  const diversityImpact = calculateDiversityImpact(stallion, mare);
  const inbreedingAnalysis = await calculateDetailedInbreedingCoefficient(stallionId, mareId);
  const inbreedingRisk = inbreedingAnalysis.coefficient;
  const expectedTraits = predictOffspringTraits(stallion, mare);
  const overallScore = calculateCompatibilityScore(
    geneticCompatibility,
    diversityImpact,
    inbreedingRisk,
  );
  const recommendation = generateCompatibilityRecommendation(overallScore, inbreedingRisk);

  return {
    overallScore: Math.round(overallScore),
    geneticCompatibility: Math.round(geneticCompatibility),
    diversityImpact: Math.round(diversityImpact),
    inbreedingRisk: Math.round(inbreedingRisk * 1000) / 1000,
    expectedTraits,
    recommendation,
  };
}

function calculateGeneticCompatibility(stallion, mare) {
  const stallionTraits = [
    ...(stallion.epigeneticModifiers?.positive || []),
    ...(stallion.epigeneticModifiers?.negative || []),
    ...(stallion.epigeneticModifiers?.hidden || []),
  ];
  const mareTraits = [
    ...(mare.epigeneticModifiers?.positive || []),
    ...(mare.epigeneticModifiers?.negative || []),
    ...(mare.epigeneticModifiers?.hidden || []),
  ];

  const sharedTraits = stallionTraits.filter(trait => mareTraits.includes(trait));
  const totalUniqueTraits = new Set([...stallionTraits, ...mareTraits]).size;
  const overlapRatio = totalUniqueTraits > 0 ? sharedTraits.length / totalUniqueTraits : 0;

  let traitScore = 50;
  if (overlapRatio < 0.2) {
    traitScore = 60; // too different
  } else if (overlapRatio > 0.8) {
    traitScore = 40; // too similar
  } else {
    traitScore = 85; // good balance
  }

  const stallionStats = [
    stallion.speed || 50,
    stallion.stamina || 50,
    stallion.agility || 50,
    stallion.intelligence || 50,
  ];
  const mareStats = [
    mare.speed || 50,
    mare.stamina || 50,
    mare.agility || 50,
    mare.intelligence || 50,
  ];

  let statScore = 0;
  for (let i = 0; i < stallionStats.length; i++) {
    const diff = Math.abs(stallionStats[i] - mareStats[i]);
    if (diff < 10) {
      statScore += 70;
    } else if (diff < 25) {
      statScore += 85;
    } else {
      statScore += 40;
    }
  }
  statScore = statScore / stallionStats.length;

  return (traitScore + statScore) / 2;
}

function calculateDiversityImpact(stallion, mare) {
  const stallionTraits = [
    ...(stallion.epigeneticModifiers?.positive || []),
    ...(stallion.epigeneticModifiers?.negative || []),
    ...(stallion.epigeneticModifiers?.hidden || []),
  ];
  const mareTraits = [
    ...(mare.epigeneticModifiers?.positive || []),
    ...(mare.epigeneticModifiers?.negative || []),
    ...(mare.epigeneticModifiers?.hidden || []),
  ];

  const uniqueTraits = new Set([...stallionTraits, ...mareTraits]);
  const sharedTraits = stallionTraits.filter(trait => mareTraits.includes(trait));

  const diversityScore = Math.min(100, uniqueTraits.size * 10);
  const sharedPenalty = sharedTraits.length * 5;

  return Math.max(0, diversityScore - sharedPenalty);
}

function predictOffspringTraits(stallion, mare) {
  const stallionTraits = stallion.epigeneticModifiers || {
    positive: [],
    negative: [],
    hidden: [],
  };
  const mareTraits = mare.epigeneticModifiers || { positive: [], negative: [], hidden: [] };

  const expectedStats = {
    speed: Math.round(((stallion.speed || 50) + (mare.speed || 50)) / 2),
    stamina: Math.round(((stallion.stamina || 50) + (mare.stamina || 50)) / 2),
    agility: Math.round(((stallion.agility || 50) + (mare.agility || 50)) / 2),
    intelligence: Math.round(((stallion.intelligence || 50) + (mare.intelligence || 50)) / 2),
  };

  const likelyTraits = [...stallionTraits.positive.slice(0, 2), ...mareTraits.positive.slice(0, 2)];

  return {
    expectedStats,
    likelyTraits: [...new Set(likelyTraits)],
    diversityPotential: calculateDiversityImpact(stallion, mare) > 70 ? 'high' : 'medium',
  };
}

function calculateCompatibilityScore(geneticCompatibility, diversityImpact, inbreedingRisk) {
  let score = geneticCompatibility * 0.4 + diversityImpact * 0.3;
  const inbreedingPenalty = inbreedingRisk * 300; // convert to percentage and amplify
  score = score * (1 - Math.min(0.8, inbreedingPenalty / 100));
  score += 10; // age compatibility base bonus
  return Math.max(0, Math.min(100, score));
}

function generateCompatibilityRecommendation(overallScore, inbreedingRisk) {
  if (inbreedingRisk > 0.25) {
    return 'avoid';
  }
  if (overallScore >= 90) {
    return 'excellent';
  }
  if (overallScore >= 80) {
    return 'good';
  }
  if (overallScore >= 60) {
    return 'fair';
  }
  if (overallScore >= 40) {
    return 'poor';
  }
  return 'avoid';
}

// ── Optimal pair search ────────────────────────────────────────────────────

/**
 * Search the population for optimal stallion×mare pairings.
 * @param {Array<number>} horseIds
 * @returns {Promise<Object>}
 */
export async function generateOptimalBreedingRecommendations(horseIds) {
  logger.info(
    `[breedingCompatibility.generateOptimalBreedingRecommendations] Generating recommendations for ${horseIds.length} horses`,
  );

  const horses = await prisma.horse.findMany({
    where: { id: { in: horseIds } },
    select: {
      id: true,
      name: true,
      sex: true,
      epigeneticModifiers: true,
      speed: true,
      stamina: true,
      agility: true,
      intelligence: true,
      sireId: true,
      damId: true,
    },
  });

  const stallions = horses.filter(h => h.sex === 'Stallion');
  const mares = horses.filter(h => h.sex === 'Mare');

  const optimalPairs = [];
  const avoidPairs = [];

  for (const stallion of stallions) {
    for (const mare of mares) {
      const compatibility = await assessBreedingPairCompatibility(stallion.id, mare.id);

      if (compatibility.overallScore >= 80) {
        optimalPairs.push({
          stallionId: stallion.id,
          stallionName: stallion.name,
          mareId: mare.id,
          mareName: mare.name,
          compatibilityScore: compatibility.overallScore,
          expectedOutcome: compatibility.expectedTraits,
          reasoning: `High compatibility (${compatibility.overallScore}%) with ${compatibility.recommendation} recommendation`,
        });
      } else if (compatibility.overallScore < 40 || compatibility.recommendation === 'avoid') {
        avoidPairs.push({
          stallionId: stallion.id,
          stallionName: stallion.name,
          mareId: mare.id,
          mareName: mare.name,
          compatibilityScore: compatibility.overallScore,
          riskFactors:
            compatibility.inbreedingRisk > 0.125
              ? ['High inbreeding risk']
              : ['Low genetic compatibility'],
          reasoning: `Low compatibility (${compatibility.overallScore}%) - ${compatibility.recommendation}`,
        });
      }
    }
  }

  optimalPairs.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

  const priorityBreedings = generatePriorityBreedings(optimalPairs, horses);
  const diversityGoals = await generateDiversityGoals(horseIds);
  const timeline = generateBreedingTimeline(optimalPairs, priorityBreedings);

  return {
    optimalPairs: optimalPairs.slice(0, 10),
    avoidPairs: avoidPairs.slice(0, 5),
    priorityBreedings,
    diversityGoals,
    timeline,
  };
}

function generatePriorityBreedings(optimalPairs, _horses) {
  const priorities = [];
  optimalPairs.slice(0, 5).forEach((pair, index) => {
    priorities.push({
      rank: index + 1,
      stallionId: pair.stallionId,
      mareId: pair.mareId,
      priority: index < 2 ? 'high' : 'medium',
      goal: 'Maximize genetic diversity',
      expectedBenefit: 'Improve population genetic health',
      timeline: 'Next breeding season',
    });
  });
  return priorities;
}

async function generateDiversityGoals(horseIds) {
  const currentDiversity = await calculateAdvancedGeneticDiversity(horseIds);
  return {
    shortTerm: {
      target: Math.min(100, currentDiversity.diversityScore + 10),
      timeframe: '1-2 years',
      actions: ['Implement top breeding recommendations', 'Avoid high-risk pairings'],
    },
    longTerm: {
      target: Math.min(100, currentDiversity.diversityScore + 25),
      timeframe: '5-10 years',
      actions: ['Introduce new bloodlines', 'Systematic outcrossing program'],
    },
  };
}

function generateBreedingTimeline(optimalPairs, priorityBreedings) {
  return {
    immediate: priorityBreedings.filter(p => p.priority === 'high'),
    nextSeason: priorityBreedings.filter(p => p.priority === 'medium'),
    future: optimalPairs.slice(5, 10).map(pair => ({
      stallionId: pair.stallionId,
      mareId: pair.mareId,
      timeline: 'Future consideration',
      notes: 'Monitor genetic trends before proceeding',
    })),
  };
}
