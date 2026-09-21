import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely extract a breed name string from an API response.
 * The backend may return `horse.breed` as either a string or an object `{ id, name, description }`.
 */
export function getBreedName(breed: unknown): string {
  // Equoria-zf80 — legacy / missing breed renders the honest 'not recorded'
  // fallback (Equoria-iwy3 / 1k4n convention: never the bare literal
  // 'Unknown'). This util feeds HorseDetailPage:562 directly adjacent to the
  // iwy3 color readout, so the two must read consistently.
  if (!breed) return 'not recorded';
  if (typeof breed === 'string') return breed;
  if (typeof breed === 'object' && breed !== null && 'name' in breed) {
    return (breed as { name: string }).name;
  }
  return 'not recorded';
}

/**
 * Horse-sex GROUP checks (Equoria-gxcxs).
 *
 * Horse.sex is a free string canonicalized server-side to Title Case
 * (backend/constants/schema.mjs HORSE_SEX; packages/database/horseSexCanonical.mjs).
 * The database never stores 'Male'/'Female' — the real vocabulary is
 * Stallion, Mare, Colt, Filly, Rig. Per the marketplace controller's
 * horseSexFilterValues (Equoria-di2n5, user ruling 2026-08-19), 'Filly' and
 * 'Colt' are not separate sexes: they are mares and stallions under three
 * years old. Any female/male eligibility check must therefore match the
 * GROUP, not the exact stored string, or every young horse (and, since
 * `sex` is never relabeled as a horse ages past 3, every horse that was
 * ever born rather than bought as breeding stock) silently disappears from
 * the check. 'Rig' (a cryptorchid) groups male.
 *
 * Case-insensitive: canonicalizeHorseSex on the backend accepts any casing,
 * and some older callers/fixtures (e.g. `gender: 'stallion'`) still pass a
 * lowercase form — mirror that tolerance rather than silently dropping them.
 */
export function isFemaleHorseSex(sex: string | null | undefined): boolean {
  const s = sex?.toLowerCase();
  return s === 'mare' || s === 'filly';
}

export function isMaleHorseSex(sex: string | null | undefined): boolean {
  const s = sex?.toLowerCase();
  return s === 'stallion' || s === 'colt' || s === 'rig';
}
