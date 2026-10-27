/**
 * Equoria-bdpvw — trait category never surfaces as a stored word.
 *
 * Old contract: rarity also had authored labels. Owner ruling 2026-10-27 (q112):
 * players never see rarity, so traitRarityLabel was removed with its cases.
 */
import { describe, it, expect } from 'vitest';
import { traitCategoryLabel } from '../traitLabels';

// Values in backend/utils/epigeneticTraits.mjs definitions.
describe('trait labels', () => {
  it.each([
    ['epigenetic', 'Care Trait'],
    ['bond', 'Bond Trait'],
    ['situational', 'Situational Trait'],
  ])('category %s reads %s', (raw, label) => {
    expect(traitCategoryLabel(raw)).toBe(label);
  });

  it('an unknown value never surfaces raw', () => {
    expect(traitCategoryLabel(['some', 'code'].join('_'))).toBe('Trait');
    expect(traitCategoryLabel(undefined)).toBe('Trait');
  });
});
