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

// Import the functions after mocking
const { calculateAgeFromBirth, processHorseBirthdays, updateHorseAge, checkForMilestones } = await import(
  '../utils/horseAgingSystem.mjs'
);

describe('Horse Aging System', () => {
  let testUser, testBreed;
  const createdUserIds = [];
  const createdBreedIds = [];
  const createdHorseIds = [];

  beforeEach(async () => {
    jest.clearAllMocks();

    // Create test user
    testUser = await prisma.user.create({
      data: {
        id: `aging-user-${Date.now()}-${Math.random()}`,
        username: `aginguser-${Date.now()}`,
        email: `aging-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Aging',
        lastName: 'Tester',
        money: 1000,
      },
    });
    createdUserIds.push(testUser.id);

    // Create test breed
    testBreed = await prisma.breed.create({
      data: {
        name: `Test Breed ${Date.now()}`,
        description: 'Test breed for aging',
      },
    });
    createdBreedIds.push(testBreed.id);
  });

  afterEach(async () => {
    jest.restoreAllMocks();

    // Clean up test data (Scoped)
    if (createdHorseIds.length > 0) {
      await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } });
      createdHorseIds.length = 0;
    }

    // Clean up breed and user only after all tests or if specifically needed
    // But since we create new ones in beforeEach, we should clean them up in afterEach
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }

    if (createdBreedIds.length > 0) {
      await prisma.breed.deleteMany({ where: { id: { in: createdBreedIds } } });
      createdBreedIds.length = 0;
    }
  });

  // Anchor dates to keep test data deterministic
  const referenceDate = new Date('2025-06-01T12:00:00Z');
  const mockNow = new Date(referenceDate); // Current time for mocking

  // Birth dates relative to reference date
  const birthToday = new Date(referenceDate);
  const birthYesterday = new Date(referenceDate);
  birthYesterday.setDate(referenceDate.getDate() - 1);

  const birth1WeekAgo = new Date(referenceDate);
  birth1WeekAgo.setDate(referenceDate.getDate() - 7); // 1 year in game time

  const birth2WeeksAgo = new Date(referenceDate);
  birth2WeeksAgo.setDate(referenceDate.getDate() - 14); // 2 years in game time

  const birth21WeeksAgo = new Date(referenceDate);
  birth21WeeksAgo.setDate(referenceDate.getDate() - 147); // 21 years (retirement age)

  const birth15DaysAgo = new Date(referenceDate);
  birth15DaysAgo.setDate(referenceDate.getDate() - 15);

  const birth31DaysAgo = new Date(referenceDate);
  birth31DaysAgo.setDate(referenceDate.getDate() - 31);

  const birth6MonthsAgo = new Date(referenceDate);
  birth6MonthsAgo.setMonth(referenceDate.getMonth() - 6);

  const birth1YearAgo = new Date(referenceDate);
  birth1YearAgo.setFullYear(referenceDate.getFullYear() - 1);

  const birth3WeeksAgo = new Date(referenceDate);
  birth3WeeksAgo.setDate(referenceDate.getDate() - 21);

  // Leap year test dates (calculated relative to reference date)
  const mockNowLeapYear = new Date(referenceDate);
  mockNowLeapYear.setFullYear(referenceDate.getFullYear()); // 2025
  mockNowLeapYear.setMonth(2); // March (0-indexed)
  mockNowLeapYear.setDate(1);
  mockNowLeapYear.setHours(12, 0, 0, 0);

  const birthLeapYear = new Date(mockNowLeapYear);
  birthLeapYear.setFullYear(mockNowLeapYear.getFullYear() - 1); // 2024 (leap year)
  birthLeapYear.setMonth(1); // February (0-indexed)
  birthLeapYear.setDate(29); // Leap day

  // Timezone test dates
  const mockNowTimezone = new Date(referenceDate);
  mockNowTimezone.setHours(23, 59, 59, 0);

  const birthTimezone = new Date(referenceDate);
  birthTimezone.setHours(0, 0, 0, 0);

  describe('Age Calculation', () => {
    it('should calculate age correctly from dateOfBirth', () => {
      const now = mockNow;

      // Test various ages (1 year = 7 days in game time)
      const testCases = [
        { birth: birthToday.toISOString().split('T')[0], expectedDays: 0 }, // Born today
        { birth: birthYesterday.toISOString().split('T')[0], expectedDays: 1 }, // Born yesterday
        { birth: birth1WeekAgo.toISOString().split('T')[0], expectedDays: 7 }, // Born 1 week ago (1 year in game time)
        { birth: birth2WeeksAgo.toISOString().split('T')[0], expectedDays: 14 }, // Born 2 weeks ago (2 years in game time)
        { birth: birth21WeeksAgo.toISOString().split('T')[0], expectedDays: 147 }, // Born 21 weeks ago (21 years in game time)
      ];

      testCases.forEach(({ birth, expectedDays }) => {
        const birthDate = new Date(birth);
        // Pass the mock date explicitly to avoid Date constructor mocking issues
        const ageInDays = calculateAgeFromBirth(birthDate, now);
        expect(ageInDays).toBe(expectedDays);
      });
    });

    it('should handle leap years correctly', () => {
      const now = mockNowLeapYear;

      // Born in leap year
      const birthDate = birthLeapYear;
      const ageInDays = calculateAgeFromBirth(birthDate, now);

      // From Feb 29, 2024 to Mar 1, 2025 = 366 days (52.3 years in game time)
      expect(ageInDays).toBe(366);
    });

    it('should handle timezone differences', () => {
      const now = mockNowTimezone;

      const birthDate = birthTimezone;
      const ageInDays = calculateAgeFromBirth(birthDate, now);

      expect(ageInDays).toBe(0); // Same day regardless of time
    });
  });

  describe('Horse Age Updates', () => {
    it('should update horse age when birthday occurs', async () => {
      const now = mockNow;

      // Mock the Date constructor to return our mock date
      const OriginalDate = global.Date;
      global.Date = class extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) {
            return now;
          }
          return new OriginalDate(...args);
        }
        static now() {
          return now.getTime();
        }
      };

      // Create horse born 1 week ago (1 year in game time)
      const horse = await prisma.horse.create({
        data: {
          name: 'Birthday Horse',
          sex: 'Colt',
          dateOfBirth: birth1WeekAgo, // Exactly 1 week ago (1 year in game time)
          age: 6, // Currently 6 days old (will turn 7 = 1 year)
          userId: testUser.id ,
          breedId: testBreed.id ,
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
      createdHorseIds.push(horse.id);

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
      const now = mockNow;

      // Mock the Date constructor to return our mock date
      const OriginalDate = global.Date;
      global.Date = class extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) {
            return now;
          }
          return new OriginalDate(...args);
        }
        static now() {
          return now.getTime();
        }
      };

      // Create horse born 6 months ago
      const horse = await prisma.horse.create({
        data: {
          name: 'No Birthday Horse',
          sex: 'Filly',
          dateOfBirth: birth6MonthsAgo, // 6 months ago
          age: 182, // Current age matches calculated age
          userId: testUser.id ,
          breedId: testBreed.id ,
        },
      });
      createdHorseIds.push(horse.id);

      const result = await updateHorseAge(horse.id);

      expect(result.ageUpdated).toBe(false);
      expect(result.newAge).toBe(182);
      expect(result.hadBirthday).toBe(false);

      // Restore original Date
      global.Date = OriginalDate;
    });

    it('should handle horses with incorrect stored age', async () => {
      const now = mockNow;

      // Mock the Date constructor to return our mock date
      const OriginalDate = global.Date;
      global.Date = class extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) {
            return now;
          }
          return new OriginalDate(...args);
        }
        static now() {
          return now.getTime();
        }
      };

      // Create horse with incorrect stored age
      const horse = await prisma.horse.create({
        data: {
          name: 'Wrong Age Horse',
          sex: 'Colt',
          dateOfBirth: birth1YearAgo, // Should be ~517 days old (accounting for leap year)
          age: 100, // Incorrect stored age
          userId: testUser.id ,
          breedId: testBreed.id ,
        },
      });
      createdHorseIds.push(horse.id);

      const result = await updateHorseAge(horse.id);

      expect(result.ageUpdated).toBe(true);
      expect(result.newAge).toBe(365); // Correct calculated age (1 year)
      expect(result.hadBirthday).toBe(true); // Age increased, so considered a birthday

      // Restore original Date
      global.Date = OriginalDate;
    });
  });

  describe('Milestone Detection', () => {
    it('should detect age 1 milestone and trigger trait evaluation', async () => {
      const now = mockNow;
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      // Mock Math.random for trait evaluation
      jest.spyOn(Math, 'random').mockReturnValue(0.1); // 10% - will trigger traits

      // Create horse turning 1 year old
      const horse = await prisma.horse.create({
        data: {
          name: 'Milestone Horse',
          sex: 'Filly',
          dateOfBirth: birth1YearAgo, // Exactly 1 year ago
          age: 364, // About to turn 365 (1 year milestone)
          userId: testUser.id ,
          breedId: testBreed.id ,
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
      createdHorseIds.push(horse.id);

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
      const now = mockNow;

      // Mock the Date constructor to return our mock date
      const OriginalDate = global.Date;
      global.Date = class extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) {
            return now;
          }
          return new OriginalDate(...args);
        }
        static now() {
          return now.getTime();
        }
      };

      // Create multiple horses with different birthday scenarios
      const horses = await Promise.all([
        // Horse turning 1 year old (milestone)
        prisma.horse.create({
          data: {
            name: 'Milestone Horse 1',
            sex: 'Colt',
            dateOfBirth: birth1WeekAgo, // 1 week ago (1 year in game time)
            age: 6, // Will turn 7 (1 year = 7 days), milestone triggers at 7
            userId: testUser.id ,
            breedId: testBreed.id ,
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
            dateOfBirth: birth15DaysAgo, // 15 days ago (2.14 years in game time)
            age: 14, // Will turn 15 (no milestone at 15)
            userId: testUser.id ,
            breedId: testBreed.id ,
          },
        }),
        // Horse with no birthday today (but incorrect age)
        prisma.horse.create({
          data: {
            name: 'No Birthday Horse',
            sex: 'Colt',
            dateOfBirth: birth31DaysAgo, // 31 days ago (4.4 years in game time)
            age: 25, // Incorrect age, will be corrected to 31 (no milestone crossing)
            userId: testUser.id ,
            breedId: testBreed.id ,
          },
        }),
      ]);
      horses.forEach(h => createdHorseIds.push(h.id));

      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const results = await processHorseBirthdays({ horseIds: horses.map(h => h.id) });

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
      const now = mockNow;

      // Mock the Date constructor to return our mock date
      const OriginalDate = global.Date;
      global.Date = class extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) {
            return now;
          }
          return new OriginalDate(...args);
        }
        static now() {
          return now.getTime();
        }
      };

      // Create horse turning 3 (training eligible)
      const horse = await prisma.horse.create({
        data: {
          name: 'Training Ready Horse',
          sex: 'Colt',
          dateOfBirth: birth3WeeksAgo, // 3 weeks ago (3 years in game time)
          age: 20, // About to turn 21 (3 years = 21 days)
          userId: testUser.id ,
          breedId: testBreed.id ,
        },
      });
      createdHorseIds.push(horse.id);

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
      const now = mockNow;

      // Mock the Date constructor to return our mock date
      const OriginalDate = global.Date;
      global.Date = class extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) {
            return now;
          }
          return new OriginalDate(...args);
        }
        static now() {
          return now.getTime();
        }
      };

      // Create horse turning 21 (retirement age)
      const horse = await prisma.horse.create({
        data: {
          name: 'Retiring Horse',
          sex: 'Mare',
          dateOfBirth: birth21WeeksAgo, // 21 weeks ago (21 years in game time)
          age: 146, // About to turn 147 (21 years = 147 days)
          userId: testUser.id ,
          breedId: testBreed.id ,
        },
      });
      createdHorseIds.push(horse.id);

      const milestoneResult = await checkForMilestones(horse.id, 146, 147); // 146 days → 147 days (21 years)

      expect(milestoneResult.milestonesTriggered).toContain('retirement');
      expect(milestoneResult.retirementTriggered).toBe(true);

      // Restore original Date
      global.Date = OriginalDate;
    });
  });
});
