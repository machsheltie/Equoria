/** Equoria-bdpvw — trait rarity and category never surface as stored words. */
import { describe, it, expect } from 'vitest';
import { traitRarityLabel, traitCategoryLabel } from '../traitLabels';

// Values in backend/utils/epigeneticTraits.mjs definitions.
describe('trait labels', () => {
  it.each([
    ['common', 'Common'],
    ['rare', 'Rare'],
    ['legendary', 'Legendary'],
  ])('rarity %s reads %s', (raw, label) => {
    expect(traitRarityLabel(raw)).toBe(label);
  });

  it.each([
    ['epigenetic', 'Care Trait'],
    ['bond', 'Bond Trait'],
    ['situational', 'Situational Trait'],
  ])('category %s reads %s', (raw, label) => {
    expect(traitCategoryLabel(raw)).toBe(label);
  });

  it('an unknown value never surfaces raw', () => {
    expect(traitRarityLabel(['ultra', 'rare'].join('_'))).toBe('Unrecorded');
    expect(traitCategoryLabel(['some', 'code'].join('_'))).toBe('Trait');
    expect(traitCategoryLabel(undefined)).toBe('Trait');
  });
});
