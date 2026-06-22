/**
 * Multi-Generational Predictions — pure, in-memory lineage trait analysis
 *
 * Extracted from enhancedGeneticProbabilityService.mjs (Equoria-urqic.4.2).
 *
 * Owns the multi-generational prediction cluster that backs
 * `calculateMultiGenerationalPredictions`: per-generation weighted trait
 * influence (with geometric decay across generations) and an aggregate
 * lineage-pattern analysis (strengths / weaknesses / score).
 *
 * All functions are pure: they operate over plain
 * `lineage.generations[].horses[]` objects, touch no DB and emit no logs. This
 * is deliberately NOT consolidated into advancedLineageAnalysisService.mjs —
 * that service is DB/ID-based and walks a different data shape; these calcs run
 * entirely over in-memory horse objects (the urqic.4 facade-composes /
 * module-computes precedent). The facade
 * (enhancedGeneticProbabilityService.calculateMultiGenerationalPredictions)
 * owns the logging and delegates the computation to `computeMultiGenerationalPredictions`.
 */

/**
 * Constants for multi-generational influence weighting.
 *
 * GENERATION_WEIGHT_DECAY mirrors the facade's
 * GENETIC_CONSTANTS.GENERATION_WEIGHT_DECAY (0.5) — each generation further back
 * in the lineage contributes half the weight of the one before it. Kept local
 * to this module so the extracted unit has no back-reference to the facade.
 */
export const MULTI_GEN_CONSTANTS = {
  GENERATION_WEIGHT_DECAY: 0.5,
};

/**
 * Calculate the weighted trait influence contributed by a single generation's
 * horses.
 *
 * Every trait (positive / negative / hidden) carried by every horse in the
 * generation contributes `weight` to that trait's running total. Malformed
 * trait arrays are tolerated (coerced to empty) so a single bad ancestor row
 * cannot throw.
 *
 * @param {Array<object>} horses - horses in this generation
 * @param {number} weight - the geometric-decay weight for this generation
 * @returns {{traitInfluence: Record<string, number>, totalInfluence: number, averageInfluence: number}}
 */
export function calculateGenerationTraitInfluence(horses, weight) {
  const traitCounts = {};
  let totalInfluence = 0;

  horses.forEach(horse => {
    const traits = horse.traits || { positive: [], negative: [], hidden: [] };
    // Ensure all trait arrays exist and are arrays
    const positiveTraits = Array.isArray(traits.positive) ? traits.positive : [];
    const negativeTraits = Array.isArray(traits.negative) ? traits.negative : [];
    const hiddenTraits = Array.isArray(traits.hidden) ? traits.hidden : [];

    const allTraits = [...positiveTraits, ...negativeTraits, ...hiddenTraits];

    allTraits.forEach(trait => {
      if (!traitCounts[trait]) {
        traitCounts[trait] = 0;
      }
      traitCounts[trait] += weight;
      totalInfluence += weight;
    });
  });

  return {
    traitInfluence: traitCounts,
    totalInfluence,
    averageInfluence: horses.length > 0 ? totalInfluence / horses.length : 0,
  };
}

/**
 * Analyze recurring trait patterns across an entire lineage.
 *
 * Accepts either the `{ generations: [...] }` shape or a bare array of
 * generations. Counts raw trait frequency over every horse, then surfaces:
 *  - strengths: traits present in >30% of the lineage (consistency signal),
 *  - weaknesses: traits flagged as negative / known-bad,
 *  - score: 75 baseline, -10 per weakness, +5 per strength, floored at 0.
 *
 * @param {object|Array} lineage - { generations: [...] } or [ ...generations ]
 * @returns {{strengths: Array, weaknesses: Array, score: number}}
 */
export function analyzeLineagePatterns(lineage) {
  const traitFrequency = {};
  let totalHorses = 0;

  // Handle case where lineage is an object with generations property
  const generations = lineage?.generations || lineage || [];

  // Collect all traits from lineage
  generations.forEach(generation => {
    if (generation.horses) {
      generation.horses.forEach(horse => {
        totalHorses++;
        const traits = horse.traits || { positive: [], negative: [], hidden: [] };
        const allHorseTraits = [...traits.positive, ...traits.negative, ...traits.hidden];

        allHorseTraits.forEach(trait => {
          if (!traitFrequency[trait]) {
            traitFrequency[trait] = 0;
          }
          traitFrequency[trait]++;
        });
      });
    }
  });

  // Identify strengths (common positive traits)
  const strengths = Object.entries(traitFrequency)
    .filter(([_trait, count]) => count / totalHorses > 0.3) // Present in >30% of lineage
    .map(([trait, count]) => ({
      trait,
      frequency: count / totalHorses,
      strength: 'lineage_consistency',
    }));

  // Identify weaknesses (common negative traits)
  const weaknesses = Object.entries(traitFrequency)
    .filter(
      ([trait, _count]) =>
        trait.includes('negative') || ['nervous', 'stubborn', 'lazy'].includes(trait),
    )
    .map(([trait, count]) => ({
      trait,
      frequency: count / totalHorses,
      concern: 'recurring_negative_trait',
    }));

  const score = Math.max(0, 75 - weaknesses.length * 10 + strengths.length * 5);

  return { strengths, weaknesses, score };
}

/**
 * Compute the full multi-generational prediction report for a breeding pair.
 *
 * Cohesive public entry point the facade
 * (enhancedGeneticProbabilityService.calculateMultiGenerationalPredictions)
 * delegates to. Accepts either the `{ generations: [...] }` shape or a bare
 * array of generations (matching the original facade behavior). Pure: no DB,
 * no logging — the facade owns the logging.
 *
 * @param {object} stallion - breeding stallion (unused in the calc; kept for
 *   signature parity with the facade entry point)
 * @param {object} mare - breeding mare (unused; signature parity)
 * @param {object|Array} lineage - { generations: [...] } or [ ...generations ]
 */
export function computeMultiGenerationalPredictions(stallion, mare, lineage) {
  // Handle case where lineage is an object with generations property
  const generations = lineage?.generations || lineage || [];

  const generationalImpact = {};
  const ancestralTraitInfluence = {};

  // Analyze each generation's influence
  generations.forEach((generation, index) => {
    const generationNumber = index + 1;
    const weight = Math.pow(MULTI_GEN_CONSTANTS.GENERATION_WEIGHT_DECAY, index);

    const horses = generation.horses || [];
    generationalImpact[`generation${generationNumber}`] = {
      weight,
      horseCount: horses.length,
      influence: weight * horses.length,
    };

    // Calculate trait influence from this generation
    const traitInfluence = calculateGenerationTraitInfluence(horses, weight);
    ancestralTraitInfluence[`generation${generationNumber}`] = traitInfluence;
  });

  // Identify lineage strengths and weaknesses
  const lineageAnalysis = analyzeLineagePatterns(lineage);

  return {
    generationalImpact,
    ancestralTraitInfluence,
    lineageStrengths: lineageAnalysis.strengths,
    lineageWeaknesses: lineageAnalysis.weaknesses,
    overallLineageScore: lineageAnalysis.score,
  };
}
