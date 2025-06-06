/**
 * Horse Aging System Test Suite
 * Tests for automatic horse aging with trait milestone integration
 *
 * 🎯 FEATURES TESTED:
 * - Automatic age calculation from dateOfBirth
 * - Daily aging process with birthday detection
 * - Trait milestone evaluation at age 1 (365 days)
 * - Integration with existing cron job system
 * - Age-based eligibility updates
 * - Retirement at age 21
 *
 * 🔧 DEPENDENCIES:
 * - horseAgingSystem.mjs (aging logic)
 * - traitEvaluation.mjs (milestone evaluation)
 * - foalTaskLogManager.mjs (task log utilities)
 * - cronJobs.mjs (daily processing)
 *
 * 📋 BUSINESS RULES TESTED:
 * - Age calculated from dateOfBirth vs current date
 * - Birthday triggers age increment and milestone checks
 * - Age 1 milestone triggers trait evaluation from task history
 * - Horses retire at age 21 (7665 days)
 * - Age affects training/competition eligibility
 * - Aging process runs daily via cron job
 *
 * 🧪 TESTING APPROACH:
 * - Mock: Date.now() for deterministic birthday testing
 * - Real: Database operations, aging logic, trait evaluation
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
jest.unstable_mockModule(join(__dirname, '../utils/logger.mjss'), () => ({
  default: mockLogger,
  logger: mockLogger,
}));

// Import the functions after mocking
const { calculateAgeFromBirth, processHorseBirthdays, updateHorseAge, checkForMilestones } =
  await import(join(__dirname, '../utils/horseAgingSystem.js'));

describe('Horse Aging System', () => {
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
        id: 'test-user-aging',
        username: 'aginguser',
        email: 'aging@example.com',
        password: 'testpassword',
        firstName: 'Aging',
        lastName: 'Tester',
        money: 1000,
      },
    });

    // Create test breed
    testBreed = await prisma.breed.create({
      data: {
        name: 'Test Breed',
        description: 'Test breed for aging',
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

  describe('Age Calculation', () => {
    it('should calculate age correctly from dateOfBirth', () => {
      const mockNow = new Date('2025-06-01T12:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());

      // Test various ages (accounting for leap years)
      const testCases = [
        { birth: '2025-06-01', expectedDays: 0 }, // Born today
        { birth: '2025-05-31', expectedDays: 1 }, // Born yesterday
        { birth: '2024-06-01', expectedDays: 365 }, // Born 1 year ago
        { birth: '2023-06-01', expectedDays: 731 }, // Born 2 years ago (366 + 365)
        { birth: '2004-06-01', expectedDays: 7670 }, // Born 21 years ago
      ];

      testCases.forEach(({ birth, expectedDays }) => {
        const birthDate = new Date(birth);
        const ageInDays = calculateAgeFromBirth(birthDate);
        expect(ageInDays).toBe(expectedDays);
      });
    });

    it('should handle leap years correctly', () => {
      const mockNow = new Date('2025-03-01T12:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());

      // Born in leap year
      const birthDate = new Date('2024-02-29');
      const ageInDays = calculateAgeFromBirth(birthDate);

      // From Feb 29, 2024 to Mar 1, 2025 = 366 days (2024 leap year) + 92 days (Jan 1 - Mar 1, 2025)
      expect(ageInDays).toBe(458);
    });

    it('should handle timezone differences', () => {
      const mockNow = new Date('2025-06-01T23:59:59Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());

      const birthDate = new Date('2025-06-01T00:00:00Z');
      const ageInDays = calculateAgeFromBirth(birthDate);

      expect(ageInDays).toBe(0); // Same day regardless of time
    });
  });

  describe('Horse Age Updates', () => {
    it('should update horse age when birthday occurs', async () => {
      const mockNow = new Date('2025-06-01T12:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());

      // Create horse born 1 year ago
      const horse = await prisma.horse.create({
        data: {
          name: 'Birthday Horse',
          sex: 'Colt',
          dateOfBirth: new Date('2024-06-01'), // Exactly 1 year ago
          age: 364, // Currently 364 days old (will turn 365)
          user: { connect: { id: testUser.id } },
          breed: { connect: { id: testBreed.id } },
          bondScore: 75,
          stressLevel: 15,
          taskLog: {
            trust_building: 8,
            desensitization: 5,
            early_touch: 6,
          },
          daysGroomedInARow: 10,
        },
      });

      const result = await updateHorseAge(horse.id);

      expect(result.ageUpdated).toBe(true);
      expect(result.newAge).toBe(365);
      expect(result.hadBirthday).toBe(true);

      // Verify database was updated
      const updatedHorse = await prisma.horse.findUnique({
        where: { id: horse.id },
      });
      expect(updatedHorse.age).toBe(365);
    });

    it('should not update age when no birthday occurs', async () => {
      const mockNow = new Date('2025-06-01T12:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());

      // Create horse born 6 months ago
      const horse = await prisma.horse.create({
        data: {
          name: 'No Birthday Horse',
          sex: 'Filly',
          dateOfBirth: new Date('2024-12-01'), // 6 months ago
          age: 182, // Current age matches calculated age
          user: { connect: { id: testUser.id } },
          breed: { connect: { id: testBreed.id } },
        },
      });

      const result = await updateHorseAge(horse.id);

      expect(result.ageUpdated).toBe(false);
      expect(result.newAge).toBe(182);
      expect(result.hadBirthday).toBe(false);
    });

    it('should handle horses with incorrect stored age', async () => {
      const mockNow = new Date('2025-06-01T12:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());

      // Create horse with incorrect stored age
      const horse = await prisma.horse.create({
        data: {
          name: 'Wrong Age Horse',
          sex: 'Colt',
          dateOfBirth: new Date('2024-01-01'), // Should be ~517 days old (accounting for leap year)
          age: 100, // Incorrect stored age
          user: { connect: { id: testUser.id } },
          breed: { connect: { id: testBreed.id } },
        },
      });

      const result = await updateHorseAge(horse.id);

      expect(result.ageUpdated).toBe(true);
      expect(result.newAge).toBe(517); // Correct calculated age
      expect(result.hadBirthday).toBe(true); // Age increased, so considered a birthday
    });
  });

  describe('Milestone Detection', () => {
    it('should detect age 1 milestone and trigger trait evaluation', async () => {
      const mockNow = new Date('2025-06-01T12:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());

      // Mock Math.random for trait evaluation
      jest.spyOn(Math, 'random').mockReturnValue(0.1); // 10% - will trigger traits

      // Create horse turning 1 year old
      const horse = await prisma.horse.create({
        data: {
          name: 'Milestone Horse',
          sex: 'Filly',
          dateOfBirth: new Date('2024-06-01'), // Exactly 1 year ago
          age: 364, // About to turn 365 (1 year milestone)
          user: { connect: { id: testUser.id } },
          breed: { connect: { id: testBreed.id } },
          bondScore: 80,
          stressLevel: 10,
          taskLog: {
            trust_building: 10, // 50 points to bonded, resilient
            desensitization: 6, // 30 points to confident
            early_touch: 8, // 40 points to calm
            hoof_handling: 4, // 20 points to show_calm
          },
          daysGroomedInARow: 12, // Burnout immunity (+10 bonus)
          epigeneticModifiers: {
            positive: [],
            negative: [],
            hidden: [],
          },
        },
      });

      const result = await checkForMilestones(horse.id, 364, 365);

      expect(result.milestonesTriggered).toContain('age_1_trait_evaluation');
      expect(result.traitsAssigned).toBeDefined();
      expect(result.traitsAssigned.length).toBeGreaterThan(0);

      // Verify traits were assigned to horse
      const updatedHorse = await prisma.horse.findUnique({
        where: { id: horse.id },
      });

      const epigeneticTags = updatedHorse.epigeneticModifiers?.epigenetic_tags || [];
      expect(epigeneticTags.length).toBeGreaterThan(0);
    });

    it('should not trigger milestone for non-milestone ages', async () => {
      const result = await checkForMilestones(123, 100, 101);

      expect(result.milestonesTriggered).toEqual([]);
      expect(result.traitsAssigned).toEqual([]);
    });

    it('should detect retirement milestone at age 21', async () => {
      const result = await checkForMilestones(456, 7664, 7665);

      expect(result.milestonesTriggered).toContain('retirement');
      expect(result.retirementTriggered).toBe(true);
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple horses with birthdays', async () => {
      const mockNow = new Date('2025-06-01T12:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());

      // Create multiple horses with different birthday scenarios
      const horses = await Promise.all([
        // Horse turning 1 year old (milestone)
        prisma.horse.create({
          data: {
            name: 'Milestone Horse 1',
            sex: 'Colt',
            dateOfBirth: new Date('2024-06-01'),
            age: 364, // Will turn 366 due to leap year, but milestone triggers at 365
            user: { connect: { id: testUser.id } },
            breed: { connect: { id: testBreed.id } },
            taskLog: { trust_building: 5 },
            daysGroomedInARow: 8,
            epigeneticModifiers: { positive: [], negative: [], hidden: [] },
          },
        }),
        // Horse turning 2 years old (no milestone)
        prisma.horse.create({
          data: {
            name: 'Regular Birthday Horse',
            sex: 'Filly',
            dateOfBirth: new Date('2023-06-01'),
            age: 730, // Will turn 731 (no milestone)
            user: { connect: { id: testUser.id } },
            breed: { connect: { id: testBreed.id } },
          },
        }),
        // Horse with no birthday today (but incorrect age)
        prisma.horse.create({
          data: {
            name: 'No Birthday Horse',
            sex: 'Colt',
            dateOfBirth: new Date('2024-01-01'),
            age: 400, // Incorrect age, will be corrected to 517 (no milestone crossing)
            user: { connect: { id: testUser.id } },
            breed: { connect: { id: testBreed.id } },
          },
        }),
      ]);

      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const results = await processHorseBirthdays();

      expect(results.totalProcessed).toBe(3);
      expect(results.birthdaysFound).toBe(3); // All 3 horses need age updates
      expect(results.milestonesTriggered).toBe(1);
      expect(results.errors).toBe(0);

      // Verify specific updates
      const updatedHorses = await prisma.horse.findMany({
        where: { id: { in: horses.map(h => h.id) } },
        orderBy: { name: 'asc' },
      });

      expect(updatedHorses[0].age).toBe(365); // Milestone horse
      expect(updatedHorses[1].age).toBe(517); // No birthday horse (corrected age)
      expect(updatedHorses[2].age).toBe(731); // Regular birthday horse
    });

    // TODO: Add error handling test when mocking is properly set up
  });

  describe('Integration with Existing Systems', () => {
    it('should maintain compatibility with training age requirements', async () => {
      const mockNow = new Date('2025-06-01T12:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());

      // Create horse turning 3 (training eligible)
      const horse = await prisma.horse.create({
        data: {
          name: 'Training Ready Horse',
          sex: 'Colt',
          dateOfBirth: new Date('2022-06-01'), // 3 years ago
          age: 1095, // About to turn 1096 (accounting for leap year)
          user: { connect: { id: testUser.id } },
          breed: { connect: { id: testBreed.id } },
        },
      });

      const result = await updateHorseAge(horse.id);

      expect(result.newAge).toBe(1096); // 3 years old (accounting for leap year)

      // Verify training eligibility (age >= 3 years = 1095 days)
      const updatedHorse = await prisma.horse.findUnique({
        where: { id: horse.id },
      });

      const ageInYears = Math.floor(updatedHorse.age / 365);
      expect(ageInYears).toBe(3);
      expect(updatedHorse.age >= 1095).toBe(true); // Training eligible
    });

    it('should handle retirement at age 21', async () => {
      const mockNow = new Date('2025-06-01T12:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());

      // Create horse turning 21 (retirement age)
      const horse = await prisma.horse.create({
        data: {
          name: 'Retiring Horse',
          sex: 'Mare',
          dateOfBirth: new Date('2004-06-01'), // 21 years ago
          age: 7664, // About to turn 7665 (21 years)
          user: { connect: { id: testUser.id } },
          breed: { connect: { id: testBreed.id } },
        },
      });

      const milestoneResult = await checkForMilestones(horse.id, 7664, 7665);

      expect(milestoneResult.milestonesTriggered).toContain('retirement');
      expect(milestoneResult.retirementTriggered).toBe(true);
    });
  });
});
