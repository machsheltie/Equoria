/**
 * Genetic Diversity Impact — object-based pure calculations
 *
 * Extracted from enhancedGeneticProbabilityService.mjs (Equoria-urqic.4).
 *
 * This module owns the pure, in-memory diversity/inbreeding/health
 * sub-calculations that back `calculateGeneticDiversityImpact`. They operate
 * on the in-memory stallion/mare/lineage OBJECT shape (`traits`,
 * `sireId`/`damId`, `lineage.generations[].horses[]`) — distinct from the
 * DB-/ID-based `inbreedingAnalysis.mjs` + `geneticDiversityMetrics.mjs`
 * siblings in this directory, which select `epigeneticModifiers` from Prisma
 * and are NOT interchangeable with these. Kept separate deliberately to avoid
 * conflating the two data shapes.
 *
 * The numeric core of the inbreeding coefficient (set intersection +
 * normalisation) still delegates to the canonical
 * backend/utils/inbreedingCoefficient.mjs (Equoria-n5wza) — only the
 * set-assembly from the object shape lives here.
 */

import { calculateInbreedingCoefficientCore } from '../../../../utils/inbreedingCoefficient.mjs';

// Genetic calculation constants used by the diversity-impact cluster.
// Mirrors the subset of GENETIC_CONSTANTS the facade uses; kept local so this
// module is self-contained.
export const DIVERSITY_IMPACT_CONSTANTS = Object.freeze({
  INBREEDING_THRESHOLD: 0.125,
});

/**
 * Calculate inbreeding coefficient from in-memory objects.
 *
 * Builds the two ancestor-ID sets from the in-memory stallion/mare/lineage
 * objects, then delegates the shared-ancestor intersection + normalisation to
 * the canonical core. The set-assembly + denominator are unchanged from the
 * original implementation so numeric output is identical.
 */
export function calculateInbreedingCoefficient(stallion, mare, lineage) {
  // Handle case where lineage is an object with generations property
  const generations = lineage?.generations || lineage || [];
  if (!generations || generations.length < 2) {
    return 0;
  }

  // Simple inbreeding detection - check for shared ancestors
  const stallionAncestors = new Set();
  const mareAncestors = new Set();

  // Add immediate parents
  if (stallion.sireId) {
    stallionAncestors.add(stallion.sireId);
  }
  if (stallion.damId) {
    stallionAncestors.add(stallion.damId);
  }
  if (mare.sireId) {
    mareAncestors.add(mare.sireId);
  }
  if (mare.damId) {
    mareAncestors.add(mare.damId);
  }

  // Add lineage ancestors
  generations.forEach(generation => {
    if (generation.horses) {
      generation.horses.forEach(horse => {
        stallionAncestors.add(horse.id);
        mareAncestors.add(horse.id);
      });
    }
  });

  // Original denominator: total of both ancestor-set sizes. Delegate the
  // intersection + division + clamp to the canonical core.
  const totalAncestors = stallionAncestors.size + mareAncestors.size;
  return calculateInbreedingCoefficientCore(stallionAncestors, mareAncestors, totalAncestors);
}

/**
 * Calculate genetic diversity score from trait sets + lineage breadth.
 */
export function calculateGeneticDiversityScore(stallion, mare, lineage) {
  const stallionTraits = stallion.traits || { positive: [], negative: [], hidden: [] };
  const mareTraits = mare.traits || { positive: [], negative: [], hidden: [] };

  // Ensure all trait arrays exist and are arrays
  const stallionPositive = Array.isArray(stallionTraits.positive) ? stallionTraits.positive : [];
  const stallionNegative = Array.isArray(stallionTraits.negative) ? stallionTraits.negative : [];
  const stallionHidden = Array.isArray(stallionTraits.hidden) ? stallionTraits.hidden : [];

  const marePositive = Array.isArray(mareTraits.positive) ? mareTraits.positive : [];
  const mareNegative = Array.isArray(mareTraits.negative) ? mareTraits.negative : [];
  const mareHidden = Array.isArray(mareTraits.hidden) ? mareTraits.hidden : [];

  const stallionAllTraits = [...stallionPositive, ...stallionNegative, ...stallionHidden];
  const mareAllTraits = [...marePositive, ...mareNegative, ...mareHidden];

  // Calculate trait diversity
  const uniqueTraits = new Set([...stallionAllTraits, ...mareAllTraits]);
  const sharedTraits = stallionAllTraits.filter(trait => mareAllTraits.includes(trait));

  const diversityRatio =
    uniqueTraits.size > 0 ? (uniqueTraits.size - sharedTraits.length) / uniqueTraits.size : 0;

  // Add lineage diversity bonus
  let lineageBonus = 0;
  // Handle case where lineage is an object with generations property
  const generations = lineage?.generations || lineage || [];
  if (generations && generations.length > 0) {
    const lineageTraits = new Set();
    generations.forEach(generation => {
      if (generation.horses) {
        generation.horses.forEach(horse => {
          const traits = horse.traits || { positive: [], negative: [], hidden: [] };
          const positive = Array.isArray(traits.positive) ? traits.positive : [];
          const negative = Array.isArray(traits.negative) ? traits.negative : [];
          const hidden = Array.isArray(traits.hidden) ? traits.hidden : [];

          [...positive, ...negative, ...hidden].forEach(trait => {
            lineageTraits.add(trait);
          });
        });
      }
    });

    lineageBonus = Math.min(20, lineageTraits.size * 2);
  }

  return Math.min(100, Math.round(diversityRatio * 80 + lineageBonus));
}

/**
 * Calculate genetic health score from diversity + inbreeding.
 */
export function calculateGeneticHealthScore(diversityScore, inbreedingCoefficient) {
  let healthScore = 85; // Base health score

  // Diversity bonus/penalty
  if (diversityScore > 70) {
    healthScore += 10;
  } else if (diversityScore < 30) {
    healthScore -= 15;
  }

  // Inbreeding penalty
  if (inbreedingCoefficient > DIVERSITY_IMPACT_CONSTANTS.INBREEDING_THRESHOLD) {
    healthScore -= inbreedingCoefficient * 100;
  }

  return Math.min(100, Math.max(0, Math.round(healthScore)));
}

/**
 * Generate human-readable diversity recommendations.
 */
export function generateDiversityRecommendations(
  diversityScore,
  inbreedingCoefficient,
  geneticHealthScore,
) {
  const recommendations = [];

  if (inbreedingCoefficient > DIVERSITY_IMPACT_CONSTANTS.INBREEDING_THRESHOLD) {
    recommendations.push('Consider outcrossing to improve genetic diversity');
  }

  if (diversityScore < 40) {
    recommendations.push('Seek breeding partners with different trait profiles');
  }

  if (geneticHealthScore < 70) {
    recommendations.push('Focus on genetic health improvement before breeding');
  }

  if (diversityScore > 80 && inbreedingCoefficient < 0.05) {
    recommendations.push('Excellent genetic diversity - proceed with confidence');
  }

  return recommendations;
}

/**
 * Bucket the genetic factors into a coarse risk level.
 */
export function getRiskLevel(inbreedingCoefficient, geneticHealthScore) {
  if (inbreedingCoefficient > 0.25 || geneticHealthScore < 50) {
    return 'high';
  } else if (inbreedingCoefficient > 0.125 || geneticHealthScore < 70) {
    return 'moderate';
  } else {
    return 'low';
  }
}

/**
 * Compose the full genetic-diversity-impact report for a breeding pair.
 *
 * This is the cohesive public entry point the facade
 * (enhancedGeneticProbabilityService.calculateGeneticDiversityImpact)
 * delegates to. Logging stays at the facade so this module is log-free /
 * trivially unit-testable.
 */
export function computeGeneticDiversityImpact(stallion, mare, lineage) {
  const inbreedingCoefficient = calculateInbreedingCoefficient(stallion, mare, lineage);
  const diversityScore = calculateGeneticDiversityScore(stallion, mare, lineage);
  const geneticHealthScore = calculateGeneticHealthScore(diversityScore, inbreedingCoefficient);
  const diversityRecommendations = generateDiversityRecommendations(
    diversityScore,
    inbreedingCoefficient,
    geneticHealthScore,
  );

  return {
    diversityScore,
    inbreedingCoefficient,
    geneticHealthScore,
    diversityRecommendations,
    riskLevel: getRiskLevel(inbreedingCoefficient, geneticHealthScore),
  };
}
