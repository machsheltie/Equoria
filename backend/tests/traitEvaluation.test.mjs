/**
 * 🧪 UNIT TEST: Trait Evaluation System - Trait Revelation & Validation
 *
 * This test validates the trait evaluation system's functionality for revealing
 * hidden traits based on foal development conditions and environmental factors.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Trait revelation conditions: age, bond score, stress level thresholds
 * - Environmental factor evaluation: high bonding enables positive traits
 * - Stress impact assessment: high stress prevents positive trait revelation
 * - Age-based trait availability: traits unlock at specific development stages
 * - Trait conflict prevention: contradictory traits cannot coexist (calm vs nervous)
 * - Duplicate trait prevention: existing traits cannot be revealed again
 * - Probability-based revelation: random chance affects trait discovery
 * - Development day usage: young foals use development days instead of age
 * - Trait definition validation: consistent structure and valid conditions
 * - Conflict symmetry: bidirectional trait conflicts (A conflicts B = B conflicts A)
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. evaluateTraitRevelation() - Complete trait revelation with condition checking
 * 2. getTraitDefinition() - Individual trait definition retrieval with validation
 * 3. getAllTraitDefinitions() - Complete trait catalog with structure validation
 * 4. TRAIT_DEFINITIONS validation - Reveal conditions, base chances, rarity levels
 * 5. TRAIT_CONFLICTS validation - Symmetric conflicts and valid trait references
 * 6. Environmental condition evaluation: bond scores, stress levels, age requirements
 * 7. Probability system testing: random chance effects on trait revelation
 * 8. Error handling: null foals, missing properties, invalid inputs
 * 9. Edge cases: newborn foals, extreme bond/stress values, existing trait conflicts
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Complete trait evaluation logic, condition checking, probability calculations
 * ✅ REAL: Trait definition validation, conflict resolution, revelation algorithms
 * 🔧 MOCK: Logger calls - external dependency for audit trails
 * 🔧 MOCK: Math.random - for deterministic testing of probability-based revelation
 *
 * 💡 TEST STRATEGY: Unit testing with minimal mocking to focus on trait evaluation
 *    business logic while ensuring predictable test outcomes for probability systems
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Mock the logger import
jest.unstable_mockModule(join(__dirname, '../utils/logger.mjs'), () => ({
  default: mockLogger,
}));

// Import the functions after mocking
const {
  evaluateTraitRevelation,
  getTraitDefinition,
  getAllTraitDefinitions,
  TRAIT_DEFINITIONS,
  TRAIT_CONFLICTS,
} = await import(join(__dirname, '../utils/traitEvaluation.mjs'));

describe('🔬 UNIT: Trait Evaluation System - Trait Revelation & Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset random seed for consistent testing
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('evaluateTraitRevelation', () => {
    const mockFoal = {
      id: 1,
      name: 'Test Foal',
      age: 0,
      bond_score: 75,
      stress_level: 20,
    };

    const mockCurrentTraits = {
      positive: [],
      negative: [],
      hidden: [],
    };

    it('should evaluate traits for a foal with good bonding and low stress', async () => {
      // Mock Math.random to ensure trait revelation
      Math.random.mockReturnValue(0.1); // Low value to trigger trait revelation

      const result = evaluateTraitRevelation(mockFoal, mockCurrentTraits, 3);

      expect(result).toHaveProperty('positive');
      expect(result).toHaveProperty('negative');
      expect(result).toHaveProperty('hidden');
      expect(Array.isArray(result.positive)).toBe(true);
      expect(Array.isArray(result.negative)).toBe(true);
      expect(Array.isArray(result.hidden)).toBe(true);
    });

    it('should not reveal traits that do not meet age requirements', async () => {
      const youngFoal = { ...mockFoal };
      Math.random.mockReturnValue(0.1);

      const result = evaluateTraitRevelation(youngFoal, mockCurrentTraits, 0); // Day 0

      // Traits requiring age > 0 should not be revealed
      const allRevealedTraits = [...result.positive, ...result.negative, ...result.hidden];

      // Check that no traits requiring higher age are revealed
      allRevealedTraits.forEach(traitKey => {
        const traitDef = getTraitDefinition(traitKey);
        expect(traitDef.revealConditions.minAge).toBeLessThanOrEqual(0);
      });
    });

    it('should not reveal traits that do not meet bonding requirements', async () => {
      const lowBondFoal = { ...mockFoal, bond_score: 30 };
      Math.random.mockReturnValue(0.1);

      const result = evaluateTraitRevelation(lowBondFoal, mockCurrentTraits, 6);

      // Should not reveal positive traits requiring high bonding
      result.positive.forEach(traitKey => {
        const traitDef = getTraitDefinition(traitKey);
        if (traitDef.revealConditions.minBondScore) {
          expect(30).toBeGreaterThanOrEqual(traitDef.revealConditions.minBondScore);
        }
      });
    });

    it('should not reveal traits that do not meet stress requirements', async () => {
      const highStressFoal = { ...mockFoal, stress_level: 90 };
      Math.random.mockReturnValue(0.1);

      const result = evaluateTraitRevelation(highStressFoal, mockCurrentTraits, 6);

      // Should not reveal positive traits that require low stress
      result.positive.forEach(traitKey => {
        const traitDef = getTraitDefinition(traitKey);
        if (traitDef.revealConditions.maxStressLevel) {
          expect(90).toBeLessThanOrEqual(traitDef.revealConditions.maxStressLevel);
        }
      });
    });

    it('should not reveal duplicate traits', async () => {
      const existingTraits = {
        positive: ['resilient'],
        negative: ['nervous'],
        hidden: ['intelligent'],
      };

      Math.random.mockReturnValue(0.1);

      const result = evaluateTraitRevelation(mockFoal, existingTraits, 6);

      // Should not contain any existing traits
      const allNewTraits = [...result.positive, ...result.negative, ...result.hidden];
      expect(allNewTraits).not.toContain('resilient');
      expect(allNewTraits).not.toContain('nervous');
      expect(allNewTraits).not.toContain('intelligent');
    });

    it('should respect trait conflicts', async () => {
      const existingTraits = {
        positive: ['calm'],
        negative: [],
        hidden: [],
      };

      Math.random.mockReturnValue(0.1);

      const result = evaluateTraitRevelation(mockFoal, existingTraits, 6);

      // Should not reveal traits that conflict with 'calm'
      const allNewTraits = [...result.positive, ...result.negative, ...result.hidden];
      const conflictsWithCalm = TRAIT_CONFLICTS.calm || [];

      conflictsWithCalm.forEach(conflictTrait => {
        expect(allNewTraits).not.toContain(conflictTrait);
      });
    });

    it('should handle foals with null bond_score and stress_level', async () => {
      const foalWithNulls = {
        id: 1,
        name: 'Test Foal',
        age: 0,
        bond_score: null,
        stress_level: null,
      };

      Math.random.mockReturnValue(0.1);

      const result = evaluateTraitRevelation(foalWithNulls, mockCurrentTraits, 3);

      expect(result).toHaveProperty('positive');
      expect(result).toHaveProperty('negative');
      expect(result).toHaveProperty('hidden');
    });

    it('should use development age for young foals', async () => {
      const newbornFoal = { ...mockFoal, age: 0 };
      Math.random.mockReturnValue(0.1);

      const _result = evaluateTraitRevelation(newbornFoal, mockCurrentTraits, 5);

      // Should use development day (5) instead of age (0) for trait evaluation
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Evaluating traits for foal 1 on day 5'),
      );
    });

    it('should not reveal traits when random chance is too high', async () => {
      Math.random.mockReturnValue(0.9); // High value to prevent trait revelation

      const result = evaluateTraitRevelation(mockFoal, mockCurrentTraits, 6);

      // Should reveal fewer or no traits due to low probability
      const totalTraits = result.positive.length + result.negative.length + result.hidden.length;
      expect(totalTraits).toBeLessThanOrEqual(1); // Some traits might still be revealed due to high base chance
    });
  });

  describe('getTraitDefinition', () => {
    it('should return trait definition for valid trait key', () => {
      const definition = getTraitDefinition('resilient');

      expect(definition).toBeDefined();
      expect(definition.name).toBe('Resilient');
      expect(definition.description).toBeDefined();
      expect(definition.revealConditions).toBeDefined();
    });

    it('should return null for invalid trait key', () => {
      const definition = getTraitDefinition('invalid_trait');
      expect(definition).toBeNull();
    });

    it('should find traits in all categories', () => {
      // Test positive trait
      expect(getTraitDefinition('resilient')).toBeDefined();

      // Test negative trait
      expect(getTraitDefinition('nervous')).toBeDefined();

      // Test rare trait
      expect(getTraitDefinition('legendary_bloodline')).toBeDefined();
    });
  });

  describe('getAllTraitDefinitions', () => {
    it('should return all trait definitions', () => {
      const definitions = getAllTraitDefinitions();

      expect(definitions).toHaveProperty('positive');
      expect(definitions).toHaveProperty('negative');
      expect(definitions).toHaveProperty('rare');

      expect(Object.keys(definitions.positive).length).toBeGreaterThan(0);
      expect(Object.keys(definitions.negative).length).toBeGreaterThan(0);
      expect(Object.keys(definitions.rare).length).toBeGreaterThan(0);
    });

    it('should have consistent structure for all traits', () => {
      const definitions = getAllTraitDefinitions();

      Object.values(definitions).forEach(category => {
        Object.values(category).forEach(trait => {
          expect(trait).toHaveProperty('name');
          expect(trait).toHaveProperty('description');
          expect(trait).toHaveProperty('revealConditions');
          expect(trait).toHaveProperty('rarity');
          expect(trait).toHaveProperty('baseChance');

          expect(typeof trait.name).toBe('string');
          expect(typeof trait.description).toBe('string');
          expect(typeof trait.revealConditions).toBe('object');
          expect(typeof trait.rarity).toBe('string');
          expect(typeof trait.baseChance).toBe('number');
        });
      });
    });
  });

  describe('TRAIT_DEFINITIONS', () => {
    it('should have valid reveal conditions for all traits', () => {
      Object.values(TRAIT_DEFINITIONS).forEach(category => {
        Object.entries(category).forEach(([_key, trait]) => {
          const conditions = trait.revealConditions;

          // Age should be valid
          expect(conditions.minAge).toBeGreaterThanOrEqual(0);
          expect(conditions.minAge).toBeLessThanOrEqual(6);

          // Bond score conditions should be valid if present
          if (conditions.minBondScore) {
            expect(conditions.minBondScore).toBeGreaterThanOrEqual(0);
            expect(conditions.minBondScore).toBeLessThanOrEqual(100);
          }
          if (conditions.maxBondScore) {
            expect(conditions.maxBondScore).toBeGreaterThanOrEqual(0);
            expect(conditions.maxBondScore).toBeLessThanOrEqual(100);
          }

          // Stress level conditions should be valid if present
          if (conditions.minStressLevel) {
            expect(conditions.minStressLevel).toBeGreaterThanOrEqual(0);
            expect(conditions.minStressLevel).toBeLessThanOrEqual(100);
          }
          if (conditions.maxStressLevel) {
            expect(conditions.maxStressLevel).toBeGreaterThanOrEqual(0);
            expect(conditions.maxStressLevel).toBeLessThanOrEqual(100);
          }

          // Base chance should be valid probability
          expect(trait.baseChance).toBeGreaterThan(0);
          expect(trait.baseChance).toBeLessThanOrEqual(1);
        });
      });
    });
  });

  describe('TRAIT_CONFLICTS', () => {
    it('should have symmetric conflicts', () => {
      Object.entries(TRAIT_CONFLICTS).forEach(([trait, conflicts]) => {
        conflicts.forEach(conflictTrait => {
          // If A conflicts with B, then B should conflict with A
          expect(TRAIT_CONFLICTS[conflictTrait]).toContain(trait);
        });
      });
    });

    it('should only reference valid traits', () => {
      const allTraitKeys = new Set();
      Object.values(TRAIT_DEFINITIONS).forEach(category => {
        Object.keys(category).forEach(key => allTraitKeys.add(key));
      });

      Object.entries(TRAIT_CONFLICTS).forEach(([trait, conflicts]) => {
        expect(allTraitKeys.has(trait)).toBe(true);
        conflicts.forEach(conflictTrait => {
          expect(allTraitKeys.has(conflictTrait)).toBe(true);
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', () => {
      const invalidFoal = null;
      const mockCurrentTraits = { positive: [], negative: [], hidden: [] };

      expect(() => {
        evaluateTraitRevelation(invalidFoal, mockCurrentTraits, 3);
      }).toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle missing foal properties', () => {
      const incompleteFoal = { id: 1 }; // Missing name, age, bond_score, stress_level
      const mockCurrentTraits = { positive: [], negative: [], hidden: [] };

      const result = evaluateTraitRevelation(incompleteFoal, mockCurrentTraits, 3);

      expect(result).toHaveProperty('positive');
      expect(result).toHaveProperty('negative');
      expect(result).toHaveProperty('hidden');
    });
  });
});
