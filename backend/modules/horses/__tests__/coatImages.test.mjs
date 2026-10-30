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

// Colors a Saddlebred can roll that have no portrait yet. Dominant White got
// portraits 2026-10-29, then the Amber, Classic and Gold Cream Champagnes and
// Ivory Champagne the same day.
// Equoria-7woyj: Smoky Seal Brown is now Seal Buckskin (q310).
const noPortraitYet = ['Sable Cream Champagne', 'Seal Buckskin'];

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
    expect(files('Rose Grey')).toEqual([
      'rosegrey1.webp',
      'rosegrey2.webp',
      'rosegrey3.webp',
      'rosegrey4.webp',
      'rosegrey5.webp',
    ]);
    expect(files('Amber Champagne')).toEqual(['amberchampagne1.webp', 'amberchampagne2.webp']);
    expect(files('Sable Champagne')).toEqual(['sablechampagne1.webp', 'sablechampagne2.webp']);
  });

  it('gives the Cream Champagnes and Ivory Champagne their own two portraits, whatever the shade', () => {
    const files = (colorName, shade) => coatImageVariants(breed, { colorName, shade }).map(url => url.split('/').pop());
    expect(files('Amber Cream Champagne', 'rich')).toEqual(['ambercreamchampagne1.webp', 'ambercreamchampagne2.webp']);
    expect(files('Classic Cream Champagne', 'silver')).toEqual([
      'classiccreamchampagne1.webp',
      'classiccreamchampagne2.webp',
    ]);
    expect(files('Gold Cream Champagne', 'pale')).toEqual(['goldcreamchampagne1.webp', 'goldcreamchampagne2.webp']);
    expect(files('Ivory Champagne', 'standard')).toEqual(['ivorychampagne1.webp', 'ivorychampagne2.webp']);
  });

  it('gives Classic Palomino its own two portraits, whatever the shade (q320)', () => {
    const files = shade =>
      coatImageVariants(breed, { colorName: 'Classic Palomino', shade }).map(url => url.split('/').pop());
    expect(files('standard')).toEqual(['classicpalomino1.webp', 'classicpalomino2.webp']);
    expect(files('pale')).toEqual(['classicpalomino1.webp', 'classicpalomino2.webp']);
    expect(rollCoatImageUrl(breed, { colorName: 'Classic Palomino', shade: 'standard' }, () => 0.999)).toBe(
      '/images/breeds/american_saddlebred/classicpalomino2.webp',
    );
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

  it('gives Dark Chestnut and Liver Chestnut each their own portraits (Equoria-7woyj)', () => {
    expect(coatImageVariants(breed, { colorName: 'Dark Chestnut', shade: 'standard' })).toEqual([
      '/images/breeds/american_saddlebred/darkchestnut1.webp',
      '/images/breeds/american_saddlebred/darkchestnut2.webp',
    ]);
    expect(coatImageVariants(breed, { colorName: 'Liver Chestnut', shade: 'standard' })).toEqual([
      '/images/breeds/american_saddlebred/liverchestnut1.webp',
      '/images/breeds/american_saddlebred/liverchestnut2.webp',
    ]);
  });

  it('rolls one of the variants, and null for a color or breed with no portrait', () => {
    const bay = { colorName: 'Blood Bay', shade: 'standard' };
    expect(rollCoatImageUrl(breed, bay, () => 0)).toBe('/images/breeds/american_saddlebred/bloodbay1.webp');
    expect(rollCoatImageUrl(breed, bay, () => 0.999)).toBe('/images/breeds/american_saddlebred/bloodbay2.webp');
    expect(rollCoatImageUrl(breed, { colorName: 'Seal Buckskin', shade: 'standard' })).toBeNull();
    expect(coatImageVariants(breed, { colorName: 'Dominant White', shade: 'white' })).toEqual([
      '/images/breeds/american_saddlebred/dominantwhite1.webp',
      '/images/breeds/american_saddlebred/dominantwhite2.webp',
    ]);
    expect(rollCoatImageUrl(breed, { colorName: 'Sable Cream Champagne', shade: 'standard' })).toBeNull();
    expect(rollCoatImageUrl(breed, { colorName: 'Bay', shade: 'blood' })).toBeNull(); // a family word is not a color
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
      // q321 (owner 2026-10-30): the classic shade makes Classic Palomino rollable,
      // so every portrait is reached again (q320 had excused the two Classic Palomino files).
      expect([...reached].sort()).toEqual(Object.values(entry.images).flat().sort());
    });
  });
});
