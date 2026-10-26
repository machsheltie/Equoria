/**
 * Epigenetic trait definitions and lookups. The live at-birth roll is
 * utils/applyEpigeneticTraitsAtBirth.mjs; the orphaned calculateEpigeneticTraits
 * model that this file used to carry (it had no caller outside its tests) was
 * removed with the owner ruling of 2026-10-26, Equoria-b76x0.
 */

// Trait definitions and their properties
const TRAIT_DEFINITIONS = {
  // Positive traits - Common
  resilient: {
    type: 'positive',
    rarity: 'common',
    conflicts: ['fragile', 'easilyOverwhelmed'],
    description: 'Takes challenges in stride.',
    category: 'epigenetic',
  },
  bold: {
    type: 'positive',
    rarity: 'common',
    conflicts: ['nervous', 'fearful'],
    description: 'Shows courage in challenging situations.',
    category: 'epigenetic',
  },
  intelligent: {
    type: 'positive',
    rarity: 'common',
    conflicts: ['lazy'],
    description: 'Learns faster and retains training better.',
    category: 'epigenetic',
  },
  athletic: {
    type: 'positive',
    rarity: 'common',
    conflicts: ['fragile', 'lazy'],
    description: 'Enhanced physical performance and stamina.',
    category: 'epigenetic',
  },
  calm: {
    type: 'positive',
    rarity: 'common',
    conflicts: ['nervous', 'aggressive', 'easilyOverwhelmed'],
    description: 'Maintains composure under pressure.',
    category: 'epigenetic',
  },

  // Positive traits - Epigenetic (from foal development)
  confident: {
    type: 'positive',
    rarity: 'common',
    conflicts: ['nervous', 'fearful'],
    description: 'This horse is brave in new situations.',
    category: 'epigenetic',
  },
  bonded: {
    type: 'positive',
    rarity: 'common',
    conflicts: ['aggressive', 'antisocial'],
    description: 'Forms deeper trust with specific handlers.',
    category: 'bond',
  },

  // Positive traits - Situational (from specific training)
  presentationBoosted: {
    type: 'positive',
    rarity: 'common',
    conflicts: [],
    description: 'Scores higher in appearance-based events.',
    category: 'situational',
  },
  showCalm: {
    type: 'positive',
    rarity: 'common',
    conflicts: ['nervous'],
    description: 'Remains composed during competitions and shows.',
    category: 'situational',
  },
  crowdReady: {
    type: 'positive',
    rarity: 'common',
    conflicts: ['nervous'],
    description: 'Comfortable performing in front of large audiences.',
    category: 'situational',
  },

  // Positive traits - Rare
  trainabilityBoost: {
    type: 'positive',
    rarity: 'rare',
    conflicts: ['stubborn'],
    description: 'Exceptional learning ability and training response.',
    category: 'epigenetic',
  },
  eagerLearner: {
    type: 'positive',
    rarity: 'common',
    conflicts: ['lazy', 'stubborn'],
    description: 'Shows enthusiasm for learning new skills and training.',
    category: 'epigenetic',
  },
  social: {
    type: 'positive',
    rarity: 'common',
    conflicts: ['antisocial', 'aggressive'],
    description: 'Enjoys interaction with other horses and humans.',
    category: 'epigenetic',
  },

  // Negative traits
  nervous: {
    type: 'negative',
    rarity: 'common',
    conflicts: ['bold', 'calm', 'confident', 'showCalm', 'crowdReady'],
    description: 'Easily startled by new situations.',
    category: 'epigenetic',
  },
  stubborn: {
    type: 'negative',
    rarity: 'common',
    conflicts: ['trainabilityBoost', 'eagerLearner'],
    description: 'Resistant to training and new commands.',
    category: 'epigenetic',
  },
  fragile: {
    type: 'negative',
    rarity: 'common',
    conflicts: ['resilient', 'athletic'],
    description: 'More susceptible to injury.',
    category: 'epigenetic',
  },
  aggressive: {
    type: 'negative',
    rarity: 'common',
    conflicts: ['calm', 'bonded', 'social'],
    description: 'Difficult to handle and may show hostility.',
    category: 'epigenetic',
  },
  lazy: {
    type: 'negative',
    rarity: 'common',
    conflicts: ['intelligent', 'athletic', 'eagerLearner'],
    description: 'Low motivation and energy for training.',
    category: 'epigenetic',
  },
  antisocial: {
    type: 'negative',
    rarity: 'common',
    conflicts: ['social', 'bonded'],
    description: 'Prefers isolation and avoids interaction with others.',
    category: 'epigenetic',
  },
  fearful: {
    type: 'negative',
    rarity: 'common',
    conflicts: ['confident', 'bold'],
    description: 'Hesitation or spook-prone behavior under pressure.',
    category: 'epigenetic',
  },
  easilyOverwhelmed: {
    type: 'negative',
    rarity: 'common',
    conflicts: ['resilient', 'calm'],
    description: 'Slower recovery from mistakes or chaotic settings.',
    category: 'epigenetic',
  },

  // Rare traits (usually hidden)
  legendaryBloodline: {
    type: 'positive',
    rarity: 'legendary',
    conflicts: [],
    description: 'Exceptional heritage with legendary performance potential.',
    category: 'epigenetic',
  },
  // Equoria-9o3n7.5 §E / Equoria-3hl8c: weatherImmunity removed — it does NOT
  // exist in the game (user decision 2026-05-26). nightVision/fireResistance/
  // waterPhobia were never defined here. The only surviving rare trait is
  // legendaryBloodline (above).
};

/**
 * Determines if traits conflict with each other
 * @param {string} trait1 - First trait
 * @param {string} trait2 - Second trait
 * @returns {boolean} True if traits conflict
 */
function traitsConflict(trait1, trait2) {
  const def1 = TRAIT_DEFINITIONS[trait1];
  const def2 = TRAIT_DEFINITIONS[trait2];

  if (!def1 || !def2) {
    return false;
  }

  return def1.conflicts.includes(trait2) || def2.conflicts.includes(trait1);
}

/**
 * Get trait definition for a specific trait
 * @param {string} trait - Trait name
 * @returns {Object|null} Trait definition or null if not found
 */
export function getTraitDefinition(trait) {
  return TRAIT_DEFINITIONS[trait] || null;
}

/**
 * Get all available traits by type
 * @param {string} type - 'positive', 'negative', or 'all'
 * @returns {string[]} Array of trait names
 */
export function getTraitsByType(type = 'all') {
  const traits = Object.keys(TRAIT_DEFINITIONS);

  if (type === 'all') {
    return traits;
  }

  return traits.filter(trait => TRAIT_DEFINITIONS[trait].type === type);
}

/**
 * Get all available traits by category
 * @param {string} category - 'epigenetic', 'bond', 'situational', or 'all'
 * @returns {string[]} Array of trait names
 */
export function getTraitsByCategory(category = 'all') {
  const traits = Object.keys(TRAIT_DEFINITIONS);

  if (category === 'all') {
    return traits;
  }

  return traits.filter(trait => TRAIT_DEFINITIONS[trait].category === category);
}

/**
 * Get trait metadata including description and category
 * @param {string} trait - Trait name
 * @returns {Object|null} Trait metadata or null if not found
 */
export function getTraitMetadata(trait) {
  const definition = TRAIT_DEFINITIONS[trait];
  if (!definition) {
    return null;
  }

  return {
    name: trait,
    type: definition.type,
    category: definition.category,
    description: definition.description,
    rarity: definition.rarity,
    conflicts: [...definition.conflicts],
  };
}

/**
 * Check if two traits conflict with each other
 * @param {string} trait1 - First trait
 * @param {string} trait2 - Second trait
 * @returns {boolean} True if traits conflict
 */
export function checkTraitConflict(trait1, trait2) {
  return traitsConflict(trait1, trait2);
}
