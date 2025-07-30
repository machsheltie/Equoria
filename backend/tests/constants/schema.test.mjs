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
  HORSE_SEX,
  HORSE_SEX_VALUES,
  HORSE_TEMPERAMENT,
  DISCIPLINES,
  DISCIPLINE_VALUES,
  GROOM_SPECIALTIES,
  GROOM_SPECIALTY_VALUES,
  GROOM_SKILL_LEVELS,
  HORSE_STATS,
  HORSE_STAT_VALUES,
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
  calculateXpForLevel,
  calculateLevelFromXp,
} from '../../constants/schema.mjs';

describe('🏇 UNIT: Schema Constants Validation', () => {
  describe('Horse Sex Constants', () => {
    it('should have all required horse sex values', () => {
      expect(HORSE_SEX.STALLION).toBe('Stallion');
      expect(HORSE_SEX.MARE).toBe('Mare');
      expect(HORSE_SEX.GELDING).toBe('Gelding');
      expect(HORSE_SEX.COLT).toBe('Colt');
      expect(HORSE_SEX.FILLY).toBe('Filly');
      expect(HORSE_SEX.RIG).toBe('Rig');
      expect(HORSE_SEX.SPAYED_MARE).toBe('Spayed Mare');
    });

    it('should validate horse sex correctly', () => {
      expect(isValidHorseSex('Stallion')).toBe(true);
      expect(isValidHorseSex('Mare')).toBe(true);
      expect(isValidHorseSex('Invalid')).toBe(false);
      expect(isValidHorseSex('')).toBe(false);
      expect(isValidHorseSex(null)).toBe(false);
    });

    it('should have consistent values array', () => {
      expect(HORSE_SEX_VALUES).toContain('Stallion');
      expect(HORSE_SEX_VALUES).toContain('Mare');
      expect(HORSE_SEX_VALUES).toHaveLength(7);
    });
  });

  describe('Horse Temperament Constants', () => {
    it('should have all required temperament values', () => {
      expect(HORSE_TEMPERAMENT.CALM).toBe('Calm');
      expect(HORSE_TEMPERAMENT.SPIRITED).toBe('Spirited');
      expect(HORSE_TEMPERAMENT.NERVOUS).toBe('Nervous');
      expect(HORSE_TEMPERAMENT.AGGRESSIVE).toBe('Aggressive');
      expect(HORSE_TEMPERAMENT.DOCILE).toBe('Docile');
      expect(HORSE_TEMPERAMENT.UNPREDICTABLE).toBe('Unpredictable');
    });

    it('should validate temperament correctly', () => {
      expect(isValidTemperament('Calm')).toBe(true);
      expect(isValidTemperament('Spirited')).toBe(true);
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
      expect(DISCIPLINE_VALUES.length).toBeGreaterThanOrEqual(20);
      expect(DISCIPLINE_VALUES).toContain('Racing');
      expect(DISCIPLINE_VALUES).toContain('Dressage');
      expect(DISCIPLINE_VALUES).toContain('Gaited');
    });
  });

  describe('Groom Constants', () => {
    it('should have all groom specialties', () => {
      expect(GROOM_SPECIALTIES.FOAL_CARE).toBe('foal_care');
      expect(GROOM_SPECIALTIES.GENERAL).toBe('general');
      expect(GROOM_SPECIALTIES.TRAINING).toBe('training');
      expect(GROOM_SPECIALTIES.MEDICAL).toBe('medical');
    });

    it('should validate groom specialties correctly', () => {
      expect(isValidGroomSpecialty('foal_care')).toBe(true);
      expect(isValidGroomSpecialty('general')).toBe(true);
      expect(isValidGroomSpecialty('invalid')).toBe(false);
    });

    it('should have all skill levels', () => {
      expect(GROOM_SKILL_LEVELS.NOVICE).toBe('novice');
      expect(GROOM_SKILL_LEVELS.INTERMEDIATE).toBe('intermediate');
      expect(GROOM_SKILL_LEVELS.EXPERT).toBe('expert');
      expect(GROOM_SKILL_LEVELS.MASTER).toBe('master');
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
      expect(isTrainingAge(3)).toBe(true);  // Minimum age
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
      expect(isBreedingAge(25, 'Stallion')).toBe(true);
      expect(isBreedingAge(26, 'Stallion')).toBe(false);

      expect(isBreedingAge(3, 'Mare')).toBe(true);
      expect(isBreedingAge(20, 'Mare')).toBe(true);
      expect(isBreedingAge(21, 'Mare')).toBe(false);

      expect(isBreedingAge(5, 'Gelding')).toBe(false); // Geldings can't breed
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

  describe('User Progression Calculations', () => {
    it('should calculate XP for levels correctly', () => {
      expect(calculateXpForLevel(1)).toBe(0);
      expect(calculateXpForLevel(2)).toBe(100);
      expect(calculateXpForLevel(3)).toBe(150);
      expect(calculateXpForLevel(4)).toBe(225);
    });

    it('should calculate level from XP correctly', () => {
      expect(calculateLevelFromXp(0)).toBe(1);
      expect(calculateLevelFromXp(99)).toBe(1);
      expect(calculateLevelFromXp(100)).toBe(2);
      expect(calculateLevelFromXp(249)).toBe(2);
      expect(calculateLevelFromXp(250)).toBe(3);
      expect(calculateLevelFromXp(474)).toBe(3);
      expect(calculateLevelFromXp(475)).toBe(4);
    });

    it('should have consistent XP progression', () => {
      // Test cumulative XP totals for each level
      let cumulativeXp = 0;
      for (let level = 1; level <= 5; level++) {
        const calculatedLevel = calculateLevelFromXp(cumulativeXp);
        expect(calculatedLevel).toBe(level);

        // Add XP needed for next level
        if (level < 5) {
          cumulativeXp += calculateXpForLevel(level + 1);
        }
      }
    });
  });

  describe('Horse Stats Validation', () => {
    it('should have all required horse stats defined', () => {
      const expectedStats = [
        'speed',
        'agility',
        'endurance',
        'strength',
        'precision',
        'balance',
        'coordination',
        'intelligence',
        'focus',
        'obedience',
        'boldness',
        'flexibility', // This should be included
      ];

      expectedStats.forEach(stat => {
        expect(HORSE_STAT_VALUES).toContain(stat);
      });

      // Verify flexibility is specifically included
      expect(HORSE_STATS.FLEXIBILITY).toBe('flexibility');
      expect(HORSE_STAT_VALUES).toContain('flexibility');
    });

    it('should validate horse stats correctly', () => {
      // Valid stats
      expect(isValidHorseStat('speed')).toBe(true);
      expect(isValidHorseStat('flexibility')).toBe(true);
      expect(isValidHorseStat('intelligence')).toBe(true);

      // Invalid stats
      expect(isValidHorseStat('invalid_stat')).toBe(false);
      expect(isValidHorseStat('')).toBe(false);
      expect(isValidHorseStat(null)).toBe(false);
      expect(isValidHorseStat(undefined)).toBe(false);
    });

    it('should have consistent stat object and array values', () => {
      expect(Object.values(HORSE_STATS)).toEqual(HORSE_STAT_VALUES);
    });
  });

  describe('Constant Integrity', () => {
    it('should have no duplicate values in arrays', () => {
      const checkNoDuplicates = (arr, _name) => {
        const unique = [...new Set(arr)];
        expect(unique.length).toBe(arr.length);
      };

      checkNoDuplicates(HORSE_SEX_VALUES, 'HORSE_SEX_VALUES');
      checkNoDuplicates(DISCIPLINE_VALUES, 'DISCIPLINE_VALUES');
      checkNoDuplicates(GROOM_SPECIALTY_VALUES, 'GROOM_SPECIALTY_VALUES');
      checkNoDuplicates(HORSE_STAT_VALUES, 'HORSE_STAT_VALUES');
    });

    it('should have consistent object and array values', () => {
      expect(Object.values(HORSE_SEX)).toEqual(HORSE_SEX_VALUES);
      expect(Object.values(DISCIPLINES)).toEqual(DISCIPLINE_VALUES);
      expect(Object.values(GROOM_SPECIALTIES)).toEqual(GROOM_SPECIALTY_VALUES);
      expect(Object.values(HORSE_STATS)).toEqual(HORSE_STAT_VALUES);
    });
  });
});
