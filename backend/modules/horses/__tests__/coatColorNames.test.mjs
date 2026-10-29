/**
 * coatColorNames — every coat color in the game (Equoria-merxy).
 *
 * Owner ruling 2026-10-28 (q190): the Marketplace color filter is a dropdown of
 * every coat color in the game. The list must hold every colorName
 * calculatePhenotype can give a horse, and nothing else.
 * Owner rulings q309-q316 (2026-10-29, Equoria-7woyj): the owner's names, spelled
 * grey (q311 overrides US spelling for grey); a color family reads as its owner
 * names (Standard Bay...), never the family word.
 */
import { describe, it, expect } from '@jest/globals';
import { calculatePhenotype } from '../services/phenotypeCalculationService.mjs';
import { canonicalCoatColorName, coatColorNames } from '../services/coatColorNames.mjs';

// Every allele spelling each locus is read with, including the alternate orders.
const loci = {
  E_Extension: ['E/E', 'E/e', 'e/e'],
  A_Agouti: ['A/A', 'A/a', 'A+/a', 'A+/A+', 'At/At', 'At/a', 'a/a'],
  EDXW: ['n/n', 'EDXW1/n'],
  Cr_Cream: ['n/n', 'Cr/n', 'n/Cr', 'Cr/Cr'],
  D_Dun: ['nd2/nd2', 'nd1/nd1', 'nd1/nd2', 'D/nd2', 'D/D'],
  Z_Silver: ['n/n', 'Z/n', 'Z/Z'],
  Ch_Champagne: ['n/n', 'Ch/n', 'Ch/Ch'],
  Prl_Pearl: ['n/n', 'prl/n', 'n/prl', 'prl/prl'],
  MFSD12_Mushroom: ['N/N', 'M/N', 'M/M'],
  Sdp_Snowdrop: ['n/n', 'sdp/n', 'sdp/sdp'],
  Sun_Sunshine: ['n/n', 'sun/n', 'sun/sun'],
  Rn_Roan: ['rn/rn', 'Rn/rn'],
  G_Gray: ['g/g', 'G/g'],
  LP_LeopardComplex: ['lp/lp', 'LP/lp'],
  PATN1_Pattern1: ['patn1/patn1', 'PATN1/patn1'],
  W_DominantWhite: ['w/w', 'W20/w', 'W22/w', 'W20/W22'],
  BR1_Brindle1: ['n/n', 'BR1/n'],
};

// A deterministic walk of the genotype space: every allele of every locus is
// paired with every allele of every other locus across the sample.
function* sampleGenotypes() {
  const entries = Object.entries(loci);
  const sizes = entries.map(([, alleles]) => alleles.length);
  const total = sizes.reduce((a, b) => a * b, 1);
  const step = 7919; // prime, so the walk spreads across the mixed-radix space
  for (let i = 0, n = 0; n < 60000; i = (i + step) % total, n += 1) {
    let rest = i;
    const genotype = {};
    entries.forEach(([locus, alleles], k) => {
      genotype[locus] = alleles[rest % sizes[k]];
      rest = Math.floor(rest / sizes[k]);
    });
    yield genotype;
  }
}

describe('coatColorNames (Equoria-merxy)', () => {
  it('holds every color calculatePhenotype gives a horse', () => {
    const missing = new Set();
    for (const genotype of sampleGenotypes()) {
      const { colorName } = calculatePhenotype(genotype);
      if (!coatColorNames.includes(colorName)) {
        missing.add(colorName);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it('is alphabetical, has no repeats and no non-color', () => {
    expect(new Set(coatColorNames).size).toBe(coatColorNames.length);
    expect([...coatColorNames].sort((a, b) => a.localeCompare(b, 'en'))).toEqual([...coatColorNames]);
    expect(coatColorNames).not.toContain('Unknown');
    expect(Object.isFrozen(coatColorNames)).toBe(true);
  });

  it('spells grey, never gray (owner ruling q311), and never lists a color family word', () => {
    expect(coatColorNames).toEqual(expect.arrayContaining(['Dapple Grey', 'Steel Grey', 'Fleabitten Grey']));
    expect(coatColorNames.filter(name => /gray|colour/i.test(name))).toEqual([]);
    for (const family of ['Bay', 'Chestnut', 'Black', 'Palomino', 'Buckskin', 'Seal Brown']) {
      expect(coatColorNames).not.toContain(family);
    }
    expect(coatColorNames).toEqual(expect.arrayContaining(['Standard Bay', 'Mahogany Bay', 'Classic Palomino']));
  });

  it('canonicalCoatColorName gives the list spelling for any case, and undefined otherwise', () => {
    expect(canonicalCoatColorName('steel grey')).toBe('Steel Grey');
    expect(canonicalCoatColorName(' STANDARD BAY ')).toBe('Standard Bay');
    expect(canonicalCoatColorName('steel gray')).toBeUndefined();
    expect(canonicalCoatColorName('Bay')).toBeUndefined();
    expect(canonicalCoatColorName('Unknown')).toBeUndefined();
    expect(canonicalCoatColorName(['Standard Bay'])).toBeUndefined();
  });
});
