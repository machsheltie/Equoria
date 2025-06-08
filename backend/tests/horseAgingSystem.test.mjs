/**
 * Horse Aging System Test Suite
 * Tests for automatic horse aging with trait milestone integration
 *
 * 🎯 FEATURES TESTED:
 * - Automatic age calculation from dateOfBirth
 * - Daily aging process with birthday detection
 * - Trait milestone evaluation at age 1 (7 days)
 * - Integration with existing cron job system
 * - Age-based eligibility updates
 * - Retirement at age 21 (147 days)
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
jest.unstable_mockModule(join(__dirname, '../utils/logger.mjs'), () => ({
  default: mockLogger,
  logger: mockLogger,
}));

// Import the functions after mocking
const { calculateAgeFromBirth, processHorseBirthdays, updateHorseAge, checkForMilestones } = await import(
  join(__dirname, '../utils/horseAgingSystem.mjs')
);

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

      // Test various ages (1 year = 7 days in game time)
      const testCases = [
        { birth: '2025-06-01', expectedDays: 0 }, // Born today
        { birth: '2025-05-31', expectedDays: 1 }, // Born yesterday
        { birth: '2025-05-25', expectedDays: 7 }, // Born 1 week ago (1 year in game time)
        { birth: '2025-05-18', expectedDays: 14 }, // Born 2 weeks ago (2 years in game time)
        { birth: '2025-01-05', expectedDays: 147 }, // Born 21 weeks ago (21 years in game time)
      ];

      testCases.forEach(({ birth, expectedDays }) => {
        const birthDate = new Date(birth);
        // Pass the mock date explicitly to avoid Date constructor mocking issues
        const ageInDays = calculateAgeFromBirth(birthDate, mockNow);
        expect(ageInDays).toBe(expectedDays);
      });
    });

    it('should handle leap years correctly', () => {
      const mockNow = new Date('2025-03-01T12:00:00Z');

      // Born in leap year
      const birthDate = new Date('2024-02-29');
      const ageInDays = calculateAgeFromBirth(birthDate, mockNow);

      // From Feb 29, 2024 to Mar 1, 2025 = 366 days (52.3 years in game time)
      expect(ageInDays).toBe(366);
    });

    it('should handle timezone differences', () => {
      const mockNow = new Date('2025-06-01T23:59:59Z');

      const birthDate = new Date('2025-06-01T00:00:00Z');
      const ageInDays = calculateAgeFromBirth(birthDate, mockNow);

      expect(ageInDays).toBe(0); // Same day regardless of time
    });
  });

  describe('Horse Age Updates', () => {
    it('should update horse age when birthday occurs', async () => {
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

      // Create horse born 1 week ago (1 year in game time)
      const horse = await prisma.horse.create({
        data: {
          name: 'Birthday Horse',
          sex: 'Colt',
          dateOfBirth: new Date('2025-05-25'), // Exactly 1 week ago (1 year in game time)
          age: 6, // Currently 6 days old (will turn 7 = 1 year)
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
      expect(result.newAge).toBe(7); // 1 year in game time
      expect(result.hadBirthday).toBe(true);

      // Verify database was updated
      const updatedHorse = await prisma.horse.findUnique({
        where: { id: horse.id },
      });
      expect(updatedHorse.age).toBe(7); // 1 year in game time

      // Restore original Date
      global.Date = OriginalDate;
    });

    it('should not update age when no birthday occurs', async () => {
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

      // Restore original Date
      global.Date = OriginalDate;
    });

    it('should handle horses with incorrect stored age', async () => {
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

      // Restore original Date
      global.Date = OriginalDate;
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

      const result = await checkForMilestones(horse.id, 6, 7); // 6 days → 7 days (1 year)

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
      const result = await checkForMilestones(456, 146, 147); // 146 days → 147 days (21 years)

      expect(result.milestonesTriggered).toContain('retirement');
      expect(result.retirementTriggered).toBe(true);
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple horses with birthdays', async () => {
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

      // Create multiple horses with different birthday scenarios
      const horses = await Promise.all([
        // Horse turning 1 year old (milestone)
        prisma.horse.create({
          data: {
            name: 'Milestone Horse 1',
            sex: 'Colt',
            dateOfBirth: new Date('2025-05-25'), // 1 week ago (1 year in game time)
            age: 6, // Will turn 7 (1 year = 7 days), milestone triggers at 7
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
            dateOfBirth: new Date('2025-05-17'), // 15 days ago (2.14 years in game time)
            age: 14, // Will turn 15 (no milestone at 15)
            user: { connect: { id: testUser.id } },
            breed: { connect: { id: testBreed.id } },
          },
        }),
        // Horse with no birthday today (but incorrect age)
        prisma.horse.create({
          data: {
            name: 'No Birthday Horse',
            sex: 'Colt',
            dateOfBirth: new Date('2025-05-01'), // 31 days ago (4.4 years in game time)
            age: 25, // Incorrect age, will be corrected to 31 (no milestone crossing)
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

      expect(updatedHorses[0].age).toBe(7); // Milestone horse (1 year)
      expect(updatedHorses[1].age).toBe(31); // No birthday horse (corrected age)
      expect(updatedHorses[2].age).toBe(15); // Regular birthday horse (no milestone)

      // Restore original Date
      global.Date = OriginalDate;
    });

    // TODO: Add error handling test when mocking is properly set up
  });

  describe('Integration with Existing Systems', () => {
    it('should maintain compatibility with training age requirements', async () => {
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

      // Create horse turning 3 (training eligible)
      const horse = await prisma.horse.create({
        data: {
          name: 'Training Ready Horse',
          sex: 'Colt',
          dateOfBirth: new Date('2025-05-11'), // 3 weeks ago (3 years in game time)
          age: 20, // About to turn 21 (3 years = 21 days)
          user: { connect: { id: testUser.id } },
          breed: { connect: { id: testBreed.id } },
        },
      });

      const result = await updateHorseAge(horse.id);

      expect(result.newAge).toBe(21); // 3 years old in game time

      // Verify training eligibility (age >= 3 years = 21 days)
      const updatedHorse = await prisma.horse.findUnique({
        where: { id: horse.id },
      });

      const ageInYears = Math.floor(updatedHorse.age / 7); // 1 year = 7 days
      expect(ageInYears).toBe(3);
      expect(updatedHorse.age >= 21).toBe(true); // Training eligible

      // Restore original Date
      global.Date = OriginalDate;
    });

    it('should handle retirement at age 21', async () => {
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

      // Create horse turning 21 (retirement age)
      const horse = await prisma.horse.create({
        data: {
          name: 'Retiring Horse',
          sex: 'Mare',
          dateOfBirth: new Date('2025-01-05'), // 21 weeks ago (21 years in game time)
          age: 146, // About to turn 147 (21 years = 147 days)
          user: { connect: { id: testUser.id } },
          breed: { connect: { id: testBreed.id } },
        },
      });

      const milestoneResult = await checkForMilestones(horse.id, 146, 147); // 146 days → 147 days (21 years)

      expect(milestoneResult.milestonesTriggered).toContain('retirement');
      expect(milestoneResult.retirementTriggered).toBe(true);

      // Restore original Date
      global.Date = OriginalDate;
    });
  });
});
