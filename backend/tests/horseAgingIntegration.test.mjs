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

// Import the services after mocking
const cronJobService = (await import(join(__dirname, '../services/cronJobs.js'))).default;

describe('Horse Aging Integration', () => {
  let testUser, testBreed;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Clean up test data
    await prisma.horse.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.breed.deleteMany({});

    // Create test user
    testUser = await prisma.user.create({
      data: {
        id: 'test-user-aging-integration',
        username: 'agingintegrationuser',
        email: 'agingintegration@example.com',
        password: 'testpassword',
        firstName: 'Aging',
        lastName: 'Integration',
        money: 1000,
      },
    });

    // Create test breed
    testBreed = await prisma.breed.create({
      data: {
        name: 'Integration Test Breed',
        description: 'Test breed for aging integration',
      },
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();

    // Clean up test data
    await prisma.horse.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.breed.deleteMany({});
  });

  describe('Complete Aging Workflow', () => {
    it('should process foal birthday with trait milestone evaluation', async () => {
      const mockNow = new Date('2025-06-01T12:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());

      // Mock Math.random for deterministic trait assignment
      jest.spyOn(Math, 'random').mockReturnValue(0.15); // 15% - will trigger some traits

      // Create foal turning 1 year old with comprehensive task history
      const foal = await prisma.horse.create({
        data: {
          name: 'Milestone Integration Foal',
          sex: 'Filly',
          dateOfBirth: new Date('2024-06-01'), // Exactly 1 year ago
          age: 364, // About to turn 365 (1 year)
          user: { connect: { id: testUser.id } },
          breed: { connect: { id: testBreed.id } },
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

      // Trigger the complete aging workflow through cron job service
      const result = await cronJobService.manualHorseAging();

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
      expect(updatedFoal.age).toBe(365); // Now 1 year old

      // Check trait milestone evaluation
      const epigeneticModifiers = updatedFoal.epigeneticModifiers;
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
    });

    it('should handle multiple horses with different milestone scenarios', async () => {
      const mockNow = new Date('2025-06-01T12:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());

      jest.spyOn(Math, 'random').mockReturnValue(0.2); // 20%

      // Create multiple horses with different scenarios
      const horses = await Promise.all([
        // Foal turning 1 year old (milestone)
        prisma.horse.create({
          data: {
            name: 'Milestone Foal',
            sex: 'Colt',
            dateOfBirth: new Date('2024-06-01'),
            age: 364,
            user: { connect: { id: testUser.id } },
            breed: { connect: { id: testBreed.id } },
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
            dateOfBirth: new Date('2022-06-01'),
            age: 1094,
            user: { connect: { id: testUser.id } },
            breed: { connect: { id: testBreed.id } },
          },
        }),
        // Horse with no birthday (correct age)
        prisma.horse.create({
          data: {
            name: 'No Birthday Horse',
            sex: 'Gelding',
            dateOfBirth: new Date('2023-01-01'),
            age: 882, // Correct age for 2023-01-01 to 2025-06-01
            user: { connect: { id: testUser.id } },
            breed: { connect: { id: testBreed.id } },
          },
        }),
      ]);

      // Process all horses
      const result = await cronJobService.manualHorseAging();

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
      expect(milestoneHorse.age).toBe(365);
      expect(milestoneHorse.epigeneticModifiers.epigenetic_tags).toBeDefined();
      expect(milestoneHorse.epigeneticModifiers.epigenetic_tags.length).toBeGreaterThan(0);

      // Training ready horse should just have age updated
      const trainingHorse = updatedHorses.find(h => h.name === 'Training Ready Horse');
      expect(trainingHorse.age).toBe(1096); // 3 years old

      // No birthday horse should remain unchanged
      const noBirthdayHorse = updatedHorses.find(h => h.name === 'No Birthday Horse');
      expect(noBirthdayHorse.age).toBe(882); // Unchanged
    });

    it('should handle foal with minimal task history', async () => {
      const mockNow = new Date('2025-06-01T12:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());

      jest.spyOn(Math, 'random').mockReturnValue(0.5); // 50% - high threshold

      // Create foal with minimal development
      const foal = await prisma.horse.create({
        data: {
          name: 'Minimal Development Foal',
          sex: 'Colt',
          dateOfBirth: new Date('2024-06-01'),
          age: 364,
          user: { connect: { id: testUser.id } },
          breed: { connect: { id: testBreed.id } },
          taskLog: {
            trust_building: 1, // 5 points to bonded, resilient
            early_touch: 1, // 5 points to calm
          },
          daysGroomedInARow: 2, // No burnout immunity
          epigeneticModifiers: { positive: [], negative: [], hidden: [] },
        },
      });

      const result = await cronJobService.manualHorseAging();

      expect(result.milestonesTriggered).toBe(1);

      const updatedFoal = await prisma.horse.findUnique({
        where: { id: foal.id },
      });

      expect(updatedFoal.age).toBe(365);

      // With minimal task history and 50% random threshold, no traits should be assigned
      // bonded: 5% < 50% ✗
      // resilient: 5% < 50% ✗
      // calm: 5% < 50% ✗
      const epigeneticTags = updatedFoal.epigeneticModifiers?.epigenetic_tags || [];
      expect(epigeneticTags.length).toBe(0);
    });

    it('should handle foal with no task history', async () => {
      const mockNow = new Date('2025-06-01T12:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());

      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      // Create foal with no development history
      const foal = await prisma.horse.create({
        data: {
          name: 'No Development Foal',
          sex: 'Filly',
          dateOfBirth: new Date('2024-06-01'),
          age: 364,
          user: { connect: { id: testUser.id } },
          breed: { connect: { id: testBreed.id } },
          taskLog: {}, // Empty task log
          daysGroomedInARow: 0,
          epigeneticModifiers: { positive: [], negative: [], hidden: [] },
        },
      });

      const result = await cronJobService.manualHorseAging();

      expect(result.milestonesTriggered).toBe(1);

      const updatedFoal = await prisma.horse.findUnique({
        where: { id: foal.id },
      });

      expect(updatedFoal.age).toBe(365);

      // No task history = no traits
      const epigeneticTags = updatedFoal.epigeneticModifiers?.epigenetic_tags || [];
      expect(epigeneticTags.length).toBe(0);
    });

    // TODO: Add cron job service status test when service is properly initialized
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Create horse with valid data
      const _horse = await prisma.horse.create({
        data: {
          name: 'Error Test Horse',
          sex: 'Colt',
          dateOfBirth: new Date('2024-06-01'),
          age: 364,
          user: { connect: { id: testUser.id } },
          breed: { connect: { id: testBreed.id } },
        },
      });

      // Mock prisma to throw error during update
      const originalUpdate = prisma.horse.update;
      jest.spyOn(prisma.horse, 'update').mockRejectedValueOnce(new Error('Database error'));

      const result = await cronJobService.manualHorseAging();

      expect(result.errors).toBe(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing horse'),
      );

      // Restore original function
      prisma.horse.update = originalUpdate;
    });

    // TODO: Add error handling test when mocking is properly set up
  });
});
