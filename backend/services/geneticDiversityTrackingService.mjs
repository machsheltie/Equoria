/**
 * Genetic Diversity Tracking Service
 *
 * Provides advanced genetic diversity algorithms, inbreeding coefficient calculations,
 * and comprehensive breeding recommendations for population-level genetic management.
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

/**
 * Calculate comprehensive genetic diversity metrics using advanced algorithms
 * @param {Array} horseIds - Array of horse IDs to analyze
 * @returns {Object} Advanced genetic diversity metrics
 */
export async function calculateAdvancedGeneticDiversity(horseIds) {
  try {
    logger.info(`[geneticDiversityTrackingService.calculateAdvancedGeneticDiversity] Analyzing ${horseIds.length} horses`);

    // Get all horses with their genetic data
    const horses = await prisma.horse.findMany({
      where: { id: { in: horseIds } },
      select: {
        id: true,
        name: true,
        epigeneticModifiers: true,
        speed: true,
        stamina: true,
        agility: true,
        intelligence: true,
        sireId: true,
        damId: true,
      },
    });

    if (horses.length === 0) {
      return getDefaultDiversityMetrics();
    }

    // Extract traits and stats for analysis
    const allTraits = [];
    const statValues = { speed: [], stamina: [], agility: [], intelligence: [] };

    horses.forEach(horse => {
      const traits = horse.epigeneticModifiers || { positive: [], negative: [], hidden: [] };
      allTraits.push(...traits.positive, ...traits.negative, ...traits.hidden);

      statValues.speed.push(horse.speed || 50);
      statValues.stamina.push(horse.stamina || 50);
      statValues.agility.push(horse.agility || 50);
      statValues.intelligence.push(horse.intelligence || 50);
    });

    // Calculate Shannon Diversity Index
    const shannonIndex = calculateShannonIndex(allTraits);

    // Calculate Simpson Diversity Index
    const simpsonIndex = calculateSimpsonIndex(allTraits);

    // Calculate Expected Heterozygosity
    const expectedHeterozygosity = calculateExpectedHeterozygosity(allTraits);

    // Calculate allele frequencies
    const alleleFrequencies = calculateAlleleFrequencies(allTraits, statValues);

    // Calculate genetic distance matrix
    const geneticDistance = calculateGeneticDistance(horses);

    // Calculate overall diversity score (0-100)
    const diversityScore = calculateOverallDiversityScore(shannonIndex, simpsonIndex, expectedHeterozygosity);

    return {
      shannonIndex: Math.round(shannonIndex * 100) / 100,
      simpsonIndex: Math.round(simpsonIndex * 100) / 100,
      expectedHeterozygosity: Math.round(expectedHeterozygosity * 100) / 100,
      alleleFrequencies,
      geneticDistance,
      diversityScore: Math.round(diversityScore),
    };

  } catch (error) {
    logger.error(`[geneticDiversityTrackingService.calculateAdvancedGeneticDiversity] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate Shannon Diversity Index for traits
 * @param {Array} traits - Array of all traits
 * @returns {number} Shannon diversity index
 */
function calculateShannonIndex(traits) {
  if (traits.length === 0) { return 0; }

  const frequencies = {};
  traits.forEach(trait => {
    frequencies[trait] = (frequencies[trait] || 0) + 1;
  });

  const total = traits.length;
  let shannon = 0;

  Object.values(frequencies).forEach(count => {
    const proportion = count / total;
    shannon -= proportion * Math.log2(proportion);
  });

  return shannon;
}

/**
 * Calculate Simpson Diversity Index for traits
 * @param {Array} traits - Array of all traits
 * @returns {number} Simpson diversity index
 */
function calculateSimpsonIndex(traits) {
  if (traits.length === 0) { return 0; }

  const frequencies = {};
  traits.forEach(trait => {
    frequencies[trait] = (frequencies[trait] || 0) + 1;
  });

  const total = traits.length;
  let simpson = 0;

  Object.values(frequencies).forEach(count => {
    const proportion = count / total;
    simpson += proportion * proportion;
  });

  return 1 - simpson; // Simpson's diversity index (1 - dominance)
}

/**
 * Calculate Expected Heterozygosity
 * @param {Array} traits - Array of all traits
 * @returns {number} Expected heterozygosity
 */
function calculateExpectedHeterozygosity(traits) {
  if (traits.length === 0) { return 0; }

  const frequencies = {};
  traits.forEach(trait => {
    frequencies[trait] = (frequencies[trait] || 0) + 1;
  });

  const total = traits.length;
  let sumSquaredFreq = 0;

  Object.values(frequencies).forEach(count => {
    const freq = count / total;
    sumSquaredFreq += freq * freq;
  });

  return 1 - sumSquaredFreq;
}

/**
 * Calculate allele frequencies for traits and stats
 * @param {Array} traits - Array of all traits
 * @param {Object} statValues - Object containing stat value arrays
 * @returns {Object} Allele frequency data
 */
function calculateAlleleFrequencies(traits, statValues) {
  const traitFrequencies = {};
  traits.forEach(trait => {
    traitFrequencies[trait] = (traitFrequencies[trait] || 0) + 1;
  });

  // Convert counts to frequencies
  const total = traits.length;
  Object.keys(traitFrequencies).forEach(trait => {
    traitFrequencies[trait] = traitFrequencies[trait] / total;
  });

  // Calculate stat distributions
  const statDistributions = {};
  Object.keys(statValues).forEach(stat => {
    const values = statValues[stat];
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

    statDistributions[stat] = {
      mean: Math.round(mean),
      variance: Math.round(variance * 100) / 100,
      standardDeviation: Math.round(Math.sqrt(variance) * 100) / 100,
    };
  });

  return {
    traits: traitFrequencies,
    stats: statDistributions,
  };
}

/**
 * Calculate genetic distance matrix between horses
 * @param {Array} horses - Array of horse objects
 * @returns {Object} Genetic distance data
 */
function calculateGeneticDistance(horses) {
  const distances = [];

  for (let i = 0; i < horses.length; i++) {
    for (let j = i + 1; j < horses.length; j++) {
      const horse1 = horses[i];
      const horse2 = horses[j];

      const distance = calculatePairwiseDistance(horse1, horse2);
      distances.push({
        horse1Id: horse1.id,
        horse2Id: horse2.id,
        distance: Math.round(distance * 100) / 100,
      });
    }
  }

  const avgDistance = distances.length > 0 ?
    distances.reduce((sum, d) => sum + d.distance, 0) / distances.length : 0;

  return {
    pairwiseDistances: distances,
    averageDistance: Math.round(avgDistance * 100) / 100,
    maxDistance: distances.length > 0 ? Math.max(...distances.map(d => d.distance)) : 0,
    minDistance: distances.length > 0 ? Math.min(...distances.map(d => d.distance)) : 0,
  };
}

/**
 * Calculate pairwise genetic distance between two horses
 * @param {Object} horse1 - First horse
 * @param {Object} horse2 - Second horse
 * @returns {number} Genetic distance
 */
function calculatePairwiseDistance(horse1, horse2) {
  // Calculate trait distance
  const traits1 = [
    ...(horse1.epigeneticModifiers?.positive || []),
    ...(horse1.epigeneticModifiers?.negative || []),
    ...(horse1.epigeneticModifiers?.hidden || []),
  ];
  const traits2 = [
    ...(horse2.epigeneticModifiers?.positive || []),
    ...(horse2.epigeneticModifiers?.negative || []),
    ...(horse2.epigeneticModifiers?.hidden || []),
  ];

  const allTraits = [...new Set([...traits1, ...traits2])];
  let traitDistance = 0;

  allTraits.forEach(trait => {
    const has1 = traits1.includes(trait) ? 1 : 0;
    const has2 = traits2.includes(trait) ? 1 : 0;
    traitDistance += Math.abs(has1 - has2);
  });

  // Calculate stat distance
  const stats = ['speed', 'stamina', 'agility', 'intelligence'];
  let statDistance = 0;

  stats.forEach(stat => {
    const val1 = horse1[stat] || 50;
    const val2 = horse2[stat] || 50;
    statDistance += Math.abs(val1 - val2) / 100; // Normalize to 0-1
  });

  // Combine trait and stat distances
  const normalizedTraitDistance = allTraits.length > 0 ? traitDistance / allTraits.length : 0;
  const normalizedStatDistance = statDistance / stats.length;

  return (normalizedTraitDistance + normalizedStatDistance) / 2;
}

/**
 * Calculate overall diversity score
 * @param {number} shannon - Shannon index
 * @param {number} simpson - Simpson index
 * @param {number} heterozygosity - Expected heterozygosity
 * @returns {number} Overall diversity score (0-100)
 */
function calculateOverallDiversityScore(shannon, simpson, heterozygosity) {
  // Normalize Shannon index (typical range 0-4, but can be higher)
  const normalizedShannon = Math.min(shannon / 4, 1);

  // Weight the different indices
  const score = (normalizedShannon * 0.4) + (simpson * 0.3) + (heterozygosity * 0.3);

  return score * 100;
}

/**
 * Get default diversity metrics for empty populations
 * @returns {Object} Default metrics
 */
function getDefaultDiversityMetrics() {
  return {
    shannonIndex: 0,
    simpsonIndex: 0,
    expectedHeterozygosity: 0,
    alleleFrequencies: { traits: {}, stats: {} },
    geneticDistance: { pairwiseDistances: [], averageDistance: 0, maxDistance: 0, minDistance: 0 },
    diversityScore: 0,
  };
}

/**
 * Calculate effective population size
 * @param {Array} horseIds - Array of horse IDs
 * @returns {Object} Effective population size data
 */
export async function calculateEffectivePopulationSize(horseIds) {
  try {
    logger.info(`[geneticDiversityTrackingService.calculateEffectivePopulationSize] Calculating for ${horseIds.length} horses`);

    const horses = await prisma.horse.findMany({
      where: { id: { in: horseIds } },
      select: { id: true, sex: true, sireId: true, damId: true },
    });

    const males = horses.filter(h => h.sex === 'Stallion').length;
    const females = horses.filter(h => h.sex === 'Mare').length;
    const actualSize = horses.length;

    // Calculate effective population size using the formula: Ne = 4NmNf / (Nm + Nf)
    const effectiveSize = males > 0 && females > 0 ?
      (4 * males * females) / (males + females) : 0;

    // Count breeding contributors (horses with offspring)
    const breedingContributors = await countBreedingContributors(horseIds);

    return {
      effectiveSize: Math.round(effectiveSize),
      actualSize,
      ratio: actualSize > 0 ? Math.round((effectiveSize / actualSize) * 100) / 100 : 0,
      breedingContributors: {
        males: breedingContributors.males,
        females: breedingContributors.females,
        total: breedingContributors.total,
      },
    };

  } catch (error) {
    logger.error(`[geneticDiversityTrackingService.calculateEffectivePopulationSize] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Count breeding contributors in the population
 * @param {Array} horseIds - Array of horse IDs
 * @returns {Object} Breeding contributor counts
 */
async function countBreedingContributors(horseIds) {
  const sires = await prisma.horse.findMany({
    where: {
      id: { in: horseIds },
      sireOffspring: { some: {} },
    },
    select: { id: true, sex: true },
  });

  const dams = await prisma.horse.findMany({
    where: {
      id: { in: horseIds },
      damOffspring: { some: {} },
    },
    select: { id: true, sex: true },
  });

  return {
    males: sires.length,
    females: dams.length,
    total: new Set([...sires.map(s => s.id), ...dams.map(d => d.id)]).size,
  };
}

/**
 * Identify genetic founders and their contributions
 * @param {Array} horseIds - Array of horse IDs
 * @returns {Array} Array of founder data
 */
export async function identifyGeneticFounders(horseIds) {
  try {
    logger.info(`[geneticDiversityTrackingService.identifyGeneticFounders] Identifying founders in ${horseIds.length} horses`);

    const horses = await prisma.horse.findMany({
      where: { id: { in: horseIds } },
      include: {
        sireOffspring: { select: { id: true } },
        damOffspring: { select: { id: true } },
      },
    });

    const founders = [];

    for (const horse of horses) {
      // A founder is a horse with no parents in the population or with significant offspring
      const hasParentsInPopulation = horseIds.includes(horse.sireId) || horseIds.includes(horse.damId);
      const offspringCount = horse.sireOffspring.length + horse.damOffspring.length;

      if (!hasParentsInPopulation || offspringCount >= 2) {
        const descendants = await getDescendants(horse.id, horseIds);
        const geneticInfluence = calculateGeneticInfluence(horse, descendants, horses.length);

        founders.push({
          id: horse.id,
          name: horse.name,
          contribution: Math.round((descendants.length / horses.length) * 100),
          descendants,
          geneticInfluence: Math.round(geneticInfluence * 100) / 100,
          offspringCount,
          isFounder: !hasParentsInPopulation,
        });
      }
    }

    // Sort by genetic influence
    founders.sort((a, b) => b.geneticInfluence - a.geneticInfluence);

    return founders;

  } catch (error) {
    logger.error(`[geneticDiversityTrackingService.identifyGeneticFounders] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Get all descendants of a horse within the population
 * @param {number} horseId - Horse ID
 * @param {Array} populationIds - Population horse IDs
 * @returns {Array} Array of descendant IDs
 */
async function getDescendants(horseId, populationIds) {
  const descendants = new Set();
  const toProcess = [horseId];
  const processed = new Set();

  while (toProcess.length > 0) {
    const currentId = toProcess.pop();
    if (processed.has(currentId)) { continue; }
    processed.add(currentId);

    const offspring = await prisma.horse.findMany({
      where: {
        OR: [
          { sireId: currentId },
          { damId: currentId },
        ],
        id: { in: populationIds },
      },
      select: { id: true },
    });

    offspring.forEach(child => {
      if (!descendants.has(child.id)) {
        descendants.add(child.id);
        toProcess.push(child.id);
      }
    });
  }

  return Array.from(descendants);
}

/**
 * Calculate genetic influence of a founder
 * @param {Object} founder - Founder horse
 * @param {Array} descendants - Array of descendant IDs
 * @param {number} populationSize - Total population size
 * @returns {number} Genetic influence score
 */
function calculateGeneticInfluence(founder, descendants, populationSize) {
  if (populationSize === 0) { return 0; }

  // Base influence from direct descendants
  const directInfluence = descendants.length / populationSize;

  // Bonus for being a true founder (no parents in population)
  const founderBonus = founder.sireId === null && founder.damId === null ? 0.2 : 0;

  // Bonus for genetic diversity (simplified)
  const diversityBonus = Math.min(0.3, descendants.length * 0.05);

  return Math.min(1, directInfluence + founderBonus + diversityBonus);
}

/**
 * Calculate detailed inbreeding coefficient with path analysis
 * @param {number} stallionId - Stallion ID
 * @param {number} mareId - Mare ID
 * @returns {Object} Detailed inbreeding analysis
 */
export async function calculateDetailedInbreedingCoefficient(stallionId, mareId) {
  try {
    logger.info(`[geneticDiversityTrackingService.calculateDetailedInbreedingCoefficient] Analyzing stallion ${stallionId} and mare ${mareId}`);

    // Get lineage for both horses up to 5 generations
    const stallionLineage = await getLineage(stallionId, 5);
    const mareLineage = await getLineage(mareId, 5);

    // Find common ancestors
    const commonAncestors = findCommonAncestors(stallionLineage, mareLineage);

    // Calculate inbreeding coefficient using path analysis
    const pathAnalysis = calculatePathAnalysis(stallionId, mareId, commonAncestors);
    const coefficient = pathAnalysis.reduce((sum, path) => sum + path.contribution, 0);

    // Assess risk level
    const riskAssessment = assessInbreedingRisk(coefficient, commonAncestors);

    // Generate recommendations
    const recommendations = generateInbreedingRecommendations(coefficient, riskAssessment, commonAncestors);

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

  } catch (error) {
    logger.error(`[geneticDiversityTrackingService.calculateDetailedInbreedingCoefficient] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Get lineage for a horse up to specified generations
 * @param {number} horseId - Horse ID
 * @param {number} generations - Number of generations
 * @returns {Array} Array of ancestors with path information
 */
async function getLineage(horseId, generations) {
  const lineage = [];
  const toProcess = [{ id: horseId, path: [], generation: 0 }];
  const processed = new Set();

  while (toProcess.length > 0) {
    const { id, path, generation } = toProcess.shift();

    if (processed.has(id) || generation >= generations) { continue; }
    processed.add(id);

    const horse = await prisma.horse.findUnique({
      where: { id },
      select: { id: true, name: true, sireId: true, damId: true },
    });

    if (horse) {
      lineage.push({
        id: horse.id,
        name: horse.name,
        path: [...path],
        generation,
      });

      if (horse.sireId && generation + 1 < generations) {
        toProcess.push({
          id: horse.sireId,
          path: [...path, 'sire'],
          generation: generation + 1,
        });
      }

      if (horse.damId && generation + 1 < generations) {
        toProcess.push({
          id: horse.damId,
          path: [...path, 'dam'],
          generation: generation + 1,
        });
      }
    }
  }

  return lineage;
}

/**
 * Find common ancestors between two lineages
 * @param {Array} stallionLineage - Stallion lineage
 * @param {Array} mareLineage - Mare lineage
 * @returns {Array} Common ancestors with path information
 */
function findCommonAncestors(stallionLineage, mareLineage) {
  const commonAncestors = [];

  stallionLineage.forEach(stallionAncestor => {
    const mareAncestor = mareLineage.find(m => m.id === stallionAncestor.id);
    if (mareAncestor) {
      // Skip if this is the same individual (generation 0)
      if (stallionAncestor.generation === 0 && mareAncestor.generation === 0) {
        return;
      }

      // Calculate contribution using Wright's formula: (1/2)^(n1 + n2 + 1)
      // For direct parent-offspring mating, this should be (1/2)^(1 + 0 + 1) = 0.25
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

/**
 * Calculate path analysis for inbreeding
 * @param {number} stallionId - Stallion ID
 * @param {number} mareId - Mare ID
 * @param {Array} commonAncestors - Common ancestors
 * @returns {Array} Path analysis data
 */
function calculatePathAnalysis(stallionId, mareId, commonAncestors) {
  return commonAncestors.map(ancestor => ({
    ancestorId: ancestor.id,
    ancestorName: ancestor.name,
    stallionPath: ancestor.stallionPath.join(' -> '),
    marePath: ancestor.marePath.join(' -> '),
    pathLength: ancestor.stallionGeneration + ancestor.mareGeneration,
    contribution: ancestor.contribution,
    significance: ancestor.contribution > 0.0625 ? 'high' : ancestor.contribution > 0.03125 ? 'medium' : 'low',
  }));
}

/**
 * Assess inbreeding risk level
 * @param {number} coefficient - Inbreeding coefficient
 * @param {Array} commonAncestors - Common ancestors
 * @returns {Object} Risk assessment
 */
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
    if (level === 'low') { level = 'medium'; }
  }

  const recentAncestors = commonAncestors.filter(a => a.stallionGeneration <= 2 || a.mareGeneration <= 2);
  if (recentAncestors.length > 0) {
    factors.push('Recent common ancestors detected');
    if (level === 'low') { level = 'medium'; }
  }

  return {
    level,
    factors,
    score: Math.round(coefficient * 100),
    description: getInbreedingDescription(level, coefficient),
  };
}

/**
 * Get inbreeding risk description
 * @param {string} level - Risk level
 * @param {number} coefficient - Inbreeding coefficient
 * @returns {string} Risk description
 */
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

/**
 * Generate inbreeding recommendations
 * @param {number} coefficient - Inbreeding coefficient
 * @param {Object} riskAssessment - Risk assessment
 * @param {Array} commonAncestors - Common ancestors
 * @returns {Array} Recommendations
 */
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

/**
 * Track population genetic health metrics
 * @param {Array} horseIds - Array of horse IDs
 * @returns {Object} Population genetic health data
 */
export async function trackPopulationGeneticHealth(horseIds) {
  try {
    logger.info(`[geneticDiversityTrackingService.trackPopulationGeneticHealth] Tracking health for ${horseIds.length} horses`);

    // Calculate current diversity metrics
    const diversity = await calculateAdvancedGeneticDiversity(horseIds);
    const effectiveSize = await calculateEffectivePopulationSize(horseIds);

    // Analyze inbreeding levels across population
    const inbreedingLevels = await analyzePopulationInbreeding(horseIds);

    // Identify genetic bottlenecks
    const geneticBottlenecks = await identifyPopulationBottlenecks(horseIds);

    // Calculate overall health score
    const overallHealth = calculatePopulationHealthScore(diversity, effectiveSize, inbreedingLevels);

    // Generate recommendations
    const recommendations = generatePopulationRecommendations(overallHealth, diversity, inbreedingLevels, geneticBottlenecks);

    return {
      overallHealth,
      diversityTrends: {
        current: diversity.diversityScore,
        trend: 'stable', // Would need historical data for real trend analysis
        effectiveSize: effectiveSize.effectiveSize,
      },
      inbreedingLevels,
      geneticBottlenecks,
      recommendations,
    };

  } catch (error) {
    logger.error(`[geneticDiversityTrackingService.trackPopulationGeneticHealth] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Analyze inbreeding levels across the population
 * @param {Array} horseIds - Array of horse IDs
 * @returns {Object} Population inbreeding analysis
 */
async function analyzePopulationInbreeding(horseIds) {
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
      } catch (error) {
        // Skip horses with calculation errors
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
 * Identify genetic bottlenecks in the population
 * @param {Array} horseIds - Array of horse IDs
 * @returns {Array} Genetic bottlenecks
 */
async function identifyPopulationBottlenecks(horseIds) {
  const horses = await prisma.horse.findMany({
    where: { id: { in: horseIds } },
    select: { id: true, name: true, epigeneticModifiers: true, sireId: true, damId: true },
  });

  const bottlenecks = [];

  // Analyze trait concentration
  const traitCounts = {};
  horses.forEach(horse => {
    const traits = horse.epigeneticModifiers || { positive: [], negative: [], hidden: [] };
    [...traits.positive, ...traits.negative, ...traits.hidden].forEach(trait => {
      traitCounts[trait] = (traitCounts[trait] || 0) + 1;
    });
  });

  // Identify over-represented traits (>75% frequency)
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

  // Analyze founder contribution
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
 * Calculate population health score
 * @param {Object} diversity - Diversity metrics
 * @param {Object} effectiveSize - Effective population size
 * @param {Object} inbreedingLevels - Inbreeding analysis
 * @returns {Object} Health score and grade
 */
function calculatePopulationHealthScore(diversity, effectiveSize, inbreedingLevels) {
  let score = 0;

  // Diversity component (40% weight)
  score += diversity.diversityScore * 0.4;

  // Effective population size component (30% weight)
  const sizeScore = Math.min(100, (effectiveSize.effectiveSize / 50) * 100); // 50 is considered good
  score += sizeScore * 0.3;

  // Inbreeding component (30% weight) - lower is better
  const inbreedingScore = Math.max(0, 100 - (inbreedingLevels.averageCoefficient * 1000));
  score += inbreedingScore * 0.3;

  const finalScore = Math.round(score);

  let grade = 'F';
  if (finalScore >= 90) { grade = 'A'; } else if (finalScore >= 80) { grade = 'B'; } else if (finalScore >= 70) { grade = 'C'; } else if (finalScore >= 60) { grade = 'D'; }

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
 * Generate population-level recommendations
 * @param {Object} overallHealth - Overall health assessment
 * @param {Object} diversity - Diversity metrics
 * @param {Object} inbreedingLevels - Inbreeding levels
 * @param {Array} geneticBottlenecks - Genetic bottlenecks
 * @returns {Array} Recommendations
 */
function generatePopulationRecommendations(overallHealth, diversity, inbreedingLevels, geneticBottlenecks) {
  const recommendations = [];

  // Health-based recommendations
  if (overallHealth.score < 60) {
    recommendations.push({
      priority: 'urgent',
      category: 'population_health',
      action: 'Implement genetic rescue program',
      description: 'Population health is critically low - introduce new genetic material immediately',
    });
  } else if (overallHealth.score < 80) {
    recommendations.push({
      priority: 'high',
      category: 'population_health',
      action: 'Increase genetic diversity',
      description: 'Population health is below optimal - focus on diversifying breeding program',
    });
  }

  // Diversity-based recommendations
  if (diversity.diversityScore < 50) {
    recommendations.push({
      priority: 'high',
      category: 'genetic_diversity',
      action: 'Outcrossing program',
      description: 'Low genetic diversity detected - implement systematic outcrossing',
    });
  }

  // Inbreeding-based recommendations
  if (inbreedingLevels.riskLevel === 'high') {
    recommendations.push({
      priority: 'high',
      category: 'inbreeding',
      action: 'Reduce inbreeding',
      description: 'High population inbreeding levels - avoid close relative breeding',
    });
  }

  // Bottleneck-based recommendations
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

/**
 * Analyze genetic trends over time
 * @param {Array} horseIds - Array of horse IDs
 * @returns {Object} Genetic trend analysis
 */
export async function analyzeGeneticTrends(horseIds) {
  try {
    logger.info(`[geneticDiversityTrackingService.analyzeGeneticTrends] Analyzing trends for ${horseIds.length} horses`);

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

    // Group horses by generation (birth year)
    const generationMap = {};
    horses.forEach(horse => {
      const year = new Date(horse.dateOfBirth).getFullYear();
      if (!generationMap[year]) { generationMap[year] = []; }
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

    // Calculate progression trends
    const diversityProgression = calculateProgression(generationalAnalysis.map(g => g.diversity));
    const inbreedingProgression = calculateProgression(generationalAnalysis.map(g => g.inbreeding));

    // Analyze trait evolution
    const traitEvolution = analyzeTraitEvolution(generationalAnalysis);

    // Generate predictions
    const predictions = generateGeneticPredictions(generationalAnalysis);

    return {
      generationalAnalysis,
      diversityProgression,
      inbreedingProgression,
      traitEvolution,
      predictions,
    };

  } catch (error) {
    logger.error(`[geneticDiversityTrackingService.analyzeGeneticTrends] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate average stats for a group of horses
 * @param {Array} horses - Array of horses
 * @returns {Object} Average stats
 */
function calculateAverageStats(horses) {
  if (horses.length === 0) { return { speed: 50, stamina: 50, agility: 50, intelligence: 50 }; }

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

/**
 * Calculate trait frequency for a group of horses
 * @param {Array} horses - Array of horses
 * @returns {Object} Trait frequencies
 */
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
 * Calculate progression trend for a series of values
 * @param {Array} values - Array of numeric values
 * @returns {Object} Progression analysis
 */
function calculateProgression(values) {
  if (values.length < 2) {
    return { trend: 'stable', slope: 0, correlation: 0 };
  }

  // Simple linear regression
  const n = values.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  let trend = 'stable';
  if (slope > 0.5) { trend = 'increasing'; } else if (slope < -0.5) { trend = 'decreasing'; }

  return {
    trend,
    slope: Math.round(slope * 100) / 100,
    correlation: calculateCorrelation(x, values),
  };
}

/**
 * Calculate correlation coefficient
 * @param {Array} x - X values
 * @param {Array} y - Y values
 * @returns {number} Correlation coefficient
 */
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

/**
 * Analyze trait evolution across generations
 * @param {Array} generationalAnalysis - Generational analysis data
 * @returns {Object} Trait evolution analysis
 */
function analyzeTraitEvolution(generationalAnalysis) {
  const traitTrends = {};
  const allTraits = new Set();

  // Collect all traits across generations
  generationalAnalysis.forEach(generation => {
    Object.keys(generation.traitFrequency).forEach(trait => allTraits.add(trait));
  });

  // Analyze trend for each trait
  allTraits.forEach(trait => {
    const frequencies = generationalAnalysis.map(g => g.traitFrequency[trait] || 0);
    const progression = calculateProgression(frequencies);

    traitTrends[trait] = {
      trend: progression.trend,
      currentFrequency: frequencies[frequencies.length - 1] || 0,
      change: frequencies.length > 1 ?
        Math.round((frequencies[frequencies.length - 1] - frequencies[0]) * 100) / 100 : 0,
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

/**
 * Generate genetic predictions based on trends
 * @param {Array} generationalAnalysis - Generational analysis data
 * @returns {Object} Genetic predictions
 */
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

  // Diversity predictions
  if (diversityTrend.trend === 'decreasing') {
    nextGenPredictions.push('Genetic diversity likely to continue declining');
    longTermPredictions.push('Risk of genetic bottleneck if trend continues');
  } else if (diversityTrend.trend === 'increasing') {
    nextGenPredictions.push('Genetic diversity expected to improve');
    longTermPredictions.push('Population genetic health likely to strengthen');
  }

  // Inbreeding predictions
  if (inbreedingTrend.trend === 'increasing') {
    nextGenPredictions.push('Inbreeding levels may increase');
    longTermPredictions.push('Genetic depression risk if inbreeding continues');
  }

  return {
    nextGeneration: {
      confidence: Math.abs(diversityTrend.correlation) > 0.7 ? 'high' : 'medium',
      predictions: nextGenPredictions,
    },
    longTerm: {
      confidence: 'medium',
      predictions: longTermPredictions,
    },
  };
}

/**
 * Generate optimal breeding recommendations for a population
 * @param {Array} horseIds - Array of horse IDs
 * @returns {Object} Optimal breeding recommendations
 */
export async function generateOptimalBreedingRecommendations(horseIds) {
  try {
    logger.info(`[geneticDiversityTrackingService.generateOptimalBreedingRecommendations] Generating recommendations for ${horseIds.length} horses`);

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

    // Evaluate all possible breeding pairs
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
            riskFactors: compatibility.inbreedingRisk > 0.125 ? ['High inbreeding risk'] : ['Low genetic compatibility'],
            reasoning: `Low compatibility (${compatibility.overallScore}%) - ${compatibility.recommendation}`,
          });
        }
      }
    }

    // Sort optimal pairs by compatibility score
    optimalPairs.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    // Generate priority breedings based on genetic goals
    const priorityBreedings = generatePriorityBreedings(optimalPairs, horses);

    // Set diversity goals
    const diversityGoals = await generateDiversityGoals(horseIds);

    // Create breeding timeline
    const timeline = generateBreedingTimeline(optimalPairs, priorityBreedings);

    return {
      optimalPairs: optimalPairs.slice(0, 10), // Top 10 pairs
      avoidPairs: avoidPairs.slice(0, 5), // Top 5 to avoid
      priorityBreedings,
      diversityGoals,
      timeline,
    };

  } catch (error) {
    logger.error(`[geneticDiversityTrackingService.generateOptimalBreedingRecommendations] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Assess breeding pair compatibility
 * @param {number} stallionId - Stallion ID
 * @param {number} mareId - Mare ID
 * @returns {Object} Compatibility assessment
 */
export async function assessBreedingPairCompatibility(stallionId, mareId) {
  try {
    logger.info(`[geneticDiversityTrackingService.assessBreedingPairCompatibility] Assessing stallion ${stallionId} and mare ${mareId}`);

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

    // Calculate genetic compatibility
    const geneticCompatibility = calculateGeneticCompatibility(stallion, mare);

    // Calculate diversity impact
    const diversityImpact = calculateDiversityImpact(stallion, mare);

    // Calculate inbreeding risk
    const inbreedingAnalysis = await calculateDetailedInbreedingCoefficient(stallionId, mareId);
    const inbreedingRisk = inbreedingAnalysis.coefficient;

    // Predict expected traits
    const expectedTraits = predictOffspringTraits(stallion, mare);

    // Calculate overall score
    const overallScore = calculateCompatibilityScore(geneticCompatibility, diversityImpact, inbreedingRisk);

    // Generate recommendation
    const recommendation = generateCompatibilityRecommendation(overallScore, inbreedingRisk);

    return {
      overallScore: Math.round(overallScore),
      geneticCompatibility: Math.round(geneticCompatibility),
      diversityImpact: Math.round(diversityImpact),
      inbreedingRisk: Math.round(inbreedingRisk * 1000) / 1000,
      expectedTraits,
      recommendation,
    };

  } catch (error) {
    logger.error(`[geneticDiversityTrackingService.assessBreedingPairCompatibility] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate genetic compatibility between two horses
 * @param {Object} stallion - Stallion data
 * @param {Object} mare - Mare data
 * @returns {number} Genetic compatibility score (0-100)
 */
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

  // Calculate trait complementarity
  const sharedTraits = stallionTraits.filter(trait => mareTraits.includes(trait));
  const totalUniqueTraits = new Set([...stallionTraits, ...mareTraits]).size;

  // Moderate overlap is good (complementary), too much overlap reduces diversity
  const overlapRatio = totalUniqueTraits > 0 ? sharedTraits.length / totalUniqueTraits : 0;

  let traitScore = 50;
  if (overlapRatio < 0.2) {
    traitScore = 60; // Too different
  } else if (overlapRatio > 0.8) {
    traitScore = 40; // Too similar
  } else {
    traitScore = 85; // Good balance
  }

  // Calculate stat complementarity
  const stallionStats = [stallion.speed || 50, stallion.stamina || 50, stallion.agility || 50, stallion.intelligence || 50];
  const mareStats = [mare.speed || 50, mare.stamina || 50, mare.agility || 50, mare.intelligence || 50];

  let statScore = 0;
  for (let i = 0; i < stallionStats.length; i++) {
    const diff = Math.abs(stallionStats[i] - mareStats[i]);
    if (diff < 10) {
      statScore += 70; // Similar levels
    } else if (diff < 25) {
      statScore += 85; // Complementary strengths
    } else {
      statScore += 40; // Too different
    }
  }
  statScore = statScore / stallionStats.length;

  return (traitScore + statScore) / 2;
}

/**
 * Calculate diversity impact of a breeding pair
 * @param {Object} stallion - Stallion data
 * @param {Object} mare - Mare data
 * @returns {number} Diversity impact score (0-100)
 */
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

  // Higher unique trait count = better diversity impact
  const diversityScore = Math.min(100, uniqueTraits.size * 10);

  // Penalty for too many shared traits
  const sharedPenalty = sharedTraits.length * 5;

  return Math.max(0, diversityScore - sharedPenalty);
}

/**
 * Predict offspring traits
 * @param {Object} stallion - Stallion data
 * @param {Object} mare - Mare data
 * @returns {Object} Expected traits
 */
function predictOffspringTraits(stallion, mare) {
  const stallionTraits = stallion.epigeneticModifiers || { positive: [], negative: [], hidden: [] };
  const mareTraits = mare.epigeneticModifiers || { positive: [], negative: [], hidden: [] };

  // Predict stats (average with some variation)
  const expectedStats = {
    speed: Math.round(((stallion.speed || 50) + (mare.speed || 50)) / 2),
    stamina: Math.round(((stallion.stamina || 50) + (mare.stamina || 50)) / 2),
    agility: Math.round(((stallion.agility || 50) + (mare.agility || 50)) / 2),
    intelligence: Math.round(((stallion.intelligence || 50) + (mare.intelligence || 50)) / 2),
  };

  // Predict likely traits (50% chance from each parent)
  const likelyTraits = [
    ...stallionTraits.positive.slice(0, 2),
    ...mareTraits.positive.slice(0, 2),
  ];

  return {
    expectedStats,
    likelyTraits: [...new Set(likelyTraits)],
    diversityPotential: calculateDiversityImpact(stallion, mare) > 70 ? 'high' : 'medium',
  };
}

/**
 * Calculate overall compatibility score
 * @param {number} geneticCompatibility - Genetic compatibility score
 * @param {number} diversityImpact - Diversity impact score
 * @param {number} inbreedingRisk - Inbreeding risk coefficient
 * @returns {number} Overall compatibility score
 */
function calculateCompatibilityScore(geneticCompatibility, diversityImpact, inbreedingRisk) {
  // Weight the components
  let score = (geneticCompatibility * 0.4) + (diversityImpact * 0.3);

  // Inbreeding penalty
  const inbreedingPenalty = inbreedingRisk * 300; // Convert to percentage and amplify
  score = score * (1 - Math.min(0.8, inbreedingPenalty / 100));

  // Age compatibility bonus (simplified - would need actual age data)
  score += 10; // Base bonus for breeding age compatibility

  return Math.max(0, Math.min(100, score));
}

/**
 * Generate compatibility recommendation
 * @param {number} overallScore - Overall compatibility score
 * @param {number} inbreedingRisk - Inbreeding risk coefficient
 * @returns {string} Recommendation
 */
function generateCompatibilityRecommendation(overallScore, inbreedingRisk) {
  if (inbreedingRisk > 0.25) { return 'avoid'; }
  if (overallScore >= 90) { return 'excellent'; }
  if (overallScore >= 80) { return 'good'; }
  if (overallScore >= 60) { return 'fair'; }
  if (overallScore >= 40) { return 'poor'; }
  return 'avoid';
}

/**
 * Generate priority breedings based on genetic goals
 * @param {Array} optimalPairs - Optimal breeding pairs
 * @param {Array} horses - All horses in population
 * @returns {Array} Priority breeding recommendations
 */
function generatePriorityBreedings(optimalPairs, _horses) {
  const priorities = [];

  // Prioritize pairs that address genetic bottlenecks
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

/**
 * Generate diversity goals for the population
 * @param {Array} horseIds - Array of horse IDs
 * @returns {Object} Diversity goals
 */
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

/**
 * Generate breeding timeline
 * @param {Array} optimalPairs - Optimal breeding pairs
 * @param {Array} priorityBreedings - Priority breedings
 * @returns {Object} Breeding timeline
 */
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

/**
 * Track genetic diversity changes over time
 * @param {Array} horseIds - Array of horse IDs
 * @returns {Object} Diversity tracking data
 */
export async function trackGeneticDiversityOverTime(horseIds) {
  try {
    logger.info(`[geneticDiversityTrackingService.trackGeneticDiversityOverTime] Tracking diversity for ${horseIds.length} horses`);

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

    // Create timeline based on birth dates
    const timeline = [];
    const yearGroups = {};

    horses.forEach(horse => {
      const year = new Date(horse.dateOfBirth).getFullYear();
      if (!yearGroups[year]) { yearGroups[year] = []; }
      yearGroups[year].push(horse);
    });

    // Calculate diversity for each year
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

    // Calculate overall diversity metrics
    const currentDiversity = await calculateAdvancedGeneticDiversity(horseIds);
    const populationHealth = await trackPopulationGeneticHealth(horseIds);

    // Generate alerts for genetic health issues
    const alerts = generateGeneticAlerts(currentDiversity, populationHealth);

    // Identify milestones
    const milestones = identifyGeneticMilestones(timeline);

    return {
      timeline,
      diversityMetrics: {
        current: currentDiversity.diversityScore,
        trend: timeline.length > 1 ?
          (timeline[timeline.length - 1].diversity > timeline[0].diversity ? 'improving' : 'declining') : 'stable',
        volatility: calculateVolatility(timeline.map(t => t.diversity)),
      },
      milestones,
      alerts,
    };

  } catch (error) {
    logger.error(`[geneticDiversityTrackingService.trackGeneticDiversityOverTime] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Generate genetic alerts
 * @param {Object} diversity - Current diversity metrics
 * @param {Object} health - Population health data
 * @returns {Array} Genetic alerts
 */
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

/**
 * Identify genetic milestones
 * @param {Array} timeline - Timeline data
 * @returns {Array} Genetic milestones
 */
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

/**
 * Calculate volatility of diversity scores
 * @param {Array} values - Array of diversity values
 * @returns {number} Volatility measure
 */
function calculateVolatility(values) {
  if (values.length < 2) { return 0; }

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

  return Math.round(Math.sqrt(variance) * 100) / 100;
}

/**
 * Generate comprehensive genetic diversity report
 * @param {Array} horseIds - Array of horse IDs
 * @returns {Object} Comprehensive genetic diversity report
 */
export async function generateGeneticDiversityReport(horseIds) {
  try {
    logger.info(`[geneticDiversityTrackingService.generateGeneticDiversityReport] Generating report for ${horseIds.length} horses`);

    // Gather all necessary data
    const [
      diversity,
      populationHealth,
      trends,
      breedingRecommendations,
      tracking,
    ] = await Promise.all([
      calculateAdvancedGeneticDiversity(horseIds),
      trackPopulationGeneticHealth(horseIds),
      analyzeGeneticTrends(horseIds),
      generateOptimalBreedingRecommendations(horseIds),
      trackGeneticDiversityOverTime(horseIds),
    ]);

    // Generate executive summary
    const executiveSummary = {
      overallHealth: populationHealth.overallHealth.grade,
      keyFindings: generateKeyFindings(diversity, populationHealth, trends),
      urgentActions: generateUrgentActions(populationHealth, breedingRecommendations),
    };

    // Generate action plan
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
    logger.error(`[geneticDiversityTrackingService.generateGeneticDiversityReport] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Generate key findings for executive summary
 * @param {Object} diversity - Diversity metrics
 * @param {Object} health - Population health
 * @param {Object} trends - Genetic trends
 * @returns {Array} Key findings
 */
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
 * Generate urgent actions
 * @param {Object} health - Population health
 * @param {Object} recommendations - Breeding recommendations
 * @returns {Array} Urgent actions
 */
function generateUrgentActions(health, recommendations) {
  const actions = [];

  if (health.overallHealth.grade === 'F') {
    actions.push('Implement genetic rescue program immediately');
  }

  if (health.inbreedingLevels.riskLevel === 'high') {
    actions.push('Halt all close relative breeding');
  }

  if (recommendations.avoidPairs.length > 0) {
    actions.push(`Avoid ${recommendations.avoidPairs.length} high-risk breeding pairs`);
  }

  return actions;
}

/**
 * Generate immediate actions
 * @param {Object} health - Population health
 * @param {Object} recommendations - Breeding recommendations
 * @returns {Array} Immediate actions
 */
function generateImmediateActions(health, recommendations) {
  const actions = [];

  if (recommendations.priorityBreedings.length > 0) {
    actions.push(`Execute ${recommendations.priorityBreedings.length} priority breedings`);
  }

  actions.push('Review and update breeding protocols');
  actions.push('Implement genetic monitoring system');

  return actions;
}

/**
 * Generate short-term actions
 * @param {Object} trends - Genetic trends
 * @param {Object} diversity - Diversity metrics
 * @returns {Array} Short-term actions
 */
function generateShortTermActions(trends, diversity) {
  const actions = [];

  if (diversity.diversityScore < 70) {
    actions.push('Develop outcrossing program');
  }

  actions.push('Establish genetic monitoring protocols');
  actions.push('Train staff on genetic management');

  return actions;
}

/**
 * Generate long-term actions
 * @param {Object} trends - Genetic trends
 * @param {Object} health - Population health
 * @returns {Array} Long-term actions
 */
function generateLongTermActions(trends, health) {
  const actions = [];

  actions.push('Develop 10-year genetic management plan');
  actions.push('Establish genetic database and tracking system');
  actions.push('Create breeding advisory committee');

  if (health.overallHealth.score < 80) {
    actions.push('Implement population genetic improvement program');
  }

  return actions;
}
