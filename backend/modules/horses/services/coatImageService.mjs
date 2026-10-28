/**
 * A horse's coat-color portrait (Equoria-de7ts).
 *
 * Pure functions over the per-breed table in data/coatImages.mjs. The variant is
 * rolled once, when the horse is created, and stored in horses.imageUrl; nothing
 * here re-rolls a stored picture.
 */
import { coatImages } from '../data/coatImages.mjs';

/** horses.imageUrl's column default: no picture chosen (the page shows the breed's). */
export const defaultHorseImageUrl = '/images/samplehorse.JPG';

/** imageUrl values that mean "no picture chosen". */
const noPictureUrls = new Set([defaultHorseImageUrl, '/images/samplehorse.jpg']);

/** True when the stored imageUrl is empty or the column default. */
export function hasNoChosenPicture(imageUrl) {
  return !imageUrl || noPictureUrls.has(imageUrl);
}

function asList(value) {
  if (typeof value === 'string') {
    return [value];
  }
  return Array.isArray(value) ? value : [];
}

/**
 * Every portrait URL a horse of this breed and color may have.
 * Empty when the breed or the color (or its shade) has no portrait yet.
 *
 * @param {string|null|undefined} breedName
 * @param {{ colorName?: string, shade?: string }|null|undefined} phenotype
 * @returns {string[]}
 */
export function coatImageVariants(breedName, phenotype) {
  const breedEntry = typeof breedName === 'string' ? coatImages[breedName] : undefined;
  if (!breedEntry || !phenotype || typeof phenotype !== 'object' || Array.isArray(phenotype)) {
    return [];
  }
  const colorEntry = Object.hasOwn(breedEntry.colors, phenotype.colorName)
    ? breedEntry.colors[phenotype.colorName]
    : undefined;
  if (colorEntry === undefined) {
    return [];
  }
  let imageNames;
  if (typeof colorEntry === 'string' || Array.isArray(colorEntry)) {
    imageNames = asList(colorEntry);
  } else {
    const shade = typeof phenotype.shade === 'string' ? phenotype.shade : 'standard';
    imageNames = Object.hasOwn(colorEntry, shade) ? asList(colorEntry[shade]) : [];
  }
  return imageNames.flatMap(imageName =>
    (breedEntry.images[imageName] ?? []).map(file => `${breedEntry.folder}/${file}`),
  );
}

/**
 * Roll one portrait for a new horse, or null when its color has none (the page
 * then shows the breed's single picture).
 *
 * @param {string|null|undefined} breedName
 * @param {object|null|undefined} phenotype
 * @param {() => number} [rng]
 * @returns {string|null}
 */
export function rollCoatImageUrl(breedName, phenotype, rng = Math.random) {
  const variants = coatImageVariants(breedName, phenotype);
  if (variants.length === 0) {
    return null;
  }
  const index = Math.min(variants.length - 1, Math.floor(rng() * variants.length));
  return variants[index];
}
