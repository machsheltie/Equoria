/**
 * Trait Discovery — discovery conditions and progress (read side)
 *
 * Read-only helpers behind GET /traits/discovery-status: which discovery
 * conditions a horse currently meets. Nothing here writes a horse's traits.
 * The /trait-discovery routes that read getDiscoveryProgress were removed under
 * Equoria-a7f1p (owner ruling 2026-10-27: traits reveal only through the
 * grooming-day ladder), and getDiscoveryProgress itself, left without a caller,
 * was deleted under Equoria-tpofm.
 *
 * Equoria-0w96q: revealTraits / batchRevealTraits (with selectTraitsToReveal,
 * updateHorseTraits and getDiscoveryReason) were deleted. They read
 * epigeneticModifiers, moved names out of `hidden` in memory and wrote the
 * whole object back outside a transaction, and had no production caller once
 * the player discovery routes went (Equoria-gu8jk; owner ruling 2026-10-20:
 * players never reveal traits). Their only importer, the never-mounted
 * traitDiscoveryMiddleware, was deleted with them. Hidden traits stay inert
 * until revealed (owner ruling 2026-10-19); a future reveal path belongs on
 * modules/traits/services/epigeneticModifiersWrites.mjs.
 *
 * Equoria-ecp0i: the ENRICHMENT_DISCOVERIES table (six player-run enrichment
 * activity names nothing produces since Equoria-fr2kg) and
 * checkEnrichmentDiscoveries were removed (owner ruling 2026-10-16, fr2kg
 * F14). Groom-driven trait discovery is unaffected.
 */

import logger from './logger.mjs';

/**
 * Discovery conditions that trigger trait revelation
 */
const DISCOVERY_CONDITIONS = {
  // Bonding-based discoveries
  HIGH_BOND: {
    name: 'High Bond',
    condition: horse => (horse.bondScore || 0) >= 80,
    description: 'Strong bond formed',
    priority: 'high',
    category: 'bonding',
    revealableTraits: ['loyal', 'trusting', 'calm'],
  },

  EXCELLENT_BOND: {
    name: 'Excellent Bond',
    condition: horse => (horse.bondScore || 0) >= 95,
    description: 'Exceptional bond achieved',
    priority: 'legendary',
    category: 'bonding',
    revealableTraits: ['devoted', 'empathetic', 'intuitive'],
  },

  // Combined conditions
  PERFECT_CARE: {
    name: 'Perfect Care',
    condition: horse => horse.bondScore >= 80,
    description: 'Perfect care conditions achieved',
    priority: 'legendary',
    category: 'milestones',
    revealableTraits: ['exceptional', 'thriving', 'balanced'],
  },

  // Equoria-kqdde: MATURE_BOND (age 3+ with bond 70) and CONSISTENT_TRAINING
  // (five trainings in a week, i.e. an adult) were removed. Traits change only
  // in a foal's first 21 days (owner rulings 2026-10-27, q115); there is no
  // adult discovery.
};

/**
 * Check which discovery conditions are currently met
 * @param {Object} horse - Horse data
 * @returns {Array} Array of met conditions
 */
async function checkDiscoveryConditions(horse) {
  const metConditions = [];

  for (const [conditionName, condition] of Object.entries(DISCOVERY_CONDITIONS)) {
    try {
      let isMet = false;

      if (condition.async) {
        isMet = await condition.condition(horse);
      } else {
        isMet = condition.condition(horse);
      }

      if (isMet) {
        metConditions.push({
          name: conditionName,
          description: condition.description,
          priority: condition.priority,
          category: condition.category,
          type: 'condition',
        });
      }
    } catch (error) {
      logger.warn(
        `[traitDiscovery.checkDiscoveryConditions] Error checking condition ${conditionName}: ${error.message}`,
      );
    }
  }

  return metConditions;
}

export { DISCOVERY_CONDITIONS, checkDiscoveryConditions };
