/**
 * Epigenetic trait definitions and lookups. The live at-birth roll is
 * utils/applyEpigeneticTraitsAtBirth.mjs; the orphaned calculateEpigeneticTraits
 * model that this file used to carry (it had no caller outside its tests) was
 * removed with the owner ruling of 2026-10-26, Equoria-b76x0.
 */

/**
 * THE trait roster (owner ruling 2026-10-27, q117; Equoria-2d55z). It replaces
 * the 2026-10-19 roster. Only these twenty traits exist: generation at birth
 * and inheritance use nothing else, and a stored name off this list has no
 * effect.
 *
 * "Do not add what each actually does yet. We will address that later." So a
 * trait new to this roster has no type, rarity or description here. The five
 * that were already defined (resilient, confident, eagerLearner, fragile,
 * fearful) keep the type, rarity and description they had, which the at-birth
 * inheritance odds read; the owner has been asked to rule rarity and
 * positive/negative for all twenty. The reveal engine reads its own rulings
 * from modules/traits/config/traitRevealSettings.mjs, never these.
 *
 * `label` is the authored name players see; the key is the stored id.
 * `rarity` is for the game and admin tooling only: players never see it
 * (owner ruling 2026-10-27, q112), so player routes use playerTraitDefinition.
 */
const rosterTrait = (label, known = {}) =>
  Object.freeze({
    label,
    type: known.type ?? null,
    rarity: known.rarity ?? null,
    conflicts: Object.freeze(known.conflicts ?? []),
    description: known.description ?? null,
    category: 'epigenetic',
  });

const TRAIT_DEFINITIONS = Object.freeze({
  brave: rosterTrait('Brave'),
  confident: rosterTrait('Confident', {
    type: 'positive',
    rarity: 'common',
    conflicts: ['fearful'],
    description: 'This horse is brave in new situations.',
  }),
  outgoing: rosterTrait('Outgoing'),
  affectionate: rosterTrait('Affectionate'),
  resilient: rosterTrait('Resilient', {
    type: 'positive',
    rarity: 'common',
    conflicts: ['fragile'],
    description: 'Takes challenges in stride.',
  }),
  fearful: rosterTrait('Fearful', {
    type: 'negative',
    rarity: 'common',
    conflicts: ['confident'],
    description: 'Hesitation or spook-prone behavior under pressure.',
  }),
  insecure: rosterTrait('Insecure'),
  aloof: rosterTrait('Aloof'),
  fragile: rosterTrait('Fragile', {
    type: 'negative',
    rarity: 'common',
    conflicts: ['resilient'],
    description: 'More susceptible to injury.',
  }),
  skittish: rosterTrait('Skittish'),
  eagerLearner: rosterTrait('Eager Learner', {
    type: 'positive',
    rarity: 'common',
    description: 'Shows enthusiasm for learning new skills and training.',
  }),
  peopleTrusting: rosterTrait('People Trusting'),
  adaptable: rosterTrait('Adaptable'),
  heart: rosterTrait('Heart'),
  focused: rosterTrait('Focused'),
  excitable: rosterTrait('Excitable'),
  curious: rosterTrait('Curious'),
  playful: rosterTrait('Playful'),
  biddable: rosterTrait('Biddable'),
  competitive: rosterTrait('Competitive'),
});

/** The twenty stored trait ids, in the owner's order. */
export const traitRosterIds = Object.freeze(Object.keys(TRAIT_DEFINITIONS));

/**
 * True when `trait` is on the roster.
 * @param {unknown} trait
 * @returns {boolean}
 */
export function isRosterTrait(trait) {
  return (
    typeof trait === 'string' && Object.prototype.hasOwnProperty.call(TRAIT_DEFINITIONS, trait)
  );
}

/**
 * A trait definition as a player may see it: the authored label, type,
 * description and category. Never the rarity (q112). Null off the roster.
 * @param {string} trait
 * @returns {{label:string, type:string|null, description:string|null, category:string, conflicts:string[]}|null}
 */
export function playerTraitDefinition(trait) {
  if (!isRosterTrait(trait)) {
    return null;
  }
  const { label, type, description, category, conflicts } = TRAIT_DEFINITIONS[trait];
  return { label, type, description, category, conflicts: [...conflicts] };
}

/**
 * Determines if traits conflict with each other
 * @param {string} trait1 - First trait
 * @param {string} trait2 - Second trait
 * @returns {boolean} True if traits conflict
 */
function traitsConflict(trait1, trait2) {
  const def1 = getTraitDefinition(trait1);
  const def2 = getTraitDefinition(trait2);

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
  return isRosterTrait(trait) ? TRAIT_DEFINITIONS[trait] : null;
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
  const definition = getTraitDefinition(trait);
  if (!definition) {
    return null;
  }

  return {
    name: trait,
    label: definition.label,
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
