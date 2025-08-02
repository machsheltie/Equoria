/**
 * Epigenetic Flag Definitions Tests
 * Unit tests for epigenetic flag configuration and definitions
 * 
 * 🧪 TESTING APPROACH: Balanced Mocking
 * - No external dependencies to mock
 * - Pure configuration testing
 * - Validates flag structure and properties
 * - Tests helper functions and data integrity
 */

import { describe, test, expect } from '@jest/globals';
import {
  FLAG_TYPES,
  SOURCE_CATEGORIES,
  MAX_FLAGS_PER_HORSE,
  FLAG_EVALUATION_AGE_RANGE,
  EPIGENETIC_FLAG_DEFINITIONS,
  getAllFlagDefinitions,
  getFlagDefinition,
  getFlagsByType,
  getFlagsBySourceCategory
} from '../../config/epigeneticFlagDefinitions.mjs';

describe('Epigenetic Flag Definitions', () => {
  describe('Constants', () => {
    test('should have correct flag types', () => {
      expect(FLAG_TYPES).toEqual({
        POSITIVE: 'positive',
        NEGATIVE: 'negative',
        ADAPTIVE: 'adaptive'
      });
    });

    test('should have correct source categories', () => {
      expect(SOURCE_CATEGORIES).toEqual({
        GROOMING: 'grooming',
        BONDING: 'bonding',
        ENVIRONMENT: 'environment',
        NOVELTY: 'novelty'
      });
    });

    test('should have correct max flags limit', () => {
      expect(MAX_FLAGS_PER_HORSE).toBe(5);
    });

    test('should have correct age range', () => {
      expect(FLAG_EVALUATION_AGE_RANGE).toEqual({
        MIN: 0,
        MAX: 3
      });
    });
  });

  describe('Flag Definitions Structure', () => {
    test('should have exactly 9 starter flags', () => {
      const flagCount = Object.keys(EPIGENETIC_FLAG_DEFINITIONS).length;
      expect(flagCount).toBe(9);
    });

    test('should have all required starter flags', () => {
      const expectedFlags = [
        'BRAVE', 'CONFIDENT', 'AFFECTIONATE', 'RESILIENT',
        'FEARFUL', 'INSECURE', 'ALOOF', 'SKITTISH', 'FRAGILE'
      ];
      
      expectedFlags.forEach(flagName => {
        expect(EPIGENETIC_FLAG_DEFINITIONS).toHaveProperty(flagName);
      });
    });

    test('each flag should have required properties', () => {
      Object.values(EPIGENETIC_FLAG_DEFINITIONS).forEach(flag => {
        expect(flag).toHaveProperty('name');
        expect(flag).toHaveProperty('displayName');
        expect(flag).toHaveProperty('description');
        expect(flag).toHaveProperty('type');
        expect(flag).toHaveProperty('sourceCategory');
        expect(flag).toHaveProperty('influences');
        expect(flag).toHaveProperty('triggerConditions');
        
        // Validate types
        expect(typeof flag.name).toBe('string');
        expect(typeof flag.displayName).toBe('string');
        expect(typeof flag.description).toBe('string');
        expect(Object.values(FLAG_TYPES)).toContain(flag.type);
        expect(Object.values(SOURCE_CATEGORIES)).toContain(flag.sourceCategory);
        expect(typeof flag.influences).toBe('object');
        expect(typeof flag.triggerConditions).toBe('object');
      });
    });

    test('each flag should have valid influences structure', () => {
      Object.values(EPIGENETIC_FLAG_DEFINITIONS).forEach(flag => {
        expect(flag.influences).toHaveProperty('traitWeightModifiers');
        expect(flag.influences).toHaveProperty('behaviorModifiers');
        
        // Trait weight modifiers should be numbers between -1 and 1
        Object.values(flag.influences.traitWeightModifiers).forEach(modifier => {
          expect(typeof modifier).toBe('number');
          expect(modifier).toBeGreaterThanOrEqual(-1);
          expect(modifier).toBeLessThanOrEqual(1);
        });
        
        // Behavior modifiers should be numbers
        Object.values(flag.influences.behaviorModifiers).forEach(modifier => {
          expect(typeof modifier).toBe('number');
        });
      });
    });
  });

  describe('Flag Type Distribution', () => {
    test('should have correct distribution of flag types', () => {
      const flagsByType = {
        positive: 0,
        negative: 0,
        adaptive: 0
      };
      
      Object.values(EPIGENETIC_FLAG_DEFINITIONS).forEach(flag => {
        flagsByType[flag.type]++;
      });
      
      expect(flagsByType.positive).toBe(4); // BRAVE, CONFIDENT, AFFECTIONATE, RESILIENT
      expect(flagsByType.negative).toBe(5); // FEARFUL, INSECURE, ALOOF, SKITTISH, FRAGILE
      expect(flagsByType.adaptive).toBe(0); // None in starter set
    });

    test('should have correct distribution of source categories', () => {
      const flagsBySource = {
        grooming: 0,
        bonding: 0,
        environment: 0,
        novelty: 0
      };
      
      Object.values(EPIGENETIC_FLAG_DEFINITIONS).forEach(flag => {
        flagsBySource[flag.sourceCategory]++;
      });
      
      expect(flagsBySource.bonding).toBeGreaterThan(0);
      expect(flagsBySource.novelty).toBeGreaterThan(0);
      expect(flagsBySource.environment).toBeGreaterThan(0);
    });
  });

  describe('Helper Functions', () => {
    describe('getAllFlagDefinitions', () => {
      test('should return all flag definitions', () => {
        const allFlags = getAllFlagDefinitions();
        expect(allFlags).toEqual(EPIGENETIC_FLAG_DEFINITIONS);
        expect(Object.keys(allFlags)).toHaveLength(9);
      });
    });

    describe('getFlagDefinition', () => {
      test('should return correct flag definition for valid name', () => {
        const braveFlag = getFlagDefinition('brave');
        expect(braveFlag).toEqual(EPIGENETIC_FLAG_DEFINITIONS.BRAVE);
        expect(braveFlag.name).toBe('brave');
        expect(braveFlag.type).toBe('positive');
      });

      test('should return correct flag definition for uppercase name', () => {
        const braveFlag = getFlagDefinition('BRAVE');
        expect(braveFlag).toEqual(EPIGENETIC_FLAG_DEFINITIONS.BRAVE);
      });

      test('should return null for invalid flag name', () => {
        const invalidFlag = getFlagDefinition('nonexistent');
        expect(invalidFlag).toBeNull();
      });

      test('should handle empty string', () => {
        const emptyFlag = getFlagDefinition('');
        expect(emptyFlag).toBeNull();
      });
    });

    describe('getFlagsByType', () => {
      test('should return positive flags', () => {
        const positiveFlags = getFlagsByType('positive');
        expect(positiveFlags).toHaveLength(4);
        positiveFlags.forEach(flag => {
          expect(flag.type).toBe('positive');
        });
        
        const flagNames = positiveFlags.map(f => f.name);
        expect(flagNames).toContain('brave');
        expect(flagNames).toContain('confident');
        expect(flagNames).toContain('affectionate');
        expect(flagNames).toContain('resilient');
      });

      test('should return negative flags', () => {
        const negativeFlags = getFlagsByType('negative');
        expect(negativeFlags).toHaveLength(5);
        negativeFlags.forEach(flag => {
          expect(flag.type).toBe('negative');
        });
        
        const flagNames = negativeFlags.map(f => f.name);
        expect(flagNames).toContain('fearful');
        expect(flagNames).toContain('insecure');
        expect(flagNames).toContain('aloof');
        expect(flagNames).toContain('skittish');
        expect(flagNames).toContain('fragile');
      });

      test('should return empty array for adaptive flags', () => {
        const adaptiveFlags = getFlagsByType('adaptive');
        expect(adaptiveFlags).toHaveLength(0);
      });

      test('should return empty array for invalid type', () => {
        const invalidFlags = getFlagsByType('invalid');
        expect(invalidFlags).toHaveLength(0);
      });
    });

    describe('getFlagsBySourceCategory', () => {
      test('should return flags by bonding category', () => {
        const bondingFlags = getFlagsBySourceCategory('bonding');
        expect(bondingFlags.length).toBeGreaterThan(0);
        bondingFlags.forEach(flag => {
          expect(flag.sourceCategory).toBe('bonding');
        });
      });

      test('should return flags by novelty category', () => {
        const noveltyFlags = getFlagsBySourceCategory('novelty');
        expect(noveltyFlags.length).toBeGreaterThan(0);
        noveltyFlags.forEach(flag => {
          expect(flag.sourceCategory).toBe('novelty');
        });
      });

      test('should return flags by environment category', () => {
        const environmentFlags = getFlagsBySourceCategory('environment');
        expect(environmentFlags.length).toBeGreaterThan(0);
        environmentFlags.forEach(flag => {
          expect(flag.sourceCategory).toBe('environment');
        });
      });

      test('should return empty array for invalid category', () => {
        const invalidFlags = getFlagsBySourceCategory('invalid');
        expect(invalidFlags).toHaveLength(0);
      });
    });
  });

  describe('Specific Flag Validation', () => {
    test('BRAVE flag should have correct properties', () => {
      const brave = EPIGENETIC_FLAG_DEFINITIONS.BRAVE;
      expect(brave.name).toBe('brave');
      expect(brave.type).toBe('positive');
      expect(brave.sourceCategory).toBe('novelty');
      expect(brave.influences.traitWeightModifiers.bold).toBe(0.3);
      expect(brave.influences.traitWeightModifiers.spooky).toBe(-0.4);
    });

    test('FEARFUL flag should have correct properties', () => {
      const fearful = EPIGENETIC_FLAG_DEFINITIONS.FEARFUL;
      expect(fearful.name).toBe('fearful');
      expect(fearful.type).toBe('negative');
      expect(fearful.sourceCategory).toBe('novelty');
      expect(fearful.influences.traitWeightModifiers.spooky).toBe(0.4);
      expect(fearful.influences.traitWeightModifiers.bold).toBe(-0.3);
    });

    test('RESILIENT flag should have correct properties', () => {
      const resilient = EPIGENETIC_FLAG_DEFINITIONS.RESILIENT;
      expect(resilient.name).toBe('resilient');
      expect(resilient.type).toBe('positive');
      expect(resilient.sourceCategory).toBe('environment');
      expect(resilient.influences.behaviorModifiers.stressRecovery).toBe(0.2);
    });
  });
});
