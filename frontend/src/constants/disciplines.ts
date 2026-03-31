/**
 * Shared discipline constants — mirrors backend/constants/schema.mjs DISCIPLINES
 *
 * Single source of truth for all 23 competition disciplines used in the game.
 * Import from here anywhere the discipline list is needed (filters, dropdowns,
 * training selectors, etc.) so that additions only require one change.
 */

export const DISCIPLINE_VALUES = [
  'Racing',
  'Show Jumping',
  'Dressage',
  'Cross Country',
  'Western Pleasure',
  'Reining',
  'Cutting',
  'Barrel Racing',
  'Roping',
  'Team Penning',
  'Rodeo',
  'Hunter',
  'Saddleseat',
  'Endurance',
  'Eventing',
  'Vaulting',
  'Polo',
  'Combined Driving',
  'Fine Harness',
  'Gaited',
  'Gymkhana',
  'Steeplechase',
  'Harness Racing',
] as const;

export type Discipline = (typeof DISCIPLINE_VALUES)[number];
