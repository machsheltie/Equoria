/**
 * breed-images — category fallback tests (Equoria-x83v4)
 *
 * Proves that breeds WITHOUT a hand-mapped portrait fall back to a
 * category-distinct silhouette (draft / pony / gaited / sport) rather than one
 * identical generic placeholder — so the ~300 portrait-less post-import breeds
 * are visually differentiated. Sentinel-positive: asserts the category routing
 * actually fires per body-type, and that a real mapped portrait still wins.
 */

import { describe, it, expect } from 'vitest';
import { getHorseImage, resolveBreedCategory, getBreedCategoryPlaceholder } from '../breed-images';

describe('resolveBreedCategory', () => {
  it('classifies draft breeds by name', () => {
    expect(resolveBreedCategory('Shire')).toBe('draft');
    expect(resolveBreedCategory('Clydesdale')).toBe('draft');
    expect(resolveBreedCategory('Percheron')).toBe('draft');
    expect(resolveBreedCategory('Belgian Draft')).toBe('draft');
    expect(resolveBreedCategory('Gypsy Vanner')).toBe('draft');
  });

  it('classifies pony breeds by name', () => {
    expect(resolveBreedCategory('Shetland Pony')).toBe('pony');
    expect(resolveBreedCategory('Welsh Pony')).toBe('pony');
    expect(resolveBreedCategory('Connemara')).toBe('pony');
    expect(resolveBreedCategory('Icelandic')).toBe('pony');
  });

  it('classifies gaited breeds by name', () => {
    expect(resolveBreedCategory('Tennessee Walking Horse')).toBe('gaited');
    expect(resolveBreedCategory('Paso Fino')).toBe('gaited');
    expect(resolveBreedCategory('Missouri Fox Trotter')).toBe('gaited');
    expect(resolveBreedCategory('American Saddlebred')).toBe('gaited');
  });

  it('classifies sport / warmblood breeds by name', () => {
    expect(resolveBreedCategory('Hanoverian')).toBe('sport');
    expect(resolveBreedCategory('Dutch Warmblood')).toBe('sport');
    expect(resolveBreedCategory('Trakehner')).toBe('sport');
  });

  it('defaults unmatched breeds to the light riding-horse type', () => {
    expect(resolveBreedCategory('Thoroughbred')).toBe('light');
    expect(resolveBreedCategory('Arabian')).toBe('light');
    expect(resolveBreedCategory('Mustang')).toBe('light');
    expect(resolveBreedCategory('')).toBe('light');
    expect(resolveBreedCategory(null)).toBe('light');
    expect(resolveBreedCategory(undefined)).toBe('light');
  });
});

describe('getBreedCategoryPlaceholder', () => {
  it('returns a distinct silhouette per body-type category', () => {
    expect(getBreedCategoryPlaceholder('Shire')).toBe('/images/breeds/category-draft.svg');
    expect(getBreedCategoryPlaceholder('Shetland Pony')).toBe('/images/breeds/category-pony.svg');
    expect(getBreedCategoryPlaceholder('Paso Fino')).toBe('/images/breeds/category-gaited.svg');
    expect(getBreedCategoryPlaceholder('Hanoverian')).toBe('/images/breeds/category-sport.svg');
  });

  it('returns the generic placeholder for light breeds', () => {
    expect(getBreedCategoryPlaceholder('Thoroughbred')).toBe('/placeholder.svg');
  });

  it('produces different placeholders for different categories (not all-identical)', () => {
    const placeholders = new Set([
      getBreedCategoryPlaceholder('Shire'),
      getBreedCategoryPlaceholder('Shetland Pony'),
      getBreedCategoryPlaceholder('Paso Fino'),
      getBreedCategoryPlaceholder('Hanoverian'),
      getBreedCategoryPlaceholder('Mustang'),
    ]);
    expect(placeholders.size).toBe(5);
  });
});

describe('getHorseImage — portrait → category fallback chain', () => {
  it('prefers a real stored portrait URL', () => {
    expect(getHorseImage('/uploads/horse-42.png', 'Shire')).toBe('/uploads/horse-42.png');
  });

  it('uses a hand-mapped breed portrait when one exists', () => {
    // Thoroughbred has a real image in BREED_PLACEHOLDERS.
    expect(getHorseImage(null, 'Thoroughbred')).toBe('/images/breeds/thoroughbred.png');
  });

  it('falls back to a CATEGORY silhouette for a portrait-less breed (not generic)', () => {
    // Shire has no hand-mapped portrait → draft category silhouette, NOT
    // the bare /placeholder.svg.
    const img = getHorseImage(null, 'Shire');
    expect(img).toBe('/images/breeds/category-draft.svg');
    expect(img).not.toBe('/placeholder.svg');
  });

  it('falls back to generic for a portrait-less light breed', () => {
    // Mustang: no portrait, light category → generic placeholder.
    expect(getHorseImage(null, 'Mustang')).toBe('/placeholder.svg');
  });

  it('treats the Prisma default sample image as "no image" and routes by breed', () => {
    expect(getHorseImage('/images/samplehorse.JPG', 'Shire')).toBe(
      '/images/breeds/category-draft.svg'
    );
  });

  it('accepts a breed object as well as a string', () => {
    expect(getHorseImage(null, { name: 'Clydesdale' })).toBe('/images/breeds/category-draft.svg');
  });
});
