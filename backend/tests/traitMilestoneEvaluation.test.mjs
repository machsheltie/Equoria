/**
 * Trait Milestone Evaluation Test Suite
 * Tests for evaluating epigenetic traits at age 1 milestone based on foal task history
 *
 * 🎯 FEATURES TESTED:
 * - Trait milestone evaluation at age 1 based on task history
 * - Task log analysis and trait point calculation
 * - Streak bonus application for burnout immunity
 * - Probability-based trait assignment with caps
 * - Integration with task influence mapping
 * - Edge cases and validation
 *
 * 🔧 DEPENDENCIES:
 * - traitEvaluation.mjs (milestone evaluation function)
 * - taskInfluenceConfig.mjs (task influence mapping)
 * - foalTaskLogManager.mjs (task log utilities)
 *
 * 📋 BUSINESS RULES TESTED:
 * - Trait points calculated from task completion counts × daily values
 * - Streak bonus (+10 points) applied when consecutive days ≥ 7
 * - Trait probability capped at 60% maximum
 * - Random chance determines final trait assignment
 * - Task history drives epigenetic trait development
 * - Age 1 milestone triggers comprehensive trait evaluation
 *
 * 🧪 TESTING APPROACH:
 * - Mock: Math.random for deterministic probability testing
 * - Real: All business logic, task influence calculations, trait evaluation
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
  logger: mockLogger,
}));

// Import the functions after mocking
const { evaluateEpigeneticTagsFromFoalTasks } = await import(
  join(__dirname, '../utils/traitEvaluation.js')
);

describe('Trait Milestone Evaluation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('evaluateEpigeneticTagsFromFoalTasks', () => {
    it('should evaluate traits from task log without streak bonus', () => {
      const taskLog = {
        trust_building: 4, // 4 × 5 = 20 points to bonded, resilient
        desensitization: 2, // 2 × 5 = 10 points to confident
        early_touch: 3, // 3 × 5 = 15 points to calm
      };

      // Mock random to ensure trait assignment (below all thresholds)
      jest.spyOn(Math, 'random').mockReturnValue(0.05); // 5% - below all calculated chances

      const result = evaluateEpigeneticTagsFromFoalTasks(taskLog, 0);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toContain('bonded'); // 20% chance
      expect(result).toContain('resilient'); // 20% chance
      expect(result).toContain('confident'); // 10% chance
      expect(result).toContain('calm'); // 15% chance
    });

    it('should apply streak bonus when consecutive days >= 7', () => {
      const taskLog = {
        trust_building: 2, // 2 × 5 = 10 points + 10 bonus = 20 points
        desensitization: 1, // 1 × 5 = 5 points + 10 bonus = 15 points
      };

      jest.spyOn(Math, 'random').mockReturnValue(0.1); // 10% - below all thresholds

      const result = evaluateEpigeneticTagsFromFoalTasks(taskLog, 7);

      expect(result).toContain('bonded'); // 20% chance (with bonus)
      expect(result).toContain('resilient'); // 20% chance (with bonus)
      expect(result).toContain('confident'); // 15% chance (with bonus)
    });

    it('should cap trait probability at 60%', () => {
      const taskLog = {
        trust_building: 20, // 20 × 5 = 100 points, capped at 60%
        desensitization: 15, // 15 × 5 = 75 points, capped at 60%
      };

      // Mock random to test cap - use 50% which should still trigger
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // 50%

      const result = evaluateEpigeneticTagsFromFoalTasks(taskLog, 0);

      expect(result).toContain('bonded'); // Capped at 60%, 50% random should trigger
      expect(result).toContain('resilient'); // Capped at 60%, 50% random should trigger
      expect(result).toContain('confident'); // Capped at 60%, 50% random should trigger
    });

    it('should not assign traits when random chance is too high', () => {
      const taskLog = {
        trust_building: 2, // 2 × 5 = 10 points = 10% chance
        desensitization: 1, // 1 × 5 = 5 points = 5% chance
      };

      // Mock random to be above all thresholds
      jest.spyOn(Math, 'random').mockReturnValue(0.9); // 90% - above all chances

      const result = evaluateEpigeneticTagsFromFoalTasks(taskLog, 0);

      expect(result).toEqual([]); // No traits should be assigned
    });

    it('should handle empty task log', () => {
      const taskLog = {};

      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const result = evaluateEpigeneticTagsFromFoalTasks(taskLog, 0);

      expect(result).toEqual([]); // No tasks = no traits
    });

    it('should handle null task log', () => {
      const taskLog = null;

      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const result = evaluateEpigeneticTagsFromFoalTasks(taskLog, 0);

      expect(result).toEqual([]); // Null task log = no traits
    });

    it('should handle tasks not in influence map', () => {
      const taskLog = {
        trust_building: 3,
        invalid_task: 5, // Not in TASK_TRAIT_INFLUENCE_MAP
        another_invalid: 2,
      };

      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const result = evaluateEpigeneticTagsFromFoalTasks(taskLog, 0);

      // Should only process valid tasks
      expect(result).toContain('bonded');
      expect(result).toContain('resilient');
      expect(result.length).toBe(2); // Only traits from trust_building
    });

    it('should handle multiple tasks influencing same trait', () => {
      const taskLog = {
        desensitization: 2, // 2 × 5 = 10 points to confident
        showground_exposure: 1, // 1 × 5 = 5 points to confident (and crowd_ready)
      };

      jest.spyOn(Math, 'random').mockReturnValue(0.04); // 4% - below both 15% and 5%

      const result = evaluateEpigeneticTagsFromFoalTasks(taskLog, 0);

      // confident should get points from both tasks: 10 + 5 = 15%
      expect(result).toContain('confident');
      expect(result).toContain('crowd_ready'); // 5% chance
    });

    it('should return unique traits only', () => {
      const taskLog = {
        trust_building: 5,
        desensitization: 3,
        early_touch: 2,
      };

      // Mock random to return different values for each call
      let _callCount = 0;
      jest.spyOn(Math, 'random').mockImplementation(() => {
        _callCount++;
        return 0.1; // Always trigger traits
      });

      const result = evaluateEpigeneticTagsFromFoalTasks(taskLog, 0);

      // Should not have duplicates
      const uniqueResult = [...new Set(result)];
      expect(result.length).toBe(uniqueResult.length);
    });

    it('should handle comprehensive foal development scenario', () => {
      const taskLog = {
        // Enrichment tasks
        trust_building: 8, // 40 points to bonded, resilient
        desensitization: 5, // 25 points to confident
        showground_exposure: 3, // 15 points to confident, crowd_ready

        // Grooming tasks
        early_touch: 6, // 30 points to calm
        hoof_handling: 4, // 20 points to show_calm
        sponge_bath: 2, // 10 points to show_calm, presentation_boosted
      };

      jest.spyOn(Math, 'random').mockReturnValue(0.3); // 30% - will trigger some traits

      const result = evaluateEpigeneticTagsFromFoalTasks(taskLog, 7); // With streak bonus

      // With streak bonus, most traits should be triggered
      // bonded: 40 + 10 = 50% > 30% ✓
      // resilient: 40 + 10 = 50% > 30% ✓
      // confident: (25 + 15) + 10 = 50% > 30% ✓
      // crowd_ready: 15 + 10 = 25% < 30% ✗
      // calm: 30 + 10 = 40% > 30% ✓
      // show_calm: (20 + 10) + 10 = 40% > 30% ✓
      // presentation_boosted: 10 + 10 = 20% < 30% ✗

      expect(result).toContain('bonded');
      expect(result).toContain('resilient');
      expect(result).toContain('confident');
      expect(result).toContain('calm');
      expect(result).toContain('show_calm');
      expect(result).not.toContain('crowd_ready');
      expect(result).not.toContain('presentation_boosted');
    });

    it('should handle edge case with zero task counts', () => {
      const taskLog = {
        trust_building: 0,
        desensitization: 3,
        early_touch: 0,
      };

      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const result = evaluateEpigeneticTagsFromFoalTasks(taskLog, 0);

      // Only desensitization should contribute
      expect(result).toContain('confident');
      expect(result).not.toContain('bonded');
      expect(result).not.toContain('calm');
    });

    it('should handle negative streak values', () => {
      const taskLog = {
        trust_building: 2, // 2 × 5 = 10 points to bonded, resilient
      };

      jest.spyOn(Math, 'random').mockReturnValue(0.05); // 5% - below 10%

      const result = evaluateEpigeneticTagsFromFoalTasks(taskLog, -5);

      // Negative streak should not apply bonus (treated as 0)
      expect(result).toContain('bonded'); // 10% chance
      expect(result).toContain('resilient'); // 10% chance
    });

    it('should handle very high task counts with capping', () => {
      const taskLog = {
        trust_building: 50, // 50 × 5 = 250 points, capped at 60%
        desensitization: 30, // 30 × 5 = 150 points, capped at 60%
      };

      jest.spyOn(Math, 'random').mockReturnValue(0.7); // 70% - above cap

      const result = evaluateEpigeneticTagsFromFoalTasks(taskLog, 0);

      expect(result).toEqual([]); // 70% random > 60% cap, no traits assigned
    });

    it('should demonstrate probability distribution', () => {
      const taskLog = {
        trust_building: 3, // 15% chance for bonded, resilient
        desensitization: 2, // 10% chance for confident
      };

      // Test multiple probability thresholds
      const testCases = [
        { random: 0.05, expectedTraits: ['bonded', 'resilient', 'confident'] }, // 5% - all trigger
        { random: 0.12, expectedTraits: ['bonded', 'resilient'] }, // 12% - only 15% trigger
        { random: 0.2, expectedTraits: [] }, // 20% - none trigger
      ];

      testCases.forEach(({ random, expectedTraits }) => {
        jest.spyOn(Math, 'random').mockReturnValue(random);

        const result = evaluateEpigeneticTagsFromFoalTasks(taskLog, 0);

        expectedTraits.forEach(trait => {
          expect(result).toContain(trait);
        });

        expect(result.length).toBe(expectedTraits.length);
      });
    });
  });
});
