/**
 * recolorStarterHorses.test.mjs (Equoria-wvdya)
 *
 * Unit coverage for the recolor scoping predicate. NO MOCKS; isDefaultSignature
 * is pure (string-map in, boolean out). The DB-touching run() is guarded behind
 * the direct-invocation check so importing here does not execute the backfill.
 *
 * The scoping guarantee this protects: only TRUE all-default (all-Bay) starter
 * genotypes are recolored; any starter a tester/user already gave real color is
 * left untouched (CLAUDE.md Rule 2 — never overwrite real data).
 */

import { describe, it, expect } from '@jest/globals';
import { isDefaultSignature } from './recolor-starter-horses.mjs';
import { GENERIC_DEFAULTS } from '../modules/horses/services/genotypeGenerationService.mjs';

// The 17-locus all-Bay signature a legacy "First Horse" carries (pre-color-system
// mint: fixed GENERIC_DEFAULTS, missing the .1 Prl/BR1 loci).
const LEGACY_ALL_BAY = {
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

describe('recolor-starter-horses isDefaultSignature (Equoria-wvdya)', () => {
  it('matches the legacy 17-locus all-Bay starter signature (will be recolored)', () => {
    expect(isDefaultSignature(LEGACY_ALL_BAY)).toBe(true);
  });

  it('matches a full current 19-locus default signature', () => {
    expect(isDefaultSignature({ ...GENERIC_DEFAULTS })).toBe(true);
  });

  it('SENTINEL: a starter with real color is NOT recolored (customization preserved)', () => {
    expect(isDefaultSignature({ ...LEGACY_ALL_BAY, E_Extension: 'e/e' })).toBe(false); // chestnut
    expect(isDefaultSignature({ ...LEGACY_ALL_BAY, Cr_Cream: 'Cr/n' })).toBe(false); // buckskin
    expect(isDefaultSignature({ ...LEGACY_ALL_BAY, G_Gray: 'G/g' })).toBe(false); // gray
  });

  it('SENTINEL: a non-default value on a newly-added locus disqualifies', () => {
    expect(isDefaultSignature({ ...LEGACY_ALL_BAY, Prl_Pearl: 'prl/prl' })).toBe(false);
    expect(isDefaultSignature({ ...LEGACY_ALL_BAY, BR1_Brindle1: 'br1/n' })).toBe(false);
  });

  it('returns false for null / non-object / array genotypes', () => {
    expect(isDefaultSignature(null)).toBe(false);
    expect(isDefaultSignature('E/e')).toBe(false);
    expect(isDefaultSignature([])).toBe(false);
  });
});
