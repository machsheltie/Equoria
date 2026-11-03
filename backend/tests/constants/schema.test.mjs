/**
 * 🧪 UNIT TEST: Schema Constants Validation
 *
 * This test validates that all schema constants are properly defined and
 * validation functions work correctly. It ensures consistency across the
 * application by testing the centralized constants.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Horse sex/gender validation
 * - Temperament validation
 * - Health status validation
 * - Competition discipline validation
 * - Groom specialty and skill level validation
 * - Age limit validation for training, competition, and breeding
 * - Score range validation
 * - User progression calculations
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. Constant value integrity
 * 2. Validation function accuracy
 * 3. Age limit enforcement
 * 4. Score range validation
 * 5. XP and level calculations
 * 6. Helper function reliability
 *
 * 🔄 PURE ALGORITHMIC APPROACH:
 * ✅ NO MOCKING: Pure unit tests with no external dependencies
 * ✅ DETERMINISTIC: All tests produce consistent results
 * ✅ ISOLATED: Tests only the constants and validation logic
 *
 * 💡 TEST STRATEGY: Pure unit testing of constants and validation functions
 *    to ensure schema consistency across the application
 */

import { describe, it, expect } from '@jest/globals';
import {
  horseSex,
  horseSexValues,
  horseTemperament,
  horseTemperamentValues,
  DISCIPLINES,
  disciplineValues,
  groomSpecialties,
  groomSpecialtyValues,
  groomSkillLevels,
  horseStats,
  horseStatValues,
  isValidHorseSex,
  isValidTemperament,
  isValidDiscipline,
  isValidGroomSpecialty,
  isValidGroomSkillLevel,
  isValidHorseStat,
  isTrainingAge,
  isCompetitionAge,
  isBreedingAge,
  isValidScore,
  isValidDisciplineScore,
} from '../../constants/schema.mjs';
import { TEMPERAMENTS } from '../../modules/competition/index.mjs';

describe('🏇 UNIT: Schema Constants Validation', () => {
  describe('Horse Sex Constants', () => {
    it('should have all required horse sex values', () => {
      expect(horseSex.STALLION).toBe('Stallion');
      expect(horseSex.MARE).toBe('Mare');
      expect(horseSex.COLT).toBe('Colt');
      expect(horseSex.FILLY).toBe('Filly');
      // Owner ruling 2026-08-19 (Equoria-z92x3): no rigs. Old contract: horseSex.RIG was 'Rig'.
      expect(horseSex).not.toHaveProperty('RIG');
    });

    it('should validate horse sex correctly', () => {
      expect(isValidHorseSex('Stallion')).toBe(true);
      expect(isValidHorseSex('Mare')).toBe(true);
      expect(isValidHorseSex('Invalid')).toBe(false);
      expect(isValidHorseSex('')).toBe(false);
      expect(isValidHorseSex(null)).toBe(false);
    });

    it('should have consistent values array', () => {
      expect(horseSexValues).toContain('Stallion');
      expect(horseSexValues).toContain('Mare');
      expect(horseSexValues).toHaveLength(4);
    });
  });

  describe('Horse Temperament Constants', () => {
    // Owner ruling (Stacey, 2026-10-15/16; Equoria-576c0 B6): the temperaments are
    // the 11 of the owner's competition matrix. Old contract: six values,
    // including 'Docile' and 'Unpredictable', which are not among the 11.
    // Owner ruling 2026-10-21: Playful renamed Driven, Willing added (12 temperaments). Old contract: the 11, with PLAYFUL.
    it("should have exactly the owner's 12 temperaments", () => {
      expect(horseTemperament).toEqual({
        SPIRITED: 'Spirited',
        NERVOUS: 'Nervous',
        CALM: 'Calm',
        BOLD: 'Bold',
        STEADY: 'Steady',
        WILLING: 'Willing',
        INDEPENDENT: 'Independent',
        REACTIVE: 'Reactive',
        STUBBORN: 'Stubborn',
        DRIVEN: 'Driven',
        LAZY: 'Lazy',
        AGGRESSIVE: 'Aggressive',
      });
      expect(horseTemperamentValues).toEqual([...TEMPERAMENTS]);
    });

    it('should validate temperament correctly', () => {
      expect(isValidTemperament('Calm')).toBe(true);
      expect(isValidTemperament('Spirited')).toBe(true);
      expect(isValidTemperament('Bold')).toBe(true);
      expect(isValidTemperament('Docile')).toBe(false);
      expect(isValidTemperament('Unpredictable')).toBe(false);
      expect(isValidTemperament('Invalid')).toBe(false);
    });
  });

  describe('Competition Disciplines', () => {
    it('should have all major disciplines', () => {
      expect(DISCIPLINES.RACING).toBe('Racing');
      expect(DISCIPLINES.SHOW_JUMPING).toBe('Show Jumping');
      expect(DISCIPLINES.DRESSAGE).toBe('Dressage');
      expect(DISCIPLINES.CROSS_COUNTRY).toBe('Cross Country');
      expect(DISCIPLINES.WESTERN_PLEASURE).toBe('Western Pleasure');
    });

    it('should validate disciplines correctly', () => {
      expect(isValidDiscipline('Racing')).toBe(true);
      expect(isValidDiscipline('Show Jumping')).toBe(true);
      expect(isValidDiscipline('Invalid Discipline')).toBe(false);
    });

    it('should have comprehensive discipline list', () => {
      expect(disciplineValues.length).toBeGreaterThanOrEqual(20);
      expect(disciplineValues).toContain('Racing');
      expect(disciplineValues).toContain('Dressage');
      expect(disciplineValues).toContain('Gaited');
    });
  });

  describe('Groom Constants', () => {
    it('should have all groom specialties', () => {
      expect(groomSpecialties.foalCare).toBe('foalCare');
      expect(groomSpecialties.GENERAL).toBe('general');
      expect(groomSpecialties.TRAINING).toBe('training');
      expect(groomSpecialties.MEDICAL).toBe('medical');
    });

    it('should validate groom specialties correctly', () => {
      expect(isValidGroomSpecialty('foalCare')).toBe(true);
      expect(isValidGroomSpecialty('general')).toBe(true);
      expect(isValidGroomSpecialty('invalid')).toBe(false);
    });

    it('should have all skill levels', () => {
      expect(groomSkillLevels.NOVICE).toBe('novice');
      expect(groomSkillLevels.INTERMEDIATE).toBe('intermediate');
      expect(groomSkillLevels.EXPERT).toBe('expert');
      expect(groomSkillLevels.MASTER).toBe('master');
    });

    it('should validate skill levels correctly', () => {
      expect(isValidGroomSkillLevel('novice')).toBe(true);
      expect(isValidGroomSkillLevel('master')).toBe(true);
      expect(isValidGroomSkillLevel('invalid')).toBe(false);
    });
  });

  describe('Age Validation', () => {
    it('should validate training age correctly', () => {
      expect(isTrainingAge(2)).toBe(false); // Too young
      expect(isTrainingAge(3)).toBe(true); // Minimum age
      expect(isTrainingAge(10)).toBe(true); // Valid age
      expect(isTrainingAge(20)).toBe(true); // Maximum age
      expect(isTrainingAge(21)).toBe(false); // Too old
    });

    it('should validate competition age correctly', () => {
      expect(isCompetitionAge(2)).toBe(false);
      expect(isCompetitionAge(3)).toBe(true);
      expect(isCompetitionAge(20)).toBe(true);
      expect(isCompetitionAge(21)).toBe(false);
    });

    it('should validate breeding age correctly', () => {
      expect(isBreedingAge(2, 'Stallion')).toBe(false);
      expect(isBreedingAge(3, 'Stallion')).toBe(true);
      // Owner ruling 2026-10-23 (Equoria-2nacc): both sexes breed 3-20. Old contract: a stallion to 25.
      expect(isBreedingAge(20, 'Stallion')).toBe(true);
      expect(isBreedingAge(21, 'Stallion')).toBe(false);

      expect(isBreedingAge(3, 'Mare')).toBe(true);
      expect(isBreedingAge(20, 'Mare')).toBe(true);
      expect(isBreedingAge(21, 'Mare')).toBe(false);

      expect(isBreedingAge(5, 'Colt')).toBe(false); // a Colt is a young stallion, not breeding stock
    });
  });

  describe('Score Validation', () => {
    it('should validate competition scores correctly', () => {
      expect(isValidScore(-1)).toBe(false);
      expect(isValidScore(0)).toBe(true);
      expect(isValidScore(500)).toBe(true);
      expect(isValidScore(1000)).toBe(true);
      expect(isValidScore(1001)).toBe(false);
    });

    it('should validate discipline scores correctly', () => {
      expect(isValidDisciplineScore(-1)).toBe(false);
      expect(isValidDisciplineScore(0)).toBe(true);
      expect(isValidDisciplineScore(50)).toBe(true);
      expect(isValidDisciplineScore(100)).toBe(true);
      expect(isValidDisciplineScore(101)).toBe(false);
    });
  });

  // User Progression Calculations block removed (Equoria-dmrw3):
  // calculateXpForLevel / calculateLevelFromXp were dead exponential-curve helpers
  // (no production callers) that disagreed with the canonical linear curve. They were
  // deleted from constants/schema.mjs. The canonical linear cumulative curve
  // (100*level) lives in backend/models/userModel.mjs (getUserProgress / addXpToUser)
  // and is served by the live /api/users/:id/progress endpoint
  // (userController.getUserProgressAPI), covered by userProgressAPI.integration.test.mjs.

  describe('Horse Stats Validation', () => {
    it('should have all required horse stats defined', () => {
      const expectedStats = [
        'speed',
        'agility',
        'endurance',
        'strength',
        'precision',
        'balance',
        'intelligence',
        'focus',
        'obedience',
        'boldness',
        'flexibility', // This should be included
      ];

      expectedStats.forEach(stat => {
        expect(horseStatValues).toContain(stat);
      });

      // Verify flexibility is specifically included
      expect(horseStats.FLEXIBILITY).toBe('flexibility');
      expect(horseStatValues).toContain('flexibility');
    });

    it('should validate horse stats correctly', () => {
      // Valid stats
      expect(isValidHorseStat('speed')).toBe(true);
      expect(isValidHorseStat('flexibility')).toBe(true);
      expect(isValidHorseStat('intelligence')).toBe(true);

      // Invalid stats
      expect(isValidHorseStat('invalidStat')).toBe(false);
      expect(isValidHorseStat('')).toBe(false);
      expect(isValidHorseStat(null)).toBe(false);
      expect(isValidHorseStat(undefined)).toBe(false);
    });

    it('should have consistent stat object and array values', () => {
      expect(Object.values(horseStats)).toEqual(horseStatValues);
    });
  });

  describe('Constant Integrity', () => {
    it('should have no duplicate values in arrays', () => {
      const checkNoDuplicates = (arr, _name) => {
        const unique = [...new Set(arr)];
        expect(unique.length).toBe(arr.length);
      };

      checkNoDuplicates(horseSexValues, 'horseSexValues');
      checkNoDuplicates(disciplineValues, 'disciplineValues');
      checkNoDuplicates(groomSpecialtyValues, 'groomSpecialtyValues');
      checkNoDuplicates(horseStatValues, 'horseStatValues');
    });

    it('should have consistent object and array values', () => {
      expect(Object.values(horseSex)).toEqual(horseSexValues);
      expect(Object.values(DISCIPLINES)).toEqual(disciplineValues);
      expect(Object.values(groomSpecialties)).toEqual(groomSpecialtyValues);
      expect(Object.values(horseStats)).toEqual(horseStatValues);
    });
  });
});
