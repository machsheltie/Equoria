/**
 * Lineage Diversity Service (Equoria-urqic.6 split from advancedLineageAnalysisService.mjs)
 *
 * Owns the genetic-diversity / inbreeding side of lineage analysis:
 * comprehensive diversity metrics (Shannon index over traits + stat variance),
 * inbreeding-risk heuristics, genetic-bottleneck detection, and the
 * pedigree-pair inbreeding coefficient.
 *
 * Overlap note (Equoria-urqic.6 / axad9 cross-ref): the genetics/ subdir's
 * geneticDiversityMetrics.mjs and inbreedingAnalysis.mjs operate on a DIFFERENT
 * model — allele-frequency Shannon/Simpson/heterozygosity over horse IDs, and a
 * detailed multi-path inbreeding coefficient. These functions instead operate
 * on the already-built `lineageData` generation arrays produced by
 * organizeByGenerations and return the distinct output shape the breeding
 * route consumes. They are parallel-but-different, not duplicates, so they are
 * kept here rather than collapsed into the genetics/ allele-math modules. The
 * canonical inbreeding CORE (intersection + normalisation) is already delegated
 * to backend/utils/inbreedingCoefficient.mjs (Equoria-n5wza) below.
 */

import logger from '../../../utils/logger.mjs';
import { calculateInbreedingCoefficientCore } from '../../../utils/inbreedingCoefficient.mjs';
import { organizeByGenerations } from './lineageTree.mjs';

/**
 * Calculate comprehensive genetic diversity metrics
 * @param {Array} lineageData - Array of generation objects
 * @returns {Object} Genetic diversity metrics
 */
export async function calculateGeneticDiversityMetrics(lineageData) {
  logger.info(
    `[lineageDiversity.calculateGeneticDiversityMetrics] Calculating diversity for ${lineageData.length} generations`,
  );

  const allHorses = lineageData.flatMap(gen => gen.horses);
  const allTraits = [];
  const allStats = { speed: [], stamina: [], agility: [], intelligence: [] };

  // Collect all traits and stats
  allHorses.forEach(horse => {
    const traits = horse.traits || { positive: [], negative: [], hidden: [] };
    allTraits.push(...traits.positive, ...traits.negative, ...traits.hidden);

    const stats = horse.stats || {};
    if (stats.speed) {
      allStats.speed.push(stats.speed);
    }
    if (stats.stamina) {
      allStats.stamina.push(stats.stamina);
    }
    if (stats.agility) {
      allStats.agility.push(stats.agility);
    }
    if (stats.intelligence) {
      allStats.intelligence.push(stats.intelligence);
    }
  });

  // Calculate trait diversity
  const uniqueTraits = [...new Set(allTraits)];
  const traitFrequency = {};
  allTraits.forEach(trait => {
    traitFrequency[trait] = (traitFrequency[trait] || 0) + 1;
  });

  // Calculate Shannon diversity index for traits
  const totalTraits = allTraits.length;
  let shannonIndex = 0;
  if (totalTraits > 0) {
    Object.values(traitFrequency).forEach(count => {
      const proportion = count / totalTraits;
      shannonIndex -= proportion * Math.log2(proportion);
    });
  }

  // Calculate stat variance
  const statVariance = {};
  Object.keys(allStats).forEach(stat => {
    const values = allStats[stat];
    if (values.length > 0) {
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance =
        values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      statVariance[stat] = {
        mean: Math.round(mean),
        variance: Math.round(variance * 100) / 100,
        standardDeviation: Math.round(Math.sqrt(variance) * 100) / 100,
      };
    }
  });

  // Calculate overall diversity score (0-100)
  const traitDiversityScore = Math.min(
    100,
    (uniqueTraits.length / Math.max(1, allHorses.length)) * 100,
  );
  const statDiversityScore =
    Object.values(statVariance).reduce((sum, stat) => sum + stat.standardDeviation, 0) / 4;
  const overallDiversity = Math.round(
    (traitDiversityScore + Math.min(100, statDiversityScore)) / 2,
  );

  return {
    overallDiversity,
    traitDiversity: {
      uniqueTraits: uniqueTraits.length,
      traitFrequency,
      diversityIndex: Math.round(shannonIndex * 100) / 100,
    },
    statVariance,
    inbreedingRisk: await calculateInbreedingRisk(lineageData),
    geneticBottlenecks: await identifyGeneticBottlenecks(lineageData),
  };
}

/**
 * Calculate inbreeding risk from lineage data
 * @param {Array} lineageData - Lineage generation data
 * @returns {Object} Inbreeding risk assessment
 */
async function calculateInbreedingRisk(lineageData) {
  const allHorses = lineageData.flatMap(gen => gen.horses);
  const horseIds = new Set();
  const duplicates = [];

  allHorses.forEach(horse => {
    if (horseIds.has(horse.id)) {
      duplicates.push(horse.id);
    } else {
      horseIds.add(horse.id);
    }
  });

  const riskLevel = duplicates.length > 0 ? 'high' : allHorses.length < 8 ? 'medium' : 'low';

  return {
    level: riskLevel,
    duplicateAncestors: duplicates.length,
    totalAncestors: horseIds.size,
    coefficient: duplicates.length / Math.max(1, allHorses.length),
  };
}

/**
 * Identify genetic bottlenecks in lineage
 * @param {Array} lineageData - Lineage generation data
 * @returns {Array} Array of identified bottlenecks
 */
export async function identifyGeneticBottlenecks(lineageData) {
  const bottlenecks = [];

  lineageData.forEach((generation, index) => {
    const { horses } = generation;
    const traitCounts = {};

    // Count trait occurrences in this generation
    horses.forEach(horse => {
      const traits = horse.traits || { positive: [], negative: [], hidden: [] };
      [...traits.positive, ...traits.negative, ...traits.hidden].forEach(trait => {
        traitCounts[trait] = (traitCounts[trait] || 0) + 1;
      });
    });

    // Identify traits that appear in >75% of horses (potential bottleneck)
    const totalHorses = horses.length;
    Object.entries(traitCounts).forEach(([trait, count]) => {
      const frequency = count / totalHorses;
      if (frequency > 0.75 && totalHorses > 1) {
        bottlenecks.push({
          generation: index,
          trait,
          frequency: Math.round(frequency * 100),
          severity: frequency > 0.9 ? 'high' : 'medium',
          affectedTraits: [trait],
          recommendation: `Consider introducing genetic diversity to reduce ${trait} dominance`,
        });
      }
    });
  });

  return bottlenecks;
}

/**
 * Calculate inbreeding coefficient for specific breeding pair
 * @param {number} stallionId - Stallion ID
 * @param {number} mareId - Mare ID
 * @returns {number} Inbreeding coefficient (0-1)
 */
export async function calculateInbreedingCoefficient(stallionId, mareId) {
  try {
    logger.info(
      `[lineageDiversity.calculateInbreedingCoefficient] Calculating for stallion ${stallionId} and mare ${mareId}`,
    );

    // Get lineage for both horses
    const lineageData = await organizeByGenerations(stallionId, mareId, 4);
    const allAncestors = lineageData.flatMap(gen => gen.horses);

    // Find common ancestors
    const stallionAncestors = new Set();
    const mareAncestors = new Set();
    const commonAncestors = [];

    // Separate ancestors by parent line
    allAncestors.forEach(horse => {
      // This is a simplified approach - in reality, we'd need to trace specific lineage paths
      if (horse.id === stallionId || isAncestorOf(horse.id, stallionId, allAncestors)) {
        stallionAncestors.add(horse.id);
      }
      if (horse.id === mareId || isAncestorOf(horse.id, mareId, allAncestors)) {
        mareAncestors.add(horse.id);
      }
    });

    // Delegate intersection + normalisation to the canonical core
    // (backend/utils/inbreedingCoefficient.mjs, Equoria-n5wza). The set
    // assembly above, the denominator (max(1, allAncestors.length)), and the
    // self-pair exclusion are unchanged from the original implementation so
    // numeric output is identical. We still compute commonAncestors for the
    // log line so the existing log message is preserved.
    stallionAncestors.forEach(id => {
      if (mareAncestors.has(id) && id !== stallionId && id !== mareId) {
        commonAncestors.push(id);
      }
    });

    const coefficient = calculateInbreedingCoefficientCore(
      stallionAncestors,
      mareAncestors,
      Math.max(1, allAncestors.length),
      { excludeIds: [stallionId, mareId] },
    );

    logger.info(
      `[lineageDiversity.calculateInbreedingCoefficient] Found ${commonAncestors.length} common ancestors, coefficient: ${coefficient}`,
    );
    return coefficient;
  } catch (error) {
    logger.error(`[lineageDiversity.calculateInbreedingCoefficient] Error: ${error.message}`);
    return 0;
  }
}

/**
 * Helper function to check if horse is ancestor of another
 * @param {number} ancestorId - Potential ancestor ID
 * @param {number} descendantId - Descendant ID
 * @param {Array} allHorses - All horses in lineage
 * @returns {boolean} True if ancestor relationship exists
 */
function isAncestorOf(ancestorId, descendantId, allHorses) {
  const descendant = allHorses.find(h => h.id === descendantId);
  if (!descendant) {
    return false;
  }

  if (descendant.sireId === ancestorId || descendant.damId === ancestorId) {
    return true;
  }

  // Check recursively through parents
  if (descendant.sireId && isAncestorOf(ancestorId, descendant.sireId, allHorses)) {
    return true;
  }
  if (descendant.damId && isAncestorOf(ancestorId, descendant.damId, allHorses)) {
    return true;
  }

  return false;
}
