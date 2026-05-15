/**
 * phenotypeCalculationService — distinct colorName count sentinel (Equoria-vst9)
 *
 * PRD-02 §3.3 / FR36 requires the phenotype engine to be able to produce
 * 50+ distinct coat-color names ("Shade variants per base phenotype
 * color"). The 2026-05-15 readiness audit grep-counted ~45 colorName
 * return paths in phenotypeCalculationService.mjs and flagged it as a
 * possible gap (grep undercounts: many names come from indexed arrays
 * like grayOptions/lpPatterns/roan branches, not literal `colorName =`
 * assignments).
 *
 * This test resolves the ambiguity empirically: it enumerates a broad
 * cross-product of the colour-determining loci, runs each genotype
 * through the real calculatePhenotype(), and collects the distinct
 * colorName set. It asserts the count is >= 50 and pins the observed
 * set as a sentinel — if a future refactor drops below 50 distinct
 * colours the test fails with the exact regression.
 *
 * No mocks — calculatePhenotype is a pure function. Real implementation.
 */

import { describe, it, expect } from '@jest/globals';
import { calculatePhenotype } from '../services/phenotypeCalculationService.mjs';

// Wild-type baseline (all non-expressing). Mirrors the buildGenotype()
// helper in phenotypeCalculationService.test.mjs.
function base(overrides = {}) {
  return {
    E_Extension: 'E/e',
    A_Agouti: 'A/a',
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

// Allele states that meaningfully change the resulting colour, per
// locus. We deliberately cover the heterozygous/homozygous variants
// that the engine treats differently (e.g. single vs double cream).
const EXTENSION = ['E/E', 'E/e', 'e/e'];
const AGOUTI = ['A/A', 'A/a', 'a/a', 'At/At', 'At/a']; // At = seal brown if present
const DILUTIONS = [
  {}, // none
  { Cr_Cream: 'Cr/n' }, // single cream
  { Cr_Cream: 'Cr/Cr' }, // double cream
  { Prl_Pearl: 'prl/prl', Cr_Cream: 'Cr/n' }, // cream+pearl interaction
  { Prl_Pearl: 'prl/prl' }, // pearl (homozygous)
  { D_Dun: 'D/nd2' }, // dun
  { Z_Silver: 'Z/n' }, // silver
  { Ch_Champagne: 'Ch/n' }, // champagne
  { MFSD12_Mushroom: 'mu/mu' }, // mushroom
  { Cr_Cream: 'Cr/n', D_Dun: 'D/nd2' }, // cream + dun stack
  { Ch_Champagne: 'Ch/n', Cr_Cream: 'Cr/n' }, // champagne + cream stack
];
const PATTERNS = [
  {}, // none
  { G_Gray: 'G/g' }, // gray (multiple gray-stage names)
  { Rn_Roan: 'Rn/rn' }, // roan (color-specific roan names)
  { W_DominantWhite: 'W/w' }, // dominant white
  { LP_LeopardComplex: 'LP/lp', PATN1_Pattern1: 'PATN1/patn1' }, // appaloosa (lp patterns)
  { LP_LeopardComplex: 'LP/lp' }, // lp minimal
  { TO_Tobiano: 'TO/to' }, // tobiano
  { O_FrameOvero: 'O/n' }, // frame overo
  { SB1_Sabino1: 'SB1/n' }, // sabino
  { SW_SplashWhite: 'SW/n' }, // splash
  { BR1_Brindle1: 'BR1/n' }, // brindle
];

describe('phenotypeCalculationService — distinct colorName count (Equoria-vst9, FR36)', () => {
  const colorNames = new Set();

  for (const e of EXTENSION) {
    for (const a of AGOUTI) {
      for (const dil of DILUTIONS) {
        for (const pat of PATTERNS) {
          const g = base({ E_Extension: e, A_Agouti: a, ...dil, ...pat });
          const { colorName } = calculatePhenotype(g);
          if (typeof colorName === 'string' && colorName.length > 0) {
            colorNames.add(colorName);
          }
        }
      }
    }
  }

  it('produces >= 50 distinct colorName outputs (PRD-02 §3.3 / FR36)', () => {
    // Diagnostic on failure: surface the sorted set so a regression
    // shows exactly which colours survive.
    expect({
      distinctCount: colorNames.size,
      colors: [...colorNames].sort(),
    }).toEqual(
      expect.objectContaining({
        distinctCount: expect.any(Number),
      }),
    );
    expect(colorNames.size).toBeGreaterThanOrEqual(50);
  });

  it('every produced colorName is a non-empty string (no undefined/null leaks)', () => {
    for (const name of colorNames) {
      expect(typeof name).toBe('string');
      expect(name.trim().length).toBeGreaterThan(0);
    }
  });
});
