/**
 * seedBreedGeneticProfile.test.mjs (Equoria-26qjf.5)
 *
 * Unit coverage for isDefaultSignature — the predicate that decides which horses
 * the post-import re-roll touches. NO MOCKS; the function is pure (string-map in,
 * boolean out). The DB-touching main() is guarded behind the direct-invocation
 * check so importing this module here does not run the re-roll.
 *
 * The critical case (Equoria-26qjf.1 interaction): legacy default-signature
 * horses were minted with the OLD 17-locus GENERIC_DEFAULTS and therefore LACK
 * the Prl_Pearl / BR1_Brindle1 keys added in .1. They must still be recognized
 * as default-signature so .5 re-rolls them — otherwise the .1 change silently
 * orphans the exact population this story exists to fix.
 */

import { describe, it, expect } from '@jest/globals';
// Equoria-kfgep: isDefaultSignature was extracted from the seed script into a
// shared helper module — import from there.
import { isDefaultSignature } from '../utils/defaultGenotypeSignature.mjs';
import { GENERIC_DEFAULTS } from '../modules/horses/services/genotypeGenerationService.mjs';

// The original 17-locus GENERIC_DEFAULTS set, BEFORE Prl_Pearl/BR1_Brindle1 were
// added in 26qjf.1. A legacy starter horse's stored genotype looks like this.
const LEGACY_17_DEFAULT = {
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
};

describe('isDefaultSignature (Equoria-26qjf.5)', () => {
  it('recognizes a full current (19-locus) default genotype', () => {
    expect(isDefaultSignature({ ...GENERIC_DEFAULTS })).toBe(true);
  });

  it('CRITICAL: recognizes a legacy 17-locus default genotype missing Prl_Pearl/BR1_Brindle1', () => {
    // This is the population 26qjf.5 must re-roll. The .1 GENERIC_DEFAULTS growth
    // must NOT cause these to read as non-default.
    expect(LEGACY_17_DEFAULT.Prl_Pearl).toBeUndefined();
    expect(LEGACY_17_DEFAULT.BR1_Brindle1).toBeUndefined();
    expect(isDefaultSignature(LEGACY_17_DEFAULT)).toBe(true);
  });

  it('recognizes a legacy genotype that explicitly has wild-type Prl/BR1', () => {
    expect(isDefaultSignature({ ...LEGACY_17_DEFAULT, Prl_Pearl: 'n/n', BR1_Brindle1: 'n/n' })).toBe(
      true,
    );
  });

  it('SENTINEL: a non-default value at any locus disqualifies (customization preserved)', () => {
    // A horse with a real, non-default color must NOT be re-rolled.
    expect(isDefaultSignature({ ...GENERIC_DEFAULTS, E_Extension: 'e/e' })).toBe(false);
    expect(isDefaultSignature({ ...LEGACY_17_DEFAULT, Cr_Cream: 'Cr/n' })).toBe(false);
  });

  it('SENTINEL: a non-default value on a newly-added locus disqualifies', () => {
    // A Pearl carrier is real color data, not a backfill default.
    expect(isDefaultSignature({ ...LEGACY_17_DEFAULT, Prl_Pearl: 'prl/prl' })).toBe(false);
    expect(isDefaultSignature({ ...LEGACY_17_DEFAULT, BR1_Brindle1: 'br1/n' })).toBe(false);
  });

  it('returns false for null / non-object / array genotypes', () => {
    expect(isDefaultSignature(null)).toBe(false);
    expect(isDefaultSignature(undefined)).toBe(false);
    expect(isDefaultSignature('E/e')).toBe(false);
    expect(isDefaultSignature([])).toBe(false);
  });

  it('returns false when a NON-optional locus is missing (incomplete genotype is not default)', () => {
    const missingCore = { ...LEGACY_17_DEFAULT };
    delete missingCore.E_Extension;
    expect(isDefaultSignature(missingCore)).toBe(false);
  });
});
