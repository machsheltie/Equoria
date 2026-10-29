/**
 * Coat-color portraits (Equoria-de7ts).
 *
 * The owner's American Saddlebred files live in
 * frontend/public/images/breeds/american_saddlebred/. Every file the table
 * names must exist there, every file she delivered must be used, and every
 * color + shade a Saddlebred can roll either maps to its portraits or is one of
 * the colors with no portrait yet (those show the breed's single picture).
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { coatImages } from '../data/coatImages.mjs';
import { coatImageVariants, rollCoatImageUrl } from '../services/coatImageService.mjs';
import { parseBreedSourceFile } from '../../../seed/syncBreedGeneticProfiles.mjs';
import { generateGenotype } from '../services/genotypeGenerationService.mjs';
import { calculateBreedPhenotype } from '../services/phenotypeCalculationService.mjs';
import { seededRng } from '../../../__tests__/helpers/seededRng.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..', '..');
const publicDir = join(repoRoot, 'frontend', 'public');
const breed = 'American Saddlebred';
const entry = coatImages[breed];

// Colors a Saddlebred can roll that have no portrait yet (the owner will
// address the Cream Champagnes herself; Dominant White got portraits 2026-10-29).
const noPortraitYet = [
  'Amber Cream Champagne',
  'Classic Cream Champagne',
  'Gold Cream Champagne',
  'Ivory Champagne',
  'Sable Cream Champagne',
  'Smoky Seal Brown',
];

describe('coat-color portrait table (Equoria-de7ts)', () => {
  it('names only files that exist, and uses every file the owner delivered', () => {
    const folderOnDisk = join(publicDir, ...entry.folder.split('/').filter(Boolean));
    const named = Object.values(entry.images).flat();
    for (const file of named) {
      expect({ file, exists: existsSync(join(folderOnDisk, file)) }).toEqual({ file, exists: true });
    }
    expect([...named].sort()).toEqual(readdirSync(folderOnDisk).sort());
    // q275: the game ships WebP copies only; the PNG/JPG originals stay out of the repo.
    expect(readdirSync(folderOnDisk).filter(file => !file.endsWith('.webp'))).toEqual([]);
  });

  it('uses all five rose grey portraits, and gives Amber and Sable Champagne their own (q276)', () => {
    const files = (colorName, shade = 'standard') =>
      coatImageVariants(breed, { colorName, shade }).map(url => url.split('/').pop());
    expect(files('Rose Gray')).toEqual([
      'rosegrey1.webp',
      'rosegrey2.webp',
      'rosegrey3.webp',
      'rosegrey4.webp',
      'rosegrey5.webp',
    ]);
    expect(files('Amber Champagne')).toEqual(['amberchampagne1.webp', 'amberchampagne2.webp']);
    expect(files('Sable Champagne')).toEqual(['sablechampagne1.webp', 'sablechampagne2.webp']);
  });

  it('gives every portrait at least two variants', () => {
    for (const [imageName, files] of Object.entries(entry.images)) {
      expect({ imageName, enough: files.length >= 2 }).toEqual({ imageName, enough: true });
    }
  });

  it('refers only to image names it defines', () => {
    const imageNames = Object.values(entry.colors).flatMap(value =>
      typeof value === 'string' || Array.isArray(value) ? [value].flat() : Object.values(value).flat(),
    );
    for (const imageName of imageNames) {
      expect(Object.hasOwn(entry.images, imageName)).toBe(true);
    }
  });

  it('counts dark chestnut and liver chestnut as variants of Chestnut — Dark', () => {
    expect(coatImageVariants(breed, { colorName: 'Chestnut', shade: 'dark' })).toEqual([
      '/images/breeds/american_saddlebred/darkchestnut1.webp',
      '/images/breeds/american_saddlebred/darkchestnut2.webp',
      '/images/breeds/american_saddlebred/liverchestnut1.webp',
      '/images/breeds/american_saddlebred/liverchestnut2.webp',
    ]);
  });

  it('rolls one of the variants, and null for a color or breed with no portrait', () => {
    const bay = { colorName: 'Bay', shade: 'blood' };
    expect(rollCoatImageUrl(breed, bay, () => 0)).toBe('/images/breeds/american_saddlebred/bloodbay1.webp');
    expect(rollCoatImageUrl(breed, bay, () => 0.999)).toBe('/images/breeds/american_saddlebred/bloodbay2.webp');
    expect(rollCoatImageUrl(breed, { colorName: 'Smoky Seal Brown', shade: 'standard' })).toBeNull();
    expect(coatImageVariants(breed, { colorName: 'Dominant White', shade: 'white' })).toEqual([
      '/images/breeds/american_saddlebred/dominantwhite1.webp',
      '/images/breeds/american_saddlebred/dominantwhite2.webp',
    ]);
    expect(rollCoatImageUrl(breed, { colorName: 'Bay', shade: 'no such shade' })).toBeNull();
    expect(rollCoatImageUrl('Arabian', bay)).toBeNull();
    expect(rollCoatImageUrl(breed, null)).toBeNull();
  });

  describe('every color a Saddlebred can roll', () => {
    const rolled = new Set();

    beforeAll(() => {
      const file = join(repoRoot, 'backend', 'data', 'breeds', `${breed}.txt`);
      const { profile } = parseBreedSourceFile(readFileSync(file, 'utf8'), `${breed}.txt`);
      const rng = seededRng(6971);
      for (let i = 0; i < 100000; i++) {
        const { colorName, shade } = calculateBreedPhenotype(generateGenotype(profile, rng), profile, rng);
        rolled.add(`${colorName}|${shade}`);
      }
    });

    it('maps to its portraits, or is a color with no portrait yet', () => {
      const unmapped = new Set();
      for (const key of rolled) {
        const [colorName, shade] = key.split('|');
        if (coatImageVariants(breed, { colorName, shade }).length === 0) {
          unmapped.add(colorName);
        }
      }
      expect([...unmapped].sort()).toEqual(noPortraitYet);
    });

    it('reaches every portrait the table offers', () => {
      const reached = new Set();
      for (const key of rolled) {
        const [colorName, shade] = key.split('|');
        for (const url of coatImageVariants(breed, { colorName, shade })) {
          reached.add(url.split('/').pop());
        }
      }
      expect([...reached].sort()).toEqual(Object.values(entry.images).flat().sort());
    });
  });
});
