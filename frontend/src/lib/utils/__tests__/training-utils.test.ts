/**
 * Training Utilities Tests
 *
 * Comprehensive test suite for training-utils.ts
 * Target: 100% coverage (40+ tests)
 *
 * Story 4-1: Training Session Interface - Task 1
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  DISCIPLINES,
  getDisciplinesByCategory,
  getDisciplineById,
  formatDisciplineName,
  canTrain,
  getDisciplineScore,
  formatCooldownDate,
  getDaysUntilAvailable,
  getDisciplinesGroupedByCategory,
  isValidDiscipline,
  getCategoryColor,
  type Horse,
  type _Discipline,
} from '../training-utils';

describe('Training Utilities', () => {
  describe('DISCIPLINES Data', () => {
    test('should have exactly 24 disciplines', () => {
      expect(DISCIPLINES).toHaveLength(24); // Owner ruling 2026-10-21: Pleasure Driving is the 24th discipline. Old contract: 23.
    });

    test('should have 7 Western disciplines', () => {
      const western = DISCIPLINES.filter((d) => d.category === 'Western');
      expect(western).toHaveLength(7);
    });

    test('should have 6 English disciplines', () => {
      const english = DISCIPLINES.filter((d) => d.category === 'English');
      expect(english).toHaveLength(6);
    });

    test('should have 8 Specialized disciplines', () => {
      const specialized = DISCIPLINES.filter((d) => d.category === 'Specialized');
      expect(specialized).toHaveLength(8); // Owner ruling 2026-10-21: Pleasure Driving joins Specialized. Old contract: 7.
    });

    test('should have 3 Racing disciplines', () => {
      const racing = DISCIPLINES.filter((d) => d.category === 'Racing');
      expect(racing).toHaveLength(3);
    });

    test('each discipline should have required fields', () => {
      DISCIPLINES.forEach((discipline) => {
        expect(discipline).toHaveProperty('id');
        expect(discipline).toHaveProperty('name');
        expect(discipline).toHaveProperty('category');
        expect(discipline).toHaveProperty('description');
        expect(discipline).toHaveProperty('primaryStats');
        expect(Array.isArray(discipline.primaryStats)).toBe(true);
      });
    });

    test('discipline IDs should be unique', () => {
      const ids = DISCIPLINES.map((d) => d.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(DISCIPLINES.length);
    });

    test('discipline names should be unique', () => {
      const names = DISCIPLINES.map((d) => d.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(DISCIPLINES.length);
    });
  });

  describe('getDisciplinesByCategory', () => {
    test('should return Western disciplines', () => {
      const disciplines = getDisciplinesByCategory('Western');
      expect(disciplines).toHaveLength(7);
      expect(disciplines.every((d) => d.category === 'Western')).toBe(true);
    });

    test('should return English disciplines', () => {
      const disciplines = getDisciplinesByCategory('English');
      expect(disciplines).toHaveLength(6);
      expect(disciplines.every((d) => d.category === 'English')).toBe(true);
    });

    test('should return Specialized disciplines', () => {
      const disciplines = getDisciplinesByCategory('Specialized');
      expect(disciplines).toHaveLength(8); // Owner ruling 2026-10-21: Pleasure Driving joins Specialized. Old contract: 7.
      expect(disciplines.every((d) => d.category === 'Specialized')).toBe(true);
    });

    test('should return Racing disciplines', () => {
      const disciplines = getDisciplinesByCategory('Racing');
      expect(disciplines).toHaveLength(3);
      expect(disciplines.every((d) => d.category === 'Racing')).toBe(true);
    });

    test('should include specific Western disciplines', () => {
      const disciplines = getDisciplinesByCategory('Western');
      const names = disciplines.map((d) => d.name);
      expect(names).toContain('Western Pleasure');
      expect(names).toContain('Reining');
      expect(names).toContain('Barrel Racing');
    });
  });

  describe('getDisciplineById', () => {
    test('should return discipline for valid ID', () => {
      const discipline = getDisciplineById('dressage');
      expect(discipline).toBeDefined();
      expect(discipline?.name).toBe('Dressage');
      expect(discipline?.category).toBe('English');
    });

    test('should return undefined for invalid ID', () => {
      const discipline = getDisciplineById('invalid-discipline');
      expect(discipline).toBeUndefined();
    });

    test('should return racing discipline', () => {
      const discipline = getDisciplineById('racing');
      expect(discipline).toBeDefined();
      expect(discipline?.name).toBe('Racing');
      expect(discipline?.category).toBe('Racing');
    });

    test('should return correct primary stats', () => {
      const discipline = getDisciplineById('show-jumping');
      expect(discipline).toBeDefined();
      expect(discipline?.primaryStats).toContain('agility');
      expect(discipline?.primaryStats).toContain('precision');
    });
  });

  describe('formatDisciplineName', () => {
    test('should format valid discipline ID to name', () => {
      expect(formatDisciplineName('western-pleasure')).toBe('Western Pleasure');
      expect(formatDisciplineName('dressage')).toBe('Dressage');
      expect(formatDisciplineName('barrel-racing')).toBe('Barrel Racing');
    });

    test('should return ID itself for invalid discipline', () => {
      expect(formatDisciplineName('invalid-id')).toBe('invalid-id');
    });

    test('should handle empty string', () => {
      expect(formatDisciplineName('')).toBe('');
    });
  });

  describe('canTrain', () => {
    let horse: Horse;

    beforeEach(() => {
      horse = {
        id: 1,
        name: 'Thunder',
        age: 5,
        health: 100,
        trainingCooldown: null,
        disciplineScores: {},
      };
    });

    test('should return eligible for valid horse', () => {
      const result = canTrain(horse);
      expect(result.eligible).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    test('should reject horse under 3 years old', () => {
      horse.age = 2;
      const result = canTrain(horse);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('at least 3 years old');
    });

    test('should allow 3 year old horse', () => {
      horse.age = 3;
      const result = canTrain(horse);
      expect(result.eligible).toBe(true);
    });

    test('should reject horse on cooldown', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      horse.trainingCooldown = futureDate.toISOString();

      const result = canTrain(horse);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('on cooldown');
    });

    test('should allow horse with expired cooldown', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      horse.trainingCooldown = pastDate.toISOString();

      const result = canTrain(horse);
      expect(result.eligible).toBe(true);
    });

    test('should check health when option is provided', () => {
      horse.health = 30;
      const result = canTrain(horse, { checkHealth: true, minHealth: 50 });
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('health');
    });

    test('should allow horse with sufficient health', () => {
      horse.health = 80;
      const result = canTrain(horse, { checkHealth: true, minHealth: 50 });
      expect(result.eligible).toBe(true);
    });

    test('should use default minHealth of 50 when not specified', () => {
      horse.health = 40;
      const result = canTrain(horse, { checkHealth: true });
      expect(result.eligible).toBe(false);
    });

    test('should skip health check when checkHealth is false', () => {
      horse.health = 10;
      const result = canTrain(horse, { checkHealth: false });
      expect(result.eligible).toBe(true);
    });

    test('should handle horse without health property', () => {
      delete horse.health;
      const result = canTrain(horse, { checkHealth: true });
      expect(result.eligible).toBe(true);
    });
  });

  describe('getDisciplineScore', () => {
    test('should return score for existing discipline', () => {
      const horse: Horse = {
        id: 1,
        name: 'Thunder',
        age: 5,
        disciplineScores: { dressage: 45, racing: 30 },
      };

      expect(getDisciplineScore(horse, 'dressage')).toBe(45);
      expect(getDisciplineScore(horse, 'racing')).toBe(30);
    });

    test('should return 0 for discipline with no score', () => {
      const horse: Horse = {
        id: 1,
        name: 'Thunder',
        age: 5,
        disciplineScores: { dressage: 45 },
      };

      expect(getDisciplineScore(horse, 'show-jumping')).toBe(0);
    });

    test('should return 0 when disciplineScores is undefined', () => {
      const horse: Horse = {
        id: 1,
        name: 'Thunder',
        age: 5,
      };

      expect(getDisciplineScore(horse, 'dressage')).toBe(0);
    });

    test('should handle empty disciplineScores object', () => {
      const horse: Horse = {
        id: 1,
        name: 'Thunder',
        age: 5,
        disciplineScores: {},
      };

      expect(getDisciplineScore(horse, 'dressage')).toBe(0);
    });
  });

  describe('formatCooldownDate', () => {
    test('should return "Available now" for null date', () => {
      expect(formatCooldownDate(null)).toBe('Available now');
    });

    test('should return "Available now" for past date', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      expect(formatCooldownDate(pastDate)).toBe('Available now');
    });

    test('should return "1 day" for tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(formatCooldownDate(tomorrow)).toBe('1 day');
    });

    test('should return days for dates within a week', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);
      expect(formatCooldownDate(futureDate)).toBe('3 days');
    });

    test('should return formatted date for dates beyond a week', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      const formatted = formatCooldownDate(futureDate);
      // Equoria-2dnd2: formatCooldownDate now routes through the shared formatDate
      // util — canonical "Mon D, YYYY" (e.g. "Jan 15, 2026") replaces the bare
      // locale-default numeric "1/15/2026". Assert a real date (not "Invalid Date").
      expect(formatted).toMatch(/\w{3} \d{1,2}, \d{4}/);
      expect(formatted).not.toContain('Invalid Date');
    });

    test('should handle string dates', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(formatCooldownDate(tomorrow.toISOString())).toBe('1 day');
    });
  });

  describe('getDaysUntilAvailable', () => {
    test('should return 0 for null date', () => {
      expect(getDaysUntilAvailable(null)).toBe(0);
    });

    test('should return 0 for past date', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      expect(getDaysUntilAvailable(pastDate)).toBe(0);
    });

    test('should return correct days for future date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      expect(getDaysUntilAvailable(futureDate)).toBe(7);
    });

    test('should round up partial days', () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 25); // Just over 1 day
      expect(getDaysUntilAvailable(futureDate)).toBe(2);
    });

    test('should handle string dates', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      expect(getDaysUntilAvailable(futureDate.toISOString())).toBe(5);
    });
  });

  describe('getDisciplinesGroupedByCategory', () => {
    test('should return all four categories', () => {
      const grouped = getDisciplinesGroupedByCategory();
      expect(Object.keys(grouped)).toEqual(['Western', 'English', 'Specialized', 'Racing']);
    });

    test('should have correct counts for each category', () => {
      const grouped = getDisciplinesGroupedByCategory();
      expect(grouped.Western).toHaveLength(7);
      expect(grouped.English).toHaveLength(6);
      expect(grouped.Specialized).toHaveLength(8); // Owner ruling 2026-10-21: Pleasure Driving joins Specialized. Old contract: 7.
      expect(grouped.Racing).toHaveLength(3);
    });

    test('should return discipline objects with all properties', () => {
      const grouped = getDisciplinesGroupedByCategory();
      grouped.Western.forEach((discipline) => {
        expect(discipline).toHaveProperty('id');
        expect(discipline).toHaveProperty('name');
        expect(discipline.category).toBe('Western');
      });
    });
  });

  describe('isValidDiscipline', () => {
    test('should return true for valid discipline IDs', () => {
      expect(isValidDiscipline('dressage')).toBe(true);
      expect(isValidDiscipline('racing')).toBe(true);
      expect(isValidDiscipline('western-pleasure')).toBe(true);
    });

    test('should return false for invalid discipline IDs', () => {
      expect(isValidDiscipline('invalid')).toBe(false);
      expect(isValidDiscipline('unknown-discipline')).toBe(false);
      expect(isValidDiscipline('')).toBe(false);
    });
  });

  describe('getCategoryColor', () => {
    test('should return correct color for Western', () => {
      expect(getCategoryColor('Western')).toBe('orange');
    });

    test('should return correct color for English', () => {
      expect(getCategoryColor('English')).toBe('blue');
    });

    test('should return correct color for Specialized', () => {
      expect(getCategoryColor('Specialized')).toBe('purple');
    });

    test('should return correct color for Racing', () => {
      expect(getCategoryColor('Racing')).toBe('red');
    });
  });

  describe('Edge Cases', () => {
    test('should handle horse with all fields undefined', () => {
      const horse: Horse = {
        id: 1,
        name: 'Test',
        age: 3,
      };

      expect(() => canTrain(horse)).not.toThrow();
      expect(() => getDisciplineScore(horse, 'dressage')).not.toThrow();
    });

    test('should handle empty strings in discipline lookups', () => {
      expect(getDisciplineById('')).toBeUndefined();
      expect(formatDisciplineName('')).toBe('');
      expect(isValidDiscipline('')).toBe(false);
    });

    test('should handle extreme date values', () => {
      const veryFarFuture = new Date('2099-12-31');
      const days = getDaysUntilAvailable(veryFarFuture);
      expect(days).toBeGreaterThan(26000); // Approximately 73+ years
    });
  });
});
