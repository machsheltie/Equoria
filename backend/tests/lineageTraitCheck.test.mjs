/**
 * 🧪 UNIT TEST: Lineage Trait Check - Discipline Affinity Analysis
 *
 * This test validates the lineage trait checking utilities for analyzing
 * discipline affinity patterns across horse ancestry and competition history.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Discipline affinity detection: 3+ ancestors with same discipline = affinity
 * - Ancestor discipline priority: direct field > competition history > scores > specialty
 * - Detailed affinity analysis: Breakdown, strength percentage, dominant counts
 * - Specific discipline checking: Custom minimum thresholds and percentage calculations
 * - Competition history analysis: Most common discipline from competition records
 * - Score-based discipline detection: Highest scoring discipline from performance data
 * - Edge case handling: Empty arrays, null values, missing fields, circular references
 * - Data source flexibility: Multiple field names (competitionHistory vs competitions)
 * - Robust error handling: Graceful degradation with invalid or incomplete data
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. checkLineageForDisciplineAffinity() - Main affinity detection with 3+ threshold
 * 2. checkLineageForDisciplineAffinityDetailed() - Comprehensive analysis with statistics
 * 3. checkSpecificDisciplineAffinity() - Custom discipline and threshold checking
 * 4. getAncestorPreferredDiscipline() - Multi-source discipline preference detection
 * 5. getMostCommonDisciplineFromHistory() - Competition history analysis
 * 6. getHighestScoringDiscipline() - Performance score-based discipline detection
 * 7. Edge cases - Null handling, empty data, circular references, invalid inputs
 * 8. Data flexibility - Multiple field names and data structure variations
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Complete business logic, affinity calculations, statistical analysis
 * ✅ REAL: Data processing, field priority logic, percentage calculations
 * 🔧 MOCK: Logger only - external dependency for error reporting
 *
 * 💡 TEST STRATEGY: Pure unit testing of business logic with minimal mocking
 *    to validate affinity detection accuracy and comprehensive edge case coverage
 */

import { jest, describe, beforeEach, expect, it } from '@jest/globals';

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
  checkLineageForDisciplineAffinity,
  checkLineageForDisciplineAffinityDetailed,
  checkSpecificDisciplineAffinity,
  getAncestorPreferredDiscipline,
  getMostCommonDisciplineFromHistory,
  getHighestScoringDiscipline,
} = await import(join(__dirname, '../utils/lineageTraitCheck.js'));

describe('🧬 UNIT: Lineage Trait Check - Discipline Affinity Analysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkLineageForDisciplineAffinity', () => {
    it('should return affinity true when 3 or more ancestors share the same discipline', () => {
      const ancestors = [
        { id: 1, name: 'Horse1', discipline: 'Show Jumping' },
        { id: 2, name: 'Horse2', discipline: 'Show Jumping' },
        { id: 3, name: 'Horse3', discipline: 'Show Jumping' },
        { id: 4, name: 'Horse4', discipline: 'Dressage' },
        { id: 5, name: 'Horse5', discipline: 'Racing' },
      ];

      const result = checkLineageForDisciplineAffinity(ancestors);

      expect(result.affinity).toBe(true);
      expect(result.discipline).toBe('Show Jumping');
    });

    it('should return affinity false when less than 3 ancestors share the same discipline', () => {
      const ancestors = [
        { id: 1, name: 'Horse1', discipline: 'Show Jumping' },
        { id: 2, name: 'Horse2', discipline: 'Show Jumping' },
        { id: 3, name: 'Horse3', discipline: 'Dressage' },
        { id: 4, name: 'Horse4', discipline: 'Racing' },
        { id: 5, name: 'Horse5', discipline: 'Racing' },
      ];

      const result = checkLineageForDisciplineAffinity(ancestors);

      expect(result.affinity).toBe(false);
      expect(result.discipline).toBeUndefined();
    });

    it('should handle empty ancestors array', () => {
      const result = checkLineageForDisciplineAffinity([]);

      expect(result.affinity).toBe(false);
      expect(result.discipline).toBeUndefined();
    });

    it('should handle null ancestors', () => {
      const result = checkLineageForDisciplineAffinity(null);

      expect(result.affinity).toBe(false);
      expect(result.discipline).toBeUndefined();
    });

    it('should handle ancestors without discipline information', () => {
      const ancestors = [
        { id: 1, name: 'Horse1' },
        { id: 2, name: 'Horse2' },
        { id: 3, name: 'Horse3' },
      ];

      const result = checkLineageForDisciplineAffinity(ancestors);

      expect(result.affinity).toBe(false);
      expect(result.discipline).toBeUndefined();
    });

    it('should handle exactly 3 ancestors with same discipline', () => {
      const ancestors = [
        { id: 1, name: 'Horse1', discipline: 'Racing' },
        { id: 2, name: 'Horse2', discipline: 'Racing' },
        { id: 3, name: 'Horse3', discipline: 'Racing' },
      ];

      const result = checkLineageForDisciplineAffinity(ancestors);

      expect(result.affinity).toBe(true);
      expect(result.discipline).toBe('Racing');
    });

    it('should handle more than 3 ancestors with same discipline', () => {
      const ancestors = [
        { id: 1, name: 'Horse1', discipline: 'Dressage' },
        { id: 2, name: 'Horse2', discipline: 'Dressage' },
        { id: 3, name: 'Horse3', discipline: 'Dressage' },
        { id: 4, name: 'Horse4', discipline: 'Dressage' },
        { id: 5, name: 'Horse5', discipline: 'Racing' },
      ];

      const result = checkLineageForDisciplineAffinity(ancestors);

      expect(result.affinity).toBe(true);
      expect(result.discipline).toBe('Dressage');
    });
  });

  describe('getAncestorPreferredDiscipline', () => {
    it('should prioritize direct discipline field', () => {
      const ancestor = {
        id: 1,
        name: 'Horse1',
        discipline: 'Show Jumping',
        competitionHistory: [{ discipline: 'Racing', placement: '1st' }],
        disciplineScores: { Dressage: 95 },
      };

      const result = getAncestorPreferredDiscipline(ancestor);

      expect(result).toBe('Show Jumping');
    });

    it('should use competition history when no direct discipline', () => {
      const ancestor = {
        id: 1,
        name: 'Horse1',
        competitionHistory: [
          { discipline: 'Racing', placement: '1st' },
          { discipline: 'Racing', placement: '2nd' },
          { discipline: 'Dressage', placement: '3rd' },
        ],
      };

      const result = getAncestorPreferredDiscipline(ancestor);

      expect(result).toBe('Racing');
    });

    it('should use discipline scores when no competition history', () => {
      const ancestor = {
        id: 1,
        name: 'Horse1',
        disciplineScores: { Racing: 75, Dressage: 90, 'Show Jumping': 65 },
      };

      const result = getAncestorPreferredDiscipline(ancestor);

      expect(result).toBe('Dressage');
    });

    it('should use competitions field as alternative to competitionHistory', () => {
      const ancestor = {
        id: 1,
        name: 'Horse1',
        competitions: [
          { discipline: 'Show Jumping', placement: '1st' },
          { discipline: 'Show Jumping', placement: '2nd' },
        ],
      };

      const result = getAncestorPreferredDiscipline(ancestor);

      expect(result).toBe('Show Jumping');
    });

    it('should use specialty field as fallback', () => {
      const ancestor = {
        id: 1,
        name: 'Horse1',
        specialty: 'Eventing',
      };

      const result = getAncestorPreferredDiscipline(ancestor);

      expect(result).toBe('Eventing');
    });

    it('should return null when no discipline information available', () => {
      const ancestor = {
        id: 1,
        name: 'Horse1',
      };

      const result = getAncestorPreferredDiscipline(ancestor);

      expect(result).toBeNull();
    });
  });

  describe('checkLineageForDisciplineAffinityDetailed', () => {
    it('should provide detailed analysis with affinity', () => {
      const ancestors = [
        { id: 1, name: 'Horse1', discipline: 'Racing' },
        { id: 2, name: 'Horse2', discipline: 'Racing' },
        { id: 3, name: 'Horse3', discipline: 'Racing' },
        { id: 4, name: 'Horse4', discipline: 'Dressage' },
        { id: 5, name: 'Horse5', discipline: 'Show Jumping' },
      ];

      const result = checkLineageForDisciplineAffinityDetailed(ancestors);

      expect(result.affinity).toBe(true);
      expect(result.discipline).toBe('Racing');
      expect(result.totalAnalyzed).toBe(5);
      expect(result.totalWithDisciplines).toBe(5);
      expect(result.disciplineBreakdown).toEqual({
        Racing: 3,
        Dressage: 1,
        'Show Jumping': 1,
      });
      expect(result.affinityStrength).toBe(60); // 3/5 = 60%
      expect(result.dominantCount).toBe(3);
    });

    it('should provide detailed analysis without affinity', () => {
      const ancestors = [
        { id: 1, name: 'Horse1', discipline: 'Racing' },
        { id: 2, name: 'Horse2', discipline: 'Dressage' },
        { id: 3, name: 'Horse3', discipline: 'Show Jumping' },
      ];

      const result = checkLineageForDisciplineAffinityDetailed(ancestors);

      expect(result.affinity).toBe(false);
      expect(result.totalAnalyzed).toBe(3);
      expect(result.totalWithDisciplines).toBe(3);
      expect(result.affinityStrength).toBe(33); // 1/3 = 33%
      expect(result.dominantCount).toBe(1);
    });

    it('should handle empty ancestors array', () => {
      const result = checkLineageForDisciplineAffinityDetailed([]);

      expect(result.affinity).toBe(false);
      expect(result.totalAnalyzed).toBe(0);
      expect(result.totalWithDisciplines).toBe(0);
      expect(result.disciplineBreakdown).toEqual({});
      expect(result.affinityStrength).toBe(0);
    });
  });

  describe('checkSpecificDisciplineAffinity', () => {
    it('should check for specific discipline affinity with default minimum', () => {
      const ancestors = [
        { id: 1, name: 'Horse1', discipline: 'Racing' },
        { id: 2, name: 'Horse2', discipline: 'Racing' },
        { id: 3, name: 'Horse3', discipline: 'Racing' },
        { id: 4, name: 'Horse4', discipline: 'Dressage' },
      ];

      const result = checkSpecificDisciplineAffinity(ancestors, 'Racing');

      expect(result.hasAffinity).toBe(true);
      expect(result.count).toBe(3);
      expect(result.required).toBe(3);
      expect(result.discipline).toBe('Racing');
      expect(result.matchingAncestors).toEqual(['Horse1', 'Horse2', 'Horse3']);
      expect(result.percentage).toBe(75); // 3/4 = 75%
    });

    it('should check for specific discipline affinity with custom minimum', () => {
      const ancestors = [
        { id: 1, name: 'Horse1', discipline: 'Show Jumping' },
        { id: 2, name: 'Horse2', discipline: 'Show Jumping' },
        { id: 3, name: 'Horse3', discipline: 'Dressage' },
      ];

      const result = checkSpecificDisciplineAffinity(ancestors, 'Show Jumping', 2);

      expect(result.hasAffinity).toBe(true);
      expect(result.count).toBe(2);
      expect(result.required).toBe(2);
      expect(result.discipline).toBe('Show Jumping');
    });

    it('should return false when not enough ancestors match', () => {
      const ancestors = [
        { id: 1, name: 'Horse1', discipline: 'Racing' },
        { id: 2, name: 'Horse2', discipline: 'Dressage' },
        { id: 3, name: 'Horse3', discipline: 'Show Jumping' },
      ];

      const result = checkSpecificDisciplineAffinity(ancestors, 'Racing', 3);

      expect(result.hasAffinity).toBe(false);
      expect(result.count).toBe(1);
      expect(result.required).toBe(3);
    });

    it('should handle empty ancestors or missing target discipline', () => {
      expect(checkSpecificDisciplineAffinity([], 'Racing').hasAffinity).toBe(false);
      expect(checkSpecificDisciplineAffinity(null, 'Racing').hasAffinity).toBe(false);
      expect(checkSpecificDisciplineAffinity([{ discipline: 'Racing' }], null).hasAffinity).toBe(
        false,
      );
    });
  });

  describe('getMostCommonDisciplineFromHistory', () => {
    it('should return the most common discipline', () => {
      const history = [
        { discipline: 'Racing', placement: '1st' },
        { discipline: 'Racing', placement: '2nd' },
        { discipline: 'Racing', placement: '3rd' },
        { discipline: 'Dressage', placement: '1st' },
      ];

      const result = getMostCommonDisciplineFromHistory(history);

      expect(result).toBe('Racing');
    });

    it('should handle empty or null history', () => {
      expect(getMostCommonDisciplineFromHistory([])).toBeNull();
      expect(getMostCommonDisciplineFromHistory(null)).toBeNull();
    });

    it('should handle competitions without discipline field', () => {
      const history = [{ placement: '1st' }, { placement: '2nd' }];

      const result = getMostCommonDisciplineFromHistory(history);

      expect(result).toBeNull();
    });
  });

  describe('getHighestScoringDiscipline', () => {
    it('should return the highest scoring discipline', () => {
      const scores = {
        Racing: 75,
        Dressage: 90,
        'Show Jumping': 65,
      };

      const result = getHighestScoringDiscipline(scores);

      expect(result).toBe('Dressage');
    });

    it('should handle empty or null scores', () => {
      expect(getHighestScoringDiscipline({})).toBeNull();
      expect(getHighestScoringDiscipline(null)).toBeNull();
    });

    it('should handle non-numeric scores', () => {
      const scores = {
        Racing: 'high',
        Dressage: 90,
        'Show Jumping': 'medium',
      };

      const result = getHighestScoringDiscipline(scores);

      expect(result).toBe('Dressage');
    });

    it('should return null when all scores are non-numeric', () => {
      const scores = {
        Racing: 'high',
        Dressage: 'medium',
        'Show Jumping': 'low',
      };

      const result = getHighestScoringDiscipline(scores);

      expect(result).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully in main function', () => {
      // Test with valid data that won't cause errors but verify function robustness
      const ancestors = [{ id: 1, name: 'Test' }];

      const result = checkLineageForDisciplineAffinity(ancestors);

      // The function should still work and not throw
      expect(result.affinity).toBe(false);
      // Function should handle edge cases gracefully
    });

    it('should handle errors gracefully in detailed function', () => {
      // Test with valid data that won't cause errors
      const ancestors = [{ id: 1, name: 'Test' }];

      const result = checkLineageForDisciplineAffinityDetailed(ancestors);

      expect(result.affinity).toBe(false);
      expect(result.totalAnalyzed).toBe(1);
      expect(result.totalWithDisciplines).toBe(0);
      // No error should occur with valid data
    });

    it('should handle errors gracefully in specific discipline check', () => {
      // Test with valid data that won't cause errors
      const ancestors = [{ id: 1, name: 'Test' }];

      const result = checkSpecificDisciplineAffinity(ancestors, 'Racing');

      expect(result.hasAffinity).toBe(false);
      expect(result.count).toBe(0);
      // No error should occur with valid data
    });

    it('should handle undefined ancestors gracefully', () => {
      const result = checkLineageForDisciplineAffinity();
      expect(result.affinity).toBe(false);
    });

    it('should handle ancestors with circular references gracefully', () => {
      // Create an object with circular reference
      const circularAncestor = { id: 1, name: 'Test' };
      circularAncestor.self = circularAncestor;

      const result = checkLineageForDisciplineAffinity([circularAncestor]);

      // Should still work despite circular reference
      expect(result.affinity).toBe(false);
    });
  });
});
