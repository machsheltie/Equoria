/**
 * Equoria-2nacc: every age gate reads the one horse age policy.
 *
 * Owner rulings 2026-10-07 / 2026-10-23: the active ages are 3-20 inclusive for
 * training, competition and breeding; 21 is retirement. The single source is
 * constants/horseAgePolicy.mjs. These tests pin each gate's boundary at 20 / 21
 * so a gate with its own copy of the numbers cannot drift again.
 */
import { describe, it, expect } from '@jest/globals';
import { minActiveAgeYears, maxActiveAgeYears, retirementAgeYears } from '../../../constants/horseAgePolicy.mjs';
import { checkAgeRequirements } from '../../../utils/competitionLogic.mjs';
import { MIN_ENTRY_AGE_YEARS, MAX_ENTRY_AGE_YEARS, ageRefusal } from '../../../utils/competitionEntryRules.mjs';
import { minBreedingAgeYears, maxBreedingAgeYears } from '../services/breedingPairRules.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';
import { BREEDING_LIMITS, COMPETITION_LIMITS, TRAINING_LIMITS, isBreedingAge } from '../../../constants/schema.mjs';

describe('the horse age policy (Equoria-2nacc)', () => {
  it('is 3-20 active with retirement at 21', () => {
    expect([minActiveAgeYears, maxActiveAgeYears, retirementAgeYears]).toEqual([3, 20, 21]);
  });

  it('is the window competition entry and breeding use', () => {
    expect([MIN_ENTRY_AGE_YEARS, MAX_ENTRY_AGE_YEARS]).toEqual([minActiveAgeYears, maxActiveAgeYears]);
    expect([minBreedingAgeYears, maxBreedingAgeYears]).toEqual([minActiveAgeYears, maxActiveAgeYears]);
  });

  it('competition entry accepts 3 and 20 and refuses 2 and 21', () => {
    expect(ageRefusal(birthDateForAge(3))).toBeNull();
    expect(ageRefusal(birthDateForAge(20))).toBeNull();
    expect(ageRefusal(birthDateForAge(2))).toBe('AGE_TOO_YOUNG');
    expect(ageRefusal(birthDateForAge(21))).toBe('AGE_TOO_OLD');
  });

  it('checkAgeRequirements accepts 3 and 20 and refuses 2 and 21 (was 3-21)', () => {
    expect(checkAgeRequirements({ age: 3 })).toBe(true);
    expect(checkAgeRequirements({ age: 20 })).toBe(true);
    expect(checkAgeRequirements({ age: 2 })).toBe(false);
    expect(checkAgeRequirements({ age: 21 })).toBe(false);
  });

  it('the schema constants carry the same window, for both sexes (a stallion used to run to 25)', () => {
    expect([TRAINING_LIMITS.MIN_AGE, TRAINING_LIMITS.MAX_AGE]).toEqual([minActiveAgeYears, maxActiveAgeYears]);
    expect([COMPETITION_LIMITS.MIN_AGE, COMPETITION_LIMITS.MAX_AGE]).toEqual([minActiveAgeYears, maxActiveAgeYears]);
    expect([BREEDING_LIMITS.MIN_STALLION_AGE, BREEDING_LIMITS.MAX_STALLION_AGE]).toEqual([
      minActiveAgeYears,
      maxActiveAgeYears,
    ]);
    expect([BREEDING_LIMITS.MIN_MARE_AGE, BREEDING_LIMITS.MAX_MARE_AGE]).toEqual([
      minActiveAgeYears,
      maxActiveAgeYears,
    ]);
    expect(isBreedingAge(20, 'Stallion')).toBe(true);
    expect(isBreedingAge(21, 'Stallion')).toBe(false);
  });
});
