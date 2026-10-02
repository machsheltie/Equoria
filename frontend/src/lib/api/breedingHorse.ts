/**
 * BreedingHorse — the breeding feature's view of a horse, derived from the
 * GET /api/v1/horses list DTO (HorseSummary) by one checked normalizer
 * (Equoria-q4uem.6). Replaces the `as unknown as Horse[]` cast that used to
 * sit in BreedingPairSelection.
 *
 * Source of every field: backend/modules/horses/routes/horseRoutes.mjs
 * (GET /, the `data: horses.map(...)` serializer) over
 * backend/modules/horses/services/horseRouteQueries.mjs HORSE_LIST_SELECT:
 *   id, name, dateOfBirth, healthStatus, sex, age  — selected columns
 *   breed                                          — `{ id, name }` relation (null when unset)
 *   ageYears                                       — added by withAgeYears (utils/horseAge.mjs)
 * `imageUrl` and `level` are NOT in the list select, so they are absent on
 * this endpoint today; they are carried as the optional fields HorseSummary
 * already declares so the breeding UI keeps its existing fallbacks.
 *
 * Sex handling preserves the page's prior observable behaviour: HorseSelector
 * only ever listed a horse whose `sex` matched the canonical vocabulary
 * case-insensitively (isMaleHorseSex / isFemaleHorseSex), and `gender` was
 * never read (the list endpoint does not emit it). Such a horse is now dropped
 * here instead of being filtered out by both selectors.
 */

import { getBreedName, parseHorseSex } from '../utils.js';
import type { HorseSex } from '../../types/breeding.js';
import type { HorseSummary } from './types.js';

export type BreedingHorse = Pick<
  HorseSummary,
  'id' | 'name' | 'dateOfBirth' | 'healthStatus' | 'imageUrl' | 'level'
> & {
  age: number;
  sex: HorseSex;
  breedName: string;
};

/** Normalize one list horse; null when its sex is missing or unrecognised. */
export function toBreedingHorse(horse: HorseSummary): BreedingHorse | null {
  const sex = parseHorseSex(horse.sex);
  if (!sex) return null;

  return {
    id: horse.id,
    name: horse.name,
    // `||`, not `??`: a 0-year-old reads `age`, exactly as the page did.
    age: horse.ageYears || horse.age,
    sex,
    breedName: getBreedName(horse.breed),
    healthStatus: horse.healthStatus,
    dateOfBirth: horse.dateOfBirth,
    imageUrl: horse.imageUrl,
    level: horse.level,
  };
}

/** Normalize a list response, dropping horses toBreedingHorse rejects. */
export function toBreedingHorses(horses: readonly HorseSummary[]): BreedingHorse[] {
  return horses.map(toBreedingHorse).filter((horse): horse is BreedingHorse => horse !== null);
}
