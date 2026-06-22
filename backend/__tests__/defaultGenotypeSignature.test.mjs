/**
 * defaultGenotypeSignature.test.mjs (Equoria-kfgep)
 *
 * Unit coverage for the shared isDefaultSignature predicate extracted from
 * seed-breed-genetic-profile.mjs and recolor-starter-horses.mjs. NO MOCKS — the
 * function is pure (genotype map in, boolean out), so this is a real-logic unit
 * test with no DB.
 *
 * The predicate scopes destructive recolor/re-roll writes (CLAUDE.md Rule 2):
 * only a TRUE all-default ("minted-before-color-system") signature returns true;
 * any genotype carrying real/customized color must return false so it is left
 * untouched.
 */

import { describe, it, expect } from '@jest/globals';
import { isDefaultSignature, SIGNATURE_OPTIONAL_LOCI } from '../utils/defaultGenotypeSignature.mjs';
import { GENERIC_DEFAULTS } from '../modules/horses/index.mjs';

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

describe('isDefaultSignature (Equoria-kfgep — shared helper)', () => {
  it('returns true for an exact full GENERIC_DEFAULTS genotype', () => {
    expect(isDefaultSignature({ ...GENERIC_DEFAULTS })).toBe(true);
  });

  it('returns true for the legacy 17-locus all-Bay starter signature', () => {
    expect(isDefaultSignature(LEGACY_ALL_BAY)).toBe(true);
  });

  it('is insensitive to JSONB key ordering', () => {
    const reversed = Object.fromEntries(Object.entries(LEGACY_ALL_BAY).reverse());
    expect(isDefaultSignature(reversed)).toBe(true);
  });

  it('SENTINEL: a single real-color locus disqualifies (customization preserved)', () => {
    expect(isDefaultSignature({ ...LEGACY_ALL_BAY, E_Extension: 'e/e' })).toBe(false); // chestnut
    expect(isDefaultSignature({ ...LEGACY_ALL_BAY, Cr_Cream: 'Cr/n' })).toBe(false); // buckskin
    expect(isDefaultSignature({ ...LEGACY_ALL_BAY, G_Gray: 'G/g' })).toBe(false); // gray
  });

  it('SENTINEL: a missing REQUIRED (non-optional) locus disqualifies', () => {
    const missingRequired = { ...LEGACY_ALL_BAY };
    delete missingRequired.A_Agouti; // A_Agouti is not in SIGNATURE_OPTIONAL_LOCI
    expect(isDefaultSignature(missingRequired)).toBe(false);
  });

  it('treats a MISSING optional locus (Prl_Pearl / BR1_Brindle1) as default', () => {
    // Build a genotype that includes the optional loci at their default, then
    // drop them — a legacy row would simply omit them. The helper must still
    // accept it as default (wild-type 'n/n' = no expression).
    // Equoria-26qjf.1 added Prl_Pearl/BR1_Brindle1 to GENERIC_DEFAULTS with
    // wild-type 'n/n' defaults. A row that includes them at their default value
    // (post-.1 row) is still default; a legacy row missing the keys entirely
    // (predates .1) is tolerated as default by SIGNATURE_OPTIONAL_LOCI carve-out.
    const withOptionalAtDefault = {
      ...LEGACY_ALL_BAY,
      Prl_Pearl: 'n/n',
      BR1_Brindle1: 'n/n',
    };
    expect(isDefaultSignature(withOptionalAtDefault)).toBe(true);

    const withoutOptional = { ...LEGACY_ALL_BAY };
    delete withoutOptional.Prl_Pearl;
    delete withoutOptional.BR1_Brindle1;
    expect(isDefaultSignature(withoutOptional)).toBe(true);
  });

  it('SENTINEL: a non-default value on an optional locus disqualifies (Equoria-26qjf.1 landed Prl/BR1 into GENERIC_DEFAULTS)', () => {
    // Equoria-26qjf.1 added Prl_Pearl and BR1_Brindle1 to GENERIC_DEFAULTS with
    // wild-type 'n/n' defaults. The SIGNATURE_OPTIONAL_LOCI carve-out tolerates
    // a MISSING optional locus (legacy rows predate the loci), but a PRESENT
    // non-default value goes through the normal loop and disqualifies — exactly
    // the Equoria-3x7j3 follow-up scenario, now resolved by .1 landing. A real
    // Prl/BR1-carrying horse is no longer "default" and is preserved by the
    // destructive recolor.
    expect(isDefaultSignature({ ...LEGACY_ALL_BAY, Prl_Pearl: 'Prl/prl' })).toBe(false);
    expect(isDefaultSignature({ ...LEGACY_ALL_BAY, BR1_Brindle1: 'br1/n' })).toBe(false);
  });

  it('returns false for null / undefined / non-object / array inputs', () => {
    expect(isDefaultSignature(null)).toBe(false);
    expect(isDefaultSignature(undefined)).toBe(false);
    expect(isDefaultSignature('E/e')).toBe(false);
    expect(isDefaultSignature(42)).toBe(false);
    expect(isDefaultSignature([])).toBe(false);
    expect(isDefaultSignature(['E/e'])).toBe(false);
  });

  it('exposes the optional-loci carve-out set for documentation/consumers', () => {
    expect(SIGNATURE_OPTIONAL_LOCI.has('Prl_Pearl')).toBe(true);
    expect(SIGNATURE_OPTIONAL_LOCI.has('BR1_Brindle1')).toBe(true);
    expect(SIGNATURE_OPTIONAL_LOCI.has('E_Extension')).toBe(false);
  });
});
