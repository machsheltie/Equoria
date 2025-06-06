/**
 * Task Influence Configuration Test Suite
 * Tests for task-to-trait influence mapping and epigenetic trait point accumulation
 *
 * 🎯 FEATURES TESTED:
 * - Task influence map structure and validation
 * - Trait point accumulation system for epigenetic development
 * - Integration between foal tasks and trait probability
 * - Daily value consistency and business rule validation
 * - Trait name validation against existing trait definitions
 * - Task coverage for all foal-specific activities
 *
 * 🔧 DEPENDENCIES:
 * - taskInfluenceConfig.mjs (task influence mapping)
 * - groomConfig.mjs (task category definitions)
 * - traitEvaluation.mjs (trait definitions for validation)
 *
 * 📋 BUSINESS RULES TESTED:
 * - Each foal task maps to specific epigenetic traits
 * - Daily value determines trait point contribution per successful task
 * - Trait points accumulate to influence trait probability during development
 * - All task types have consistent daily value structure
 * - Trait names reference valid epigenetic traits
 * - Task influence supports both enrichment and grooming activities
 *
 * 🧪 TESTING APPROACH:
 * - Mock: None (testing real configuration values)
 * - Real: All task mappings, trait references, daily values, validation logic
 */

import { describe, it, expect } from '@jest/globals';
import {
  TASK_TRAIT_INFLUENCE_MAP,
  getTaskInfluence,
  getTraitsInfluencedByTask,
  getDailyTraitValue,
  getTasksInfluencingTrait,
  getAllInfluencedTraits,
  calculateTraitPoints,
  validateTaskInfluenceMap,
} from '../config/taskInfluenceConfig.mjs';
import { ELIGIBLE_FOAL_ENRICHMENT_TASKS, FOAL_GROOMING_TASKS } from '../config/groomConfig.mjs';

describe('Task Influence Configuration', () => {
  describe('Task Influence Map Structure', () => {
    it('should define influence map for all foal tasks', () => {
      expect(TASK_TRAIT_INFLUENCE_MAP).toBeDefined();
      expect(typeof TASK_TRAIT_INFLUENCE_MAP).toBe('object');
    });

    it('should have entries for all enrichment tasks', () => {
      ELIGIBLE_FOAL_ENRICHMENT_TASKS.forEach(task => {
        expect(TASK_TRAIT_INFLUENCE_MAP).toHaveProperty(task);
        expect(TASK_TRAIT_INFLUENCE_MAP[task]).toHaveProperty('traits');
        expect(TASK_TRAIT_INFLUENCE_MAP[task]).toHaveProperty('dailyValue');
      });
    });

    it('should have entries for all grooming tasks', () => {
      FOAL_GROOMING_TASKS.forEach(task => {
        expect(TASK_TRAIT_INFLUENCE_MAP).toHaveProperty(task);
        expect(TASK_TRAIT_INFLUENCE_MAP[task]).toHaveProperty('traits');
        expect(TASK_TRAIT_INFLUENCE_MAP[task]).toHaveProperty('dailyValue');
      });
    });

    it('should have correct structure for each task entry', () => {
      Object.entries(TASK_TRAIT_INFLUENCE_MAP).forEach(([_taskName, influence]) => {
        // Check required properties
        expect(influence).toHaveProperty('traits');
        expect(influence).toHaveProperty('dailyValue');

        // Check data types
        expect(Array.isArray(influence.traits)).toBe(true);
        expect(typeof influence.dailyValue).toBe('number');

        // Check constraints
        expect(influence.traits.length).toBeGreaterThan(0);
        expect(influence.dailyValue).toBeGreaterThan(0);
        expect(influence.dailyValue).toBeLessThanOrEqual(10); // Reasonable daily value limit

        // Check trait names are strings
        influence.traits.forEach(trait => {
          expect(typeof trait).toBe('string');
          expect(trait.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Task Coverage Validation', () => {
    it('should cover all enrichment tasks', () => {
      const expectedTasks = ['desensitization', 'trust_building', 'showground_exposure'];

      expectedTasks.forEach(task => {
        expect(TASK_TRAIT_INFLUENCE_MAP).toHaveProperty(task);
      });
    });

    it('should cover all grooming tasks', () => {
      const expectedTasks = [
        'early_touch',
        'hoof_handling',
        'tying_practice',
        'sponge_bath',
        'coat_check',
        'mane_tail_grooming',
      ];

      expectedTasks.forEach(task => {
        expect(TASK_TRAIT_INFLUENCE_MAP).toHaveProperty(task);
      });
    });

    it('should not have entries for non-foal tasks', () => {
      const nonFoalTasks = ['general_grooming', 'exercise', 'medical_check', 'feeding'];

      nonFoalTasks.forEach(task => {
        expect(TASK_TRAIT_INFLUENCE_MAP).not.toHaveProperty(task);
      });
    });
  });

  describe('Trait Influence Validation', () => {
    it('should have logical trait mappings for enrichment tasks', () => {
      // desensitization should influence confidence-related traits
      expect(TASK_TRAIT_INFLUENCE_MAP.desensitization.traits).toContain('confident');

      // trust_building should influence bonding and resilience
      expect(TASK_TRAIT_INFLUENCE_MAP.trust_building.traits).toContain('bonded');
      expect(TASK_TRAIT_INFLUENCE_MAP.trust_building.traits).toContain('resilient');

      // showground_exposure should influence crowd readiness and confidence
      expect(TASK_TRAIT_INFLUENCE_MAP.showground_exposure.traits).toContain('crowd_ready');
      expect(TASK_TRAIT_INFLUENCE_MAP.showground_exposure.traits).toContain('confident');
    });

    it('should have logical trait mappings for grooming tasks', () => {
      // early_touch should influence calmness
      expect(TASK_TRAIT_INFLUENCE_MAP.early_touch.traits).toContain('calm');

      // hoof_handling should influence show calmness
      expect(TASK_TRAIT_INFLUENCE_MAP.hoof_handling.traits).toContain('show_calm');

      // tying_practice should influence show calmness
      expect(TASK_TRAIT_INFLUENCE_MAP.tying_practice.traits).toContain('show_calm');

      // presentation tasks should influence presentation traits
      expect(TASK_TRAIT_INFLUENCE_MAP.sponge_bath.traits).toContain('presentation_boosted');
      expect(TASK_TRAIT_INFLUENCE_MAP.coat_check.traits).toContain('presentation_boosted');
      expect(TASK_TRAIT_INFLUENCE_MAP.mane_tail_grooming.traits).toContain('presentation_boosted');
    });

    it('should have consistent daily values', () => {
      const dailyValues = Object.values(TASK_TRAIT_INFLUENCE_MAP).map(
        influence => influence.dailyValue,
      );

      // All daily values should be the same for consistency
      const uniqueValues = [...new Set(dailyValues)];
      expect(uniqueValues).toHaveLength(1);
      expect(uniqueValues[0]).toBe(5); // Expected daily value
    });

    it('should have unique trait combinations per task', () => {
      Object.entries(TASK_TRAIT_INFLUENCE_MAP).forEach(([_taskName, influence]) => {
        // Check for duplicate traits within the same task
        const uniqueTraits = [...new Set(influence.traits)];
        expect(uniqueTraits.length).toBe(influence.traits.length);
      });
    });
  });

  describe('Business Rule Validation', () => {
    it('should support trait point accumulation system', () => {
      // Each task should contribute meaningful points
      Object.values(TASK_TRAIT_INFLUENCE_MAP).forEach(influence => {
        expect(influence.dailyValue).toBeGreaterThanOrEqual(1);
        expect(influence.dailyValue).toBeLessThanOrEqual(10);
      });
    });

    it('should have reasonable trait distribution', () => {
      // Count trait occurrences across all tasks
      const traitCounts = {};

      Object.values(TASK_TRAIT_INFLUENCE_MAP).forEach(influence => {
        influence.traits.forEach(trait => {
          traitCounts[trait] = (traitCounts[trait] || 0) + 1;
        });
      });

      // No trait should be overly dominant
      Object.values(traitCounts).forEach(count => {
        expect(count).toBeLessThanOrEqual(5); // Max 5 tasks per trait
      });

      // Should have good variety of traits
      expect(Object.keys(traitCounts).length).toBeGreaterThanOrEqual(6);
    });

    it('should support epigenetic development progression', () => {
      // Early tasks (enrichment) should focus on foundational traits
      const enrichmentTraits = new Set();
      ELIGIBLE_FOAL_ENRICHMENT_TASKS.forEach(task => {
        TASK_TRAIT_INFLUENCE_MAP[task].traits.forEach(trait => {
          enrichmentTraits.add(trait);
        });
      });

      // Later tasks (grooming) should focus on presentation traits
      const groomingTraits = new Set();
      FOAL_GROOMING_TASKS.forEach(task => {
        TASK_TRAIT_INFLUENCE_MAP[task].traits.forEach(trait => {
          groomingTraits.add(trait);
        });
      });

      // Should have some overlap but also distinct focuses
      expect(enrichmentTraits.size).toBeGreaterThan(0);
      expect(groomingTraits.size).toBeGreaterThan(0);
    });
  });

  describe('Integration Validation', () => {
    it('should integrate with foal task categories', () => {
      const allFoalTasks = [...ELIGIBLE_FOAL_ENRICHMENT_TASKS, ...FOAL_GROOMING_TASKS];
      const influenceMapTasks = Object.keys(TASK_TRAIT_INFLUENCE_MAP);

      // All foal tasks should have influence mappings
      allFoalTasks.forEach(task => {
        expect(influenceMapTasks).toContain(task);
      });

      // No extra tasks should be in influence map
      influenceMapTasks.forEach(task => {
        expect(allFoalTasks).toContain(task);
      });
    });

    it('should provide complete task influence coverage', () => {
      const totalFoalTasks = ELIGIBLE_FOAL_ENRICHMENT_TASKS.length + FOAL_GROOMING_TASKS.length;
      const totalInfluenceTasks = Object.keys(TASK_TRAIT_INFLUENCE_MAP).length;

      expect(totalInfluenceTasks).toBe(totalFoalTasks);
    });
  });

  describe('Data Quality Validation', () => {
    it('should have meaningful trait names', () => {
      const allTraits = new Set();

      Object.values(TASK_TRAIT_INFLUENCE_MAP).forEach(influence => {
        influence.traits.forEach(trait => {
          allTraits.add(trait);

          // Trait names should be descriptive
          expect(trait.length).toBeGreaterThan(3);
          expect(trait).toMatch(/^[a-z_]+$/); // Snake case format
        });
      });

      // Should have reasonable number of unique traits
      expect(allTraits.size).toBeGreaterThanOrEqual(6);
      expect(allTraits.size).toBeLessThanOrEqual(15);
    });

    it('should maintain consistent naming conventions', () => {
      Object.keys(TASK_TRAIT_INFLUENCE_MAP).forEach(taskName => {
        // Task names should match foal task naming convention
        expect(taskName).toMatch(/^[a-z_]+$/);
      });

      Object.values(TASK_TRAIT_INFLUENCE_MAP).forEach(influence => {
        influence.traits.forEach(trait => {
          // Trait names should use snake_case
          expect(trait).toMatch(/^[a-z_]+$/);
        });
      });
    });
  });

  describe('Utility Functions', () => {
    describe('getTaskInfluence', () => {
      it('should return influence object for valid task', () => {
        const influence = getTaskInfluence('trust_building');

        expect(influence).toBeDefined();
        expect(influence).toHaveProperty('traits');
        expect(influence).toHaveProperty('dailyValue');
        expect(influence.traits).toContain('bonded');
        expect(influence.dailyValue).toBe(5);
      });

      it('should return null for invalid task', () => {
        const influence = getTaskInfluence('invalid_task');
        expect(influence).toBeNull();
      });
    });

    describe('getTraitsInfluencedByTask', () => {
      it('should return traits for valid task', () => {
        const traits = getTraitsInfluencedByTask('showground_exposure');

        expect(Array.isArray(traits)).toBe(true);
        expect(traits).toContain('crowd_ready');
        expect(traits).toContain('confident');
      });

      it('should return empty array for invalid task', () => {
        const traits = getTraitsInfluencedByTask('invalid_task');
        expect(traits).toEqual([]);
      });

      it('should return copy of traits array', () => {
        const traits1 = getTraitsInfluencedByTask('trust_building');
        const traits2 = getTraitsInfluencedByTask('trust_building');

        expect(traits1).not.toBe(traits2); // Different array instances
        expect(traits1).toEqual(traits2); // Same content
      });
    });

    describe('getDailyTraitValue', () => {
      it('should return daily value for valid task', () => {
        const value = getDailyTraitValue('early_touch');
        expect(value).toBe(5);
      });

      it('should return 0 for invalid task', () => {
        const value = getDailyTraitValue('invalid_task');
        expect(value).toBe(0);
      });
    });

    describe('getTasksInfluencingTrait', () => {
      it('should return tasks that influence a specific trait', () => {
        const tasks = getTasksInfluencingTrait('confident');

        expect(Array.isArray(tasks)).toBe(true);
        expect(tasks).toContain('desensitization');
        expect(tasks).toContain('showground_exposure');
      });

      it('should return empty array for non-existent trait', () => {
        const tasks = getTasksInfluencingTrait('non_existent_trait');
        expect(tasks).toEqual([]);
      });

      it('should return all tasks for presentation_boosted trait', () => {
        const tasks = getTasksInfluencingTrait('presentation_boosted');

        expect(tasks).toContain('sponge_bath');
        expect(tasks).toContain('coat_check');
        expect(tasks).toContain('mane_tail_grooming');
      });
    });

    describe('getAllInfluencedTraits', () => {
      it('should return all unique traits', () => {
        const traits = getAllInfluencedTraits();

        expect(Array.isArray(traits)).toBe(true);
        expect(traits.length).toBeGreaterThan(0);

        // Should contain expected traits
        expect(traits).toContain('confident');
        expect(traits).toContain('bonded');
        expect(traits).toContain('calm');
        expect(traits).toContain('show_calm');
        expect(traits).toContain('presentation_boosted');
      });

      it('should return sorted array', () => {
        const traits = getAllInfluencedTraits();
        const sortedTraits = [...traits].sort();

        expect(traits).toEqual(sortedTraits);
      });

      it('should return unique traits only', () => {
        const traits = getAllInfluencedTraits();
        const uniqueTraits = [...new Set(traits)];

        expect(traits.length).toBe(uniqueTraits.length);
      });
    });

    describe('calculateTraitPoints', () => {
      it('should calculate trait points for single task', () => {
        const taskCompletions = { trust_building: 3 };
        const traitPoints = calculateTraitPoints(taskCompletions);

        expect(traitPoints.bonded).toBe(15); // 3 completions * 5 points
        expect(traitPoints.resilient).toBe(15); // 3 completions * 5 points
      });

      it('should calculate trait points for multiple tasks', () => {
        const taskCompletions = {
          trust_building: 2,
          desensitization: 1,
          early_touch: 3,
        };
        const traitPoints = calculateTraitPoints(taskCompletions);

        expect(traitPoints.bonded).toBe(10); // trust_building: 2 * 5
        expect(traitPoints.resilient).toBe(10); // trust_building: 2 * 5
        expect(traitPoints.confident).toBe(5); // desensitization: 1 * 5
        expect(traitPoints.calm).toBe(15); // early_touch: 3 * 5
      });

      it('should handle overlapping traits correctly', () => {
        const taskCompletions = {
          desensitization: 2,
          showground_exposure: 1,
        };
        const traitPoints = calculateTraitPoints(taskCompletions);

        // Both tasks influence 'confident' trait
        expect(traitPoints.confident).toBe(15); // (2 * 5) + (1 * 5)
        expect(traitPoints.crowd_ready).toBe(5); // showground_exposure: 1 * 5
      });

      it('should ignore invalid tasks', () => {
        const taskCompletions = {
          trust_building: 2,
          invalid_task: 5,
        };
        const traitPoints = calculateTraitPoints(taskCompletions);

        expect(traitPoints.bonded).toBe(10);
        expect(traitPoints.resilient).toBe(10);
        expect(Object.keys(traitPoints)).toHaveLength(2);
      });

      it('should handle zero completions', () => {
        const taskCompletions = { trust_building: 0 };
        const traitPoints = calculateTraitPoints(taskCompletions);

        expect(Object.keys(traitPoints)).toHaveLength(0);
      });
    });

    describe('validateTaskInfluenceMap', () => {
      it('should validate correct structure', () => {
        const result = validateTaskInfluenceMap();

        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      // Note: Testing invalid structures would require modifying the actual map,
      // which would break other tests. In a real scenario, we might test this
      // with a separate test configuration or mock the map.
    });
  });
});
