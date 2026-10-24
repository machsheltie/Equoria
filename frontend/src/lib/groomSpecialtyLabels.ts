/**
 * Groom specialty labels, in the game's voice (Equoria-m9lz1 fix round 1).
 *
 * WHY A LABEL MAP AND NOT AN EXTENSION OF `formatSpecialty`
 *   Three reasons, in order of weight:
 *
 *   1. No transform can produce the right words. The requirement is the game
 *      speaking, not mechanical case conversion: `foal_care` de-snake-cased is
 *      "foal care", which is *correct* but flat. "raising foals" is what a
 *      horsewoman would say, and no amount of regex gets there from the enum.
 *      A label map is the only shape that can hold authored prose.
 *
 *   2. There is no "one shared helper" to extend. `formatSpecialty` exists
 *      TWICE — `components/MyGroomsDashboard.tsx:66` and
 *      `components/AssignGroomModal.tsx:193` — as two separate local copies,
 *      both camelCase-only (`replace(/([A-Z])/g, ' $1')`), so neither touches
 *      `foal_care` at all. Extending "the" helper would mean picking one of two
 *      and leaving the other wrong.
 *
 *   3. One spelling per specialty. Until the camelCase conversion (owner
 *      ruling 2026-10-21, Equoria-pjvp8 phase 3e) `grooms.speciality` held both
 *      `foal_care` and `foalCare` depending on which path created the row; the
 *      data migration 20261022190000_groom_speciality_camelcase unified them,
 *      so the map keeps only the camelCase keys.
 *
 * COVERAGE
 *   Every value in `backend/constants/schema.mjs` `GROOM_SPECIALTIES`
 *   (`foalCare`, `general`, `training`, `medical`), plus two legacy strings that
 *   appear only in older test fixtures (`generalGrooming`,
 *   `specializedDisciplines`) so they cannot surface raw either.
 *
 * SCOPE NOTE
 *   The two legacy `formatSpecialty` copies are deliberately NOT switched over
 *   here. They render a card badge ("Foal Care" as a title-cased chip), a
 *   different register from a sentence, and
 *   `components/__tests__/GroomHiringInterface.story-7-1.test.tsx:444` asserts
 *   that exact chip text. Rewording a badge a player already sees is a copy
 *   change that belongs to whoever owns that surface, not to this fix. This
 *   module is the intended single source when that unification happens.
 */

/**
 * Authored, sentence-ready labels. Lowercase on purpose: every current consumer
 * drops these into running prose ("a long career in raising foals"), so casing
 * belongs to the sentence, not the label.
 *
 * Keys are only the values that actually occur; an invented `labelShaped` key is
 * dead weight that reads as coverage without being any.
 */
const GROOM_SPECIALTY_LABELS: Readonly<Record<string, string>> = Object.freeze({
  // GROOM_SPECIALTIES.FOAL_CARE.
  foalCare: 'raising foals',
  // GROOM_SPECIALTIES.GENERAL.
  general: 'everyday care',
  // GROOM_SPECIALTIES.TRAINING and .MEDICAL.
  training: 'training support',
  medical: 'medical care',
  // Legacy strings that appear in older test fixtures, mapped so they cannot
  // surface raw.
  generalGrooming: 'grooming',
  specializedDisciplines: 'specialist disciplines',
});

/**
 * Last-resort formatter for a specialty this module has not been taught yet: it
 * must never hand a player a raw database enum. Splits snake_case AND camelCase
 * — the failure that produced this module was `foal_care` reaching a sentence
 * verbatim, and the existing camelCase-only helpers would not have caught it.
 */
function humanizeUnknownSpecialty(raw: string): string {
  return raw
    .replace(/_+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();
}

/**
 * A groom's specialty as a phrase fit to drop into a sentence.
 *
 * @param specialty the raw `Groom.speciality` value, in either spelling
 * @param fallback what to say when the value is missing or empty — the caller
 *   owns this because the right words depend on the sentence
 * @returns an authored label, a humanized form of an unrecognized value, or the
 *   caller's fallback
 */
export function groomSpecialtyLabel(
  specialty: string | null | undefined,
  fallback = 'looking after horses'
): string {
  if (typeof specialty !== 'string' || specialty.trim() === '') {
    return fallback;
  }
  const key = specialty.trim();
  return GROOM_SPECIALTY_LABELS[key] ?? humanizeUnknownSpecialty(key);
}

/** Exported for the test that proves every backend specialty value is covered. */
export const KNOWN_GROOM_SPECIALTY_LABELS = GROOM_SPECIALTY_LABELS;

/**
 * Title-cased specialty for a card chip (Equoria-bdpvw): the same stored values
 * as the sentence phrases above, in the register a badge uses. An unknown value
 * reads as a generic authored phrase, never the stored value.
 */
const GROOM_SPECIALTY_TITLES: Readonly<Record<string, string>> = Object.freeze({
  foalCare: 'Foal Care',
  general: 'Everyday Care',
  training: 'Training Support',
  medical: 'Medical Care',
  generalGrooming: 'Grooming',
  specializedDisciplines: 'Specialist Disciplines',
});

export function groomSpecialtyTitle(specialty: string | null | undefined): string {
  if (typeof specialty !== 'string') return 'Everyday Care';
  return GROOM_SPECIALTY_TITLES[specialty.trim()] ?? 'Everyday Care';
}

/** Exported for the test that proves every backend specialty value is covered. */
export const KNOWN_GROOM_SPECIALTY_TITLES = GROOM_SPECIALTY_TITLES;
