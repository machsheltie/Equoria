/**
 * Tests for Horse Filtering Utilities
 *
 * Tests cover:
 * - Search filtering (name, breed, traits)
 * - Age range filtering
 * - Breed filtering
 * - Discipline filtering
 * - Training status filtering
 * - Combined filter application
 * - Edge cases and boundary conditions
 *
 * Story 3-6: Horse Search & Filter - Task 1
 */

import { describe, it, expect } from 'vitest';
import {
  filterBySearch,
  filterByAgeRange,
  filterByBreed,
  filterByDiscipline,
  filterByTrainingStatus,
  applyFilters,
  hasActiveFilters,
  getActiveFilterCount,
  type Horse,
  type HorseFilters,
} from '../horse-filter-utils';

const mockHorses: Horse[] = [
  {
    id: 1,
    name: 'Thunder',
    age: 5,
    breedId: 1,
    breedName: 'Arabian',
    disciplines: ['Racing', 'Dressage'],
    traits: [{ name: 'Fast' }, { name: 'Intelligent' }],
    lastTrainedAt: '2026-01-20',
    trainingCooldown: null,
  },
  {
    id: 2,
    name: 'Lightning Strike',
    age: 3,
    breedId: 2,
    breedName: 'Thoroughbred',
    disciplines: ['Racing'],
    traits: [{ name: 'Speed' }],
    lastTrainedAt: null,
    trainingCooldown: null,
  },
  {
    id: 3,
    name: 'Moonbeam',
    age: 10,
    breedId: 1,
    breedName: 'Arabian',
    disciplines: ['Dressage', 'ShowJumping'],
    traits: [{ name: 'Graceful' }, { name: 'Calm' }],
    lastTrainedAt: '2026-01-28',
    trainingCooldown: '2026-02-05',
  },
  {
    id: 4,
    name: 'Storm',
    age: 7,
    breedId: 3,
    breedName: 'Mustang',
    disciplines: ['Trail', 'Endurance'],
    traits: [{ name: 'Brave' }],
    lastTrainedAt: '2026-01-15',
    trainingCooldown: null,
  },
];

describe('horse-filter-utils', () => {
  describe('filterBySearch', () => {
    it('should return all horses when search term is empty', () => {
      expect(filterBySearch(mockHorses, '')).toEqual(mockHorses);
      expect(filterBySearch(mockHorses, '   ')).toEqual(mockHorses);
    });

    it('should filter by horse name (case-insensitive)', () => {
      const result = filterBySearch(mockHorses, 'thunder');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Thunder');
    });

    it('should filter by partial horse name', () => {
      const result = filterBySearch(mockHorses, 'light');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Lightning Strike');
    });

    it('should filter by breed name (case-insensitive)', () => {
      const result = filterBySearch(mockHorses, 'arabian');
      expect(result).toHaveLength(2);
      expect(result.map((h) => h.name)).toContain('Thunder');
      expect(result.map((h) => h.name)).toContain('Moonbeam');
    });

    it('should filter by trait name', () => {
      const result = filterBySearch(mockHorses, 'fast');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Thunder');
    });

    it('should return empty array when no matches', () => {
      const result = filterBySearch(mockHorses, 'nonexistent');
      expect(result).toHaveLength(0);
    });

    it('should handle horses without traits', () => {
      const horsesWithoutTraits: Horse[] = [{ id: 5, name: 'Test', age: 5, breedId: 1 }];
      const result = filterBySearch(horsesWithoutTraits, 'trait');
      expect(result).toHaveLength(0);
    });

    it('should be case-insensitive', () => {
      expect(filterBySearch(mockHorses, 'THUNDER')).toHaveLength(1);
      expect(filterBySearch(mockHorses, 'ThUnDeR')).toHaveLength(1);
    });
  });

  describe('filterByAgeRange', () => {
    it('should return all horses when no age range specified', () => {
      expect(filterByAgeRange(mockHorses, undefined, undefined)).toEqual(mockHorses);
    });

    it('should filter by minimum age only', () => {
      const result = filterByAgeRange(mockHorses, 7, undefined);
      expect(result).toHaveLength(2);
      expect(result.map((h) => h.age)).toContain(7);
      expect(result.map((h) => h.age)).toContain(10);
    });

    it('should filter by maximum age only', () => {
      const result = filterByAgeRange(mockHorses, undefined, 5);
      expect(result).toHaveLength(2);
      expect(result.map((h) => h.age)).toContain(3);
      expect(result.map((h) => h.age)).toContain(5);
    });

    it('should filter by age range (inclusive)', () => {
      const result = filterByAgeRange(mockHorses, 5, 7);
      expect(result).toHaveLength(2);
      expect(result.map((h) => h.age)).toContain(5);
      expect(result.map((h) => h.age)).toContain(7);
    });

    it('should return empty array when no horses in range', () => {
      const result = filterByAgeRange(mockHorses, 20, 30);
      expect(result).toHaveLength(0);
    });

    it('should handle same min and max age', () => {
      const result = filterByAgeRange(mockHorses, 5, 5);
      expect(result).toHaveLength(1);
      expect(result[0].age).toBe(5);
    });
  });

  describe('filterByBreed', () => {
    it('should return all horses when breed array is empty', () => {
      expect(filterByBreed(mockHorses, [])).toEqual(mockHorses);
    });

    it('should filter by single breed ID', () => {
      const result = filterByBreed(mockHorses, ['1']);
      expect(result).toHaveLength(2);
      expect(result.map((h) => h.breedName)).toEqual(['Arabian', 'Arabian']);
    });

    it('should filter by multiple breed IDs', () => {
      const result = filterByBreed(mockHorses, ['1', '2']);
      expect(result).toHaveLength(3);
    });

    it('should handle horses without breed ID', () => {
      const horsesWithoutBreed: Horse[] = [{ id: 5, name: 'Test', age: 5 }];
      const result = filterByBreed(horsesWithoutBreed, ['1']);
      expect(result).toHaveLength(0);
    });

    it('should return empty array when no matches', () => {
      const result = filterByBreed(mockHorses, ['999']);
      expect(result).toHaveLength(0);
    });
  });

  describe('filterByDiscipline', () => {
    it('should return all horses when discipline array is empty', () => {
      expect(filterByDiscipline(mockHorses, [])).toEqual(mockHorses);
    });

    it('should filter by single discipline', () => {
      const result = filterByDiscipline(mockHorses, ['Racing']);
      expect(result).toHaveLength(2);
      expect(result.map((h) => h.name)).toContain('Thunder');
      expect(result.map((h) => h.name)).toContain('Lightning Strike');
    });

    it('should filter by multiple disciplines', () => {
      const result = filterByDiscipline(mockHorses, ['Dressage', 'Trail']);
      expect(result).toHaveLength(3);
    });

    it('should be case-insensitive', () => {
      const result = filterByDiscipline(mockHorses, ['racing']);
      expect(result).toHaveLength(2);
    });

    it('should handle horses without disciplines', () => {
      const horsesWithoutDisciplines: Horse[] = [{ id: 5, name: 'Test', age: 5 }];
      const result = filterByDiscipline(horsesWithoutDisciplines, ['Racing']);
      expect(result).toHaveLength(0);
    });

    it('should return empty array when no matches', () => {
      const result = filterByDiscipline(mockHorses, ['Polo']);
      expect(result).toHaveLength(0);
    });
  });

  describe('filterByTrainingStatus', () => {
    it('should return all horses when status is "all"', () => {
      expect(filterByTrainingStatus(mockHorses, 'all')).toEqual(mockHorses);
    });

    it('should filter trained horses', () => {
      const result = filterByTrainingStatus(mockHorses, 'trained');
      expect(result).toHaveLength(3);
      expect(result.map((h) => h.name)).toContain('Thunder');
      expect(result.map((h) => h.name)).toContain('Moonbeam');
      expect(result.map((h) => h.name)).toContain('Storm');
    });

    it('should filter untrained horses', () => {
      const result = filterByTrainingStatus(mockHorses, 'untrained');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Lightning Strike');
    });

    it('should filter horses in training cooldown', () => {
      const result = filterByTrainingStatus(mockHorses, 'in_training');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Moonbeam');
    });

    it('should handle horses with null training dates', () => {
      const horsesWithNull: Horse[] = [
        { id: 5, name: 'Test', age: 5, lastTrainedAt: null, trainingCooldown: null },
      ];
      const trained = filterByTrainingStatus(horsesWithNull, 'trained');
      const untrained = filterByTrainingStatus(horsesWithNull, 'untrained');

      expect(trained).toHaveLength(0);
      expect(untrained).toHaveLength(1);
    });
  });

  describe('applyFilters', () => {
    const defaultFilters: HorseFilters = {
      search: '',
      breedIds: [],
      disciplines: [],
      trainingStatus: 'all',
    };

    it('should return all horses with default filters', () => {
      const result = applyFilters(mockHorses, defaultFilters);
      expect(result).toEqual(mockHorses);
    });

    it('should apply search filter only', () => {
      const filters: HorseFilters = {
        ...defaultFilters,
        search: 'thunder',
      };
      const result = applyFilters(mockHorses, filters);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Thunder');
    });

    it('should apply breed filter only', () => {
      const filters: HorseFilters = {
        ...defaultFilters,
        breedIds: ['1'],
      };
      const result = applyFilters(mockHorses, filters);
      expect(result).toHaveLength(2);
    });

    it('should apply age range filter only', () => {
      const filters: HorseFilters = {
        ...defaultFilters,
        minAge: 7,
      };
      const result = applyFilters(mockHorses, filters);
      expect(result).toHaveLength(2);
    });

    it('should apply multiple filters together', () => {
      const filters: HorseFilters = {
        search: '',
        breedIds: ['1'],
        disciplines: ['Dressage'],
        minAge: 5,
        trainingStatus: 'all',
      };
      const result = applyFilters(mockHorses, filters);
      expect(result).toHaveLength(2);
      expect(result.map((h) => h.name)).toContain('Thunder');
      expect(result.map((h) => h.name)).toContain('Moonbeam');
    });

    it('should return empty array when no horses match all filters', () => {
      const filters: HorseFilters = {
        search: 'nonexistent',
        breedIds: ['999'],
        disciplines: [],
        trainingStatus: 'all',
      };
      const result = applyFilters(mockHorses, filters);
      expect(result).toHaveLength(0);
    });
  });

  describe('hasActiveFilters', () => {
    it('should return false for default filters', () => {
      const filters: HorseFilters = {
        search: '',
        breedIds: [],
        disciplines: [],
        trainingStatus: 'all',
      };
      expect(hasActiveFilters(filters)).toBe(false);
    });

    it('should return true when search is active', () => {
      const filters: HorseFilters = {
        search: 'test',
        breedIds: [],
        disciplines: [],
        trainingStatus: 'all',
      };
      expect(hasActiveFilters(filters)).toBe(true);
    });

    it('should return true when age filters are active', () => {
      const filters: HorseFilters = {
        search: '',
        minAge: 5,
        breedIds: [],
        disciplines: [],
        trainingStatus: 'all',
      };
      expect(hasActiveFilters(filters)).toBe(true);
    });

    it('should return true when breed filter is active', () => {
      const filters: HorseFilters = {
        search: '',
        breedIds: ['1'],
        disciplines: [],
        trainingStatus: 'all',
      };
      expect(hasActiveFilters(filters)).toBe(true);
    });

    it('should return true when discipline filter is active', () => {
      const filters: HorseFilters = {
        search: '',
        breedIds: [],
        disciplines: ['Racing'],
        trainingStatus: 'all',
      };
      expect(hasActiveFilters(filters)).toBe(true);
    });

    it('should return true when training status filter is active', () => {
      const filters: HorseFilters = {
        search: '',
        breedIds: [],
        disciplines: [],
        trainingStatus: 'trained',
      };
      expect(hasActiveFilters(filters)).toBe(true);
    });
  });

  describe('getActiveFilterCount', () => {
    it('should return 0 for default filters', () => {
      const filters: HorseFilters = {
        search: '',
        breedIds: [],
        disciplines: [],
        trainingStatus: 'all',
      };
      expect(getActiveFilterCount(filters)).toBe(0);
    });

    it('should count search filter', () => {
      const filters: HorseFilters = {
        search: 'test',
        breedIds: [],
        disciplines: [],
        trainingStatus: 'all',
      };
      expect(getActiveFilterCount(filters)).toBe(1);
    });

    it('should count age range as one filter', () => {
      const filters: HorseFilters = {
        search: '',
        minAge: 5,
        maxAge: 10,
        breedIds: [],
        disciplines: [],
        trainingStatus: 'all',
      };
      expect(getActiveFilterCount(filters)).toBe(1);
    });

    it('should count all active filters', () => {
      const filters: HorseFilters = {
        search: 'test',
        minAge: 5,
        breedIds: ['1'],
        disciplines: ['Racing'],
        trainingStatus: 'trained',
      };
      expect(getActiveFilterCount(filters)).toBe(5);
    });
  });
});
