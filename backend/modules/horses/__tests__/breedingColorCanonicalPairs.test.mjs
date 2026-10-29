/**
 * breedingColorCanonicalPairs.test.mjs
 *
 * Foal colour must not depend on which parent carried a gene, or on how a
 * breed file happens to spell an allele pair.
 *
 *   - Equoria-yp4sa (GEN-01): an n/n sire x Z/Z dam foal is Z/n and reads
 *     Silver; every locus comes out in one dominant-first spelling.
 *   - Equoria-i5ah4: a pair spelled the other way round from the breed's
 *     allowedAlleles is still allowed (black x homozygous bay gives bay).
 *   - Equoria-q39od (GEN-02): an e/E foal of an E/e-only breed keeps E/e, and
 *     a replacement for a pair the breed does not allow is built only from
 *     alleles the parents carry.
 *
 * Pure functions, real code, seeded RNG.
 */

import {
  inheritColorGenotype,
  canonicalAllelePair,
  isDisallowedCombination,
  buildDisallowedMap,
} from '../services/breedingColorInheritanceService.mjs';
import { calculatePhenotype } from '../services/phenotypeCalculationService.mjs';
import { seededRng } from '../../../__tests__/helpers/seededRng.mjs';

function buildGenotype(overrides = {}) {
  return {
    E_Extension: 'E/E',
    A_Agouti: 'A/A',
    Cr_Cream: 'n/n',
    D_Dun: 'nd2/nd2',
    Z_Silver: 'n/n',
    Ch_Champagne: 'n/n',
    G_Gray: 'g/g',
    Rn_Roan: 'rn/rn',
    W_DominantWhite: 'w/w',
    TO_Tobiano: 'to/to',
    O_FrameOvero: 'n/n',
    SB1_Sabino1: 'n/n',
    SW_SplashWhite: 'n/n',
    LP_LeopardComplex: 'lp/lp',
    PATN1_Pattern1: 'patn1/patn1',
    EDXW: 'n/n',
    MFSD12_Mushroom: 'N/N',
    Prl_Pearl: 'n/n',
    BR1_Brindle1: 'n/n',
    ...overrides,
  };
}

// Each row: locus, the wild-type parent's pair, the carrier parent's
// homozygous pair, and the single canonical spelling of the foal's pair.
const dominantFirstCases = [
  ['E_Extension', 'e/e', 'E/E', 'E/e'],
  ['A_Agouti', 'a/a', 'A/A', 'A/a'],
  ['Cr_Cream', 'n/n', 'Cr/Cr', 'Cr/n'],
  ['D_Dun', 'nd2/nd2', 'D/D', 'D/nd2'],
  ['Z_Silver', 'n/n', 'Z/Z', 'Z/n'],
  ['Ch_Champagne', 'n/n', 'Ch/Ch', 'Ch/n'],
  ['G_Gray', 'g/g', 'G/G', 'G/g'],
  ['Rn_Roan', 'rn/rn', 'Rn/Rn', 'Rn/rn'],
  ['W_DominantWhite', 'w/w', 'W4/W4', 'W4/w'],
  ['TO_Tobiano', 'to/to', 'TO/TO', 'TO/to'],
  ['O_FrameOvero', 'n/n', 'O/n', 'O/n'],
  ['SB1_Sabino1', 'n/n', 'SB1/SB1', 'SB1/n'],
  ['SW_SplashWhite', 'n/n', 'SW1/SW1', 'SW1/n'],
  ['LP_LeopardComplex', 'lp/lp', 'LP/LP', 'LP/lp'],
  ['PATN1_Pattern1', 'patn1/patn1', 'PATN1/PATN1', 'PATN1/patn1'],
  ['EDXW', 'n/n', 'EDXW1/n', 'EDXW1/n'],
  ['MFSD12_Mushroom', 'N/N', 'M/M', 'M/N'],
  ['Prl_Pearl', 'n/n', 'prl/prl', 'prl/n'],
  ['BR1_Brindle1', 'n/n', 'br1/br1', 'br1/n'],
];

describe('Equoria-yp4sa: foal pairs come out in one canonical order', () => {
  it.each(dominantFirstCases)(
    '%s: the foal pair is the same whichever parent carries the gene',
    (locus, wildPair, carrierPair, expected) => {
      const wildParent = buildGenotype({ [locus]: wildPair });
      const carrierParent = buildGenotype({ [locus]: carrierPair });
      const seen = new Set();
      const rng = seededRng(0x9e01);
      for (let i = 0; i < 200; i++) {
        const heterozygous = [
          inheritColorGenotype(wildParent, carrierParent, null, rng)[locus],
          inheritColorGenotype(carrierParent, wildParent, null, rng)[locus],
        ].filter(pair => pair !== wildPair);
        heterozygous.forEach(pair => seen.add(pair));
      }
      expect([...seen]).toEqual([expected]);
    },
  );

  it('n/n sire x Z/Z dam gives a Silver foal (black base: Silver Black, owner name Equoria-7woyj)', () => {
    const sire = buildGenotype({ A_Agouti: 'a/a', Z_Silver: 'n/n' });
    const dam = buildGenotype({ A_Agouti: 'a/a', Z_Silver: 'Z/Z' });
    const rng = seededRng(0x51);
    for (let i = 0; i < 50; i++) {
      const foal = inheritColorGenotype(sire, dam, null, rng);
      expect(foal.Z_Silver).toBe('Z/n');
      expect(calculatePhenotype(foal).colorName).toBe('Silver Black');
    }
  });

  it('canonicalAllelePair orders A > At > a and keeps homozygous pairs', () => {
    expect(canonicalAllelePair('A_Agouti', 'a/At')).toBe('At/a');
    expect(canonicalAllelePair('A_Agouti', 'At/A')).toBe('A/At');
    expect(canonicalAllelePair('D_Dun', 'nd2/nd1')).toBe('nd1/nd2');
    expect(canonicalAllelePair('W_DominantWhite', 'W4/W4')).toBe('W4/W4');
  });
});

describe('Equoria-i5ah4: the breed whitelist ignores allele order', () => {
  it('black (a/a) sire x homozygous bay (A/A) dam always gives a bay A/a foal', () => {
    const profile = { allowedAlleles: { A_Agouti: ['a/a', 'A/a', 'A/A'] } };
    const sire = buildGenotype({ A_Agouti: 'a/a' });
    const dam = buildGenotype({ A_Agouti: 'A/A' });
    const rng = seededRng(0x15a4);
    for (let i = 0; i < 500; i++) {
      const foal = inheritColorGenotype(sire, dam, profile, rng);
      expect(foal.A_Agouti).toBe('A/a');
      expect(calculatePhenotype(foal).colorName).toBe('Standard Bay');
    }
  });

  it('a breed spelling cream n/Cr still accepts a Cr/n foal', () => {
    const profile = { allowedAlleles: { Cr_Cream: ['n/n', 'n/Cr', 'Cr/Cr'] } };
    const sire = buildGenotype({ E_Extension: 'e/e', Cr_Cream: 'Cr/Cr' });
    const dam = buildGenotype({ E_Extension: 'e/e', Cr_Cream: 'n/n' });
    const foal = inheritColorGenotype(sire, dam, profile, seededRng(7));
    expect(foal.Cr_Cream).toBe('Cr/n');
    expect(calculatePhenotype(foal).colorName).toBe('Classic Palomino');
  });

  it('disallowedCombinations matches either spelling', () => {
    const map = buildDisallowedMap({ disallowedCombinations: { W_DominantWhite: ['W4/W20'] } });
    expect(isDisallowedCombination(map, 'W_DominantWhite', 'W20/W4')).toBe(true);
    expect(isDisallowedCombination(map, 'W_DominantWhite', 'W4/W20')).toBe(true);
  });
});

describe('Equoria-q39od: breed check keeps valid genes and never invents alleles', () => {
  it('an E/e-only breed keeps the E/e foal of an e/e sire x E/E dam (never Chestnut)', () => {
    const profile = { allowedAlleles: { E_Extension: ['E/E', 'E/e'] } };
    const sire = buildGenotype({ E_Extension: 'e/e' });
    const dam = buildGenotype({ E_Extension: 'E/E' });
    const rng = seededRng(0x39);
    for (let i = 0; i < 200; i++) {
      const foal = inheritColorGenotype(sire, dam, profile, rng);
      expect(foal.E_Extension).toBe('E/e');
      expect(calculatePhenotype(foal).colorName).not.toBe('Standard Chestnut');
    }
  });

  it('a pair the breed does not allow is replaced from the parents own alleles', () => {
    // Breed lists A/A first; the parents (A/a x A/a) can also give A/a, which is
    // allowed, so an a/a draw must become A/a or A/A, and both are derivable.
    // The first allowed entry that the parents cannot give (At/At) is never used.
    const profile = { allowedAlleles: { A_Agouti: ['At/At', 'A/a', 'A/A'] } };
    const sire = buildGenotype({ A_Agouti: 'A/a' });
    const dam = buildGenotype({ A_Agouti: 'A/a' });
    const rng = seededRng(0x2a);
    for (let i = 0; i < 400; i++) {
      const foal = inheritColorGenotype(sire, dam, profile, rng);
      expect(['A/a', 'A/A']).toContain(foal.A_Agouti);
    }
  });
});
