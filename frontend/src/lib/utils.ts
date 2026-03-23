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
  if (!breed) return 'Unknown';
  if (typeof breed === 'string') return breed;
  if (typeof breed === 'object' && breed !== null && 'name' in breed) {
    return (breed as { name: string }).name;
  }
  return 'Unknown';
}
