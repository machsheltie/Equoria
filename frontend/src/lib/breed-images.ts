/**
 * Breed Images Utility
 *
 * Provides helper functions for resolving horse image URLs.
 * Falls back to breed-specific or generic placeholder images
 * when no portrait URL is available.
 */

import type { CSSProperties } from 'react';

/** Map of breed names (lowercase) to placeholder image paths */
const BREED_PLACEHOLDERS: Record<string, string> = {
  // Images that exist in /public/images/breeds/
  thoroughbred: '/images/breeds/thoroughbred.png',
  arabian: '/images/breeds/arabian.png',
  warmblood: '/images/breeds/warmblood.png',
  'dutch warmblood': '/images/breeds/warmblood.png',
  hanoverian: '/images/breeds/warmblood.png',
  oldenburg: '/images/breeds/warmblood.png',
  trakehner: '/images/breeds/warmblood.png',
  friesian: '/images/breeds/friesian.jpg',
  morgan: '/images/breeds/morgan.webp',
  lusitano: '/images/breeds/lusitano.webp',
  saddlebred: '/images/breeds/american_saddlebred.png',
  'american saddlebred': '/images/breeds/american_saddlebred.png',
  'american cream draft': '/images/breeds/american_cream_draft.png',
  // These breeds need images added to /public/images/breeds/ to show something other than placeholder
  // 'quarter horse': '/images/breeds/quarter-horse.png',
  // andalusian: '/images/breeds/andalusian.png',
  // mustang: '/images/breeds/mustang.png',
  // appaloosa: '/images/breeds/appaloosa.png',
  // 'paint horse': '/images/breeds/paint.png',
  // 'tennessee walking horse': '/images/breeds/walking-horse.png',
  // standardbred: '/images/breeds/standardbred.png',
  // clydesdale: '/images/breeds/clydesdale.png',
  // percheron: '/images/breeds/percheron.png',
  // shire: '/images/breeds/shire.png',
};

const GENERIC_PLACEHOLDER = '/placeholder.svg';

/**
 * Resolve the display image URL for a horse.
 *
 * Returns the provided imageUrl if truthy, otherwise looks up a
 * breed-specific placeholder, falling back to the generic placeholder.
 *
 * @param imageUrl - The horse's stored portrait URL (may be null/undefined)
 * @param breed    - The horse's breed name or breed object
 * @returns        A non-empty image URL string
 */
export function getHorseImage(
  imageUrl: string | null | undefined,
  breed: string | { id?: number; name?: string; description?: string } | null | undefined
): string {
  if (imageUrl) return imageUrl;

  const breedName = typeof breed === 'string' ? breed : (breed?.name ?? '');

  const key = breedName.toLowerCase().trim();
  if (BREED_PLACEHOLDERS[key]) return BREED_PLACEHOLDERS[key];
  // Partial match — e.g. "American Quarter Horse" matches "quarter horse"
  const partialKey = Object.keys(BREED_PLACEHOLDERS).find(
    (k) => key.includes(k) || k.includes(key)
  );
  return partialKey ? BREED_PLACEHOLDERS[partialKey] : GENERIC_PLACEHOLDER;
}

/**
 * Resolve inline style overrides for a horse image element.
 *
 * When a real portrait URL is provided the image is displayed normally
 * (object-fit: cover). For placeholder images we use object-fit: contain
 * so the placeholder graphic isn't cropped awkwardly.
 *
 * @param imageUrl - The horse's stored portrait URL (may be null/undefined)
 * @param breed    - The horse's breed name or breed object
 * @returns        A React CSSProperties object (may be empty)
 */
export function getHorseImageStyle(
  imageUrl: string | null | undefined,
  _breed: string | { id?: number; name?: string; description?: string } | null | undefined
): CSSProperties {
  if (imageUrl) return {};
  // Placeholder images look better with contain + a subtle background
  return { objectFit: 'contain', padding: '8px' };
}
