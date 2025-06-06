/**
 * 🧪 UNIT TEST: Foal Model - Foal Development & Activity Management
 *
 * This test validates the foal model's functionality for managing foal development
 * during the critical first 7 days of life, including bonding and stress tracking.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Foals are horses with age = 0 (newborns only)
 * - 7-day development period with daily activities
 * - Bonding level starts at 50, stress level starts at 20
 * - Activities can only be completed once per day
 * - Each activity affects bonding (+/-) and stress (+/-) levels
 * - Development record is auto-created for new foals
 * - Day advancement is blocked after completing 7-day period
 * - Activity availability depends on current day and completion status
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. getFoalDevelopment() - Retrieve foal development status and available activities
 * 2. completeActivity() - Execute daily activities with bonding/stress effects
 * 3. advanceDay() - Progress foal to next development day
 * 4. Input validation and error handling for all operations
 * 5. Auto-creation of development records for new foals
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Business logic for development progression, activity validation, bonding/stress calculations
 * ✅ REAL: Day advancement logic, activity availability rules, input validation
 * 🔧 MOCK: Database operations (Prisma calls) - external dependency
 * 🔧 MOCK: Logger calls - external dependency for error reporting
 *
 * 💡 TEST STRATEGY: Unit testing with mocked database to focus on foal development
 *    business logic while ensuring predictable test outcomes for complex progression rules
 */

import { jest, describe, beforeEach, expect, it } from '@jest/globals';

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock the database
const mockPrisma = {
  horse: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  foalDevelopment: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  foalActivity: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  foalTrainingHistory: {
    create: jest.fn(),
  },
};

// Mock the logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
};

// Mock modules
jest.unstable_mockModule(join(__dirname, '../db/index.mjs'), () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule(join(__dirname, '../utils/logger.mjs'), () => ({
  default: mockLogger,
}));

// Import after mocking
const {
  getFoalDevelopment,
  completeActivity,
  advanceDay,
  completeEnrichmentActivity,
  getAvailableActivities,
} = await import(join(__dirname, '../models/foalModel.mjs'));

describe('🍼 UNIT: Foal Model - Foal Development & Activity Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.horse.findUnique.mockClear();
    mockPrisma.horse.update.mockClear();
    mockPrisma.foalDevelopment.findUnique.mockClear();
    mockPrisma.foalDevelopment.create.mockClear();
    mockPrisma.foalDevelopment.update.mockClear();
    mockPrisma.foalActivity.findMany.mockClear();
    mockPrisma.foalActivity.create.mockClear();
    mockPrisma.foalTrainingHistory.create.mockClear();
    mockLogger.info.mockClear();
    mockLogger.error.mockClear();
  });

  describe('getFoalDevelopment', () => {
    it('should return foal development data for valid foal', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Foal',
        age: 0,
        breed: { name: 'Thoroughbred' },
        owner: { name: 'Test Owner' },
        stable: { name: 'Test Stable' },
      };

      const mockDevelopment = {
        currentDay: 2,
        bondingLevel: 60,
        stressLevel: 15,
        completedActivities: { 0: ['gentle_touch'], 1: ['feeding_assistance'] },
      };

      const mockActivities = [
        {
          id: 1,
          day: 1,
          activityType: 'feeding_assistance',
          outcome: 'success',
          bondingChange: 5,
          stressChange: -1,
          description: 'Feeding went well',
          createdAt: new Date(),
        },
      ];

      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);
      mockPrisma.foalDevelopment.findUnique.mockResolvedValue(mockDevelopment);
      mockPrisma.foalActivity.findMany.mockResolvedValue(mockActivities);

      const result = await getFoalDevelopment(1);

      expect(result).toHaveProperty('foal');
      expect(result).toHaveProperty('development');
      expect(result).toHaveProperty('activityHistory');
      expect(result).toHaveProperty('availableActivities');
      expect(result.foal.name).toBe('Test Foal');
      expect(result.development.currentDay).toBe(2);
      expect(result.development.bondingLevel).toBe(60);
    });

    it('should throw error for horse that is not a foal', async () => {
      const mockHorse = {
        id: 1,
        name: 'Adult Horse',
        age: 5,
        breed: { name: 'Thoroughbred' },
      };

      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);

      await expect(getFoalDevelopment(1)).rejects.toThrow(
        'Horse is not a foal (must be 1 year old or younger)',
      );
    });

    it('should throw error for 2-year-old horse (boundary test)', async () => {
      const mockHorse = {
        id: 1,
        name: 'Young Horse',
        age: 2,
        breed: { name: 'Thoroughbred' },
      };

      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);

      await expect(getFoalDevelopment(1)).rejects.toThrow(
        'Horse is not a foal (must be 1 year old or younger)',
      );
    });

    it('should accept 1-year-old horse (boundary test)', async () => {
      const mockHorse = {
        id: 1,
        name: 'Yearling',
        age: 1,
        breed: { name: 'Thoroughbred' },
        user: { firstName: 'Test Owner' },
      };

      const mockDevelopment = {
        currentDay: 1,
        bondingLevel: 55,
        stressLevel: 18,
        completedActivities: {},
      };

      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);
      mockPrisma.foalDevelopment.findUnique.mockResolvedValue(mockDevelopment);
      mockPrisma.foalActivity.findMany.mockResolvedValue([]);

      const result = await getFoalDevelopment(1);

      expect(result.foal.name).toBe('Yearling');
      expect(result.development.currentDay).toBe(1);
    });

    it('should validate availableActivities are returned correctly', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Foal',
        age: 0,
        breed: { name: 'Thoroughbred' },
        user: { firstName: 'Test Owner' },
      };

      const mockDevelopment = {
        currentDay: 0,
        bondingLevel: 50,
        stressLevel: 20,
        completedActivities: {},
      };

      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);
      mockPrisma.foalDevelopment.findUnique.mockResolvedValue(mockDevelopment);
      mockPrisma.foalActivity.findMany.mockResolvedValue([]);

      const result = await getFoalDevelopment(1);

      expect(result.availableActivities).toBeDefined();
      expect(Array.isArray(result.availableActivities)).toBe(true);
      expect(result.availableActivities.length).toBeGreaterThan(0);
      // Day 0 should have activities like gentle_touch, quiet_presence, soft_voice
      const activityTypes = result.availableActivities.map(a => a.type);
      expect(activityTypes).toContain('gentle_touch');
    });

    it('should filter out completed activities from available activities', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Foal',
        age: 0,
        breed: { name: 'Thoroughbred' },
        user: { firstName: 'Test Owner' },
      };

      const mockDevelopment = {
        currentDay: 0,
        bondingLevel: 55,
        stressLevel: 18,
        completedActivities: { 0: ['gentle_touch'] }, // gentle_touch already completed
      };

      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);
      mockPrisma.foalDevelopment.findUnique.mockResolvedValue(mockDevelopment);
      mockPrisma.foalActivity.findMany.mockResolvedValue([]);

      const result = await getFoalDevelopment(1);

      const activityTypes = result.availableActivities.map(a => a.type);
      expect(activityTypes).not.toContain('gentle_touch'); // Should be filtered out
      expect(activityTypes).toContain('quiet_presence'); // Should still be available
    });

    it('should throw error for non-existent horse', async () => {
      mockPrisma.horse.findUnique.mockResolvedValue(null);

      await expect(getFoalDevelopment(999)).rejects.toThrow('Foal not found');
    });

    it('should throw error for invalid foal ID', async () => {
      await expect(getFoalDevelopment('invalid')).rejects.toThrow(
        'Foal ID must be a positive integer',
      );
      await expect(getFoalDevelopment(-1)).rejects.toThrow('Foal ID must be a positive integer');
      await expect(getFoalDevelopment(0)).rejects.toThrow('Foal ID must be a positive integer');
    });

    it('should create default development record for new foal', async () => {
      const mockHorse = {
        id: 1,
        name: 'New Foal',
        age: 0,
        breed: { name: 'Thoroughbred' },
        owner: { name: 'Test Owner' },
      };

      const mockNewDevelopment = {
        currentDay: 0,
        bondingLevel: 50,
        stressLevel: 20,
        completedActivities: {},
      };

      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);
      mockPrisma.foalDevelopment.findUnique.mockResolvedValue(null);
      mockPrisma.foalDevelopment.create.mockResolvedValue(mockNewDevelopment);
      mockPrisma.foalActivity.findMany.mockResolvedValue([]);

      const result = await getFoalDevelopment(1);

      expect(mockPrisma.foalDevelopment.create).toHaveBeenCalledWith({
        data: {
          foalId: 1,
          currentDay: 0,
          bondingLevel: 50,
          stressLevel: 20,
          completedActivities: {},
        },
      });
      expect(result.development.currentDay).toBe(0);
    });
  });

  describe('completeActivity', () => {
    it('should complete an available activity successfully', async () => {
      const mockDevelopment = {
        currentDay: 0,
        bondingLevel: 50,
        stressLevel: 20,
        completedActivities: {},
      };

      mockPrisma.foalDevelopment.findUnique.mockResolvedValue(mockDevelopment);
      mockPrisma.foalDevelopment.update.mockResolvedValue({});
      mockPrisma.foalActivity.create.mockResolvedValue({ id: 1 });

      // Mock the return call to getFoalDevelopment
      const mockHorse = {
        id: 1,
        name: 'Test Foal',
        age: 0,
        breed: { name: 'Thoroughbred' },
        user: { firstName: 'Test Owner' },
      };
      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);
      mockPrisma.foalActivity.findMany.mockResolvedValue([]);

      const result = await completeActivity(1, 'gentle_touch');

      expect(mockPrisma.foalDevelopment.update).toHaveBeenCalled();
      expect(mockPrisma.foalActivity.create).toHaveBeenCalled();
      expect(result).toHaveProperty('foal');
      expect(result).toHaveProperty('development');
    });

    it('should update completedActivities correctly when completing activity', async () => {
      const mockDevelopment = {
        currentDay: 0,
        bondingLevel: 50,
        stressLevel: 20,
        completedActivities: {},
      };

      mockPrisma.foalDevelopment.findUnique.mockResolvedValue(mockDevelopment);
      mockPrisma.foalDevelopment.update.mockResolvedValue({});
      mockPrisma.foalActivity.create.mockResolvedValue({ id: 1 });

      // Mock the return call to getFoalDevelopment
      const mockHorse = {
        id: 1,
        name: 'Test Foal',
        age: 0,
        breed: { name: 'Thoroughbred' },
        user: { firstName: 'Test Owner' },
      };
      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);
      mockPrisma.foalActivity.findMany.mockResolvedValue([]);

      await completeActivity(1, 'gentle_touch');

      // Verify that the update call includes the completed activity
      expect(mockPrisma.foalDevelopment.update).toHaveBeenCalledWith({
        where: { foalId: 1 },
        data: expect.objectContaining({
          completedActivities: { 0: ['gentle_touch'] },
        }),
      });
    });

    it('should add to existing completed activities for the same day', async () => {
      const mockDevelopment = {
        currentDay: 0,
        bondingLevel: 55,
        stressLevel: 18,
        completedActivities: { 0: ['quiet_presence'] }, // Already has one activity
      };

      mockPrisma.foalDevelopment.findUnique.mockResolvedValue(mockDevelopment);
      mockPrisma.foalDevelopment.update.mockResolvedValue({});
      mockPrisma.foalActivity.create.mockResolvedValue({ id: 1 });

      // Mock the return call to getFoalDevelopment
      const mockHorse = {
        id: 1,
        name: 'Test Foal',
        age: 0,
        breed: { name: 'Thoroughbred' },
        user: { firstName: 'Test Owner' },
      };
      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);
      mockPrisma.foalActivity.findMany.mockResolvedValue([]);

      await completeActivity(1, 'gentle_touch');

      // Verify that both activities are now in the completed list
      expect(mockPrisma.foalDevelopment.update).toHaveBeenCalledWith({
        where: { foalId: 1 },
        data: expect.objectContaining({
          completedActivities: { 0: ['quiet_presence', 'gentle_touch'] },
        }),
      });
    });

    it('should enforce bonding level bounds (0-100)', async () => {
      const mockDevelopment = {
        currentDay: 0,
        bondingLevel: 98, // High bonding level
        stressLevel: 20,
        completedActivities: {},
      };

      mockPrisma.foalDevelopment.findUnique.mockResolvedValue(mockDevelopment);
      mockPrisma.foalDevelopment.update.mockResolvedValue({});
      mockPrisma.foalActivity.create.mockResolvedValue({ id: 1 });

      // Mock the return call to getFoalDevelopment
      const mockHorse = {
        id: 1,
        name: 'Test Foal',
        age: 0,
        breed: { name: 'Thoroughbred' },
        user: { firstName: 'Test Owner' },
      };
      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);
      mockPrisma.foalActivity.findMany.mockResolvedValue([]);

      await completeActivity(1, 'gentle_touch');

      // Verify bonding level is capped at 100
      const updateCall = mockPrisma.foalDevelopment.update.mock.calls[0][0];
      expect(updateCall.data.bondingLevel).toBeLessThanOrEqual(100);
    });

    it('should enforce stress level bounds (0-100)', async () => {
      const mockDevelopment = {
        currentDay: 0,
        bondingLevel: 50,
        stressLevel: 2, // Low stress level
        completedActivities: {},
      };

      mockPrisma.foalDevelopment.findUnique.mockResolvedValue(mockDevelopment);
      mockPrisma.foalDevelopment.update.mockResolvedValue({});
      mockPrisma.foalActivity.create.mockResolvedValue({ id: 1 });

      // Mock the return call to getFoalDevelopment
      const mockHorse = {
        id: 1,
        name: 'Test Foal',
        age: 0,
        breed: { name: 'Thoroughbred' },
        user: { firstName: 'Test Owner' },
      };
      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);
      mockPrisma.foalActivity.findMany.mockResolvedValue([]);

      await completeActivity(1, 'gentle_touch');

      // Verify stress level doesn't go below 0
      const updateCall = mockPrisma.foalDevelopment.update.mock.calls[0][0];
      expect(updateCall.data.stressLevel).toBeGreaterThanOrEqual(0);
    });

    it('should throw error for missing development record', async () => {
      mockPrisma.foalDevelopment.findUnique.mockResolvedValue(null);

      await expect(completeActivity(1, 'gentle_touch')).rejects.toThrow(
        'Foal development record not found',
      );
    });

    it('should throw error for invalid foal ID', async () => {
      await expect(completeActivity('invalid', 'gentle_touch')).rejects.toThrow(
        'Foal ID must be a positive integer',
      );
    });

    it('should throw error for missing activity type', async () => {
      await expect(completeActivity(1, '')).rejects.toThrow('Activity type is required');
    });

    it('should throw error for unavailable activity', async () => {
      const mockDevelopment = {
        currentDay: 0,
        bondingLevel: 50,
        stressLevel: 20,
        completedActivities: { 0: ['gentle_touch'] }, // Activity already completed
      };

      mockPrisma.foalDevelopment.findUnique.mockResolvedValue(mockDevelopment);

      await expect(completeActivity(1, 'gentle_touch')).rejects.toThrow(
        'Activity not available for current day or already completed',
      );
    });
  });

  describe('advanceDay', () => {
    it('should advance foal to next day successfully', async () => {
      const mockDevelopment = {
        currentDay: 2,
        bondingLevel: 60,
        stressLevel: 15,
      };

      mockPrisma.foalDevelopment.findUnique.mockResolvedValue(mockDevelopment);
      mockPrisma.foalDevelopment.update.mockResolvedValue({ ...mockDevelopment, currentDay: 3 });

      // Mock the return call to getFoalDevelopment
      const mockHorse = {
        id: 1,
        name: 'Test Foal',
        age: 0,
        breed: { name: 'Thoroughbred' },
        owner: { name: 'Test Owner' },
      };
      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);
      mockPrisma.foalActivity.findMany.mockResolvedValue([]);

      const result = await advanceDay(1);

      expect(mockPrisma.foalDevelopment.update).toHaveBeenCalledWith({
        where: { foalId: 1 },
        data: { currentDay: 3 },
      });
      expect(result).toHaveProperty('foal');
      expect(result).toHaveProperty('development');
    });

    it('should throw error for foal that has completed development', async () => {
      const mockDevelopment = {
        currentDay: 6,
        bondingLevel: 80,
        stressLevel: 10,
      };

      mockPrisma.foalDevelopment.findUnique.mockResolvedValue(mockDevelopment);

      await expect(advanceDay(1)).rejects.toThrow('Foal has already completed development period');
    });

    it('should throw error for invalid foal ID', async () => {
      await expect(advanceDay('invalid')).rejects.toThrow('Foal ID must be a positive integer');
    });
  });

  describe('completeEnrichmentActivity', () => {
    it('should complete enrichment activity successfully', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Foal',
        age: 0,
        bondScore: 50,
        stressLevel: 20,
      };

      const mockTrainingRecord = { id: 1 };

      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);
      mockPrisma.horse.update.mockResolvedValue({ ...mockHorse, bondScore: 55, stressLevel: 18 });
      mockPrisma.foalTrainingHistory.create.mockResolvedValue(mockTrainingRecord);

      const result = await completeEnrichmentActivity(1, 0, 'gentle_touch');

      expect(result.success).toBe(true);
      expect(result.foal.name).toBe('Test Foal');
      expect(result.activity.name).toBe('Gentle Touch');
      expect(result.levels).toHaveProperty('bond_score');
      expect(result.levels).toHaveProperty('stress_level');
      expect(result.training_record_id).toBe(1);
    });

    it('should validate day parameter (0-6)', async () => {
      await expect(completeEnrichmentActivity(1, -1, 'gentle_touch')).rejects.toThrow(
        'Day must be between 0 and 6',
      );
      await expect(completeEnrichmentActivity(1, 7, 'gentle_touch')).rejects.toThrow(
        'Day must be between 0 and 6',
      );
      await expect(completeEnrichmentActivity(1, 'invalid', 'gentle_touch')).rejects.toThrow(
        'Day must be between 0 and 6',
      );
    });

    it('should validate activity is appropriate for the day', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Foal',
        age: 0,
        bondScore: 50,
        stressLevel: 20,
      };

      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);

      // Try to do a day 3 activity on day 0
      await expect(completeEnrichmentActivity(1, 0, 'halter_introduction')).rejects.toThrow(
        'Activity "halter_introduction" is not appropriate for day 0',
      );
    });

    it('should enforce bonding and stress bounds (0-100)', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Foal',
        age: 0,
        bondScore: 98, // High bond score
        stressLevel: 2, // Low stress level
      };

      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);
      mockPrisma.horse.update.mockResolvedValue({ ...mockHorse, bondScore: 100, stressLevel: 0 });
      mockPrisma.foalTrainingHistory.create.mockResolvedValue({ id: 1 });

      const result = await completeEnrichmentActivity(1, 0, 'gentle_touch');

      // Verify bounds are enforced
      expect(result.levels.bond_score).toBeLessThanOrEqual(100);
      expect(result.levels.stress_level).toBeGreaterThanOrEqual(0);
    });

    it('should handle null bondScore and stressLevel with defaults', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Foal',
        age: 0,
        bondScore: null, // Null values
        stressLevel: null,
      };

      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);
      mockPrisma.horse.update.mockResolvedValue({ ...mockHorse, bondScore: 55, stressLevel: 18 });
      mockPrisma.foalTrainingHistory.create.mockResolvedValue({ id: 1 });

      const result = await completeEnrichmentActivity(1, 0, 'gentle_touch');

      expect(result.success).toBe(true);
      // Should use defaults: bond_score: 50, stress_level: 0
      expect(result.levels).toHaveProperty('bond_score');
      expect(result.levels).toHaveProperty('stress_level');
    });

    it('should throw error for horse that is not a foal', async () => {
      const mockHorse = {
        id: 1,
        name: 'Adult Horse',
        age: 3,
        bondScore: 50,
        stressLevel: 20,
      };

      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);

      await expect(completeEnrichmentActivity(1, 0, 'gentle_touch')).rejects.toThrow(
        'Horse is not a foal (must be 1 year old or younger)',
      );
    });
  });

  describe('getAvailableActivities', () => {
    it('should return activities for day 0', () => {
      const activities = getAvailableActivities(0, {});

      expect(Array.isArray(activities)).toBe(true);
      expect(activities.length).toBeGreaterThan(0);

      const activityTypes = activities.map(a => a.type);
      expect(activityTypes).toContain('gentle_touch');
      expect(activityTypes).toContain('quiet_presence');
      expect(activityTypes).toContain('soft_voice');
    });

    it('should return different activities for different days', () => {
      const day0Activities = getAvailableActivities(0, {});
      const day3Activities = getAvailableActivities(3, {});

      const day0Types = day0Activities.map(a => a.type);
      const day3Types = day3Activities.map(a => a.type);

      // Day 0 should not have halter_introduction
      expect(day0Types).not.toContain('halter_introduction');
      // Day 3 should have halter_introduction
      expect(day3Types).toContain('halter_introduction');
    });

    it('should filter out completed activities', () => {
      const completedActivities = { 0: ['gentle_touch'] };
      const activities = getAvailableActivities(0, completedActivities);

      const activityTypes = activities.map(a => a.type);
      expect(activityTypes).not.toContain('gentle_touch'); // Should be filtered out
      expect(activityTypes).toContain('quiet_presence'); // Should still be available
    });

    it('should return empty array for invalid day', () => {
      const activities = getAvailableActivities(99, {});
      expect(activities).toEqual([]);
    });

    it('should handle missing completedActivities gracefully', () => {
      const activities = getAvailableActivities(0); // No completedActivities parameter
      expect(Array.isArray(activities)).toBe(true);
      expect(activities.length).toBeGreaterThan(0);
    });
  });
});
