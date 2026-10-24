/**
 * Authored labels for the words a groom, rider or trainer carries (Equoria-bdpvw).
 *
 * Owner ruling 2026-10-23: players never see a stored code name. Every stored
 * word is shown through a label in the game's voice, title-cased, and a value
 * the map has not been taught reads as a generic authored phrase, never the
 * stored value.
 *
 * One map per domain. Skill levels and personalities are shared by all three
 * kinds of staff (the sets differ per kind, so one map holds the union); the
 * groom specialty has its own map in groomSpecialtyLabels.ts.
 */

const SKILL_LEVEL_LABELS: Readonly<Record<string, string>> = Object.freeze({
  // Groom: novice, intermediate, expert, master.
  novice: 'Novice',
  intermediate: 'Intermediate',
  expert: 'Expert',
  master: 'Master',
  // Rider: rookie, developing, experienced. Trainer: novice, developing, expert.
  rookie: 'Rookie',
  developing: 'Developing',
  experienced: 'Experienced',
});

const PERSONALITY_LABELS: Readonly<Record<string, string>> = Object.freeze({
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
  return lookup(SKILL_LEVEL_LABELS, skillLevel, 'Unrated');
}

/** A staff member's personality as a title-cased word. */
export function personalityLabel(personality: string | null | undefined): string {
  return lookup(PERSONALITY_LABELS, personality, 'Hard to Read');
}

/** Exported so the test can prove every stored staff value is covered. */
export const KNOWN_SKILL_LEVEL_LABELS = SKILL_LEVEL_LABELS;
export const KNOWN_PERSONALITY_LABELS = PERSONALITY_LABELS;
