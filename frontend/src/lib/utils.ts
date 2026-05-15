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
