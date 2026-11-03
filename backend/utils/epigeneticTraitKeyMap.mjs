/**
 * Canonical discipline-affinity trait key (Equoria-9o3n7.6, §C/§F).
 *
 * Discipline-affinity keys derive deterministically from the canonical
 * DISCIPLINES roster, so the at-birth emitter, the competition-score map and
 * traitEffects all build them here and cannot drift.
 *
 * Every stored trait id is camelCase (migration
 * 20261029150000_trait_values_camelcase); the read-time normalizer for the old
 * snake_case ids was removed in camelCase phase 6 (Equoria-pjvp8.7).
 */

/**
 * Convert a discipline display name (e.g. "Show Jumping") to its canonical
 * `disciplineAffinity<PascalDiscipline>` trait key (e.g.
 * `disciplineAffinityShowJumping`).
 *
 * @param {string} discipline - canonical discipline display name from DISCIPLINES
 * @returns {string} canonical affinity trait key, or '' for invalid input
 */
export function disciplineAffinityKey(discipline) {
  if (!discipline || typeof discipline !== 'string') {
    return '';
  }
  const pascal = discipline
    .trim()
    .split(/\s+/)
    .map(word => (word.length === 0 ? '' : word.charAt(0).toUpperCase() + word.slice(1)))
    .join('');
  if (pascal.length === 0) {
    return '';
  }
  return `disciplineAffinity${pascal}`;
}

export default {
  disciplineAffinityKey,
};
