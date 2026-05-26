/**
 * Canonical epigenetic-trait key map + normalizer (Equoria-9o3n7.6, §C).
 *
 * THE source of truth for converting legacy snake_case (and a few mixed-case)
 * epigenetic-trait keys to the ONE canonical camelCase convention enforced
 * across TRAIT_DEFINITIONS, traitEffects, the competition-score affinity map,
 * every at-birth/discovery emitter, and traitCompetitionImpact.
 *
 * Two consumers:
 *   1. Read-tolerance: `normalizeTraitKey()` lets read paths tolerate legacy
 *      rows whose `epigeneticModifiers` arrays still carry snake_case keys
 *      until the forward-only DB backfill (see
 *      packages/database/scripts/backfillEpigeneticTraitCasing.mjs) runs.
 *   2. Backfill: the migration/script imports `LEGACY_TRAIT_KEY_MAP` +
 *      `normalizeTraitKey` so the DB rewrite and the runtime read use the
 *      EXACT same mapping (no drift between "what we store" and "what we
 *      tolerate").
 *
 * Discipline-affinity keys are handled by `disciplineAffinityKey()` rather
 * than an explicit per-discipline table, because they derive deterministically
 * from the canonical DISCIPLINES roster (see §F / 9o3n7.5).
 */

/**
 * Static legacy→canonical map for the fixed (non-affinity) trait vocabulary.
 * Every key here is a legacy spelling that may exist in stored data or old
 * code; every value is the canonical camelCase key.
 *
 * NOTE: the four §E-dropped names (weatherImmunity/nightVision/fireResistance/
 * waterPhobia and their snake forms) are intentionally NOT remapped — they are
 * removed from the game entirely (9o3n7 §E). A backfill encountering one leaves
 * it as-is (it has no effect either way); dropping stored ghosts is out of
 * scope for the casing migration and tracked separately if ever needed.
 */
export const LEGACY_TRAIT_KEY_MAP = Object.freeze({
  trainability_boost: 'trainabilityBoost',
  eager_learner: 'eagerLearner',
  low_immunity: 'lowImmunity',
  legendary_bloodline: 'legendaryBloodline',
  specialized_lineage: 'specializedLineage',
  legacy_talent: 'legacyTalent',
});

/**
 * Convert a discipline display name (e.g. "Show Jumping") to its canonical
 * `disciplineAffinity<PascalDiscipline>` trait key (e.g.
 * `disciplineAffinityShowJumping`). This is the ONE canonical derivation; the
 * at-birth emitter, the competition-score map, and traitEffects all use it so
 * they cannot drift (resolves the historic jumping/show_jumping silent-miss).
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

/**
 * Legacy snake-case affinity prefix → used by normalizeTraitKey to convert a
 * stored `discipline_affinity_show_jumping` into `disciplineAffinityShowJumping`.
 */
const LEGACY_AFFINITY_PREFIX = 'discipline_affinity_';

/**
 * Normalize ANY trait key to canonical camelCase. Idempotent: a key already in
 * canonical form is returned unchanged.
 *
 * Handles:
 *   - the fixed legacy map (LEGACY_TRAIT_KEY_MAP)
 *   - legacy snake-case discipline-affinity keys
 *     (discipline_affinity_show_jumping → disciplineAffinityShowJumping)
 *   - everything else passes through untouched (already-canonical keys, and
 *     the §E-dropped ghosts which are deliberately not remapped)
 *
 * @param {string} key - a trait key from stored data or code
 * @returns {string} canonical camelCase key (or the input verbatim if non-string)
 */
export function normalizeTraitKey(key) {
  if (typeof key !== 'string' || key.length === 0) {
    return key;
  }
  if (Object.prototype.hasOwnProperty.call(LEGACY_TRAIT_KEY_MAP, key)) {
    return LEGACY_TRAIT_KEY_MAP[key];
  }
  if (key.startsWith(LEGACY_AFFINITY_PREFIX)) {
    // discipline_affinity_show_jumping → "Show Jumping"-style words → PascalCase
    const tail = key.slice(LEGACY_AFFINITY_PREFIX.length); // "show_jumping"
    const pascal = tail
      .split('_')
      .map(word => (word.length === 0 ? '' : word.charAt(0).toUpperCase() + word.slice(1)))
      .join('');
    return pascal.length === 0 ? key : `disciplineAffinity${pascal}`;
  }
  return key;
}

/**
 * Normalize an `epigeneticModifiers` shape ({positive,negative,hidden}) in
 * place-safe fashion (returns a NEW object; does not mutate the input).
 * Non-array fields default to []. Used by both the backfill script and any
 * read path that wants a fully-canonical view of stored modifiers.
 *
 * @param {object} modifiers - { positive?, negative?, hidden? }
 * @returns {{positive:string[], negative:string[], hidden:string[]}}
 */
export function normalizeEpigeneticModifiers(modifiers) {
  const src =
    modifiers && typeof modifiers === 'object' && !Array.isArray(modifiers) ? modifiers : {};
  const norm = arr => (Array.isArray(arr) ? arr : []).map(normalizeTraitKey);
  return {
    positive: norm(src.positive),
    negative: norm(src.negative),
    hidden: norm(src.hidden),
  };
}

export default {
  LEGACY_TRAIT_KEY_MAP,
  disciplineAffinityKey,
  normalizeTraitKey,
  normalizeEpigeneticModifiers,
};
