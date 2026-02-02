/**
 * Training Utilities Tests
 *
 * Comprehensive test suite for training-utils.ts
 * Target: 100% coverage (40+ tests)
 *
 * Story 4-1: Training Session Interface - Task 1
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  DISCIPLINES,
  getDisciplinesByCategory,
  getDisciplineById,
  formatDisciplineName,
  calculateExpectedGain,
  canTrain,
  getDisciplineScore,
  formatCooldownDate,
  getDaysUntilAvailable,
  getDisciplinesGroupedByCategory,
  isValidDiscipline,
  getCategoryColor,
  calculateNetEffect,
  groupModifiersByCategory,
  getTraitModifiersForDiscipline,
  type Horse,
  type Discipline,
  type TraitModifier,
} from '../training-utils';

describe('Training Utilities', () => {
  describe('DISCIPLINES Data', () => {
    test('should have exactly 23 disciplines', () => {
      expect(DISCIPLINES).toHaveLength(23);
    });

    test('should have 7 Western disciplines', () => {
      const western = DISCIPLINES.filter((d) => d.category === 'Western');
      expect(western).toHaveLength(7);
    });

    test('should have 6 English disciplines', () => {
      const english = DISCIPLINES.filter((d) => d.category === 'English');
      expect(english).toHaveLength(6);
    });

    test('should have 7 Specialized disciplines', () => {
      const specialized = DISCIPLINES.filter((d) => d.category === 'Specialized');
      expect(specialized).toHaveLength(7);
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
      expect(disciplines).toHaveLength(7);
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

  describe('calculateExpectedGain', () => {
    test('should calculate with no trait modifiers', () => {
      expect(calculateExpectedGain(5, [])).toBe(5);
    });

    test('should add positive trait modifiers', () => {
      expect(calculateExpectedGain(5, [1, 2])).toBe(8);
    });

    test('should subtract negative trait modifiers', () => {
      expect(calculateExpectedGain(5, [-1, -2])).toBe(2);
    });

    test('should handle mixed positive and negative modifiers', () => {
      expect(calculateExpectedGain(5, [2, -1, 1])).toBe(7);
    });

    test('should never return negative values', () => {
      expect(calculateExpectedGain(5, [-10])).toBe(0);
    });

    test('should handle zero base gain', () => {
      expect(calculateExpectedGain(0, [1, 2, 3])).toBe(6);
    });

    test('should handle large trait bonuses', () => {
      expect(calculateExpectedGain(5, [10, 15, 20])).toBe(50);
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
      expect(formatted).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
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
      expect(grouped.Specialized).toHaveLength(7);
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

  // ============================================================
  // Trait Modifier Tests (Task 5: Trait Calculation Utilities)
  // ============================================================

  describe('TraitModifier Interface', () => {
    test('should define a valid TraitModifier structure', () => {
      const modifier: TraitModifier = {
        traitId: 'test-trait',
        traitName: 'Test Trait',
        effect: 5,
        description: 'A test trait',
        affectedDisciplines: ['racing', 'dressage'],
        category: 'positive',
      };

      expect(modifier.traitId).toBe('test-trait');
      expect(modifier.traitName).toBe('Test Trait');
      expect(modifier.effect).toBe(5);
      expect(modifier.description).toBe('A test trait');
      expect(modifier.affectedDisciplines).toHaveLength(2);
      expect(modifier.category).toBe('positive');
    });
  });

  describe('calculateNetEffect', () => {
    test('should calculate correctly with only positive modifiers', () => {
      const modifiers: TraitModifier[] = [
        {
          traitId: 'athletic',
          traitName: 'Athletic',
          effect: 3,
          description: 'Enhances performance',
          affectedDisciplines: ['racing'],
          category: 'positive',
        },
        {
          traitId: 'quick-learner',
          traitName: 'Quick Learner',
          effect: 2,
          description: 'Learns faster',
          affectedDisciplines: ['all'],
          category: 'positive',
        },
      ];

      // Base 5 + positive (3 + 2) = 10
      expect(calculateNetEffect(5, modifiers)).toBe(10);
    });

    test('should calculate correctly with only negative modifiers', () => {
      const modifiers: TraitModifier[] = [
        {
          traitId: 'stubborn',
          traitName: 'Stubborn',
          effect: -2,
          description: 'Reduces effectiveness',
          affectedDisciplines: ['all'],
          category: 'negative',
        },
        {
          traitId: 'nervous',
          traitName: 'Nervous',
          effect: -3,
          description: 'Reduces focus',
          affectedDisciplines: ['all'],
          category: 'negative',
        },
      ];

      // Base 5 - negative (2 + 3) = 0
      expect(calculateNetEffect(5, modifiers)).toBe(0);
    });

    test('should calculate correctly with mixed modifiers', () => {
      const modifiers: TraitModifier[] = [
        {
          traitId: 'athletic',
          traitName: 'Athletic',
          effect: 3,
          description: 'Enhances performance',
          affectedDisciplines: ['racing'],
          category: 'positive',
        },
        {
          traitId: 'stubborn',
          traitName: 'Stubborn',
          effect: -2,
          description: 'Reduces effectiveness',
          affectedDisciplines: ['all'],
          category: 'negative',
        },
        {
          traitId: 'intelligent',
          traitName: 'Intelligent',
          effect: 4,
          description: 'Learns quickly',
          affectedDisciplines: ['dressage'],
          category: 'positive',
        },
      ];

      // Base 5 + positive (3 + 4) - negative (2) = 10
      expect(calculateNetEffect(5, modifiers)).toBe(10);
    });

    test('should return base gain when no modifiers provided', () => {
      expect(calculateNetEffect(5, [])).toBe(5);
      expect(calculateNetEffect(10, [])).toBe(10);
      expect(calculateNetEffect(0, [])).toBe(0);
    });

    test('should handle edge case with zero effect modifiers', () => {
      const modifiers: TraitModifier[] = [
        {
          traitId: 'calm',
          traitName: 'Calm',
          effect: 0,
          description: 'Maintains composure',
          affectedDisciplines: ['all'],
          category: 'neutral',
        },
        {
          traitId: 'focused',
          traitName: 'Focused',
          effect: 0,
          description: 'Stays focused',
          affectedDisciplines: ['all'],
          category: 'neutral',
        },
      ];

      // Neutral modifiers should not affect the base gain
      expect(calculateNetEffect(5, modifiers)).toBe(5);
    });

    test('should handle large positive modifiers', () => {
      const modifiers: TraitModifier[] = [
        {
          traitId: 'exceptional',
          traitName: 'Exceptional',
          effect: 10,
          description: 'Exceptional ability',
          affectedDisciplines: ['all'],
          category: 'positive',
        },
      ];

      expect(calculateNetEffect(5, modifiers)).toBe(15);
    });

    test('should allow negative result when negatives exceed base plus positives', () => {
      const modifiers: TraitModifier[] = [
        {
          traitId: 'severely-injured',
          traitName: 'Severely Injured',
          effect: -10,
          description: 'Major injury penalty',
          affectedDisciplines: ['all'],
          category: 'negative',
        },
      ];

      // Base 5 - negative (10) = -5 (allows negative)
      expect(calculateNetEffect(5, modifiers)).toBe(-5);
    });
  });

  describe('groupModifiersByCategory', () => {
    test('should group positive modifiers correctly', () => {
      const modifiers: TraitModifier[] = [
        {
          traitId: 'athletic',
          traitName: 'Athletic',
          effect: 3,
          description: 'Enhances performance',
          affectedDisciplines: ['racing'],
          category: 'positive',
        },
        {
          traitId: 'intelligent',
          traitName: 'Intelligent',
          effect: 4,
          description: 'Learns quickly',
          affectedDisciplines: ['dressage'],
          category: 'positive',
        },
      ];

      const grouped = groupModifiersByCategory(modifiers);

      expect(grouped.positive).toHaveLength(2);
      expect(grouped.negative).toHaveLength(0);
      expect(grouped.neutral).toHaveLength(0);
      expect(grouped.positive[0].traitId).toBe('athletic');
      expect(grouped.positive[1].traitId).toBe('intelligent');
    });

    test('should group negative modifiers correctly', () => {
      const modifiers: TraitModifier[] = [
        {
          traitId: 'stubborn',
          traitName: 'Stubborn',
          effect: -2,
          description: 'Reduces effectiveness',
          affectedDisciplines: ['all'],
          category: 'negative',
        },
        {
          traitId: 'nervous',
          traitName: 'Nervous',
          effect: -3,
          description: 'Reduces focus',
          affectedDisciplines: ['all'],
          category: 'negative',
        },
      ];

      const grouped = groupModifiersByCategory(modifiers);

      expect(grouped.positive).toHaveLength(0);
      expect(grouped.negative).toHaveLength(2);
      expect(grouped.neutral).toHaveLength(0);
      expect(grouped.negative[0].traitId).toBe('stubborn');
      expect(grouped.negative[1].traitId).toBe('nervous');
    });

    test('should group neutral modifiers correctly', () => {
      const modifiers: TraitModifier[] = [
        {
          traitId: 'calm',
          traitName: 'Calm',
          effect: 0,
          description: 'Maintains composure',
          affectedDisciplines: ['all'],
          category: 'neutral',
        },
      ];

      const grouped = groupModifiersByCategory(modifiers);

      expect(grouped.positive).toHaveLength(0);
      expect(grouped.negative).toHaveLength(0);
      expect(grouped.neutral).toHaveLength(1);
      expect(grouped.neutral[0].traitId).toBe('calm');
    });

    test('should handle empty array', () => {
      const grouped = groupModifiersByCategory([]);

      expect(grouped.positive).toHaveLength(0);
      expect(grouped.negative).toHaveLength(0);
      expect(grouped.neutral).toHaveLength(0);
    });

    test('should correctly separate mixed modifiers', () => {
      const modifiers: TraitModifier[] = [
        {
          traitId: 'athletic',
          traitName: 'Athletic',
          effect: 3,
          description: 'Enhances performance',
          affectedDisciplines: ['racing'],
          category: 'positive',
        },
        {
          traitId: 'stubborn',
          traitName: 'Stubborn',
          effect: -2,
          description: 'Reduces effectiveness',
          affectedDisciplines: ['all'],
          category: 'negative',
        },
        {
          traitId: 'calm',
          traitName: 'Calm',
          effect: 0,
          description: 'Maintains composure',
          affectedDisciplines: ['all'],
          category: 'neutral',
        },
        {
          traitId: 'intelligent',
          traitName: 'Intelligent',
          effect: 4,
          description: 'Learns quickly',
          affectedDisciplines: ['dressage'],
          category: 'positive',
        },
      ];

      const grouped = groupModifiersByCategory(modifiers);

      expect(grouped.positive).toHaveLength(2);
      expect(grouped.negative).toHaveLength(1);
      expect(grouped.neutral).toHaveLength(1);
    });
  });

  describe('getTraitModifiersForDiscipline', () => {
    test('should return athletic modifier for racing discipline', () => {
      const modifiers = getTraitModifiersForDiscipline(['athletic'], 'racing');

      expect(modifiers).toHaveLength(1);
      expect(modifiers[0].traitId).toBe('athletic');
      expect(modifiers[0].traitName).toBe('Athletic');
      expect(modifiers[0].effect).toBe(3);
      expect(modifiers[0].category).toBe('positive');
    });

    test('should return intelligent modifier for dressage discipline', () => {
      const modifiers = getTraitModifiersForDiscipline(['intelligent'], 'dressage');

      expect(modifiers).toHaveLength(1);
      expect(modifiers[0].traitId).toBe('intelligent');
      expect(modifiers[0].traitName).toBe('Intelligent');
      expect(modifiers[0].effect).toBe(4);
      expect(modifiers[0].category).toBe('positive');
    });

    test('should return modifiers with "all" disciplines for any discipline', () => {
      const modifiers = getTraitModifiersForDiscipline(['stubborn'], 'racing');

      expect(modifiers).toHaveLength(1);
      expect(modifiers[0].traitId).toBe('stubborn');
      expect(modifiers[0].affectedDisciplines).toContain('all');
    });

    test('should filter out non-matching disciplines', () => {
      // Athletic only affects racing, show-jumping, barrel-racing
      const modifiers = getTraitModifiersForDiscipline(['athletic'], 'dressage');

      expect(modifiers).toHaveLength(0);
    });

    test('should return empty array for horse with no traits', () => {
      const modifiers = getTraitModifiersForDiscipline([], 'racing');

      expect(modifiers).toHaveLength(0);
    });

    test('should return multiple modifiers for horse with multiple traits', () => {
      const modifiers = getTraitModifiersForDiscipline(
        ['athletic', 'stubborn', 'quick-learner'],
        'racing'
      );

      expect(modifiers).toHaveLength(3);

      const traitIds = modifiers.map((m) => m.traitId);
      expect(traitIds).toContain('athletic');
      expect(traitIds).toContain('stubborn');
      expect(traitIds).toContain('quick-learner');
    });

    test('should return calm modifier with neutral category for any discipline', () => {
      const modifiers = getTraitModifiersForDiscipline(['calm'], 'show-jumping');

      expect(modifiers).toHaveLength(1);
      expect(modifiers[0].traitId).toBe('calm');
      expect(modifiers[0].category).toBe('neutral');
      expect(modifiers[0].effect).toBe(0);
    });

    test('should ignore unknown traits', () => {
      const modifiers = getTraitModifiersForDiscipline(
        ['athletic', 'unknown-trait', 'another-unknown'],
        'racing'
      );

      expect(modifiers).toHaveLength(1);
      expect(modifiers[0].traitId).toBe('athletic');
    });

    test('should return intelligent modifier for western-pleasure discipline', () => {
      const modifiers = getTraitModifiersForDiscipline(['intelligent'], 'western-pleasure');

      expect(modifiers).toHaveLength(1);
      expect(modifiers[0].traitId).toBe('intelligent');
      expect(modifiers[0].affectedDisciplines).toContain('western-pleasure');
    });

    test('should return athletic modifier for show-jumping discipline', () => {
      const modifiers = getTraitModifiersForDiscipline(['athletic'], 'show-jumping');

      expect(modifiers).toHaveLength(1);
      expect(modifiers[0].traitId).toBe('athletic');
      expect(modifiers[0].affectedDisciplines).toContain('show-jumping');
    });

    test('should return athletic modifier for barrel-racing discipline', () => {
      const modifiers = getTraitModifiersForDiscipline(['athletic'], 'barrel-racing');

      expect(modifiers).toHaveLength(1);
      expect(modifiers[0].traitId).toBe('athletic');
      expect(modifiers[0].affectedDisciplines).toContain('barrel-racing');
    });
  });

  describe('Trait Modifier Integration', () => {
    test('should calculate net effect using modifiers from getTraitModifiersForDiscipline', () => {
      const modifiers = getTraitModifiersForDiscipline(['athletic', 'stubborn'], 'racing');

      // athletic (+3 positive) + stubborn (-2 negative)
      // Base 5 + 3 - 2 = 6
      const netEffect = calculateNetEffect(5, modifiers);
      expect(netEffect).toBe(6);
    });

    test('should group modifiers from getTraitModifiersForDiscipline correctly', () => {
      const modifiers = getTraitModifiersForDiscipline(['athletic', 'stubborn', 'calm'], 'racing');

      const grouped = groupModifiersByCategory(modifiers);

      expect(grouped.positive).toHaveLength(1);
      expect(grouped.negative).toHaveLength(1);
      expect(grouped.neutral).toHaveLength(1);
    });

    test('should handle complex scenario with multiple traits for dressage', () => {
      const modifiers = getTraitModifiersForDiscipline(
        ['intelligent', 'quick-learner', 'stubborn', 'calm'],
        'dressage'
      );

      // intelligent (+4) for dressage + quick-learner (+2) for all + stubborn (-2) for all + calm (0) for all
      expect(modifiers).toHaveLength(4);

      const netEffect = calculateNetEffect(5, modifiers);
      // Base 5 + positive (4 + 2) - negative (2) = 9
      expect(netEffect).toBe(9);
    });
  });
});
