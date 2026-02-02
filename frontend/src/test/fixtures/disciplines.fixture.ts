/**
 * Disciplines Test Fixture
 *
 * Complete list of 23 horse training disciplines from Equoria Training System.
 * Used for testing competition filters and discipline-related functionality.
 *
 * Source: Epic 4 Training System
 * Usage: Competition filtering, eligibility checks, training selection
 */

export const DISCIPLINES = [
  // Jumping Disciplines (5)
  'Show Jumping',
  'Cross-Country',
  'Hunter',
  'Eventing',
  'Puissance',

  // Flat Racing Disciplines (3)
  'Flat Racing',
  'Steeplechase',
  'Harness Racing',

  // Dressage Disciplines (2)
  'Dressage',
  'Freestyle Dressage',

  // Western Disciplines (4)
  'Western Pleasure',
  'Reining',
  'Cutting',
  'Barrel Racing',

  // Endurance & Trail (2)
  'Endurance',
  'Trail',

  // Specialized Disciplines (4)
  'Vaulting',
  'Polo',
  'Mounted Games',
  'Driving',

  // Combined Disciplines (3)
  'Combined Driving',
  'Working Equitation',
  'Tent Pegging',
] as const;

export type Discipline = (typeof DISCIPLINES)[number];

/**
 * Discipline categories for optional grouping
 * Can be used to organize disciplines in select dropdowns
 */
export const DISCIPLINE_CATEGORIES = {
  JUMPING: ['Show Jumping', 'Cross-Country', 'Hunter', 'Eventing', 'Puissance'],
  RACING: ['Flat Racing', 'Steeplechase', 'Harness Racing'],
  DRESSAGE: ['Dressage', 'Freestyle Dressage'],
  WESTERN: ['Western Pleasure', 'Reining', 'Cutting', 'Barrel Racing'],
  ENDURANCE: ['Endurance', 'Trail'],
  SPECIALIZED: ['Vaulting', 'Polo', 'Mounted Games', 'Driving'],
  COMBINED: ['Combined Driving', 'Working Equitation', 'Tent Pegging'],
} as const;

/**
 * Validate if a string is a valid discipline
 */
export function isValidDiscipline(value: string): value is Discipline {
  return DISCIPLINES.includes(value as Discipline);
}

/**
 * Get category for a discipline
 */
export function getDisciplineCategory(discipline: Discipline): string {
  for (const [category, disciplines] of Object.entries(DISCIPLINE_CATEGORIES)) {
    if (disciplines.includes(discipline as never)) {
      return category;
    }
  }
  return 'UNKNOWN';
}

/**
 * Total count verification (for testing)
 */
export const DISCIPLINES_COUNT = 23;

// Verify fixture integrity
if (DISCIPLINES.length !== DISCIPLINES_COUNT) {
  throw new Error(
    `Disciplines fixture integrity error: Expected ${DISCIPLINES_COUNT} disciplines, got ${DISCIPLINES.length}`
  );
}
