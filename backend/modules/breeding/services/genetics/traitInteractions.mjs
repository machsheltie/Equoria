/**
 * Trait Interactions — synergistic/antagonistic pair analysis (pure)
 *
 * Extracted from enhancedGeneticProbabilityService.mjs (Equoria-urqic.4.3).
 *
 * Owns the trait-interaction cluster that backs `calculateTraitInteractions`:
 * scanning a breeding pair's combined trait bags against the synergistic and
 * antagonistic trait-pair table, scoring inheritance/conflict-resolution
 * probabilities, and predicting trait combinations.
 *
 * All functions are pure: they operate over plain stallion/mare objects (and
 * their `.traits` bags), touch no DB and emit no logs. The shared
 * `TRAIT_INTERACTIONS` table and `hasTraitInCategory` helper are imported from
 * genetics/traitConstants.mjs — the same source the facade uses — so neither
 * this module nor the facade holds a back-reference to the other (no circular
 * import). The facade
 * (enhancedGeneticProbabilityService.calculateTraitInteractions) delegates the
 * computation to `computeTraitInteractions`.
 */

import { TRAIT_INTERACTIONS, hasTraitInCategory } from './traitConstants.mjs';

/**
 * Probability that an offspring inherits BOTH traits of an interacting pair.
 *
 * Higher when one parent carries both traits (60%); lower for cross-parent
 * inheritance where each parent supplies one trait (35%); 0 otherwise.
 *
 * @param {boolean} stallionHasTrait1
 * @param {boolean} stallionHasTrait2
 * @param {boolean} mareHasTrait1
 * @param {boolean} mareHasTrait2
 * @returns {number} probability in [0, 60]
 */
export function calculateInteractionInheritanceProbability(
  stallionHasTrait1,
  stallionHasTrait2,
  mareHasTrait1,
  mareHasTrait2,
) {
  let probability = 0;

  // Both traits from same parent
  if ((stallionHasTrait1 && stallionHasTrait2) || (mareHasTrait1 && mareHasTrait2)) {
    probability = 60; // High chance if one parent has both
  } else if ((stallionHasTrait1 && mareHasTrait2) || (stallionHasTrait2 && mareHasTrait1)) {
    // Traits from different parents
    probability = 35; // Moderate chance for cross-inheritance
  }

  return probability;
}

/**
 * Probability that an antagonistic conflict resolves (one trait dominates).
 *
 * Cross-parent conflicts (each parent supplies one of the conflicting traits)
 * resolve more readily (70%) than same-parent conflicts (40%).
 *
 * @param {boolean} stallionHasTrait1
 * @param {boolean} stallionHasTrait2
 * @param {boolean} mareHasTrait1
 * @param {boolean} mareHasTrait2
 * @returns {number} probability (70 or 40)
 */
export function calculateConflictResolutionProbability(
  stallionHasTrait1,
  stallionHasTrait2,
  mareHasTrait1,
  mareHasTrait2,
) {
  // Higher probability means one trait will dominate over the other
  if ((stallionHasTrait1 && mareHasTrait2) || (stallionHasTrait2 && mareHasTrait1)) {
    return 70; // Cross-parent conflicts often resolve
  } else {
    return 40; // Same-parent conflicts are harder to resolve
  }
}

/**
 * Predict likely trait combinations for an offspring.
 *
 * Emits one `synergistic` combination per detected synergistic pair, then adds
 * `individual` predictions for the high-value traits (athletic / intelligent /
 * resilient / calm) carried by either parent.
 *
 * @param {{positive: string[], negative: string[], hidden: string[]}} stallionTraits
 * @param {{positive: string[], negative: string[], hidden: string[]}} mareTraits
 * @param {Array<{trait1: string, trait2: string, inheritanceProbability: number, synergyBonus: number}>} synergisticPairs
 * @returns {Array<object>}
 */
export function predictTraitCombinations(stallionTraits, mareTraits, synergisticPairs) {
  const combinations = [];

  synergisticPairs.forEach(pair => {
    combinations.push({
      traits: [pair.trait1, pair.trait2],
      probability: pair.inheritanceProbability,
      expectedBonus: pair.synergyBonus,
      type: 'synergistic',
    });
  });

  // Add some individual high-value trait predictions
  const highValueTraits = ['athletic', 'intelligent', 'resilient', 'calm'];
  highValueTraits.forEach(trait => {
    const stallionHas = hasTraitInCategory(stallionTraits, trait);
    const mareHas = hasTraitInCategory(mareTraits, trait);

    if (stallionHas || mareHas) {
      const probability = stallionHas && mareHas ? 75 : 45;
      combinations.push({
        traits: [trait],
        probability,
        expectedBonus: 5,
        type: 'individual',
      });
    }
  });

  return combinations;
}

/**
 * Compute the full trait-interaction report for a breeding pair.
 *
 * Cohesive public entry point the facade
 * (enhancedGeneticProbabilityService.calculateTraitInteractions) delegates to.
 * Scans the combined trait bags against the synergistic/antagonistic table,
 * computes an aggregate interaction score (synergy minus conflict), and predicts
 * trait combinations. Pure: no DB, no logging.
 *
 * @param {object} stallion - breeding stallion (uses `.traits`)
 * @param {object} mare - breeding mare (uses `.traits`)
 * @returns {{synergisticPairs: Array, antagonisticPairs: Array, interactionScore: number, predictedCombinations: Array}}
 */
export function computeTraitInteractions(stallion, mare) {
  const stallionTraits = stallion.traits || { positive: [], negative: [], hidden: [] };
  const mareTraits = mare.traits || { positive: [], negative: [], hidden: [] };

  const allStallionTraits = [
    ...stallionTraits.positive,
    ...stallionTraits.negative,
    ...stallionTraits.hidden,
  ];
  const allMareTraits = [...mareTraits.positive, ...mareTraits.negative, ...mareTraits.hidden];

  const synergisticPairs = [];
  const antagonisticPairs = [];

  // Check for synergistic interactions
  TRAIT_INTERACTIONS.synergistic.forEach(interaction => {
    const [trait1, trait2] = interaction.traits;
    const stallionHasTrait1 = allStallionTraits.includes(trait1);
    const stallionHasTrait2 = allStallionTraits.includes(trait2);
    const mareHasTrait1 = allMareTraits.includes(trait1);
    const mareHasTrait2 = allMareTraits.includes(trait2);

    if ((stallionHasTrait1 || mareHasTrait1) && (stallionHasTrait2 || mareHasTrait2)) {
      synergisticPairs.push({
        trait1,
        trait2,
        synergyBonus: interaction.bonus,
        inheritanceProbability: calculateInteractionInheritanceProbability(
          stallionHasTrait1,
          stallionHasTrait2,
          mareHasTrait1,
          mareHasTrait2,
        ),
      });
    }
  });

  // Check for antagonistic interactions
  TRAIT_INTERACTIONS.antagonistic.forEach(interaction => {
    const [trait1, trait2] = interaction.traits;
    const stallionHasTrait1 = allStallionTraits.includes(trait1);
    const stallionHasTrait2 = allStallionTraits.includes(trait2);
    const mareHasTrait1 = allMareTraits.includes(trait1);
    const mareHasTrait2 = allMareTraits.includes(trait2);

    if ((stallionHasTrait1 || mareHasTrait1) && (stallionHasTrait2 || mareHasTrait2)) {
      antagonisticPairs.push({
        trait1,
        trait2,
        conflictPenalty: Math.abs(interaction.penalty),
        resolutionProbability: calculateConflictResolutionProbability(
          stallionHasTrait1,
          stallionHasTrait2,
          mareHasTrait1,
          mareHasTrait2,
        ),
      });
    }
  });

  // Calculate overall interaction score
  const synergyScore = synergisticPairs.reduce((sum, pair) => sum + pair.synergyBonus, 0);
  const conflictScore = antagonisticPairs.reduce((sum, pair) => sum + pair.conflictPenalty, 0);
  const interactionScore = synergyScore - conflictScore;

  // Predict trait combinations
  const predictedCombinations = predictTraitCombinations(
    stallionTraits,
    mareTraits,
    synergisticPairs,
  );

  return {
    synergisticPairs,
    antagonisticPairs,
    interactionScore,
    predictedCombinations,
  };
}
