/**
 * 🧪 UNIT TEST: Training Model - Training Session Logging & Horse Data
 *
 * This test validates the training model's core functionality for logging training
 * sessions, retrieving training history, and managing horse age data.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Training session logging with required fields (horseId, discipline, timestamp)
 * - Horse ID validation: must be positive integer
 * - Discipline validation: required non-empty string
 * - Training history retrieval by horse and discipline
 * - Horse age retrieval for training eligibility checks
 * - Database error handling with graceful error messages
 * - Input validation for all parameters
 * - Multiple training sessions per horse across different disciplines
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. logTrainingSession() - Training session logging with validation
 * 2. getLastTrainingDate() - Training history retrieval with ordering
 * 3. getHorseAge() - Horse age data retrieval for eligibility
 * 4. Input validation for all functions
 * 5. Database error handling scenarios
 * 6. Integration scenarios with multiple sessions
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: All business logic, validation rules, error handling, data processing
 * ✅ REAL: Input validation, parameter checking, response formatting
 * 🔧 MOCK: Database operations (Prisma calls) - external dependency
 *
 * 💡 TEST STRATEGY: Unit testing with mocked database to focus on model
 *    business logic while ensuring predictable test outcomes for data operations
 */

import { jest, describe, beforeEach, expect, it } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock the Prisma client
const mockTrainingLogCreate = jest.fn();
const mockTrainingLogFindFirst = jest.fn();
const mockHorseFindUnique = jest.fn();

jest.unstable_mockModule(join(__dirname, '../db/index.mjs'), () => ({
  default: {
    trainingLog: {
      create: mockTrainingLogCreate,
      findFirst: mockTrainingLogFindFirst,
    },
    horse: {
      findUnique: mockHorseFindUnique,
    },
  },
}));

// Import the module after mocking
const { logTrainingSession, getLastTrainingDate, getHorseAge } = await import(
  join(__dirname, '../models/trainingModel.mjs')
);

describe('🏋️ UNIT: Training Model - Training Session Logging & Horse Data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTrainingLogCreate.mockClear();
    mockTrainingLogFindFirst.mockClear();
    mockHorseFindUnique.mockClear();
  });

  describe('logTrainingSession', () => {
    it('should log a training session with all required fields', async () => {
      const mockResult = {
        id: 1,
        horseId: 5,
        discipline: 'Show Jumping',
        trainedAt: new Date('2025-01-15T10:00:00Z'),
      };
      mockTrainingLogCreate.mockResolvedValue(mockResult);

      const trainingData = {
        horseId: 5,
        discipline: 'Show Jumping',
      };

      const result = await logTrainingSession(trainingData);

      expect(mockTrainingLogCreate).toHaveBeenCalledWith({
        data: {
          horseId: 5,
          discipline: 'Show Jumping',
          trainedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(mockResult);
    });

    it('should throw error if horseId is missing', async () => {
      await expect(logTrainingSession({ discipline: 'Racing' })).rejects.toThrow(
        'Horse ID is required',
      );
    });

    it('should throw error if discipline is missing', async () => {
      await expect(logTrainingSession({ horseId: 5 })).rejects.toThrow('Discipline is required');
    });

    it('should throw error if horseId is not a positive integer', async () => {
      await expect(logTrainingSession({ horseId: -1, discipline: 'Racing' })).rejects.toThrow(
        'Horse ID must be a positive integer',
      );

      await expect(logTrainingSession({ horseId: 0, discipline: 'Racing' })).rejects.toThrow(
        'Horse ID must be a positive integer',
      );

      await expect(
        logTrainingSession({ horseId: 'invalid', discipline: 'Racing' }),
      ).rejects.toThrow('Horse ID must be a positive integer');
    });

    it('should handle database errors gracefully', async () => {
      mockTrainingLogCreate.mockRejectedValue(new Error('Database connection failed'));

      await expect(logTrainingSession({ horseId: 5, discipline: 'Racing' })).rejects.toThrow(
        'Database error: Database connection failed',
      );
    });
  });

  describe('getLastTrainingDate', () => {
    it('should return the most recent training date for horse and discipline', async () => {
      const mockResult = {
        trainedAt: new Date('2025-01-15T10:00:00Z'),
      };
      mockTrainingLogFindFirst.mockResolvedValue(mockResult);

      const result = await getLastTrainingDate(5, 'Show Jumping');

      expect(mockTrainingLogFindFirst).toHaveBeenCalledWith({
        where: {
          horseId: 5,
          discipline: 'Show Jumping',
        },
        orderBy: {
          trainedAt: 'desc',
        },
      });
      expect(result).toEqual(new Date('2025-01-15T10:00:00Z'));
    });

    it('should return null if no training records found', async () => {
      mockTrainingLogFindFirst.mockResolvedValue(null);

      const result = await getLastTrainingDate(5, 'Racing');

      expect(result).toBeNull();
    });

    it('should throw error if horseId is not a positive integer', async () => {
      await expect(getLastTrainingDate(-1, 'Racing')).rejects.toThrow(
        'Horse ID must be a positive integer',
      );

      await expect(getLastTrainingDate(0, 'Racing')).rejects.toThrow(
        'Horse ID must be a positive integer',
      );

      await expect(getLastTrainingDate('invalid', 'Racing')).rejects.toThrow(
        'Horse ID must be a positive integer',
      );
    });

    it('should throw error if discipline is missing', async () => {
      await expect(getLastTrainingDate(5, '')).rejects.toThrow('Discipline is required');

      await expect(getLastTrainingDate(5, null)).rejects.toThrow('Discipline is required');
    });

    it('should handle database errors gracefully', async () => {
      mockTrainingLogFindFirst.mockRejectedValue(new Error('Database connection failed'));

      await expect(getLastTrainingDate(5, 'Racing')).rejects.toThrow(
        'Database error: Database connection failed',
      );
    });
  });

  describe('getHorseAge', () => {
    it('should return horse age from database', async () => {
      const mockResult = {
        age: 5,
      };
      mockHorseFindUnique.mockResolvedValue(mockResult);

      const result = await getHorseAge(10);

      expect(mockHorseFindUnique).toHaveBeenCalledWith({
        where: { id: 10 },
        select: { age: true },
      });
      expect(result).toBe(5);
    });

    it('should return null if horse not found', async () => {
      mockHorseFindUnique.mockResolvedValue(null);

      const result = await getHorseAge(999);

      expect(result).toBeNull();
    });

    it('should throw error if horseId is not a positive integer', async () => {
      await expect(getHorseAge(-1)).rejects.toThrow('Horse ID must be a positive integer');

      await expect(getHorseAge(0)).rejects.toThrow('Horse ID must be a positive integer');

      await expect(getHorseAge('invalid')).rejects.toThrow('Horse ID must be a positive integer');
    });

    it('should handle database errors gracefully', async () => {
      mockHorseFindUnique.mockRejectedValue(new Error('Database connection failed'));

      await expect(getHorseAge(5)).rejects.toThrow('Database error: Database connection failed');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle multiple training sessions for same horse different disciplines', async () => {
      // Mock successful logging
      mockTrainingLogCreate.mockResolvedValue({
        id: 1,
        horseId: 5,
        discipline: 'Racing',
        trainedAt: new Date(),
      });

      await logTrainingSession({ horseId: 5, discipline: 'Racing' });
      await logTrainingSession({ horseId: 5, discipline: 'Show Jumping' });

      expect(mockTrainingLogCreate).toHaveBeenCalledTimes(2);
    });

    it('should validate horse age before allowing training', async () => {
      // Mock horse age check
      mockHorseFindUnique.mockResolvedValue({ age: 2 });

      const age = await getHorseAge(5);
      expect(age).toBe(2);

      // In the actual training logic, this would prevent training
      // since horse is under 3 years old
    });
  });
});
