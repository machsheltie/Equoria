/**
 * Genetic Breeding Recommendations — synchronous, object-based (pure)
 *
 * Extracted from enhancedGeneticProbabilityService.mjs (Equoria-urqic.4.3).
 *
 * Owns the recommendation-shaping cluster that backs
 * `generateGeneticBreedingRecommendations`: turning a compatibility score, a
 * trait-interaction report, and an enhanced-probability report into an overall
 * recommendation label, strengths/concerns lists, optimization suggestions, and
 * an expected-outcomes summary.
 *
 * This is the SYNC, in-memory-object-consuming variant. It is deliberately NOT
 * merged with genetics/recommendationGenerators.mjs, which is the DB/ID-based,
 * epigeneticModifiers-shaped recommendation generator — a different data shape
 * and a different consumer. Keeping them separate avoids conflating two
 * unrelated recommendation pipelines.
 *
 * The three upstream computations it composes —
 * calculateGeneticCompatibilityScore, calculateTraitInteractions, and
 * calculateEnhancedGeneticProbabilities — are all facade exports. Rather than
 * import them here (which would create a circular import: facade → this module →
 * facade), the facade INJECTS them as `compatibilityFn`, `traitInteractionsFn`,
 * and `probabilitiesFn`. This mirrors the urqic.4 / .4.1 precedent (facade
 * composes, module computes).
 */

/**
 * Generate optimization suggestions from a compatibility report and a
 * trait-interaction report.
 *
 * Each rule appends at most one suggestion; an empty array means the pair is
 * already well-optimized on every axis checked.
 *
 * @param {object} compatibility - output of calculateGeneticCompatibilityScore
 * @param {object} traitInteractions - output of calculateTraitInteractions
 * @returns {Array<{category: string, suggestion: string, impact: string}>}
 */
export function generateOptimizationSuggestions(compatibility, traitInteractions) {
  const suggestions = [];

  if (compatibility.traitCompatibility.score < 60) {
    suggestions.push({
      category: 'trait_compatibility',
      suggestion: 'Consider alternative breeding partners with more compatible trait profiles',
      impact: 'high',
    });
  }

  if (traitInteractions.antagonisticPairs.length > 0) {
    suggestions.push({
      category: 'trait_conflicts',
      suggestion: 'Monitor offspring for trait conflicts and plan training accordingly',
      impact: 'medium',
    });
  }

  if (compatibility.statCompatibility.complementaryStats.length === 0) {
    suggestions.push({
      category: 'stat_balance',
      suggestion: 'Seek breeding partners with complementary stat strengths',
      impact: 'medium',
    });
  }

  if (compatibility.diversityScore < 40) {
    suggestions.push({
      category: 'genetic_diversity',
      suggestion: 'Introduce new bloodlines to improve genetic diversity',
      impact: 'high',
    });
  }

  return suggestions;
}

/**
 * Compute the full genetic breeding recommendation report for a pair.
 *
 * Cohesive public entry point the facade
 * (enhancedGeneticProbabilityService.generateGeneticBreedingRecommendations)
 * delegates to. Composes three injected facade computations rather than
 * importing them, to avoid a circular import. Pure: no DB, no logging.
 *
 * @param {object} stallion - breeding stallion
 * @param {object} mare - breeding mare
 * @param {object} deps - injected facade computations
 * @param {(s: object, m: object) => object} deps.compatibilityFn - calculateGeneticCompatibilityScore
 * @param {(s: object, m: object) => object} deps.traitInteractionsFn - calculateTraitInteractions
 * @param {(s: object, m: object) => object} deps.probabilitiesFn - calculateEnhancedGeneticProbabilities
 * @returns {{overallRecommendation: string, strengths: string[], concerns: string[], optimizationSuggestions: Array, expectedOutcomes: object, compatibilityScore: number}}
 */
export function computeGeneticRecommendations(
  stallion,
  mare,
  { compatibilityFn, traitInteractionsFn, probabilitiesFn },
) {
  const compatibility = compatibilityFn(stallion, mare);
  const traitInteractions = traitInteractionsFn(stallion, mare);
  const probabilities = probabilitiesFn(stallion, mare);

  // Determine overall recommendation
  let overallRecommendation;
  if (compatibility.overallScore >= 80) {
    overallRecommendation = 'Highly Recommended';
  } else if (compatibility.overallScore >= 65) {
    overallRecommendation = 'Recommended';
  } else if (compatibility.overallScore >= 45) {
    overallRecommendation = 'Acceptable';
  } else {
    overallRecommendation = 'Not Recommended';
  }

  // Identify strengths
  const strengths = [];
  if (compatibility.traitCompatibility.sharedPositiveTraits.length > 0) {
    strengths.push(
      `Shared positive traits: ${compatibility.traitCompatibility.sharedPositiveTraits.join(', ')}`,
    );
  }
  if (traitInteractions.synergisticPairs.length > 0) {
    strengths.push(`${traitInteractions.synergisticPairs.length} synergistic trait combinations`);
  }
  if (compatibility.statCompatibility.complementaryStats.length > 0) {
    strengths.push('Complementary stat profiles for balanced offspring');
  }

  // Identify concerns
  const concerns = [];
  if (compatibility.traitCompatibility.conflicts.length > 0) {
    concerns.push(`${compatibility.traitCompatibility.conflicts.length} trait conflicts detected`);
  }
  if (traitInteractions.antagonisticPairs.length > 0) {
    concerns.push(`${traitInteractions.antagonisticPairs.length} antagonistic trait pairs`);
  }
  if (compatibility.diversityScore < 30) {
    concerns.push('Low genetic diversity may limit offspring potential');
  }

  // Generate optimization suggestions
  const optimizationSuggestions = generateOptimizationSuggestions(compatibility, traitInteractions);

  // Calculate expected outcomes
  const expectedOutcomes = {
    traitInheritance: probabilities.traitProbabilities,
    statRanges: probabilities.statProbabilities,
    geneticScore: probabilities.overallGeneticScore,
  };

  return {
    overallRecommendation,
    strengths,
    concerns,
    optimizationSuggestions,
    expectedOutcomes,
    compatibilityScore: compatibility.overallScore,
  };
}
