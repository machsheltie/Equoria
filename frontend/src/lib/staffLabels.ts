/**
 * Authored labels for the words a groom, rider or trainer carries (Equoria-bdpvw).
 *
 * Owner ruling 2026-10-23: players never see a stored code name. Every stored
 * word is shown through a label in the game's voice, title-cased, and a value
 * the map has not been taught reads as a generic authored phrase, never the
 * stored value.
 *
 * One map per domain. Skill levels and personalities are shared by all three
 * kinds of staff (the sets differ per kind, so one map holds the union). The
 * groom specialty chip title lives here too; the sentence-register phrase for a
 * specialty stays in groomSpecialtyLabels.ts.
 */

const skillLevelLabels: Readonly<Record<string, string>> = Object.freeze({
  // Groom: novice, intermediate, expert, master.
  novice: 'Novice',
  intermediate: 'Intermediate',
  expert: 'Expert',
  master: 'Master',
  // Trainer: novice, developing, expert. (Riders have no skill word: owner ruling
  // 2026-10-29, q282, the star level is a rider's only level.)
  developing: 'Developing',
});

const personalityLabels: Readonly<Record<string, string>> = Object.freeze({
  // Groom.
  gentle: 'Gentle',
  energetic: 'Energetic',
  patient: 'Patient',
  strict: 'Strict',
  confident: 'Confident',
  calm: 'Calm',
  // Rider.
  daring: 'Daring',
  methodical: 'Methodical',
  intuitive: 'Intuitive',
  competitive: 'Competitive',
  // Trainer (patient, competitive and technical are shared words).
  focused: 'Focused',
  encouraging: 'Encouraging',
  technical: 'Technical',
});

function lookup(
  map: Readonly<Record<string, string>>,
  value: string | null | undefined,
  fallback: string
): string {
  if (typeof value !== 'string') return fallback;
  return map[value.trim()] ?? fallback;
}

/** A staff member's skill level as a title-cased word. */
export function skillLevelLabel(skillLevel: string | null | undefined): string {
  return lookup(skillLevelLabels, skillLevel, 'Unrated');
}

/** A staff member's personality as a title-cased word. */
export function personalityLabel(personality: string | null | undefined): string {
  return lookup(personalityLabels, personality, 'Hard to Read');
}

/** Exported so the test can prove every stored staff value is covered. */
export const knownSkillLevelLabels = skillLevelLabels;
export const knownPersonalityLabels = personalityLabels;

/**
 * A groom's specialty as a title-cased chip. An unknown value reads as a generic
 * authored phrase, never the stored value.
 */
const groomSpecialtyTitles: Readonly<Record<string, string>> = Object.freeze({
  foalCare: 'Foal Care',
  general: 'Everyday Care',
  training: 'Training Support',
  medical: 'Medical Care',
  // Legacy strings that appear only in older fixtures.
  generalGrooming: 'Grooming',
  specializedDisciplines: 'Specialist Disciplines',
});

export function groomSpecialtyTitle(specialty: string | null | undefined): string {
  return lookup(groomSpecialtyTitles, specialty, 'Everyday Care');
}

export const knownGroomSpecialtyTitles = groomSpecialtyTitles;
