/**
 * Trait Milestone Integration Test
 * Tests the integration between foal task history and trait milestone evaluation at age 1
 *
 * 🎯 FEATURES TESTED:
 * - Integration between task log storage and trait milestone evaluation
 * - Real-world foal development scenarios with trait assignment
 * - Age 1 milestone evaluation with comprehensive task history
 * - Streak bonus application and burnout immunity integration
 * - Task influence mapping integration with trait evaluation
 *
 * 🔧 DEPENDENCIES:
 * - traitEvaluation.mjs (milestone evaluation function)
 * - foalTaskLogManager.mjs (task log utilities)
 * - taskInfluenceConfig.mjs (task influence mapping)
 * - Horse model with task log storage
 *
 * 📋 BUSINESS RULES TESTED:
 * - Age 1 milestone triggers comprehensive trait evaluation
 * - Task history drives epigenetic trait development
 * - Streak bonuses enhance trait assignment probability
 * - Integration between daily task exclusivity and milestone evaluation
 * - Real database storage supports trait milestone evaluation
 *
 * 🧪 TESTING APPROACH:
 * - Mock: Math.random for deterministic trait assignment testing
 * - Real: Database operations, task log storage, trait evaluation logic
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import prisma from '../db/index.mjs';

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
const { getFoalCareSummary } = await import(join(__dirname, '../utils/foalTaskLogManager.js'));

describe('Trait Milestone Integration', () => {
  let testUser, testFoal;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Clean up test data
    await prisma.horse.deleteMany({});
    await prisma.user.deleteMany({});

    // Create test user
    testUser = await prisma.user.create({
      data: {
        id: 'test-user-milestone',
        username: 'milestoneuser',
        email: 'milestone@example.com',
        password: 'testpassword',
        firstName: 'Milestone',
        lastName: 'Tester',
        money: 1000,
      },
    });

    // Create test foal approaching age 1
    testFoal = await prisma.horse.create({
      data: {
        name: 'Test Foal Milestone',
        sex: 'Colt',
        dateOfBirth: new Date(Date.now() - 360 * 24 * 60 * 60 * 1000), // Almost 1 year old
        age: 360,
        user: {
          connect: { id: testUser.id },
        },
        bondScore: 75,
        stressLevel: 15,
        taskLog: null,
        lastGroomed: null,
        daysGroomedInARow: 0,
      },
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();

    // Clean up test data
    await prisma.horse.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('Age 1 Milestone Evaluation', () => {
    it('should evaluate traits from comprehensive foal development history', async () => {
      // Simulate comprehensive foal development over first year
      const comprehensiveTaskLog = {
        // Early enrichment (0-6 months)
        trust_building: 12, // 60 points to bonded, resilient
        desensitization: 8, // 40 points to confident

        // Mid development (6-9 months)
        showground_exposure: 5, // 25 points to confident, crowd_ready
        early_touch: 10, // 50 points to calm

        // Later grooming (9-12 months)
        hoof_handling: 6, // 30 points to show_calm
        sponge_bath: 4, // 20 points to show_calm, presentation_boosted
        coat_check: 3, // 15 points to presentation_boosted
      };

      // Store comprehensive task log in database
      await prisma.horse.update({
        where: { id: testFoal.id },
        data: {
          taskLog: comprehensiveTaskLog,
          daysGroomedInARow: 10, // Strong streak for bonus
          lastGroomed: new Date(),
        },
      });

      // Retrieve foal data
      const foal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      // Get care summary
      const careSummary = getFoalCareSummary(foal);
      expect(careSummary.totalTaskCompletions).toBe(48);
      expect(careSummary.uniqueTasksCompleted).toBe(7);
      expect(careSummary.consecutiveDaysOfCare).toBe(10);
      expect(careSummary.hasBurnoutImmunity).toBe(true);

      // Mock random for trait assignment
      jest.spyOn(Math, 'random').mockReturnValue(0.3); // 30%

      // Evaluate traits at age 1 milestone
      const assignedTraits = evaluateEpigeneticTagsFromFoalTasks(
        foal.taskLog,
        foal.daysGroomedInARow,
      );

      // Verify trait assignments with streak bonus
      // Expected trait points with 10-point streak bonus:
      // bonded: 60 + 10 = 70% (capped at 60%) > 30% ✓
      // resilient: 60 + 10 = 70% (capped at 60%) > 30% ✓
      // confident: (40 + 25) + 10 = 75% (capped at 60%) > 30% ✓
      // crowd_ready: 25 + 10 = 35% > 30% ✓
      // calm: 50 + 10 = 60% > 30% ✓
      // show_calm: (30 + 20) + 10 = 60% > 30% ✓
      // presentation_boosted: (20 + 15) + 10 = 45% > 30% ✓

      expect(assignedTraits).toContain('bonded');
      expect(assignedTraits).toContain('resilient');
      expect(assignedTraits).toContain('confident');
      expect(assignedTraits).toContain('crowd_ready');
      expect(assignedTraits).toContain('calm');
      expect(assignedTraits).toContain('show_calm');
      expect(assignedTraits).toContain('presentation_boosted');

      expect(assignedTraits.length).toBe(7); // All traits assigned
    });

    it('should handle minimal development with no streak bonus', async () => {
      // Simulate minimal foal development
      const minimalTaskLog = {
        trust_building: 2, // 10 points to bonded, resilient
        early_touch: 1, // 5 points to calm
      };

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: {
          taskLog: minimalTaskLog,
          daysGroomedInARow: 3, // No burnout immunity
          lastGroomed: new Date(),
        },
      });

      const foal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      const careSummary = getFoalCareSummary(foal);
      expect(careSummary.totalTaskCompletions).toBe(3);
      expect(careSummary.hasBurnoutImmunity).toBe(false);

      // Mock random for selective trait assignment
      jest.spyOn(Math, 'random').mockReturnValue(0.07); // 7%

      const assignedTraits = evaluateEpigeneticTagsFromFoalTasks(
        foal.taskLog,
        foal.daysGroomedInARow,
      );

      // Expected trait points without streak bonus:
      // bonded: 10% > 7% ✓
      // resilient: 10% > 7% ✓
      // calm: 5% < 7% ✗

      expect(assignedTraits).toContain('bonded');
      expect(assignedTraits).toContain('resilient');
      expect(assignedTraits).not.toContain('calm');
      expect(assignedTraits.length).toBe(2);
    });

    it('should handle specialized development paths', async () => {
      // Simulate confidence-focused development
      const confidenceTaskLog = {
        desensitization: 10, // 50 points to confident
        showground_exposure: 6, // 30 points to confident, crowd_ready
      };

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: {
          taskLog: confidenceTaskLog,
          daysGroomedInARow: 8, // Burnout immunity
          lastGroomed: new Date(),
        },
      });

      const foal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      jest.spyOn(Math, 'random').mockReturnValue(0.4); // 40%

      const assignedTraits = evaluateEpigeneticTagsFromFoalTasks(
        foal.taskLog,
        foal.daysGroomedInARow,
      );

      // Expected trait points with streak bonus:
      // confident: (50 + 30) + 10 = 90% (capped at 60%) > 40% ✓
      // crowd_ready: 30 + 10 = 40% = 40% (borderline, depends on exact random)

      expect(assignedTraits).toContain('confident');
      // crowd_ready might or might not be assigned at exactly 40%
    });

    it('should integrate with real database persistence', async () => {
      // Test that trait evaluation works with real database storage
      const taskLog = {
        trust_building: 5,
        desensitization: 3,
        early_touch: 4,
      };

      // Store and retrieve from database
      await prisma.horse.update({
        where: { id: testFoal.id },
        data: { taskLog },
      });

      const storedFoal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      // Verify data persistence
      expect(storedFoal.taskLog).toEqual(taskLog);

      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const assignedTraits = evaluateEpigeneticTagsFromFoalTasks(storedFoal.taskLog, 0);

      // Verify traits are assigned from persisted data
      expect(assignedTraits).toContain('bonded');
      expect(assignedTraits).toContain('resilient');
      expect(assignedTraits).toContain('confident');
      expect(assignedTraits).toContain('calm');
    });

    it('should handle edge case of no task history', async () => {
      // Foal with no enrichment/grooming history
      await prisma.horse.update({
        where: { id: testFoal.id },
        data: {
          taskLog: {},
          daysGroomedInARow: 0,
        },
      });

      const foal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const assignedTraits = evaluateEpigeneticTagsFromFoalTasks(
        foal.taskLog,
        foal.daysGroomedInARow,
      );

      // No task history = no epigenetic traits
      expect(assignedTraits).toEqual([]);
    });
  });

  describe('Milestone Timing and Business Rules', () => {
    it('should demonstrate age 1 milestone evaluation timing', async () => {
      // This test demonstrates when the milestone evaluation would occur
      const taskLog = {
        trust_building: 6,
        desensitization: 4,
        early_touch: 5,
      };

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: {
          taskLog,
          age: 365, // Exactly 1 year old
        },
      });

      const foal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      // At age 1 (365 days), trigger milestone evaluation
      if (foal.age >= 365) {
        jest.spyOn(Math, 'random').mockReturnValue(0.15);

        const assignedTraits = evaluateEpigeneticTagsFromFoalTasks(
          foal.taskLog,
          foal.daysGroomedInARow || 0,
        );

        // Verify milestone evaluation occurs
        expect(assignedTraits.length).toBeGreaterThan(0);
        expect(assignedTraits).toContain('bonded');
        expect(assignedTraits).toContain('resilient');
      }
    });

    it('should support trait development progression tracking', async () => {
      // Track trait development over time leading to milestone
      const developmentStages = [
        { age: 90, taskLog: { trust_building: 2 } },
        { age: 180, taskLog: { trust_building: 4, desensitization: 2 } },
        { age: 270, taskLog: { trust_building: 6, desensitization: 4, early_touch: 3 } },
        {
          age: 365,
          taskLog: { trust_building: 8, desensitization: 6, early_touch: 5, hoof_handling: 2 },
        },
      ];

      for (const stage of developmentStages) {
        await prisma.horse.update({
          where: { id: testFoal.id },
          data: {
            age: stage.age,
            taskLog: stage.taskLog,
          },
        });

        const foal = await prisma.horse.findUnique({
          where: { id: testFoal.id },
        });

        // Only evaluate at age 1 milestone
        if (foal.age >= 365) {
          jest.spyOn(Math, 'random').mockReturnValue(0.2);

          const assignedTraits = evaluateEpigeneticTagsFromFoalTasks(foal.taskLog, 0);

          // Final milestone should have comprehensive trait assignment
          expect(assignedTraits.length).toBeGreaterThanOrEqual(4);
          expect(assignedTraits).toContain('bonded');
          expect(assignedTraits).toContain('resilient');
          expect(assignedTraits).toContain('confident');
          expect(assignedTraits).toContain('calm');
        }
      }
    });
  });
});
