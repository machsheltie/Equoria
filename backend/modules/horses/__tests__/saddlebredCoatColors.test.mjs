/**
 * American Saddlebred coat colors (Equoria-de7ts, owner rulings 2026-10-28).
 *
 *   - Dun of any sort does not exist in the breed: nothing with Dun in its name
 *     (Bay Dun, Red Dun, Grulla, Dunskin, Dunalino, Smoky Grulla, any Dun
 *     Champagne) can roll.
 *   - About 7% of Saddlebreds are seal-based (the At agouti allele), giving
 *     Seal Brown in Dark, Light and Sealskin, and Seal Perlino (At + Cr/Cr).
 *   - New shades: Bay Blood/Copper/Wild, Chestnut Golden, Palomino Chocolate.
 *   - Shade weights are pending the owner (q270): every shade of a color is
 *     equally likely until she picks.
 *
 * Drives the real generator and color engine with the breed's real seed file
 * profile and a seeded RNG, so every run checks the same reproducible sample.
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBreedSourceFile } from '../../../seed/syncBreedGeneticProfiles.mjs';
import { generateGenotype } from '../services/genotypeGenerationService.mjs';
import { calculateBreedPhenotype, calculatePhenotype } from '../services/phenotypeCalculationService.mjs';
import { seededRng } from '../../../__tests__/helpers/seededRng.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const breedFile = join(here, '..', '..', '..', 'data', 'breeds', 'American Saddlebred.txt');
const rolls = 100000;

function sealBased(genotype) {
  // The base color alone, from the real engine: Extension + Agouti only.
  const base = calculatePhenotype({ E_Extension: genotype.E_Extension, A_Agouti: genotype.A_Agouti });
  return base.colorName === 'Seal Brown';
}

describe('American Saddlebred coat colors (Equoria-de7ts)', () => {
  let profile;
  const colorCounts = new Map();
  const shadeCounts = new Map();
  let sealCount = 0;

  beforeAll(() => {
    ({ profile } = parseBreedSourceFile(readFileSync(breedFile, 'utf8'), 'American Saddlebred.txt'));
    const rng = seededRng(20261028);
    for (let i = 0; i < rolls; i++) {
      const genotype = generateGenotype(profile, rng);
      const { colorName, shade } = calculateBreedPhenotype(genotype, profile, rng);
      colorCounts.set(colorName, (colorCounts.get(colorName) ?? 0) + 1);
      const key = `${colorName}|${shade}`;
      shadeCounts.set(key, (shadeCounts.get(key) ?? 0) + 1);
      if (sealBased(genotype)) {
        sealCount++;
      }
    }
  });

  it('never rolls a dun color', () => {
    const dunColors = [...colorCounts.keys()].filter(name => /dun|grulla/i.test(name));
    expect(dunColors).toEqual([]);
    expect(profile.allowedAlleles.D_Dun).toEqual(['nd2/nd2']);
    expect(profile.alleleWeights.D_Dun).toEqual({ 'nd2/nd2': 1 });
  });

  it('makes about 7% of Saddlebreds seal-based', () => {
    const share = sealCount / rolls;
    expect(share).toBeGreaterThan(0.065);
    expect(share).toBeLessThan(0.075);
  });

  it('rolls Seal Brown and Seal Perlino', () => {
    expect(colorCounts.get('Seal Brown')).toBeGreaterThan(0);
    expect(colorCounts.get('Seal Perlino')).toBeGreaterThan(0);
  });

  const newShades = {
    Bay: ['standard', 'dark', 'light', 'blood', 'copper', 'wild'],
    Chestnut: ['medium', 'dark', 'light', 'golden'],
    Palomino: ['pale', 'golden', 'copper', 'chocolate'],
    'Seal Brown': ['dark', 'light', 'sealskin'],
  };

  it.each(Object.entries(newShades))('rolls every %s shade, each about equally often', (colorName, shades) => {
    const total = colorCounts.get(colorName);
    const rolled = [...shadeCounts.keys()]
      .filter(key => key.startsWith(`${colorName}|`))
      .map(key => key.slice(colorName.length + 1))
      .sort();
    expect(rolled).toEqual([...shades].sort());
    // Equal weights pending the owner's q270: each shade within 40% of a fair share.
    const fair = total / shades.length;
    for (const shade of shades) {
      const count = shadeCounts.get(`${colorName}|${shade}`);
      expect(count).toBeGreaterThan(fair * 0.6);
      expect(count).toBeLessThan(fair * 1.4);
    }
  });
});

describe('shade roll (Equoria-de7ts)', () => {
  it('rolls the shade of any breed by its weights (owner ruling q277)', () => {
    const profile = { shadeBias: { Chestnut: { light: 0.5, golden: 0.5 } } };
    const genotype = { E_Extension: 'e/e', A_Agouti: 'A/a' };
    expect(calculateBreedPhenotype(genotype, profile, () => 0).shade).toBe('light');
    expect(calculateBreedPhenotype(genotype, profile, () => 0.99).shade).toBe('golden');
  });

  it('picks the shade from the roll, by weight', () => {
    const shadeBias = { Bay: { dark: 0.5, wild: 0.5 } };
    const genotype = { E_Extension: 'E/e', A_Agouti: 'A/a' };
    expect(calculatePhenotype(genotype, shadeBias, () => 0).shade).toBe('dark');
    expect(calculatePhenotype(genotype, shadeBias, () => 0.99).shade).toBe('wild');
  });
});

describe('calculatePhenotype — seal names (Equoria-de7ts)', () => {
  it('names seal brown with double cream Seal Perlino', () => {
    const genotype = { E_Extension: 'E/e', A_Agouti: 'At/a', Cr_Cream: 'Cr/Cr' };
    expect(calculatePhenotype(genotype).colorName).toBe('Seal Perlino');
  });

  it('still names bay with double cream Perlino and seal brown alone Seal Brown', () => {
    expect(calculatePhenotype({ E_Extension: 'E/e', A_Agouti: 'A/At', Cr_Cream: 'Cr/Cr' }).colorName).toBe('Perlino');
    expect(calculatePhenotype({ E_Extension: 'E/e', A_Agouti: 'At/At' }).colorName).toBe('Seal Brown');
  });
});
