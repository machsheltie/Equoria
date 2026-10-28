/**
 * Staff star levels for riders, trainers and grooms (Equoria-nawn5).
 *
 * Owner ruling 2026-10-28: all three use the same five levels with stars —
 * Rookie (1 star), Novice (2), Intermediate (3), Advanced (4), Expert (5). The
 * game stores a camelCase word (`starLevel`); players only ever see the authored
 * label and the stars (owner ruling 2026-10-23: never a stored code name). The
 * price that goes with each level is set by the server and arrives on the staff
 * row or offer; this file carries no prices.
 */

export const staffLevelOrder = ['rookie', 'novice', 'intermediate', 'advanced', 'expert'] as const;

export type StaffLevel = (typeof staffLevelOrder)[number];

const staffLevelTable: Readonly<Record<StaffLevel, { label: string; stars: number }>> =
  Object.freeze({
    rookie: { label: 'Rookie', stars: 1 },
    novice: { label: 'Novice', stars: 2 },
    intermediate: { label: 'Intermediate', stars: 3 },
    advanced: { label: 'Advanced', stars: 4 },
    expert: { label: 'Expert', stars: 5 },
  });

export function isStaffLevel(value: unknown): value is StaffLevel {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(staffLevelTable, value);
}

/** The level's authored label; an unknown value reads "Unrated", never the stored word. */
export function staffLevelLabel(level: string | null | undefined): string {
  return isStaffLevel(level) ? staffLevelTable[level].label : 'Unrated';
}

/** 1-5 stars; 0 for an unknown value. */
export function staffLevelStars(level: string | null | undefined): number {
  return isStaffLevel(level) ? staffLevelTable[level].stars : 0;
}

/**
 * The level as plain words, e.g. "Advanced, 4 stars", for places that can only
 * hold text (a select option, an accessible name).
 */
export function staffLevelPhrase(level: string | null | undefined): string {
  const stars = staffLevelStars(level);
  if (stars === 0) return staffLevelLabel(level);
  return `${staffLevelLabel(level)}, ${stars} ${stars === 1 ? 'star' : 'stars'}`;
}
