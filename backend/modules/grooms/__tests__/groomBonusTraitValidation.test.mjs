/**
 * Pure-export unit tests for (was backend/__tests__/groomAndLegacyPureExports.test.mjs;
 * Equoria-7t1tn moved it here once only grooms code remained in it):
 *  - groomBonusTraitService (validateBonusTraits)
 *
 * Equoria-58xq6: the legacy-score calculators (getLegacyScoreDefinitions,
 * getTraitScoringDefinitions) were deleted with their last consumer, GET
 * /horses/:id/legacy-score (owner ruling q242), and so were their tests here.
 */

import { describe, it, expect } from '@jest/globals';

import { validateBonusTraits } from '../services/groomBonusTraitService.mjs';

// Owner ruling 2026-10-28 q154 (Equoria-4fa7s): a show handler is the horse's
// groom and any groom may handle in any class. Old contract: groomHandlerService's
// bonus tables and calculateHandlerBonus judged a groom per conformation class
// and priced per-discipline handler bonuses; they were removed with that
// ruling, and so were their tests here.

// ─── validateBonusTraits ─────────────────────────────────────────────────────

describe('validateBonusTraits', () => {
  it('returns valid=true for an empty object', () => {
    const result = validateBonusTraits({});
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid=true for a single valid trait bonus', () => {
    const result = validateBonusTraits({ speed: 0.1 });
    expect(result.valid).toBe(true);
  });

  it('returns valid=false for null input', () => {
    const result = validateBonusTraits(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns valid=false for non-object input', () => {
    const result = validateBonusTraits('string');
    expect(result.valid).toBe(false);
  });

  it('returns valid=false when more than 3 traits provided', () => {
    const result = validateBonusTraits({
      speed: 0.1,
      stamina: 0.1,
      agility: 0.1,
      boldness: 0.1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Maximum'))).toBe(true);
  });

  it('returns valid=false for a non-numeric bonus value', () => {
    const result = validateBonusTraits({ speed: 'fast' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('must be a number'))).toBe(true);
  });

  it('returns valid=false for bonus above 0.3 (MAX_TRAIT_BONUS)', () => {
    const result = validateBonusTraits({ speed: 0.5 });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('between 0 and'))).toBe(true);
  });

  it('returns valid=false for negative bonus', () => {
    const result = validateBonusTraits({ speed: -0.1 });
    expect(result.valid).toBe(false);
  });

  it('returns valid=true for bonus at boundary 0', () => {
    const result = validateBonusTraits({ speed: 0 });
    expect(result.valid).toBe(true);
  });

  it('returns valid=true for bonus at boundary 0.3', () => {
    const result = validateBonusTraits({ speed: 0.3 });
    expect(result.valid).toBe(true);
  });
});
