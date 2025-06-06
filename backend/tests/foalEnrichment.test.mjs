/**
 * 🧪 UNIT TEST: Foal Enrichment API - Early Training System Validation
 *
 * This test validates the foal enrichment system that provides early training
 * activities for young horses to build bonding and manage stress levels.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Foal enrichment activities: Day-specific training activities for foals (0-1 years old)
 * - Bond score management: Activities increase bond score (0-100 range with bounds)
 * - Stress level management: Activities affect stress levels (0-100 range with bounds)
 * - Age restrictions: Only foals (1 year old or younger) can participate
 * - Day-specific activities: Different activities available for different training days (0-6)
 * - Activity validation: Activities must be appropriate for the specified day
 * - Input validation: Foal ID, day, and activity name validation
 * - Training history: All activities logged in foalTrainingHistory table
 * - Default value handling: Null bond scores and stress levels use defaults (50, 0)
 * - Activity flexibility: Activities accepted by type or name, case insensitive
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. completeEnrichmentActivity() - Complete foal training activity execution
 * 2. Input validation - Foal ID, day range, activity name validation
 * 3. Age validation - Only foals (≤1 year) can participate in enrichment
 * 4. Activity validation - Day-specific activity availability and appropriateness
 * 5. Bond/stress management - Score updates with proper bounds (0-100)
 * 6. Database operations - Horse lookup, updates, training history creation
 * 7. Error handling - Database errors, validation failures, not found scenarios
 * 8. Default handling - Null values for bond score and stress level
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ⚠️  OVER-MOCKED: Complete database layer (Prisma) and logger mocked
 * ⚠️  RISK: Tests may not reflect real database constraints and behavior
 * 🔧 MOCK: Database operations, logger - for unit testing isolation
 *
 * 💡 TEST STRATEGY: Unit testing with mocked dependencies to validate
 *    business logic and input validation for foal enrichment system
 *
 * ⚠️  WARNING: Heavy database mocking may miss real-world constraints.
 *    Consider integration tests with real database for complete validation.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock Prisma client
const mockPrisma = {
  horse: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  foalTrainingHistory: {
    create: jest.fn(),
  },
};

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
};

// Mock the imports before importing the module
jest.unstable_mockModule(join(__dirname, '../db/index.js'), () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule(join(__dirname, '../utils/logger.mjs'), () => ({
  default: mockLogger,
}));

// Import the function after mocking
const { completeEnrichmentActivity } = await import(join(__dirname, '../models/foalModel.js'));

describe('🐴 UNIT: Foal Enrichment API - Early Training System Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('completeEnrichmentActivity', () => {
    const mockFoal = {
      id: 1,
      name: 'Test Foal',
      age: 0,
      bondScore: 50,
      stressLevel: 20,
    };

    const mockTrainingRecord = {
      id: 'test-uuid-123',
      horseId: 1,
      day: 3,
      activity: 'Trailer Exposure',
      outcome: 'success',
      bondChange: 4,
      stressChange: 5,
    };

    it('should complete enrichment activity successfully', async () => {
      mockPrisma.horse.findUnique.mockResolvedValue(mockFoal);
      mockPrisma.horse.update.mockResolvedValue({
        ...mockFoal,
        bondScore: 54,
        stressLevel: 25,
      });
      mockPrisma.foalTrainingHistory.create.mockResolvedValue(mockTrainingRecord);

      const result = await completeEnrichmentActivity(1, 3, 'Trailer Exposure');

      expect(result.success).toBe(true);
      expect(result.foal.id).toBe(1);
      expect(result.foal.name).toBe('Test Foal');
      expect(result.activity.name).toBe('Trailer Exposure');
      expect(result.activity.day).toBe(3);
      expect(result.levels.bondScore).toBeGreaterThanOrEqual(52);
      expect(result.levels.stressLevel).toBeGreaterThanOrEqual(23);
      expect(result.trainingRecordId).toBe('test-uuid-123');

      expect(mockPrisma.horse.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          name: true,
          age: true,
          bondScore: true,
          stressLevel: true,
        },
      });

      expect(mockPrisma.horse.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          bondScore: expect.any(Number),
          stressLevel: expect.any(Number),
        },
      });

      expect(mockPrisma.foalTrainingHistory.create).toHaveBeenCalledWith({
        data: {
          horseId: 1,
          day: 3,
          activity: 'Trailer Exposure',
          outcome: expect.any(String),
          bondChange: expect.any(Number),
          stressChange: expect.any(Number),
        },
      });
    });

    it('should handle foal with null bondScore and stressLevel', async () => {
      const foalWithNulls = {
        ...mockFoal,
        bondScore: null,
        stressLevel: null,
      };

      mockPrisma.horse.findUnique.mockResolvedValue(foalWithNulls);
      mockPrisma.horse.update.mockResolvedValue({
        ...foalWithNulls,
        bondScore: 54,
        stressLevel: 5,
      });
      mockPrisma.foalTrainingHistory.create.mockResolvedValue(mockTrainingRecord);

      const result = await completeEnrichmentActivity(1, 3, 'Trailer Exposure');

      expect(result.success).toBe(true);
      expect(result.levels.bondScore).toBeGreaterThanOrEqual(50); // Should use default 50
      expect(result.levels.stressLevel).toBeGreaterThanOrEqual(0); // Should use default 0
    });

    it('should validate foal ID is a positive integer', async () => {
      await expect(completeEnrichmentActivity('invalid', 3, 'Trailer Exposure')).rejects.toThrow(
        'Foal ID must be a positive integer',
      );

      await expect(completeEnrichmentActivity(-1, 3, 'Trailer Exposure')).rejects.toThrow(
        'Foal ID must be a positive integer',
      );

      await expect(completeEnrichmentActivity(0, 3, 'Trailer Exposure')).rejects.toThrow(
        'Foal ID must be a positive integer',
      );
    });

    it('should validate day is between 0 and 6', async () => {
      await expect(completeEnrichmentActivity(1, -1, 'Trailer Exposure')).rejects.toThrow(
        'Day must be between 0 and 6',
      );

      await expect(completeEnrichmentActivity(1, 7, 'Trailer Exposure')).rejects.toThrow(
        'Day must be between 0 and 6',
      );

      await expect(completeEnrichmentActivity(1, 'invalid', 'Trailer Exposure')).rejects.toThrow(
        'Day must be between 0 and 6',
      );
    });

    it('should validate activity is required and is a string', async () => {
      await expect(completeEnrichmentActivity(1, 3, '')).rejects.toThrow(
        'Activity is required and must be a string',
      );

      await expect(completeEnrichmentActivity(1, 3, null)).rejects.toThrow(
        'Activity is required and must be a string',
      );

      await expect(completeEnrichmentActivity(1, 3, 123)).rejects.toThrow(
        'Activity is required and must be a string',
      );
    });

    it('should throw error if foal not found', async () => {
      mockPrisma.horse.findUnique.mockResolvedValue(null);

      await expect(completeEnrichmentActivity(999, 3, 'Trailer Exposure')).rejects.toThrow(
        'Foal not found',
      );
    });

    it('should throw error if horse is not a foal (age > 1)', async () => {
      const adultHorse = {
        ...mockFoal,
        age: 3,
      };

      mockPrisma.horse.findUnique.mockResolvedValue(adultHorse);

      await expect(completeEnrichmentActivity(1, 3, 'Trailer Exposure')).rejects.toThrow(
        'Horse is not a foal (must be 1 year old or younger)',
      );
    });

    it('should throw error if activity is not appropriate for the day', async () => {
      mockPrisma.horse.findUnique.mockResolvedValue(mockFoal);

      // Try to do a day 3 activity on day 0
      await expect(completeEnrichmentActivity(1, 0, 'Trailer Exposure')).rejects.toThrow(
        'Activity "Trailer Exposure" is not appropriate for day 0',
      );

      // Try an invalid activity
      await expect(completeEnrichmentActivity(1, 3, 'Invalid Activity')).rejects.toThrow(
        'Activity "Invalid Activity" is not appropriate for day 3',
      );
    });

    it('should accept activity by type or name', async () => {
      mockPrisma.horse.findUnique.mockResolvedValue(mockFoal);
      mockPrisma.horse.update.mockResolvedValue({
        ...mockFoal,
        bond_score: 54,
        stress_level: 25,
      });
      mockPrisma.foalTrainingHistory.create.mockResolvedValue(mockTrainingRecord);

      // Test by exact type
      const result1 = await completeEnrichmentActivity(1, 3, 'trailer_exposure');
      expect(result1.success).toBe(true);

      // Test by exact name
      const result2 = await completeEnrichmentActivity(1, 3, 'Trailer Exposure');
      expect(result2.success).toBe(true);

      // Test case insensitive
      const result3 = await completeEnrichmentActivity(1, 3, 'TRAILER EXPOSURE');
      expect(result3.success).toBe(true);
    });

    it('should enforce bonding and stress level bounds (0-100)', async () => {
      // Test with extreme values
      const extremeFoal = {
        ...mockFoal,
        bondScore: 95,
        stressLevel: 5,
      };

      mockPrisma.horse.findUnique.mockResolvedValue(extremeFoal);
      mockPrisma.horse.update.mockResolvedValue({
        ...extremeFoal,
        bondScore: 100, // Should be capped at 100
        stressLevel: 0, // Should be capped at 0
      });
      mockPrisma.foalTrainingHistory.create.mockResolvedValue(mockTrainingRecord);

      const result = await completeEnrichmentActivity(1, 3, 'Trailer Exposure');

      expect(result.levels.bondScore).toBeLessThanOrEqual(100);
      expect(result.levels.stressLevel).toBeGreaterThanOrEqual(0);
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.horse.findUnique.mockRejectedValue(new Error('Database connection failed'));

      await expect(completeEnrichmentActivity(1, 3, 'Trailer Exposure')).rejects.toThrow(
        'Database connection failed',
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          '[foalModel.completeEnrichmentActivity] Error: Database connection failed',
        ),
      );
    });

    it('should validate all day 3 activities are available', async () => {
      mockPrisma.horse.findUnique.mockResolvedValue(mockFoal);
      mockPrisma.horse.update.mockResolvedValue({
        ...mockFoal,
        bondScore: 54,
        stressLevel: 25,
      });
      mockPrisma.foalTrainingHistory.create.mockResolvedValue(mockTrainingRecord);

      const day3Activities = [
        'Halter Introduction',
        'Leading Practice',
        'Handling Exercises',
        'Trailer Exposure',
      ];

      for (const activity of day3Activities) {
        const result = await completeEnrichmentActivity(1, 3, activity);
        expect(result.success).toBe(true);
        expect(result.activity.name).toBe(activity);
      }
    });
  });
});
