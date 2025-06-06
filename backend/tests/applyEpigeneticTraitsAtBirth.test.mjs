/**
 * 🧪 UNIT TEST: Apply Epigenetic Traits At Birth - Breeding Condition Analysis
 *
 * This test validates the epigenetic trait application system that determines
 * foal traits based on breeding conditions, lineage, and environmental factors.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Environmental conditions: Low stress + premium feed → positive traits (resilient, people_trusting)
 * - Inbreeding detection: Common ancestors → negative traits (fragile, reactive, low_immunity)
 * - Discipline specialization: 3+ ancestors same discipline → discipline_affinity traits
 * - Legacy talent: 4+ ancestors same discipline → legacy_talent trait
 * - Stress effects: Very high mare stress (85+) → nervous trait
 * - Nutrition effects: Poor feed quality (25-) → low_immunity trait
 * - Trait deduplication: No duplicate traits from multiple conditions
 * - Input validation: Required mare object, graceful handling of missing parameters
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. applyEpigeneticTraitsAtBirth() - Complete trait application with all conditions
 * 2. Environmental trait assignment: Stress + feed quality combinations
 * 3. Inbreeding analysis: Common ancestor detection and severity levels
 * 4. Discipline specialization: Lineage analysis for discipline affinity
 * 5. Legacy talent detection: Enhanced discipline specialization bonuses
 * 6. Stress-based traits: Mare stress level impact on foal traits
 * 7. Nutrition-based traits: Feed quality impact on immune system
 * 8. Edge cases: Empty lineage, null values, missing parameters
 * 9. Data structure validation: Return format and trait deduplication
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Complete trait calculation algorithms, breeding analysis, condition evaluation
 * ✅ REAL: Inbreeding detection, discipline specialization, environmental factor processing
 * 🔧 MOCK: Math.random() for deterministic testing, logger for output control
 *
 * 💡 TEST STRATEGY: Unit testing with controlled randomness to validate
 *    breeding condition analysis and trait assignment accuracy
 *
 * ⚠️  NOTE: This represents GOOD balanced mocking - mocks only randomness and logging
 *    while testing real breeding logic, trait calculations, and business rules.
 */

import { jest, describe, beforeEach, afterEach, expect, it } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.unstable_mockModule(join(__dirname, '../utils/logger.mjs'), () => ({
  default: mockLogger,
}));

// Import the function after mocking
const { applyEpigeneticTraitsAtBirth } = await import(
  join(__dirname, '../utils/applyEpigeneticTraitsAtBirth.js')
);

describe('🧬 UNIT: Apply Epigenetic Traits At Birth - Breeding Condition Analysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset random seed for consistent testing
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Input Validation', () => {
    it('should throw error when mare is not provided', () => {
      expect(() => {
        applyEpigeneticTraitsAtBirth({
          lineage: [],
          feedQuality: 50,
          stressLevel: 50,
        });
      }).toThrow('Mare object is required');
    });

    it('should handle missing optional parameters', () => {
      const mare = { stressLevel: 30 };
      const result = applyEpigeneticTraitsAtBirth({ mare });

      expect(result).toHaveProperty('positive');
      expect(result).toHaveProperty('negative');
      expect(Array.isArray(result.positive)).toBe(true);
      expect(Array.isArray(result.negative)).toBe(true);
    });
  });

  describe('Low Stress and Premium Feed Conditions', () => {
    it('should assign resilient trait with low stress and premium feed', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // Below 0.75 threshold

      const mare = { stressLevel: 15 };
      const result = applyEpigeneticTraitsAtBirth({
        mare,
        feedQuality: 85,
        stressLevel: 15,
      });

      expect(result.positive).toContain('resilient');
    });

    it('should assign people_trusting trait with low stress and premium feed', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.4); // Below 0.60 threshold

      const mare = { stressLevel: 20 };
      const result = applyEpigeneticTraitsAtBirth({
        mare,
        feedQuality: 80,
        stressLevel: 20,
      });

      expect(result.positive).toContain('people_trusting');
    });

    it('should not assign positive traits with high stress', () => {
      const mare = { stressLevel: 50 };
      const result = applyEpigeneticTraitsAtBirth({
        mare,
        feedQuality: 85,
        stressLevel: 50,
      });

      expect(result.positive).not.toContain('resilient');
      expect(result.positive).not.toContain('people_trusting');
    });

    it('should not assign positive traits with poor feed quality', () => {
      const mare = { stressLevel: 15 };
      const result = applyEpigeneticTraitsAtBirth({
        mare,
        feedQuality: 60,
        stressLevel: 15,
      });

      expect(result.positive).not.toContain('resilient');
      expect(result.positive).not.toContain('people_trusting');
    });
  });

  describe('Inbreeding Detection and Negative Traits', () => {
    it('should assign fragile trait with high inbreeding', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // Below 0.80 threshold for high inbreeding

      const mare = { stressLevel: 50 };
      const lineage = [
        { id: 1, name: 'Common Ancestor' },
        { id: 1, name: 'Common Ancestor' }, // Same ancestor appears multiple times
        { id: 1, name: 'Common Ancestor' },
        { id: 1, name: 'Common Ancestor' },
        { id: 2, name: 'Other Horse' },
      ];

      const result = applyEpigeneticTraitsAtBirth({
        mare,
        lineage,
        feedQuality: 50,
        stressLevel: 50,
      });

      expect(result.negative).toContain('fragile');
    });

    it('should assign reactive trait with moderate inbreeding', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.3); // Below 0.40 threshold for moderate inbreeding

      const mare = { stressLevel: 50 };
      const lineage = [
        { id: 1, name: 'Common Ancestor' },
        { id: 1, name: 'Common Ancestor' },
        { id: 1, name: 'Common Ancestor' },
        { id: 2, name: 'Other Horse' },
      ];

      const result = applyEpigeneticTraitsAtBirth({
        mare,
        lineage,
        feedQuality: 50,
        stressLevel: 50,
      });

      expect(result.negative).toContain('reactive');
    });

    it('should assign low_immunity trait with inbreeding', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.2); // Below 0.35 threshold for moderate inbreeding

      const mare = { stressLevel: 50 };
      const lineage = [
        { id: 1, name: 'Common Ancestor' },
        { id: 1, name: 'Common Ancestor' },
        { id: 1, name: 'Common Ancestor' },
        { id: 2, name: 'Other Horse' },
      ];

      const result = applyEpigeneticTraitsAtBirth({
        mare,
        lineage,
        feedQuality: 50,
        stressLevel: 50,
      });

      expect(result.negative).toContain('low_immunity');
    });

    it('should not assign inbreeding traits without common ancestors', () => {
      const mare = { stressLevel: 50 };
      const lineage = [
        { id: 1, name: 'Horse 1' },
        { id: 2, name: 'Horse 2' },
        { id: 3, name: 'Horse 3' },
        { id: 4, name: 'Horse 4' },
      ];

      const result = applyEpigeneticTraitsAtBirth({
        mare,
        lineage,
        feedQuality: 50,
        stressLevel: 50,
      });

      expect(result.negative).not.toContain('fragile');
      expect(result.negative).not.toContain('reactive');
      expect(result.negative).not.toContain('low_immunity');
    });
  });

  describe('Discipline Specialization', () => {
    it('should assign discipline affinity trait with 3+ ancestors in same discipline', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // Below 0.70 threshold

      const mare = { stressLevel: 50 };
      const lineage = [
        { id: 1, discipline: 'Racing' },
        { id: 2, discipline: 'Racing' },
        { id: 3, discipline: 'Racing' },
        { id: 4, discipline: 'Dressage' },
      ];

      const result = applyEpigeneticTraitsAtBirth({
        mare,
        lineage,
        feedQuality: 50,
        stressLevel: 50,
      });

      expect(result.positive).toContain('discipline_affinity_racing');
    });

    it('should assign legacy_talent trait with 4+ ancestors in same discipline', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.3); // Below 0.40 threshold

      const mare = { stressLevel: 50 };
      const lineage = [
        { id: 1, discipline: 'Show Jumping' },
        { id: 2, discipline: 'Show Jumping' },
        { id: 3, discipline: 'Show Jumping' },
        { id: 4, discipline: 'Show Jumping' },
        { id: 5, discipline: 'Dressage' },
      ];

      const result = applyEpigeneticTraitsAtBirth({
        mare,
        lineage,
        feedQuality: 50,
        stressLevel: 50,
      });

      expect(result.positive).toContain('discipline_affinity_show_jumping');
      expect(result.positive).toContain('legacy_talent');
    });

    it('should use disciplineScores when discipline field is not available', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // Below 0.70 threshold

      const mare = { stressLevel: 50 };
      const lineage = [
        { id: 1, disciplineScores: { Racing: 85, Dressage: 60 } },
        { id: 2, disciplineScores: { Racing: 90, Jumping: 55 } },
        { id: 3, disciplineScores: { Racing: 78, Dressage: 70 } },
        { id: 4, disciplineScores: { Dressage: 80, Racing: 65 } },
      ];

      const result = applyEpigeneticTraitsAtBirth({
        mare,
        lineage,
        feedQuality: 50,
        stressLevel: 50,
      });

      expect(result.positive).toContain('discipline_affinity_racing');
    });

    it('should not assign discipline traits without sufficient specialization', () => {
      const mare = { stressLevel: 50 };
      const lineage = [
        { id: 1, discipline: 'Racing' },
        { id: 2, discipline: 'Dressage' },
        { id: 3, discipline: 'Show Jumping' },
        { id: 4, discipline: 'Racing' },
      ];

      const result = applyEpigeneticTraitsAtBirth({
        mare,
        lineage,
        feedQuality: 50,
        stressLevel: 50,
      });

      expect(
        result.positive.filter(trait => trait.startsWith('discipline_affinity_')),
      ).toHaveLength(0);
      expect(result.positive).not.toContain('legacy_talent');
    });
  });

  describe('Additional Stress and Nutrition Effects', () => {
    it('should assign nervous trait with very high mare stress', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.3); // Below 0.40 threshold

      const mare = { stressLevel: 85 };
      const result = applyEpigeneticTraitsAtBirth({
        mare,
        lineage: [],
        feedQuality: 50,
        stressLevel: 85,
      });

      expect(result.negative).toContain('nervous');
    });

    it('should assign low_immunity trait with poor nutrition', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.2); // Below 0.30 threshold

      const mare = { stressLevel: 50 };
      const result = applyEpigeneticTraitsAtBirth({
        mare,
        lineage: [],
        feedQuality: 25,
        stressLevel: 50,
      });

      expect(result.negative).toContain('low_immunity');
    });

    it('should not duplicate traits', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.1); // Low value to trigger multiple conditions

      const mare = { stressLevel: 50 };
      const lineage = [
        { id: 1, name: 'Common Ancestor' },
        { id: 1, name: 'Common Ancestor' },
        { id: 1, name: 'Common Ancestor' },
      ];

      const result = applyEpigeneticTraitsAtBirth({
        mare,
        lineage,
        feedQuality: 25, // Poor nutrition
        stressLevel: 50,
      });

      // Should only have one instance of low_immunity even though both inbreeding and poor nutrition can cause it
      const immunityCount = result.negative.filter(trait => trait === 'low_immunity').length;
      expect(immunityCount).toBeLessThanOrEqual(1);
    });
  });

  describe('Return Value Structure', () => {
    it('should return object with positive and negative arrays', () => {
      const mare = { stressLevel: 50 };
      const result = applyEpigeneticTraitsAtBirth({
        mare,
        lineage: [],
        feedQuality: 50,
        stressLevel: 50,
      });

      expect(result).toHaveProperty('positive');
      expect(result).toHaveProperty('negative');
      expect(Array.isArray(result.positive)).toBe(true);
      expect(Array.isArray(result.negative)).toBe(true);
    });

    it('should handle empty lineage gracefully', () => {
      const mare = { stressLevel: 50 };
      const result = applyEpigeneticTraitsAtBirth({
        mare,
        lineage: [],
        feedQuality: 50,
        stressLevel: 50,
      });

      expect(result.positive).toEqual([]);
      expect(result.negative).toEqual([]);
    });

    it('should handle null lineage gracefully', () => {
      const mare = { stressLevel: 50 };
      const result = applyEpigeneticTraitsAtBirth({
        mare,
        lineage: null,
        feedQuality: 50,
        stressLevel: 50,
      });

      expect(result.positive).toEqual([]);
      expect(result.negative).toEqual([]);
    });
  });
});
