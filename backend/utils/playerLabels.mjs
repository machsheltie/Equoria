/**
 * Authored words for stored values that reach a player (Equoria-bdpvw).
 *
 * Owner ruling 2026-10-23: players never see a raw code name (daily_evaluation,
 * trustBuilding); a code hands out hints about the game's internals. Payloads a
 * player can read in the network tab carry these words, not the stored values.
 */

/** Where a trait came to light, in the game's voice. One map for the domain. */
const TRAIT_SOURCE_LABELS = Object.freeze({
  groom: 'Groom Care',
  milestone: 'Milestone',
  environmental: 'Surroundings',
  genetic: 'Bloodline',
  epigenetic: 'Care',
  daily_evaluation: 'Daily Care',
  enrichment: 'Enrichment',
});

/** Where a trait came to light, as words. An unknown source reads as "Care". */
export function traitSourceLabel(sourceType) {
  if (typeof sourceType !== 'string') {
    return 'Care';
  }
  return Object.hasOwn(TRAIT_SOURCE_LABELS, sourceType) ? TRAIT_SOURCE_LABELS[sourceType] : 'Care';
}

/**
 * A stored name (snake_case or camelCase) as title-cased words, for a name the
 * game has no hand-written label for (a trait, a groom task).
 */
export function labelWords(code) {
  if (typeof code !== 'string' || code.trim() === '') {
    return 'Unknown';
  }
  return code
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
