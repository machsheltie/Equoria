/**
 * Genetic Diversity Metrics
 *
 * Population-level genetic diversity calculations:
 *   - Shannon / Simpson diversity indices
 *   - Expected heterozygosity
 *   - Allele frequencies & stat distributions
 *   - Pairwise genetic distance matrix
 *   - Composite diversity score
 *   - Effective population size (Wright's Ne formula)
 *   - Founder identification & genetic-influence scoring
 *
 * All exports are real-DB-backed (via prisma) and pure on numeric inputs —
 * helpers are exported alongside the public API for unit-level coverage.
 *
 * Refs Equoria-1743t (god-file split AC #1: geneticDiversityMetrics.mjs).
 */

import prisma from '../../../packages/database/prismaClient.mjs';
import logger from '../../utils/logger.mjs';

// ── Public API: composite diversity ─────────────────────────────────────────

/**
 * Calculate comprehensive genetic diversity metrics for a population.
 * @param {Array<number>} horseIds - Horse IDs to analyze.
 * @returns {Promise<Object>} Diversity metrics (shannon, simpson, heterozygosity, alleles, distance, score).
 */
export async function calculateAdvancedGeneticDiversity(horseIds) {
  try {
    logger.info(
      `[geneticDiversityMetrics.calculateAdvancedGeneticDiversity] Analyzing ${horseIds.length} horses`,
    );

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

    const shannonIndex = calculateShannonIndex(allTraits);
    const simpsonIndex = calculateSimpsonIndex(allTraits);
    const expectedHeterozygosity = calculateExpectedHeterozygosity(allTraits);
    const alleleFrequencies = calculateAlleleFrequencies(allTraits, statValues);
    const geneticDistance = calculateGeneticDistance(horses);
    const diversityScore = calculateOverallDiversityScore(
      shannonIndex,
      simpsonIndex,
      expectedHeterozygosity,
    );

    return {
      shannonIndex: Math.round(shannonIndex * 100) / 100,
      simpsonIndex: Math.round(simpsonIndex * 100) / 100,
      expectedHeterozygosity: Math.round(expectedHeterozygosity * 100) / 100,
      alleleFrequencies,
      geneticDistance,
      diversityScore: Math.round(diversityScore),
    };
  } catch (error) {
    logger.error(
      `[geneticDiversityMetrics.calculateAdvancedGeneticDiversity] Error: ${error.message}`,
    );
    throw error;
  }
}

// ── Index calculations ──────────────────────────────────────────────────────

/**
 * Shannon Diversity Index over trait occurrences.
 * @param {Array<string>} traits
 * @returns {number}
 */
export function calculateShannonIndex(traits) {
  if (traits.length === 0) {
    return 0;
  }
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
 * Simpson Diversity Index (1 - dominance).
 * @param {Array<string>} traits
 * @returns {number}
 */
export function calculateSimpsonIndex(traits) {
  if (traits.length === 0) {
    return 0;
  }
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
  return 1 - simpson;
}

/**
 * Expected heterozygosity (1 - Σ(freq²)).
 * @param {Array<string>} traits
 * @returns {number}
 */
export function calculateExpectedHeterozygosity(traits) {
  if (traits.length === 0) {
    return 0;
  }
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
 * Allele frequency distribution for traits + stat moments.
 * @param {Array<string>} traits
 * @param {Object} statValues
 * @returns {Object}
 */
export function calculateAlleleFrequencies(traits, statValues) {
  const traitFrequencies = {};
  traits.forEach(trait => {
    traitFrequencies[trait] = (traitFrequencies[trait] || 0) + 1;
  });
  const total = traits.length;
  Object.keys(traitFrequencies).forEach(trait => {
    traitFrequencies[trait] = traitFrequencies[trait] / total;
  });

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

  return { traits: traitFrequencies, stats: statDistributions };
}

// ── Genetic distance ────────────────────────────────────────────────────────

/**
 * Pairwise distance matrix across the population.
 * @param {Array<Object>} horses
 * @returns {Object}
 */
export function calculateGeneticDistance(horses) {
  const distances = [];
  for (let i = 0; i < horses.length; i++) {
    for (let j = i + 1; j < horses.length; j++) {
      const distance = calculatePairwiseDistance(horses[i], horses[j]);
      distances.push({
        horse1Id: horses[i].id,
        horse2Id: horses[j].id,
        distance: Math.round(distance * 100) / 100,
      });
    }
  }
  const avgDistance =
    distances.length > 0 ? distances.reduce((sum, d) => sum + d.distance, 0) / distances.length : 0;
  return {
    pairwiseDistances: distances,
    averageDistance: Math.round(avgDistance * 100) / 100,
    maxDistance: distances.length > 0 ? Math.max(...distances.map(d => d.distance)) : 0,
    minDistance: distances.length > 0 ? Math.min(...distances.map(d => d.distance)) : 0,
  };
}

/**
 * Pairwise genetic distance between two horses (combined trait + stat).
 * @param {Object} horse1
 * @param {Object} horse2
 * @returns {number}
 */
export function calculatePairwiseDistance(horse1, horse2) {
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

  const stats = ['speed', 'stamina', 'agility', 'intelligence'];
  let statDistance = 0;
  stats.forEach(stat => {
    const val1 = horse1[stat] || 50;
    const val2 = horse2[stat] || 50;
    statDistance += Math.abs(val1 - val2) / 100;
  });

  const normalizedTraitDistance = allTraits.length > 0 ? traitDistance / allTraits.length : 0;
  const normalizedStatDistance = statDistance / stats.length;
  return (normalizedTraitDistance + normalizedStatDistance) / 2;
}

/**
 * Weighted composite score (0-100) from the three diversity indices.
 * @param {number} shannon
 * @param {number} simpson
 * @param {number} heterozygosity
 * @returns {number}
 */
export function calculateOverallDiversityScore(shannon, simpson, heterozygosity) {
  const normalizedShannon = Math.min(shannon / 4, 1);
  const score = normalizedShannon * 0.4 + simpson * 0.3 + heterozygosity * 0.3;
  return score * 100;
}

/**
 * Default metrics for an empty population (avoids divide-by-zero downstream).
 * @returns {Object}
 */
export function getDefaultDiversityMetrics() {
  return {
    shannonIndex: 0,
    simpsonIndex: 0,
    expectedHeterozygosity: 0,
    alleleFrequencies: { traits: {}, stats: {} },
    geneticDistance: { pairwiseDistances: [], averageDistance: 0, maxDistance: 0, minDistance: 0 },
    diversityScore: 0,
  };
}

// ── Effective population size ───────────────────────────────────────────────

/**
 * Wright's effective population size: Ne = 4·Nm·Nf / (Nm + Nf).
 * @param {Array<number>} horseIds
 * @returns {Promise<Object>}
 */
export async function calculateEffectivePopulationSize(horseIds) {
  try {
    logger.info(
      `[geneticDiversityMetrics.calculateEffectivePopulationSize] Calculating for ${horseIds.length} horses`,
    );

    const horses = await prisma.horse.findMany({
      where: { id: { in: horseIds } },
      select: { id: true, sex: true, sireId: true, damId: true },
    });

    const males = horses.filter(h => h.sex === 'Stallion').length;
    const females = horses.filter(h => h.sex === 'Mare').length;
    const actualSize = horses.length;

    const effectiveSize = males > 0 && females > 0 ? (4 * males * females) / (males + females) : 0;

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
    logger.error(
      `[geneticDiversityMetrics.calculateEffectivePopulationSize] Error: ${error.message}`,
    );
    throw error;
  }
}

/**
 * Count breeding contributors (horses that produced any offspring in the pop).
 * @param {Array<number>} horseIds
 * @returns {Promise<Object>}
 */
async function countBreedingContributors(horseIds) {
  const sires = await prisma.horse.findMany({
    where: { id: { in: horseIds }, sireOffspring: { some: {} } },
    select: { id: true, sex: true },
  });
  const dams = await prisma.horse.findMany({
    where: { id: { in: horseIds }, damOffspring: { some: {} } },
    select: { id: true, sex: true },
  });
  return {
    males: sires.length,
    females: dams.length,
    total: new Set([...sires.map(s => s.id), ...dams.map(d => d.id)]).size,
  };
}

// ── Founders ────────────────────────────────────────────────────────────────

/**
 * Identify founders + their genetic-influence scores.
 * @param {Array<number>} horseIds
 * @returns {Promise<Array<Object>>}
 */
export async function identifyGeneticFounders(horseIds) {
  try {
    logger.info(
      `[geneticDiversityMetrics.identifyGeneticFounders] Identifying founders in ${horseIds.length} horses`,
    );

    const horses = await prisma.horse.findMany({
      where: { id: { in: horseIds } },
      include: {
        sireOffspring: { select: { id: true } },
        damOffspring: { select: { id: true } },
      },
    });

    const founders = [];

    for (const horse of horses) {
      const hasParentsInPopulation =
        horseIds.includes(horse.sireId) || horseIds.includes(horse.damId);
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

    founders.sort((a, b) => b.geneticInfluence - a.geneticInfluence);
    return founders;
  } catch (error) {
    logger.error(`[geneticDiversityMetrics.identifyGeneticFounders] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Get all descendant IDs within the population (BFS over sire/dam links).
 * @param {number} horseId
 * @param {Array<number>} populationIds
 * @returns {Promise<Array<number>>}
 */
async function getDescendants(horseId, populationIds) {
  const descendants = new Set();
  const toProcess = [horseId];
  const processed = new Set();

  while (toProcess.length > 0) {
    const currentId = toProcess.pop();
    if (processed.has(currentId)) {
      continue;
    }
    processed.add(currentId);

    const offspring = await prisma.horse.findMany({
      where: {
        OR: [{ sireId: currentId }, { damId: currentId }],
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
 * Genetic influence score: directDescendants/pop + founder bonus + diversity bonus.
 * @param {Object} founder
 * @param {Array<number>} descendants
 * @param {number} populationSize
 * @returns {number}
 */
function calculateGeneticInfluence(founder, descendants, populationSize) {
  if (populationSize === 0) {
    return 0;
  }
  const directInfluence = descendants.length / populationSize;
  const founderBonus = founder.sireId === null && founder.damId === null ? 0.2 : 0;
  const diversityBonus = Math.min(0.3, descendants.length * 0.05);
  return Math.min(1, directInfluence + founderBonus + diversityBonus);
}
