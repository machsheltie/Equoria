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
 *   breedingCooldownEndsAt, inFoal                 — added by breedingStateFields
 *                                                    (Equoria-q4uem.9 slice 6; the
 *                                                    cooldown is a mare's only)
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

import { getBreedName } from '../utils.js';
import type { HorseSex } from '../../types/breeding.js';
import type { HorseSummary } from './types.js';

export type BreedingHorse = Pick<
  HorseSummary,
  // `level` and `imageUrl` are always undefined from GET /horses today:
  // HORSE_LIST_SELECT does not send them. Stud fee is player-set (owner
  // ruling, Equoria-q4uem.9); the game never derives it from `level`.
  | 'id'
  | 'name'
  | 'dateOfBirth'
  | 'healthStatus'
  | 'displayedHealth'
  | 'imageUrl'
  | 'level'
  | 'breedingCooldownEndsAt'
  | 'inFoal'
> & {
  age: number;
  sex: HorseSex;
  breedName: string;
};

const CANONICAL_HORSE_SEX: ReadonlyMap<string, HorseSex> = new Map<string, HorseSex>([
  ['stallion', 'Stallion'],
  ['mare', 'Mare'],
  ['colt', 'Colt'],
  ['filly', 'Filly'],
  ['rig', 'Rig'],
]);

/**
 * Parse an API horse-sex string into the canonical HorseSex (Equoria-q4uem.6).
 * Case-insensitive, matching isFemaleHorseSex/isMaleHorseSex; anything outside
 * the canonical vocabulary (including 'Male'/'Female', which the database
 * never stores) is null, so callers handle it explicitly.
 */
export function parseHorseSex(sex: string | null | undefined): HorseSex | null {
  if (!sex) return null;
  return CANONICAL_HORSE_SEX.get(sex.toLowerCase()) ?? null;
}

/** Normalize one list horse; null when its sex is missing or unrecognised. */
export function toBreedingHorse(horse: HorseSummary): BreedingHorse | null {
  const sex = parseHorseSex(horse.sex);
  if (!sex) return null;

  return {
    id: horse.id,
    name: horse.name,
    // ageYears alone (owner ruling 2026-10-23, Equoria-x49d): the backend serves
    // it on every list horse, so the legacy `age` fallback would only mask a
    // regression — and it misread a horse in its first year (ageYears 0).
    age: horse.ageYears,
    sex,
    breedName: getBreedName(horse.breed),
    healthStatus: horse.healthStatus,
    // Equoria-u0jop: the selector's Fair-or-better gate and health label.
    displayedHealth: horse.displayedHealth,
    dateOfBirth: horse.dateOfBirth,
    imageUrl: horse.imageUrl,
    level: horse.level,
    // Server truth (Equoria-q4uem.9): the selector's cooldown and in-foal
    // gates read these; without them a mare on cooldown looked breedable.
    breedingCooldownEndsAt: horse.breedingCooldownEndsAt,
    inFoal: horse.inFoal,
  };
}

/** Normalize a list response, dropping horses toBreedingHorse rejects. */
export function toBreedingHorses(horses: readonly HorseSummary[]): BreedingHorse[] {
  return horses.map(toBreedingHorse).filter((horse): horse is BreedingHorse => horse !== null);
}
