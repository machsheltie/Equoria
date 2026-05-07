/**
 * personalityModifierEngine — unit tests (Equoria-rr7)
 *
 * Pure functions: applyPersonalityEffectsToMilestone, calculateTraitDevelopmentBonus,
 * getPersonalityEffectPreview. Depends only on groomPersonalityTraitBonus (pure).
 */

import { describe, it, expect } from '@jest/globals';
import {
  applyPersonalityEffectsToMilestone,
  calculateTraitDevelopmentBonus,
  getPersonalityEffectPreview,
} from '../../utils/personalityModifierEngine.mjs';

// Valid types from groomPersonalityTraitBonus — Calm groom is ideal for Nervous/Spirited foals
const MATCH_GROOM = 'Calm';
const MATCH_FOAL = 'Nervous';
const MISMATCH_GROOM = 'Assertive';
const MISMATCH_FOAL = 'Nervous';

// ---------------------------------------------------------------------------
// applyPersonalityEffectsToMilestone
// ---------------------------------------------------------------------------
describe('applyPersonalityEffectsToMilestone', () => {
  it('returns original values when groomPersonality is missing', () => {
    const result = applyPersonalityEffectsToMilestone({
      groomPersonality: null,
      foalTemperament: MATCH_FOAL,
      baseMilestoneScore: 5,
      baseStressLevel: 10,
      baseBondingRate: 2,
    });
    expect(result.modifiedMilestoneScore).toBe(5);
    expect(result.modifiedStressLevel).toBe(10);
    expect(result.modifiedBondingRate).toBe(2);
    expect(result.personalityEffectApplied).toBe(false);
  });

  it('returns original values when foalTemperament is missing', () => {
    const result = applyPersonalityEffectsToMilestone({
      groomPersonality: MATCH_GROOM,
      foalTemperament: null,
      baseMilestoneScore: 5,
    });
    expect(result.personalityEffectApplied).toBe(false);
  });

  it('applies personality effects and sets personalityEffectApplied=true', () => {
    const result = applyPersonalityEffectsToMilestone({
      groomPersonality: MATCH_GROOM,
      foalTemperament: MATCH_FOAL,
      bondScore: 50,
      baseMilestoneScore: 3,
      baseStressLevel: 20,
      baseBondingRate: 1,
    });
    expect(result.personalityEffectApplied).toBe(true);
    expect(result).toHaveProperty('modifiedMilestoneScore');
    expect(result).toHaveProperty('modifiedStressLevel');
    expect(result).toHaveProperty('modifiedBondingRate');
  });

  it('modified stress level is non-negative', () => {
    const result = applyPersonalityEffectsToMilestone({
      groomPersonality: MATCH_GROOM,
      foalTemperament: MATCH_FOAL,
      bondScore: 100,
      baseMilestoneScore: 0,
      baseStressLevel: 5,
      baseBondingRate: 0,
    });
    expect(result.modifiedStressLevel).toBeGreaterThanOrEqual(0);
  });

  it('returns result with effects shape including isMatch/isStrongMatch', () => {
    const result = applyPersonalityEffectsToMilestone({
      groomPersonality: MATCH_GROOM,
      foalTemperament: MATCH_FOAL,
      bondScore: 50,
      baseMilestoneScore: 5,
      baseStressLevel: 10,
      baseBondingRate: 2,
    });
    expect(result.effects).toHaveProperty('milestoneScoreChange');
    expect(result.effects).toHaveProperty('stressReduction');
    expect(result.effects).toHaveProperty('bondingRateChange');
    expect(typeof result.effects.isMatch).toBe('boolean');
    expect(typeof result.effects.isStrongMatch).toBe('boolean');
  });

  it('passes base scores through when params is default (no-op return on null personality)', () => {
    const result = applyPersonalityEffectsToMilestone({
      groomPersonality: '',
      foalTemperament: MATCH_FOAL,
      baseMilestoneScore: 7,
      baseStressLevel: 3,
      baseBondingRate: 1,
    });
    expect(result.baseMilestoneScore).toBe(7);
    expect(result.baseStressLevel).toBe(3);
    expect(result.baseBondingRate).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// calculateTraitDevelopmentBonus
// ---------------------------------------------------------------------------
describe('calculateTraitDevelopmentBonus', () => {
  it('returns a traitModifier of +1 or +2 for a matching pair', () => {
    const result = calculateTraitDevelopmentBonus({
      groomPersonality: MATCH_GROOM,
      foalTemperament: MATCH_FOAL,
      bondScore: 50,
      baseMilestoneScore: 0,
    });
    expect(result.traitModifier).toBeGreaterThanOrEqual(1);
    expect(result.personalityEffectApplied).toBe(true);
  });

  it('returns a traitModifier of -1 for a mismatch', () => {
    const result = calculateTraitDevelopmentBonus({
      groomPersonality: MISMATCH_GROOM,
      foalTemperament: MISMATCH_FOAL,
      bondScore: 0,
      baseMilestoneScore: 0,
    });
    expect(result.traitModifier).toBe(-1);
  });

  it('assigns positive trait when finalScore >= 3', () => {
    const result = calculateTraitDevelopmentBonus({
      groomPersonality: MATCH_GROOM,
      foalTemperament: MATCH_FOAL,
      bondScore: 100,
      baseMilestoneScore: 5,
    });
    // finalScore = 5 + traitModifier (>=1) → >=6, which is >= 3
    expect(result.finalTraitAssignment).toBe('positive');
  });

  it('assigns negative trait when finalScore <= -3', () => {
    const result = calculateTraitDevelopmentBonus({
      groomPersonality: MISMATCH_GROOM,
      foalTemperament: MISMATCH_FOAL,
      bondScore: 0,
      baseMilestoneScore: -10,
    });
    // finalScore = -10 + (-1) = -11, which is <= -3
    expect(result.finalTraitAssignment).toBe('negative');
  });

  it('assigns randomized when score is between -2 and 2', () => {
    const result = calculateTraitDevelopmentBonus({
      groomPersonality: MISMATCH_GROOM,
      foalTemperament: MISMATCH_FOAL,
      bondScore: 0,
      baseMilestoneScore: 0, // 0 + (-1) = -1, in [-2, 2]
    });
    expect(result.finalTraitAssignment).toBe('randomized');
  });

  it('includes personalityCompatibility in result', () => {
    const result = calculateTraitDevelopmentBonus({
      groomPersonality: MATCH_GROOM,
      foalTemperament: MATCH_FOAL,
      bondScore: 50,
      baseMilestoneScore: 0,
    });
    expect(result.personalityCompatibility).toBeDefined();
  });

  it('returns graceful fallback on error (empty personality)', () => {
    const result = calculateTraitDevelopmentBonus({
      groomPersonality: '',
      foalTemperament: '',
      bondScore: 0,
      baseMilestoneScore: 3,
    });
    // calculatePersonalityCompatibility with unknown types may throw or return default
    expect(result).toHaveProperty('traitModifier');
    expect(result).toHaveProperty('finalTraitAssignment');
  });
});

// ---------------------------------------------------------------------------
// getPersonalityEffectPreview
// ---------------------------------------------------------------------------
describe('getPersonalityEffectPreview', () => {
  it('returns expected shape', () => {
    const preview = getPersonalityEffectPreview(MATCH_GROOM, MATCH_FOAL, 50);
    expect(preview).toHaveProperty('isCompatible');
    expect(preview).toHaveProperty('compatibilityLevel');
    expect(preview).toHaveProperty('traitBonus');
    expect(preview).toHaveProperty('stressReduction');
    expect(preview).toHaveProperty('bondingBonus');
    expect(preview).toHaveProperty('description');
    expect(preview).toHaveProperty('recommendation');
  });

  it('isCompatible is true for matching pair', () => {
    const preview = getPersonalityEffectPreview(MATCH_GROOM, MATCH_FOAL, 50);
    expect(preview.isCompatible).toBe(true);
  });

  it('compatibilityLevel is strong for very good match with high bond', () => {
    const preview = getPersonalityEffectPreview(MATCH_GROOM, MATCH_FOAL, 100);
    expect(['strong', 'good']).toContain(preview.compatibilityLevel);
  });

  it('compatibilityLevel is poor for mismatch', () => {
    const preview = getPersonalityEffectPreview(MISMATCH_GROOM, MISMATCH_FOAL, 0);
    expect(preview.compatibilityLevel).toBe('poor');
  });

  it('stressReduction is a non-negative number', () => {
    const preview = getPersonalityEffectPreview(MATCH_GROOM, MATCH_FOAL, 50);
    expect(typeof preview.stressReduction).toBe('number');
    expect(preview.stressReduction).toBeGreaterThanOrEqual(0);
  });

  it('returns unknown-compatibility fallback on error (empty personality)', () => {
    const preview = getPersonalityEffectPreview('', '', 0);
    expect(preview).toHaveProperty('compatibilityLevel');
  });
});
