/**
 * bondingModifiers — unit tests (Equoria-rr7)
 *
 * Pure functions, no DB required. Uses in-memory horse objects.
 */

import { describe, it, expect } from '@jest/globals';
import { calculateBondingChange, applyBondingChange, getBondingEfficiency } from '../../utils/bondingModifiers.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const noTraitHorse = (overrides = {}) => ({
  id: 1,
  bondScore: 50,
  epigeneticModifiers: { positive: [], negative: [], hidden: [] },
  ...overrides,
});

const horseWithTraits = (positive = [], negative = []) => ({
  id: 2,
  bondScore: 50,
  epigeneticModifiers: { positive, negative, hidden: [] },
});

// ---------------------------------------------------------------------------
// calculateBondingChange
// ---------------------------------------------------------------------------
describe('calculateBondingChange', () => {
  it('returns result with expected shape', () => {
    const result = calculateBondingChange(noTraitHorse(), 'grooming');
    expect(result).toHaveProperty('originalChange');
    expect(result).toHaveProperty('modifiedChange');
    expect(result).toHaveProperty('traitModifier');
    expect(result).toHaveProperty('appliedTraits');
    expect(result).toHaveProperty('activity');
  });

  it('grooming with 30min duration returns positive bonding change', () => {
    const result = calculateBondingChange(noTraitHorse(), 'grooming', { duration: 30 });
    // baseChange=2 + 30*0.5 = 17
    expect(result.modifiedChange).toBeGreaterThan(0);
    expect(result.originalChange).toBeGreaterThan(0);
  });

  it('grooming with longer duration gives more bonding', () => {
    const short = calculateBondingChange(noTraitHorse(), 'grooming', { duration: 30 });
    const long = calculateBondingChange(noTraitHorse(), 'grooming', { duration: 60 });
    expect(long.modifiedChange).toBeGreaterThan(short.modifiedChange);
  });

  it('training success=true gives more bonding than success=false', () => {
    const success = calculateBondingChange(noTraitHorse(), 'training', { success: true });
    const fail = calculateBondingChange(noTraitHorse(), 'training', { success: false });
    expect(success.modifiedChange).toBeGreaterThan(fail.modifiedChange);
  });

  it('competition 1st place gives more bonding than 3rd place', () => {
    const first = calculateBondingChange(noTraitHorse(), 'competition', { placement: '1st' });
    const third = calculateBondingChange(noTraitHorse(), 'competition', { placement: '3rd' });
    expect(first.modifiedChange).toBeGreaterThan(third.modifiedChange);
  });

  it('feeding with quality 100 gives more bonding than quality 0', () => {
    const high = calculateBondingChange(noTraitHorse(), 'feeding', { feedQuality: 100 });
    const low = calculateBondingChange(noTraitHorse(), 'feeding', { feedQuality: 0 });
    expect(high.modifiedChange).toBeGreaterThan(low.modifiedChange);
  });

  it('interaction uses duration multiplier', () => {
    const short = calculateBondingChange(noTraitHorse(), 'interaction', { duration: 15 });
    const long = calculateBondingChange(noTraitHorse(), 'interaction', { duration: 60 });
    expect(long.modifiedChange).toBeGreaterThan(short.modifiedChange);
  });

  it('unknown activity returns error result', () => {
    const result = calculateBondingChange(noTraitHorse(), 'dancing');
    expect(result.error).toBeDefined();
    expect(result.modifiedChange).toBe(0);
  });

  it('calm trait increases bonding via bondingBonus', () => {
    const withCalm = horseWithTraits(['calm']);
    const without = horseWithTraits([]);
    const calmResult = calculateBondingChange(withCalm, 'grooming', { duration: 30 });
    const baseResult = calculateBondingChange(without, 'grooming', { duration: 30 });
    expect(calmResult.modifiedChange).toBeGreaterThan(baseResult.modifiedChange);
  });

  it('traitModifier reflects trait bonus', () => {
    const withCalm = horseWithTraits(['calm']);
    const result = calculateBondingChange(withCalm, 'grooming', { duration: 30 });
    expect(result.traitModifier).toBeGreaterThan(1);
  });

  it('traitModifier is 1 for no-trait horse', () => {
    const result = calculateBondingChange(noTraitHorse(), 'grooming', { duration: 30 });
    expect(result.traitModifier).toBe(1);
  });

  it('bonding change is capped at maxPerSession', () => {
    // grooming maxPerSession: 50
    const result = calculateBondingChange(noTraitHorse(), 'grooming', { duration: 10000 });
    expect(result.modifiedChange).toBeLessThanOrEqual(50);
  });

  it('bonding change is never negative', () => {
    const result = calculateBondingChange(noTraitHorse(), 'feeding', { feedQuality: 0 });
    expect(result.modifiedChange).toBeGreaterThanOrEqual(0);
  });

  it('missing epigeneticModifiers field handled gracefully', () => {
    const horse = { id: 3, bondScore: 50 };
    const result = calculateBondingChange(horse, 'grooming', { duration: 30 });
    expect(result.modifiedChange).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// applyBondingChange
// ---------------------------------------------------------------------------
describe('applyBondingChange', () => {
  it('returns success true with oldBondScore and newBondScore', () => {
    const result = applyBondingChange(noTraitHorse(), 'grooming', { duration: 30 });
    expect(result.success).toBe(true);
    expect(typeof result.oldBondScore).toBe('number');
    expect(typeof result.newBondScore).toBe('number');
  });

  it('newBondScore is greater than oldBondScore after positive bonding', () => {
    const horse = noTraitHorse({ bondScore: 50 });
    const result = applyBondingChange(horse, 'grooming', { duration: 30 });
    expect(result.newBondScore).toBeGreaterThan(result.oldBondScore);
  });

  it('newBondScore is capped at 100', () => {
    const horse = noTraitHorse({ bondScore: 99 });
    const result = applyBondingChange(horse, 'competition', { placement: '1st' });
    expect(result.newBondScore).toBeLessThanOrEqual(100);
  });

  it('newBondScore is at least 0', () => {
    const horse = noTraitHorse({ bondScore: 0 });
    const result = applyBondingChange(horse, 'training', { success: false });
    expect(result.newBondScore).toBeGreaterThanOrEqual(0);
  });

  it('returns zero bondingChange for unknown activity (error absorbed)', () => {
    const result = applyBondingChange(noTraitHorse(), 'dancing');
    // calculateBondingChange absorbs the error and returns modifiedChange=0
    // applyBondingChange therefore returns success:true with no net change
    expect(result.bondingChange).toBe(0);
    expect(result.newBondScore).toBe(result.oldBondScore);
  });

  it('uses horse.bondScore as oldBondScore', () => {
    const horse = noTraitHorse({ bondScore: 73 });
    const result = applyBondingChange(horse, 'grooming', { duration: 30 });
    expect(result.oldBondScore).toBe(73);
  });
});

// ---------------------------------------------------------------------------
// getBondingEfficiency
// ---------------------------------------------------------------------------
describe('getBondingEfficiency', () => {
  it('returns an object with efficiency field', () => {
    const result = getBondingEfficiency(noTraitHorse());
    expect(result).toHaveProperty('efficiency');
    expect(typeof result.efficiency).toBe('number');
  });

  it('base efficiency is 1.0 for horse with no traits', () => {
    const result = getBondingEfficiency(noTraitHorse());
    expect(result.efficiency).toBe(1.0);
  });

  it('calm trait increases efficiency above 1.0', () => {
    const horse = horseWithTraits(['calm']);
    const result = getBondingEfficiency(horse);
    expect(result.efficiency).toBeGreaterThan(1.0);
  });

  it('returns modifiers array', () => {
    const result = getBondingEfficiency(noTraitHorse());
    expect(result).toHaveProperty('modifiers');
    expect(Array.isArray(result.modifiers)).toBe(true);
  });

  it('handles horse without epigeneticModifiers', () => {
    const result = getBondingEfficiency({ id: 5 });
    expect(result.efficiency).toBeDefined();
    expect(result.efficiency).toBe(1.0);
  });
});
