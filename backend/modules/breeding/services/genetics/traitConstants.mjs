/**
 * Trait Constants — shared trait-interaction definitions + category helper
 *
 * Extracted from enhancedGeneticProbabilityService.mjs (Equoria-urqic.4.3).
 *
 * `TRAIT_INTERACTIONS` (the synergistic/antagonistic trait-pair table) and
 * `hasTraitInCategory` (the "does this horse carry this trait in any category?"
 * helper) are consumed by BOTH the facade (calculateTraitInheritanceProbabilities
 * / applyTraitInteractionModifiers, which stay in the facade) AND the extracted
 * trait-interactions cluster (genetics/traitInteractions.mjs). Rather than leave
 * a back-reference from the extracted module into the facade — which would
 * create a circular import — both sides import this single shared source.
 *
 * Pure data + a pure helper: no DB, no logging, no facade dependency.
 */

/**
 * Trait interaction definitions.
 *
 * `synergistic` pairs grant a `bonus`; `antagonistic` pairs incur a `penalty`.
 * Frozen so the shared table cannot be mutated by any consumer.
 */
export const TRAIT_INTERACTIONS = Object.freeze({
  synergistic: [
    { traits: ['athletic', 'intelligent'], bonus: 15 },
    { traits: ['calm', 'focused'], bonus: 12 },
    { traits: ['resilient', 'bold'], bonus: 10 },
    { traits: ['agile', 'athletic'], bonus: 8 },
  ],
  antagonistic: [
    { traits: ['calm', 'nervous'], penalty: -20 },
    { traits: ['bold', 'timid'], penalty: -15 },
    { traits: ['focused', 'distracted'], penalty: -12 },
  ],
});

/**
 * Check whether a horse's trait bag carries `trait` in any category
 * (positive / negative / hidden).
 *
 * @param {{positive: string[], negative: string[], hidden: string[]}} traits
 * @param {string} trait
 * @returns {boolean}
 */
export function hasTraitInCategory(traits, trait) {
  return (
    traits.positive.includes(trait) ||
    traits.negative.includes(trait) ||
    traits.hidden.includes(trait)
  );
}
