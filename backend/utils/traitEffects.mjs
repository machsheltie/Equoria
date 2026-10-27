/**
 * Trait Effects System
 * Maps each epigenetic trait to its specific game mechanics effects
 * Used throughout training, competition, and display logic
 */

import logger from './logger.mjs';
import { normalizeTraitKey, disciplineAffinityKey } from './epigeneticTraitKeyMap.mjs';
import { DISCIPLINES } from '../constants/schema.mjs';
import { getStatsForDiscipline } from './statMap.mjs';

/**
 * Comprehensive trait effects mapping
 * Each trait defines specific game mechanics it affects
 */
const traitEffects = {
  // ===== POSITIVE TRAITS =====

  resilient: {
    // Training effects
    suppressTemperamentDrift: true,
    trainingConsistencyBonus: 0.1, // 10% more consistent training results

    // Competition effects
    competitionScoreModifier: 0.03, // +3% to final competition score

    // Recovery effects
    injuryRecoveryBonus: 0.2, // 20% faster injury recovery

    // Discipline-specific bonuses
    disciplineModifiers: {
      'Cross Country': 0.05,
      Endurance: 0.06,
      Racing: 0.04,
    },
  },

  eagerLearner: {
    // Training effects
    trainingXpModifier: 0.25, // 25% more XP from training
    statGainChanceModifier: 0.1, // +10% chance for stat gains
    baseStatBoost: 1, // +1 to stat gains when they occur

    // Competition effects
    competitionScoreModifier: 0.02, // +2% to final score
    learningFromCompetition: 0.15, // 15% bonus learning from competitions

    // General effects
    motivationBonus: 0.2, // 20% higher motivation
    trainingConsistencyBonus: 0.15, // 15% more consistent training results

    description: 'Learns quickly and eagerly from all experiences',
  },

  peopleTrusting: {
    // Bonding effects
    bondingBonus: 0.3, // 30% faster bonding with humans
    handlerCompatibility: 0.25, // 25% better handler relationships
    groomingBondingBonus: 0.2, // 20% bonus from grooming

    // Training effects
    trainingCooperation: 0.2, // 20% more cooperative during training
    handlerTrustBonus: 0.15, // 15% bonus when working with trusted handlers

    // Competition effects
    competitionHandlerBonus: 0.1, // 10% bonus with familiar handlers

    // General effects
    socialComfort: true, // Comfortable in social situations

    description: 'Naturally trusting and cooperative with humans',
  },

  // ===== DISCIPLINE AFFINITY TRAITS (§F / 9o3n7.5) =====
  // The canonical disciplineAffinity<Discipline> entries for ALL 24 disciplines
  // are GENERATED below from statMap + DISCIPLINES and merged into this map
  // (see buildDisciplineAffinityEffects). Generating them keeps the per-
  // discipline stat emphasis in lockstep with the competition scorer's statMap
  // and guarantees every discipline the at-birth emitter can produce has a
  // matching effect (no jumping/show_jumping drift, no missing-effect gaps).

  // ===== NEGATIVE TRAITS =====

  fragile: {
    // Training effects
    trainingInjuryRisk: 0.3, // 30% higher injury risk from training
    trainingIntensityLimit: 0.2, // 20% lower max training intensity

    // Competition effects
    competitionScoreModifier: -0.035, // -3.5% to final score
    injuryRisk: 0.3, // 30% higher injury risk
    performanceInconsistency: 0.25, // 25% more inconsistent performance

    // Recovery effects
    injuryRecoveryPenalty: 0.3, // 30% slower injury recovery

    // Discipline-specific penalties
    disciplineModifiers: {
      'Cross Country': -0.08,
      'Show Jumping': -0.06,
      Racing: -0.05,
    },
  },

  // Owner ruling 2026-10-27 (q117; Equoria-2d55z): only roster traits keep an
  // entry. Effects keyed to traits no longer on the roster were removed, so a
  // stored off-roster name resolves to no effects, like any unknown trait.
  // New roster traits carry no effects until the owner rules them.

  // Owner ruling 2026-10-22 (Equoria-0d4wa): there is no burnout trait. A
  // stored "burnout" name now resolves to no effects, like any unknown trait.
};

/**
 * Build the canonical disciplineAffinity<Discipline> effect entries for ALL
 * canonical disciplines (§F / 9o3n7.5). Each affinity grants:
 *   - the +5 discipline-match bonus (applied by the scorer when the trait key
 *     matches the event's disciplineAffinityKey — not encoded here);
 *   - rich, magnitude-consistent effects: +15% discipline-training XP, +8%
 *     competition score, a +0.12 discipline-specific scoreModifier, a 20%
 *     in-discipline confidence bonus, and a baseStatBoost of +3 to the
 *     discipline's PRIMARY stat and +2 to its SECONDARY stat (drawn from the
 *     competition scorer's statMap so the emphasis matches how the discipline
 *     is actually scored). Magnitudes mirror the pre-§F racing/jumping/dressage
 *     affinities — no arbitrary new numbers.
 *
 * Generating these (rather than hand-writing 23 blocks) keeps the per-
 * discipline stat emphasis in lockstep with statMap and the affinity key in
 * lockstep with disciplineAffinityKey, eliminating drift.
 */
function buildDisciplineAffinityEffects() {
  const generated = {};
  for (const discipline of Object.values(DISCIPLINES)) {
    const key = disciplineAffinityKey(discipline);
    if (!key) {
      continue;
    }
    const stats = getStatsForDiscipline(discipline) || [];
    const [primary, secondary] = stats;
    const baseStatBoost = {};
    if (primary) {
      baseStatBoost[primary] = 3;
    }
    if (secondary) {
      baseStatBoost[secondary] = 2;
    }
    generated[key] = {
      trainingXpModifier: 0.15,
      disciplineTrainingBonus: 0.25,
      competitionScoreModifier: 0.08,
      disciplineConfidenceBonus: 0.2,
      baseStatBoost,
      disciplineModifiers: { [discipline]: 0.12 },
      description: `Natural affinity for ${discipline} inherited from lineage`,
    };
  }
  return generated;
}

// Merge the generated discipline-affinity entries into the trait effects map.
Object.assign(traitEffects, buildDisciplineAffinityEffects());

/**
 * Get trait effects for a specific trait
 * @param {string} traitName - Name of the trait
 * @returns {Object|null} Trait effects object or null if not found
 */
export function getTraitEffects(traitName) {
  if (!traitName || typeof traitName !== 'string') {
    logger.warn(`[traitEffects.getTraitEffects] Invalid trait name: ${traitName}`);
    return null;
  }

  // Normalize legacy snake-case keys to canonical camelCase so stored data and
  // older callers still resolve until the DB backfill runs (§C, 9o3n7.6).
  const canonical = normalizeTraitKey(traitName);
  const effects = traitEffects[canonical];
  if (!effects) {
    logger.warn(`[traitEffects.getTraitEffects] No effects defined for trait: ${traitName}`);
    return null;
  }

  return effects;
}

/**
 * Get all trait effects
 * @returns {Object} Complete trait effects mapping
 */
export function getAllTraitEffects() {
  return traitEffects;
}

/**
 * Check if a trait has a specific effect
 * @param {string} traitName - Name of the trait
 * @param {string} effectName - Name of the effect to check
 * @returns {boolean} Whether the trait has the specified effect
 */
export function hasTraitEffect(traitName, effectName) {
  const effects = getTraitEffects(traitName);
  return effects ? Object.prototype.hasOwnProperty.call(effects, effectName) : false;
}

/**
 * Get trait effects for multiple traits
 * @param {string[]} traitNames - Array of trait names
 * @returns {Object} Combined effects from all traits
 */
export function getCombinedTraitEffects(traitNames) {
  if (!Array.isArray(traitNames)) {
    logger.warn('[traitEffects.getCombinedTraitEffects] Invalid trait names array');
    return {};
  }

  const combinedEffects = {};

  traitNames.forEach(traitName => {
    const effects = getTraitEffects(traitName);
    if (effects) {
      // Merge effects, handling different types appropriately
      Object.keys(effects).forEach(effectKey => {
        if (!combinedEffects[effectKey]) {
          combinedEffects[effectKey] = effects[effectKey];
        } else {
          // Handle combining different effect types
          if (
            typeof effects[effectKey] === 'number' &&
            typeof combinedEffects[effectKey] === 'number'
          ) {
            // Add numeric modifiers
            combinedEffects[effectKey] += effects[effectKey];
          } else if (typeof effects[effectKey] === 'boolean') {
            // Boolean effects - true if any trait has it
            combinedEffects[effectKey] = combinedEffects[effectKey] || effects[effectKey];
          } else if (typeof effects[effectKey] === 'object' && effects[effectKey] !== null) {
            // Merge objects (like disciplineModifiers, baseStatBoost)
            if (
              typeof combinedEffects[effectKey] === 'object' &&
              combinedEffects[effectKey] !== null
            ) {
              // For numeric properties in objects, add them together
              const mergedObject = { ...combinedEffects[effectKey] };
              Object.keys(effects[effectKey]).forEach(subKey => {
                if (
                  typeof effects[effectKey][subKey] === 'number' &&
                  typeof mergedObject[subKey] === 'number'
                ) {
                  mergedObject[subKey] += effects[effectKey][subKey];
                } else {
                  mergedObject[subKey] = effects[effectKey][subKey];
                }
              });
              combinedEffects[effectKey] = mergedObject;
            } else {
              combinedEffects[effectKey] = { ...effects[effectKey] };
            }
          }
        }
      });
    }
  });

  return combinedEffects;
}

export default traitEffects;
