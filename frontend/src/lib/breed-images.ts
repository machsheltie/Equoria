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
  'american bashkir curly': '/images/breeds/american_bashkir_curly.webp',
  'bashkir curly': '/images/breeds/american_bashkir_curly.webp',
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
 * Breed body-type categories (Equoria-x83v4). There is NO category column on
 * the Breed model in the DB, so category is derived heuristically from the
 * breed NAME below. This is a best-effort visual grouping for the placeholder
 * fallback only — it does NOT drive game logic and makes no claim to be the
 * breed's authoritative registry classification.
 */
export type BreedCategory = 'draft' | 'pony' | 'gaited' | 'sport' | 'light';

/**
 * Category → distinct silhouette placeholder. Each is an honest "no portrait
 * available" SVG whose body proportions differ by category (draft = stocky,
 * pony = small/round, sport = tall/lean, gaited = upright carriage) so the
 * 300 breeds without real portraits are NOT all-identical placeholders
 * (Equoria-x83v4 AC3). These are vector silhouettes, not fabricated
 * breed-specific photography.
 */
const CATEGORY_PLACEHOLDERS: Record<Exclude<BreedCategory, 'light'>, string> = {
  draft: '/images/breeds/category-draft.svg',
  pony: '/images/breeds/category-pony.svg',
  gaited: '/images/breeds/category-gaited.svg',
  sport: '/images/breeds/category-sport.svg',
};

// Name-substring heuristics, evaluated in priority order. Lowercased, trimmed
// name is tested against each group. First match wins. Anything unmatched is
// 'light' (the generic riding-horse silhouette).
const CATEGORY_NAME_HINTS: ReadonlyArray<[Exclude<BreedCategory, 'light'>, readonly string[]]> = [
  // Draft / heavy horses
  [
    'draft',
    [
      'draft',
      'draught',
      'shire',
      'clydesdale',
      'percheron',
      'belgian',
      'suffolk',
      'ardennes',
      'ardennais',
      'boulonnais',
      'brabant',
      'jutland',
      'noriker',
      'haflinger',
      'cob',
      'heavy',
      'gypsy',
      'vanner',
      'fjord',
      'comtois',
      'breton',
      'freiberger',
      'schleswig',
      'rhenish',
      'vladimir',
      'soviet',
      'cart',
    ],
  ],
  // Ponies (test BEFORE sport so "Welsh Pony" isn't swept up elsewhere)
  [
    'pony',
    [
      'pony',
      'shetland',
      'welsh',
      'dartmoor',
      'exmoor',
      'connemara',
      'hackney pony',
      'fell',
      'dales',
      'highland',
      'icelandic',
      'miniature',
      'mini',
      'falabella',
      'pottok',
      'fjord pony',
    ],
  ],
  // Gaited breeds
  [
    'gaited',
    [
      'walking horse',
      'walker',
      'paso',
      'fox trotter',
      'foxtrotter',
      'rocky mountain',
      'mountain pleasure',
      'racking',
      'saddlebred',
      'walkaloosa',
      'mangalarga',
      'marchador',
      'campolina',
      'tolt',
      'gaited',
    ],
  ],
  // Sport / warmblood
  [
    'sport',
    [
      'warmblood',
      'hanoverian',
      'oldenburg',
      'trakehner',
      'holsteiner',
      'westphalian',
      'selle',
      'dutch',
      'danish',
      'swedish',
      'belgian warmblood',
      'zangersheide',
      'wielkopolski',
      'württemberger',
      'wurttemberger',
      'zweibrücker',
      'zweibrucker',
      'sport horse',
    ],
  ],
];

/**
 * Resolve a breed's body-type category from its name. Heuristic only — there
 * is no category field on the Breed model. Returns 'light' for any breed that
 * doesn't match a draft/pony/gaited/sport hint (the default riding-horse type).
 */
export function resolveBreedCategory(breedName: string | null | undefined): BreedCategory {
  const key = (breedName ?? '').toLowerCase().trim();
  if (!key) return 'light';
  for (const [category, hints] of CATEGORY_NAME_HINTS) {
    if (hints.some((hint) => key.includes(hint))) return category;
  }
  return 'light';
}

/**
 * The category-specific placeholder image path for a breed (Equoria-x83v4).
 * 'light' breeds get the original generic silhouette; the four body-type
 * categories get their distinct silhouette. Used as the fallback when no
 * breed-specific portrait exists in BREED_PLACEHOLDERS.
 */
export function getBreedCategoryPlaceholder(breedName: string | null | undefined): string {
  const category = resolveBreedCategory(breedName);
  if (category === 'light') return GENERIC_PLACEHOLDER;
  return CATEGORY_PLACEHOLDERS[category];
}

/**
 * URLs that are Prisma schema defaults or otherwise known to be non-existent.
 * Treated as "no real image set" so breed-specific lookup runs instead.
 */
const PLACEHOLDER_DEFAULTS = new Set(['/images/samplehorse.JPG', '/images/samplehorse.jpg']);

/**
 * Resolve the display image URL for a horse.
 *
 * Returns the provided imageUrl if truthy (and not a known dead placeholder),
 * otherwise looks up a breed-specific placeholder, falling back to the generic
 * placeholder.
 *
 * @param imageUrl - The horse's stored portrait URL (may be null/undefined)
 * @param breed    - The horse's breed name or breed object
 * @returns        A non-empty image URL string
 */
export function getHorseImage(
  imageUrl: string | null | undefined,
  breed: string | { id?: number; name?: string; description?: string } | null | undefined
): string {
  if (imageUrl && !PLACEHOLDER_DEFAULTS.has(imageUrl)) return imageUrl;

  const breedName = typeof breed === 'string' ? breed : (breed?.name ?? '');

  const key = breedName.toLowerCase().trim();
  if (BREED_PLACEHOLDERS[key]) return BREED_PLACEHOLDERS[key];
  // Partial match — e.g. "American Quarter Horse" matches "quarter horse"
  const partialKey = Object.keys(BREED_PLACEHOLDERS).find(
    (k) => key.includes(k) || k.includes(key)
  );
  if (partialKey) return BREED_PLACEHOLDERS[partialKey];
  // No breed-specific portrait — fall back to a category-distinct silhouette
  // (draft / pony / gaited / sport) rather than one identical generic
  // placeholder for all ~300 portrait-less breeds (Equoria-x83v4 AC3).
  return getBreedCategoryPlaceholder(breedName);
}

/**
 * Resolve inline style overrides for a horse image element.
 *
 * Returns an empty style object so the image fills its container via the
 * caller's `object-cover` class. Kept as a function for API compatibility
 * with existing call sites.
 */
export function getHorseImageStyle(
  _imageUrl: string | null | undefined,
  _breed: string | { id?: number; name?: string; description?: string } | null | undefined
): CSSProperties {
  return {};
}
