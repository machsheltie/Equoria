/**
 * coatColorNames — every coat color in the game (Equoria-merxy).
 *
 * Owner ruling 2026-10-28 (q190): the Marketplace color filter is a dropdown of
 * every coat color in the game, spelled the US way. The list must hold every
 * colorName calculatePhenotype can give a horse, and nothing else.
 */
import { describe, it, expect } from '@jest/globals';
import { calculatePhenotype } from '../services/phenotypeCalculationService.mjs';
import { canonicalCoatColorName, coatColorNames } from '../services/coatColorNames.mjs';

// Every allele spelling each locus is read with, including the alternate orders.
const loci = {
  E_Extension: ['E/E', 'E/e', 'e/e'],
  A_Agouti: ['A/A', 'A/a', 'At/At', 'At/a', 'a/a'],
  EDXW: ['n/n', 'EDXW1/n'],
  Cr_Cream: ['n/n', 'Cr/n', 'n/Cr', 'Cr/Cr'],
  D_Dun: ['nd2/nd2', 'nd1/nd1', 'nd1/nd2', 'D/nd2', 'D/D'],
  Z_Silver: ['n/n', 'Z/n', 'Z/Z'],
  Ch_Champagne: ['n/n', 'Ch/n', 'Ch/Ch'],
  Prl_Pearl: ['n/n', 'prl/n', 'n/prl', 'prl/prl'],
  MFSD12_Mushroom: ['N/N', 'M/N', 'M/M'],
  Rn_Roan: ['rn/rn', 'Rn/rn'],
  G_Gray: ['g/g', 'G/g'],
  LP_LeopardComplex: ['lp/lp', 'LP/lp'],
  PATN1_Pattern1: ['patn1/patn1', 'PATN1/patn1'],
  W_DominantWhite: ['w/w', 'W20/w'],
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

  it('uses US spelling: gray, never grey', () => {
    expect(coatColorNames).toEqual(expect.arrayContaining(['Gray', 'Steel Gray', 'Fleabitten Gray']));
    expect(coatColorNames.filter(name => /grey|colour/i.test(name))).toEqual([]);
  });

  it('canonicalCoatColorName gives the list spelling for any case, and undefined otherwise', () => {
    expect(canonicalCoatColorName('steel gray')).toBe('Steel Gray');
    expect(canonicalCoatColorName(' BAY ')).toBe('Bay');
    expect(canonicalCoatColorName('grey')).toBeUndefined();
    expect(canonicalCoatColorName('Unknown')).toBeUndefined();
    expect(canonicalCoatColorName(['Bay'])).toBeUndefined();
  });
});
