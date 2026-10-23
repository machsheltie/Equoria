/**
 * Inbreeding Analysis (Wright path-analysis)
 *
 * Pedigree-walking + common-ancestor detection + categorical risk
 * assessment for a stallion × mare pairing. The output of
 * {@link calculateDetailedInbreedingCoefficient} is consumed by both the
 * pair-compatibility scorer (breedingCompatibility.mjs) and the
 * population-level inbreeding analysis (populationHealth.mjs).
 *
 * Refs Equoria-1743t.
 */

import logger from '../../../../utils/logger.mjs';
import { fetchPedigreeGraph, walkPedigreeInGraph } from '../../../../utils/pedigreeWalker.mjs';

/** Generations walked up each parent's side. */
export const inbreedingGenerations = 5;

/**
 * Detailed inbreeding analysis between a stallion and a mare.
 * @param {number} stallionId
 * @param {number} mareId
 * @returns {Promise<Object>} {coefficient, commonAncestors, pathAnalysis, riskAssessment, recommendations}
 */
export async function calculateDetailedInbreedingCoefficient(stallionId, mareId) {
  logger.info(
    `[inbreedingAnalysis.calculateDetailedInbreedingCoefficient] Analyzing stallion ${stallionId} and mare ${mareId}`,
  );

  const graph = await fetchPedigreeGraph([stallionId, mareId], inbreedingGenerations);
  return calculateDetailedInbreedingCoefficientFromGraph(stallionId, mareId, graph);
}

/**
 * The same analysis read out of an already-fetched pedigree graph
 * (pedigreeWalker.fetchPedigreeGraph, at least inbreedingGenerations deep from
 * both parents): no queries, so a caller scoring many pairs fetches the union
 * of their pedigrees once (Equoria-cmw85.4, cmw85.5).
 * @param {number} stallionId
 * @param {number} mareId
 * @param {Map<number, {id:number,name:string,sireId:number|null,damId:number|null}>} graph
 * @returns {Object} {coefficient, commonAncestors, pathAnalysis, riskAssessment, recommendations}
 */
export function calculateDetailedInbreedingCoefficientFromGraph(stallionId, mareId, graph) {
  const stallionLineage = walkPedigreeInGraph(graph, stallionId, inbreedingGenerations);
  const mareLineage = walkPedigreeInGraph(graph, mareId, inbreedingGenerations);

  const commonAncestors = findCommonAncestors(stallionLineage, mareLineage);
  const pathAnalysis = calculatePathAnalysis(stallionId, mareId, commonAncestors);
  const coefficient = pathAnalysis.reduce((sum, path) => sum + path.contribution, 0);

  const riskAssessment = assessInbreedingRisk(coefficient, commonAncestors);
  const recommendations = generateInbreedingRecommendations(
    coefficient,
    riskAssessment,
    commonAncestors,
  );

  return {
    coefficient: Math.round(coefficient * 1000) / 1000,
    commonAncestors: commonAncestors.map(ancestor => ({
      id: ancestor.id,
      name: ancestor.name,
      stallionPath: ancestor.stallionPath,
      marePath: ancestor.marePath,
      contribution: Math.round(ancestor.contribution * 1000) / 1000,
    })),
    pathAnalysis,
    riskAssessment,
    recommendations,
  };
}

// Find ancestors appearing in both lineages; contribution per Wright: (1/2)^(n1+n2+1).
function findCommonAncestors(stallionLineage, mareLineage) {
  const commonAncestors = [];

  stallionLineage.forEach(stallionAncestor => {
    const mareAncestor = mareLineage.find(m => m.id === stallionAncestor.id);
    if (mareAncestor) {
      // Skip if this is the same individual (generation 0 on both sides)
      if (stallionAncestor.generation === 0 && mareAncestor.generation === 0) {
        return;
      }
      const contribution = Math.pow(0.5, stallionAncestor.generation + mareAncestor.generation + 1);
      commonAncestors.push({
        id: stallionAncestor.id,
        name: stallionAncestor.name,
        stallionPath: stallionAncestor.path,
        marePath: mareAncestor.path,
        stallionGeneration: stallionAncestor.generation,
        mareGeneration: mareAncestor.generation,
        contribution,
      });
    }
  });

  return commonAncestors;
}

function calculatePathAnalysis(stallionId, mareId, commonAncestors) {
  return commonAncestors.map(ancestor => ({
    ancestorId: ancestor.id,
    ancestorName: ancestor.name,
    stallionPath: ancestor.stallionPath.join(' -> '),
    marePath: ancestor.marePath.join(' -> '),
    pathLength: ancestor.stallionGeneration + ancestor.mareGeneration,
    contribution: ancestor.contribution,
    significance:
      ancestor.contribution > 0.0625 ? 'high' : ancestor.contribution > 0.03125 ? 'medium' : 'low',
  }));
}

function assessInbreedingRisk(coefficient, commonAncestors) {
  let level = 'low';
  const factors = [];

  if (coefficient > 0.25) {
    level = 'critical';
    factors.push('Extremely high inbreeding coefficient (>25%)');
  } else if (coefficient > 0.125) {
    level = 'high';
    factors.push('High inbreeding coefficient (>12.5%)');
  } else if (coefficient > 0.0625) {
    level = 'medium';
    factors.push('Moderate inbreeding coefficient (>6.25%)');
  }

  if (commonAncestors.length > 3) {
    factors.push(`Multiple common ancestors (${commonAncestors.length})`);
    if (level === 'low') {
      level = 'medium';
    }
  }

  const recentAncestors = commonAncestors.filter(
    a => a.stallionGeneration <= 2 || a.mareGeneration <= 2,
  );
  if (recentAncestors.length > 0) {
    factors.push('Recent common ancestors detected');
    if (level === 'low') {
      level = 'medium';
    }
  }

  return {
    level,
    factors,
    score: Math.round(coefficient * 100),
    description: getInbreedingDescription(level, coefficient),
  };
}

function getInbreedingDescription(level, coefficient) {
  const percentage = Math.round(coefficient * 100 * 10) / 10;
  switch (level) {
    case 'critical':
      return `Critical inbreeding risk (${percentage}%). Breeding strongly discouraged.`;
    case 'high':
      return `High inbreeding risk (${percentage}%). Consider alternative breeding partners.`;
    case 'medium':
      return `Moderate inbreeding risk (${percentage}%). Monitor offspring closely.`;
    default:
      return `Low inbreeding risk (${percentage}%). Acceptable for breeding.`;
  }
}

function generateInbreedingRecommendations(coefficient, riskAssessment, commonAncestors) {
  const recommendations = [];

  if (riskAssessment.level === 'critical') {
    recommendations.push({
      priority: 'urgent',
      action: 'Avoid this breeding',
      reason: 'Extremely high inbreeding coefficient poses significant genetic risks',
    });
  } else if (riskAssessment.level === 'high') {
    recommendations.push({
      priority: 'high',
      action: 'Seek alternative breeding partners',
      reason: 'High inbreeding coefficient may result in genetic issues',
    });
  } else if (riskAssessment.level === 'medium') {
    recommendations.push({
      priority: 'medium',
      action: 'Proceed with caution',
      reason: 'Monitor offspring for genetic issues and consider outcrossing',
    });
    recommendations.push({
      priority: 'medium',
      action: 'Plan outcrossing for next generation',
      reason: 'Introduce new genetic material to reduce future inbreeding',
    });
  }

  if (commonAncestors.length > 0) {
    recommendations.push({
      priority: 'low',
      action: 'Track offspring performance',
      reason: 'Monitor for expression of traits from common ancestors',
    });
  }

  return recommendations;
}
