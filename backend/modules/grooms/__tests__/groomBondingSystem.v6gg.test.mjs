/**
 * groomBondingSystem — age-unit regression test (Equoria-v6gg)
 *
 * After Equoria-son6, Horse.age stores game-years (1 real week = 1 game year).
 * Before this fix, getEligibleTasksForAge / getAgeGroupDescription /
 * validateGroomingEligibility all treated horse.age as days and divided by 7
 * internally — so a 7-year-old (horse.age=7) was treated as 1 year and only
 * got foal tasks; a 5-year-old (horse.age=5) failed the
 * `horse.age < minAgeInDays (7*0=0)` boundary inconsistently.
 *
 * Sentinel test: a 7-year-old horse must receive ADULT general grooming tasks
 * (e.g. 'brushing'), not foal-only enrichment tasks. With the buggy /7 divide
 * the same call returned only foal tasks.
 *
 * No DB needed — these are pure helpers.
 */

import {
  getEligibleTasksForAge,
  getAgeGroupDescription,
  validateGroomingEligibility,
} from '../../../utils/groomBondingSystem.mjs';
import { GROOM_CONFIG } from '../../../config/groomConfig.mjs';

describe('groomBondingSystem — game-year age units (Equoria-v6gg)', () => {
  describe('getEligibleTasksForAge', () => {
    it('7-year-old (horse.age=7) gets adult general grooming tasks, not foal-only', () => {
      // Pre-fix: ageInDays=7 → ageInYears=1.0 → fell into the foal-grooming
      //          range (1..3) and the general-grooming threshold (>=3) was
      //          NOT crossed. Result: no general grooming tasks.
      // Post-fix: ageInYears=7 → crosses GENERAL_GROOMING_MIN_AGE (3) →
      //          all task types included.
      const tasks = getEligibleTasksForAge(7);
      expect(tasks).toEqual(expect.arrayContaining(GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS));
    });

    it('newborn (age=0 years) receives enrichment tasks but not general grooming', () => {
      const tasks = getEligibleTasksForAge(0);
      expect(tasks).toEqual(expect.arrayContaining(GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS));
      expect(tasks.some(t => GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS.includes(t))).toBe(false);
    });

    it('3-year-old (boundary) crosses the general grooming threshold', () => {
      const tasks = getEligibleTasksForAge(3);
      expect(tasks).toEqual(expect.arrayContaining(GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS));
    });
  });

  describe('getAgeGroupDescription', () => {
    it('age=0 years → young foal (0-2 years)', () => {
      expect(getAgeGroupDescription(0)).toBe('young foal (0-2 years)');
    });

    it('age=2 years (boundary) → young foal', () => {
      expect(getAgeGroupDescription(2)).toBe('young foal (0-2 years)');
    });

    it('age=3 years → foal (1-3 years, upper boundary)', () => {
      expect(getAgeGroupDescription(3)).toBe('foal (1-3 years)');
    });

    it('age=7 years → adult horse (3+ years), not "young foal"', () => {
      // Pre-fix: ageInDays=7 → ageInYears=1.0 → "young foal (0-2 years)".
      // Post-fix: ageInYears=7 → "adult horse (3+ years)".
      expect(getAgeGroupDescription(7)).toBe('adult horse (3+ years)');
    });
  });

  describe('validateGroomingEligibility', () => {
    it('7-year-old can perform a general grooming task (brushing)', async () => {
      const horse = { id: 1, age: 7, healthStatus: 'Good' };
      const result = await validateGroomingEligibility(horse, GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS[0]);
      expect(result.eligible).toBe(true);
      expect(result.ageGroup).toBe('adult horse (3+ years)');
    });

    it('age=0 (newborn) is eligible for enrichment but not general grooming', async () => {
      const horse = { id: 2, age: 0, healthStatus: 'Good' };
      const enrichmentResult = await validateGroomingEligibility(horse, GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS[0]);
      expect(enrichmentResult.eligible).toBe(true);

      const generalResult = await validateGroomingEligibility(horse, GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS[0]);
      // General grooming task not in newborn's eligible list.
      expect(generalResult.eligible).toBe(false);
    });
  });
});
