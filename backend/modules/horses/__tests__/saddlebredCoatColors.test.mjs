/**
 * American Saddlebred coat colors (Equoria-de7ts, owner rulings 2026-10-28).
 *
 *   - Dun of any sort does not exist in the breed: nothing with Dun in its name
 *     (Bay Dun, Red Dun, Grulla, Dunskin, Dunalino, Smoky Grulla, any Dun
 *     Champagne) can roll.
 *   - About 7% of Saddlebreds are seal-based (the At agouti allele), giving
 *     Seal Brown in Dark, Light and Sealskin, and Seal Perlino (At + Cr/Cr).
 *   - New shades: Bay Blood/Copper/Wild, Chestnut Golden, Palomino Chocolate.
 *   - Every shade of a color is equally likely (q270; q296 2026-10-29 extends it
 *     to Buckskin, the Champagnes and the Cream Champagnes).
 *
 * Equoria-7woyj (owner rulings q309-q316, 2026-10-29): a color family's shade is
 * part of the owner's name (Bay + dark = Mahogany Bay, Seal Brown + sealskin =
 * Sealskin), so the shade checks below count the owner names.
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
  return base.colorName === 'Standard Seal Brown';
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
    expect(colorCounts.get('Dark Seal Brown')).toBeGreaterThan(0);
    expect(colorCounts.get('Seal Perlino')).toBeGreaterThan(0);
  });

  // Each shade's owner name(s); dark chestnut is Dark Chestnut or Liver Chestnut.
  const newShades = {
    Bay: [['Standard Bay'], ['Mahogany Bay'], ['Golden Bay'], ['Blood Bay'], ['Copper Bay'], ['Wild Bay']],
    Chestnut: [['Red Chestnut'], ['Dark Chestnut', 'Liver Chestnut'], ['Light Yellow Chestnut'], ['Golden Chestnut']],
    Palomino: [['Light Palomino'], ['Golden Palomino'], ['Dark Palomino'], ['Chocolate Palomino']],
    'Seal Brown': [['Dark Seal Brown'], ['Light Seal Brown'], ['Sealskin']],
  };

  it.each(Object.entries(newShades))('rolls every %s shade, each about equally often', (family, shades) => {
    const count = names => names.reduce((sum, name) => sum + (colorCounts.get(name) ?? 0), 0);
    const total = shades.reduce((sum, names) => sum + count(names), 0);
    expect(colorCounts.has(family)).toBe(false);
    for (const name of shades.flat()) {
      expect([name, shadeCounts.get(`${name}|standard`) > 0]).toEqual([name, true]);
    }
    // Equal weights pending the owner's q270: each shade within 40% of a fair share.
    const fair = total / shades.length;
    for (const names of shades) {
      expect(count(names)).toBeGreaterThan(fair * 0.6);
      expect(count(names)).toBeLessThan(fair * 1.4);
    }
  });
});

describe('American Saddlebred shade weights (Equoria-de7ts, owner ruling q296)', () => {
  // Owner ruling 2026-10-29 (q296): every Saddlebred color rolls all its shades
  // equally, Buckskin, the Champagnes and the Cream Champagnes included.
  const { profile } = parseBreedSourceFile(readFileSync(breedFile, 'utf8'), 'American Saddlebred.txt');

  it.each(Object.entries(profile.shadeBias))('gives every %s shade the same weight', (colorName, weights) => {
    expect(new Set(Object.values(weights)).size).toBe(1);
  });

  it('rolls every Buckskin shade about equally often', () => {
    const rng = seededRng(20261029);
    const genotype = { E_Extension: 'E/e', A_Agouti: 'A/a', Cr_Cream: 'Cr/n' };
    const counts = new Map();
    const total = 30000;
    for (let i = 0; i < total; i++) {
      const { colorName, shade } = calculateBreedPhenotype(genotype, profile, rng);
      expect(shade).toBe('standard');
      counts.set(colorName, (counts.get(colorName) ?? 0) + 1);
    }
    // burnished, cream, golden as the owner's names (Equoria-7woyj)
    expect([...counts.keys()].sort()).toEqual(['Buttermilk Buckskin', 'Classic Buckskin', 'Golden Buckskin']);
    const fair = total / 3;
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(fair * 0.9);
      expect(count).toBeLessThan(fair * 1.1);
    }
  });
});

describe('shade roll (Equoria-de7ts)', () => {
  it('rolls the shade of any breed by its weights (owner ruling q277)', () => {
    const profile = { shadeBias: { Chestnut: { light: 0.5, golden: 0.5 } } };
    const genotype = { E_Extension: 'e/e', A_Agouti: 'A/a' };
    // Equoria-7woyj: the rolled shade picks the owner's name (light, golden).
    expect(calculateBreedPhenotype(genotype, profile, () => 0).colorName).toBe('Light Yellow Chestnut');
    expect(calculateBreedPhenotype(genotype, profile, () => 0.99).colorName).toBe('Golden Chestnut');
  });

  it('picks the shade from the roll, by weight', () => {
    const shadeBias = { Bay: { dark: 0.5, wild: 0.5 } };
    const genotype = { E_Extension: 'E/e', A_Agouti: 'A/a' };
    expect(calculatePhenotype(genotype, shadeBias, () => 0).colorName).toBe('Mahogany Bay');
    expect(calculatePhenotype(genotype, shadeBias, () => 0.99).colorName).toBe('Wild Bay');
  });
});

describe('calculatePhenotype — seal names (Equoria-de7ts)', () => {
  it('names seal brown with double cream Seal Perlino', () => {
    const genotype = { E_Extension: 'E/e', A_Agouti: 'At/a', Cr_Cream: 'Cr/Cr' };
    expect(calculatePhenotype(genotype).colorName).toBe('Seal Perlino');
  });

  it('still names bay with double cream Perlino and seal brown alone Standard Seal Brown', () => {
    expect(calculatePhenotype({ E_Extension: 'E/e', A_Agouti: 'A/At', Cr_Cream: 'Cr/Cr' }).colorName).toBe('Perlino');
    expect(calculatePhenotype({ E_Extension: 'E/e', A_Agouti: 'At/At' }).colorName).toBe('Standard Seal Brown');
  });
});
