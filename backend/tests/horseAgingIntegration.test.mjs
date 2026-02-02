/**
 * Horse Aging Integration Test
 * Tests the complete integration of aging system with trait milestone evaluation
 *
 * 🎯 FEATURES TESTED:
 * - Complete aging workflow from cron job to trait assignment
 * - Integration between aging system and trait evaluation
 * - Real database operations with milestone processing
 * - Cron job service integration
 * - Age 1 milestone trait evaluation from foal task history
 *
 * 🔧 DEPENDENCIES:
 * - cronJobs.mjs (cron job service)
 * - horseAgingSystem.mjs (aging logic)
 * - traitEvaluation.mjs (milestone evaluation)
 * - foalTaskLogManager.mjs (task log utilities)
 *
 * 📋 BUSINESS RULES TESTED:
 * - Daily aging process triggers birthday detection
 * - Age 1 milestone automatically evaluates traits from task history
 * - Trait assignment integrates with existing epigenetic system
 * - Cron job service orchestrates the complete workflow
 * - Real-world foal development scenarios
 *
 * 🧪 TESTING APPROACH:
 * - Mock: Date.now() for deterministic birthday testing, Math.random for trait assignment
 * - Real: Database operations, aging logic, trait evaluation, cron job integration
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import prisma from '../db/index.mjs';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Mock the logger import
jest.unstable_mockModule('../utils/logger.mjs', () => ({
  default: mockLogger,
  logger: mockLogger,
}));

// Import the services after mocking
const cronJobService = (await import('../services/cronJobs.mjs')).default;

describe('Horse Aging Integration', () => {
  let testUser, testBreed;
  const createdHorseIds = new Set();
  const createdUserIds = new Set();
  const createdBreedIds = new Set();

  // Reference date anchor for all test date calculations
  const referenceDate = new Date('2025-06-01T12:00:00Z');

  // Calculate dates for different aging scenarios based on reference date
  const mockNow = new Date(referenceDate); // Current time for aging tests
  const sevenDaysAgo = new Date(referenceDate);
  sevenDaysAgo.setDate(referenceDate.getDate() - 7); // 7 days before reference (foal birthday)
  const twentyOneDaysAgo = new Date(referenceDate);
  twentyOneDaysAgo.setDate(referenceDate.getDate() - 21); // 21 days before reference (3 years old)
  const thirtyOneDaysAgo = new Date(referenceDate);
  thirtyOneDaysAgo.setDate(referenceDate.getDate() - 31); // 31 days before reference (no birthday)

  const cleanupTestData = async () => {
    try {
      if (createdHorseIds.size > 0) {
        await prisma.horse.deleteMany({
          where: { id: { in: Array.from(createdHorseIds) } },
        });
        createdHorseIds.clear();
      }
      if (createdUserIds.size > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: Array.from(createdUserIds) } },
        });
        createdUserIds.clear();
      }
      if (createdBreedIds.size > 0) {
        await prisma.breed.deleteMany({
          where: { id: { in: Array.from(createdBreedIds) } },
        });
        createdBreedIds.clear();
      }
    } catch (error) {
      console.error('Cleanup error:', error.message);
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Clean up before starting to ensure clean state for this test
    await cleanupTestData();

    // Create test user
    const userId = `aging-int-user-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    testUser = await prisma.user.create({
      data: {
        id: userId,
        username: `agingintuser_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        email: `agingint_${Date.now()}_${Math.random().toString(36).substr(2, 5)}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Aging',
        lastName: 'Integration',
        money: 1000,
      },
    });
    createdUserIds.add(testUser.id);

    // Create test breed
    testBreed = await prisma.breed.create({
      data: {
        name: `Int Test Breed ${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        description: 'Test breed for aging integration',
      },
    });
    createdBreedIds.add(testBreed.id);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanupTestData();
  });

  describe('Complete Aging Workflow', () => {
    it('should process foal birthday with trait milestone evaluation', async () => {
      // Use mockNow from describe block scope (calculated from referenceDate)

      // Mock the Date constructor to return our mock date
      const OriginalDate = global.Date;
      global.Date = class extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) {
            return mockNow;
          }
          return new OriginalDate(...args);
        }
        static now() {
          return mockNow.getTime();
        }
      };

      // Mock Math.random for deterministic trait assignment
      jest.spyOn(Math, 'random').mockReturnValue(0.15); // 15% - will trigger some traits

      // Create foal turning 1 year old with comprehensive task history
      // In Equoria: 1 year = 7 days, so foal should be 6 days old turning 7
      const foal = await prisma.horse.create({
        data: {
          name: 'Milestone Integration Foal',
          sex: 'Filly',
          dateOfBirth: sevenDaysAgo, // 7 days before reference date (birthday today!)
          age: 6, // Stored age is 6, calculated age will be 7 (birthday!)
          userId: testUser.id,
          breedId: testBreed.id,
          bondScore: 85,
          stressLevel: 5,
          taskLog: {
            // Comprehensive foal development
            trust_building: 12, // 60 points to bonded, resilient
            desensitization: 8, // 40 points to confident
            showground_exposure: 4, // 20 points to confident, crowd_ready
            early_touch: 10, // 50 points to calm
            hoof_handling: 6, // 30 points to show_calm
            sponge_bath: 3, // 15 points to show_calm, presentation_boosted
          },
          daysGroomedInARow: 15, // Strong burnout immunity (+10 bonus)
          epigeneticModifiers: {
            positive: ['athletic'],
            negative: [],
            hidden: ['mysterious_lineage'],
          },
        },
      });
      createdHorseIds.add(foal.id);

      // Trigger the complete aging workflow through cron job service
      const result = await cronJobService.manualHorseAging({ horseIds: Array.from(createdHorseIds) });

      // Verify aging process results
      expect(result.totalProcessed).toBe(1);
      expect(result.birthdaysFound).toBe(1);
      expect(result.milestonesTriggered).toBe(1);
      expect(result.errors).toBe(0);

      // Verify horse was updated in database
      const updatedFoal = await prisma.horse.findUnique({
        where: { id: foal.id },
      });

      // Check age update
      expect(updatedFoal.age).toBe(7); // Now 1 year old in Equoria (7 days)

      // Check trait milestone evaluation
      const { epigeneticModifiers } = updatedFoal;
      expect(epigeneticModifiers.epigenetic_tags).toBeDefined();
      expect(Array.isArray(epigeneticModifiers.epigenetic_tags)).toBe(true);
      expect(epigeneticModifiers.epigenetic_tags.length).toBeGreaterThan(0);

      // Verify specific traits based on task history and streak bonus
      // With 15% random and streak bonus, expected traits:
      // bonded: 60 + 10 = 70% (capped at 60%) > 15% ✓
      // resilient: 60 + 10 = 70% (capped at 60%) > 15% ✓
      // confident: (40 + 20) + 10 = 70% (capped at 60%) > 15% ✓
      // crowd_ready: 20 + 10 = 30% > 15% ✓
      // calm: 50 + 10 = 60% > 15% ✓
      // show_calm: (30 + 15) + 10 = 55% > 15% ✓
      // presentation_boosted: 15 + 10 = 25% > 15% ✓

      expect(epigeneticModifiers.epigenetic_tags).toContain('bonded');
      expect(epigeneticModifiers.epigenetic_tags).toContain('resilient');
      expect(epigeneticModifiers.epigenetic_tags).toContain('confident');
      expect(epigeneticModifiers.epigenetic_tags).toContain('calm');

      // Verify existing traits were preserved
      expect(epigeneticModifiers.positive).toContain('athletic');
      expect(epigeneticModifiers.hidden).toContain('mysterious_lineage');

      // Restore original Date
      global.Date = OriginalDate;
    });

    it('should handle multiple horses with different milestone scenarios', async () => {
      const mockNow = new Date('2025-06-01T12:00:00Z');

      // Mock the Date constructor to return our mock date
      const OriginalDate = global.Date;
      global.Date = class extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) {
            return mockNow;
          }
          return new OriginalDate(...args);
        }
        static now() {
          return mockNow.getTime();
        }
      };

      jest.spyOn(Math, 'random').mockReturnValue(0.2); // 20%

      // Create multiple horses with different scenarios
      const horses = await Promise.all([
        // Foal turning 1 year old (milestone)
        prisma.horse.create({
          data: {
            name: 'Milestone Foal',
            sex: 'Colt',
            dateOfBirth: new Date('2025-05-25T00:00:00Z'), // 7 days ago
            age: 6, // Stored age is 6, calculated age will be 7 (birthday!)
            userId: testUser.id,
            breedId: testBreed.id,
            taskLog: { trust_building: 6, desensitization: 4 },
            daysGroomedInARow: 8,
            epigeneticModifiers: { positive: [], negative: [], hidden: [] },
          },
        }),
        // Horse turning 3 years old (training eligible)
        prisma.horse.create({
          data: {
            name: 'Training Ready Horse',
            sex: 'Mare',
            dateOfBirth: new Date('2025-05-11T00:00:00Z'), // 21 days ago (3 years = 21 days)
            age: 20, // Stored age is 20, calculated age will be 21 (birthday!)
            userId: testUser.id,
            breedId: testBreed.id,
          },
        }),
        // Horse with no birthday (correct age)
        prisma.horse.create({
          data: {
            name: 'No Birthday Horse',
            sex: 'Gelding',
            dateOfBirth: new Date('2025-05-01T00:00:00Z'), // 31 days ago
            age: 31, // Correct age (no birthday today)
            userId: testUser.id,
            breedId: testBreed.id,
          },
        }),
      ]);
      horses.forEach(h => createdHorseIds.add(h.id));

      // Process all horses
      const result = await cronJobService.manualHorseAging({ horseIds: Array.from(createdHorseIds) });

      expect(result.totalProcessed).toBe(3);
      expect(result.birthdaysFound).toBe(2); // Milestone foal + training ready horse
      expect(result.milestonesTriggered).toBe(1); // Only the age 1 milestone
      expect(result.errors).toBe(0);

      // Verify specific updates
      const updatedHorses = await prisma.horse.findMany({
        where: { id: { in: horses.map(h => h.id) } },
        orderBy: { name: 'asc' },
      });

      // Milestone foal should have traits assigned
      const milestoneHorse = updatedHorses.find(h => h.name === 'Milestone Foal');
      expect(milestoneHorse.age).toBe(7); // 1 year old in Equoria
      expect(milestoneHorse.epigeneticModifiers.epigenetic_tags).toBeDefined();
      expect(milestoneHorse.epigeneticModifiers.epigenetic_tags.length).toBeGreaterThan(0);

      // Training ready horse should just have age updated
      const trainingHorse = updatedHorses.find(h => h.name === 'Training Ready Horse');
      expect(trainingHorse.age).toBe(21); // 3 years old in Equoria

      // No birthday horse should remain unchanged
      const noBirthdayHorse = updatedHorses.find(h => h.name === 'No Birthday Horse');
      expect(noBirthdayHorse.age).toBe(31); // Unchanged

      // Restore original Date
      global.Date = OriginalDate;
    });

    it('should handle foal with minimal task history', async () => {
      const mockNow = new Date('2025-06-01T12:00:00Z');

      // Mock the Date constructor to return our mock date
      const OriginalDate = global.Date;
      global.Date = class extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) {
            return mockNow;
          }
          return new OriginalDate(...args);
        }
        static now() {
          return mockNow.getTime();
        }
      };

      jest.spyOn(Math, 'random').mockReturnValue(0.5); // 50% - high threshold

      // Create foal with minimal development
      const foal = await prisma.horse.create({
        data: {
          name: 'Minimal Development Foal',
          sex: 'Colt',
          dateOfBirth: new Date('2025-05-25T00:00:00Z'), // 7 days ago
          age: 6, // Stored age is 6, calculated age will be 7 (birthday!)
          userId: testUser.id,
          breedId: testBreed.id,
          taskLog: {
            trust_building: 1, // 5 points to bonded, resilient
            early_touch: 1, // 5 points to calm
          },
          daysGroomedInARow: 2, // No burnout immunity
          epigeneticModifiers: { positive: [], negative: [], hidden: [] },
        },
      });
      createdHorseIds.add(foal.id);

      const result = await cronJobService.manualHorseAging({ horseIds: Array.from(createdHorseIds) });

      expect(result.milestonesTriggered).toBe(1);

      const updatedFoal = await prisma.horse.findUnique({
        where: { id: foal.id },
      });

      expect(updatedFoal.age).toBe(7); // 1 year old in Equoria

      // With minimal task history and 50% random threshold, no traits should be assigned
      // bonded: 5% < 50% ✗
      // resilient: 5% < 50% ✗
      // calm: 5% < 50% ✗
      const epigeneticTags = updatedFoal.epigeneticModifiers?.epigenetic_tags || [];
      expect(epigeneticTags.length).toBe(0);

      // Restore original Date
      global.Date = OriginalDate;
    });

    it('should handle foal with no task history', async () => {
      const mockNow = new Date('2025-06-01T12:00:00Z');

      // Mock the Date constructor to return our mock date
      const OriginalDate = global.Date;
      global.Date = class extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) {
            return mockNow;
          }
          return new OriginalDate(...args);
        }
        static now() {
          return mockNow.getTime();
        }
      };

      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      // Create foal with no development history
      const foal = await prisma.horse.create({
        data: {
          name: 'No Development Foal',
          sex: 'Filly',
          dateOfBirth: new Date('2025-05-25T00:00:00Z'), // 7 days ago
          age: 6, // Stored age is 6, calculated age will be 7 (birthday!)
          userId: testUser.id,
          breedId: testBreed.id,
          taskLog: {}, // Empty task log
          daysGroomedInARow: 0,
          epigeneticModifiers: { positive: [], negative: [], hidden: [] },
        },
      });
      createdHorseIds.add(foal.id);

      const result = await cronJobService.manualHorseAging({ horseIds: Array.from(createdHorseIds) });

      expect(result.milestonesTriggered).toBe(1);

      const updatedFoal = await prisma.horse.findUnique({
        where: { id: foal.id },
      });

      expect(updatedFoal.age).toBe(7); // 1 year old in Equoria

      // No task history = no traits
      const epigeneticTags = updatedFoal.epigeneticModifiers?.epigenetic_tags || [];
      expect(epigeneticTags.length).toBe(0);

      // Restore original Date
      global.Date = OriginalDate;
    });

    // TODO: Add cron job service status test when service is properly initialized
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Create horse with valid data
      const horse = await prisma.horse.create({
        data: {
          name: 'Error Test Horse',
          sex: 'Colt',
          dateOfBirth: new Date('2024-06-01'),
          age: 364,
          userId: testUser.id,
          breedId: testBreed.id,
        },
      });
      createdHorseIds.add(horse.id);

      // Mock prisma to throw error during update
      const originalUpdate = prisma.horse.update;
      jest.spyOn(prisma.horse, 'update').mockRejectedValueOnce(new Error('Database error'));

      const result = await cronJobService.manualHorseAging({ horseIds: Array.from(createdHorseIds) });

      expect(result.errors).toBe(1);
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error processing horse'));

      // Restore original function
      prisma.horse.update = originalUpdate;
    });

    // TODO: Add error handling test when mocking is properly set up
  });
});
