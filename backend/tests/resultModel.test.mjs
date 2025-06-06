/**
 * 🧪 UNIT TEST: Result Model - Competition Result Management
 *
 * This test validates the result model's functionality for saving, retrieving,
 * and managing competition results with comprehensive data validation.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Competition result saving with all required fields (horseId, showId, score, discipline, runDate)
 * - Result data validation: positive integers for IDs, numeric scores, required fields
 * - Placement handling: top 3 get placement strings, others get null
 * - Prize and stat gain handling: only winners get prizes/gains, others get defaults
 * - JSON serialization of statGains object for database storage
 * - Result retrieval by horse with chronological ordering (newest first)
 * - Result retrieval by show with score-based ordering (highest first)
 * - Individual result retrieval by ID with full relational data
 * - Database error handling with descriptive error messages
 * - Input validation for all parameters across all functions
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. saveResult() - Competition result creation with validation and data transformation
 * 2. getResultsByHorse() - Horse competition history retrieval with ordering
 * 3. getResultsByShow() - Show results retrieval with score ranking
 * 4. getResultById() - Individual result lookup with relational data
 * 5. Input validation for all functions (positive integers, required fields)
 * 6. Database error handling scenarios
 * 7. Edge cases: null placements, missing optional fields, invalid data types
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: All business logic, validation rules, data transformation, error handling
 * ✅ REAL: JSON serialization, field mapping, ordering logic, input processing
 * 🔧 MOCK: Database operations (Prisma calls) - external dependency
 *
 * 💡 TEST STRATEGY: Unit testing with mocked database to focus on model
 *    business logic while ensuring predictable test outcomes for data operations
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock Prisma client
const mockPrisma = {
  competitionResult: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

// Mock the database import
jest.unstable_mockModule(join(__dirname, '../db/index.mjs'), () => ({
  default: mockPrisma,
}));

// Import the module under test after mocking
const {
  saveResult,
  getResultsByHorse,
  getResultsByShow,
  getResultById,
  createResult,
  getResultsByUser,
} = await import(join(__dirname, '../models/resultModel.mjs'));

describe('🏆 UNIT: Result Model - Competition Result Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all mock implementations to default resolved values
    mockPrisma.competitionResult.create.mockResolvedValue({});
    mockPrisma.competitionResult.findMany.mockResolvedValue([]);
    mockPrisma.competitionResult.findUnique.mockResolvedValue(null);
    mockPrisma.competitionResult.update.mockResolvedValue({});
    mockPrisma.competitionResult.delete.mockResolvedValue({});
  });

  afterEach(() => {
    // Additional cleanup to ensure no mock state leaks
    jest.clearAllMocks();
  });

  describe('saveResult', () => {
    it('should save a competition result with all required fields', async () => {
      const resultData = {
        horseId: 1,
        showId: 2,
        score: 85.5,
        placement: '1st',
        discipline: 'Racing',
        runDate: new Date('2024-05-25'),
        showName: 'Spring Classic',
        prizeWon: 500,
        statGains: { stat: 'speed', gain: 1 },
      };

      const expectedResult = {
        id: 1,
        ...resultData,
        createdAt: new Date(),
      };

      mockPrisma.competitionResult.create.mockResolvedValue(expectedResult);

      const result = await saveResult(resultData);

      expect(mockPrisma.competitionResult.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.competitionResult.create).toHaveBeenCalledWith({
        data: {
          horseId: 1,
          showId: 2,
          score: 85.5,
          placement: '1st',
          discipline: 'Racing',
          runDate: new Date('2024-05-25'),
          showName: 'Spring Classic',
          prizeWon: 500,
          statGains: '{"stat":"speed","gain":1}',
        },
        include: {
          horse: {
            include: {
              breed: true,
            },
          },
          show: true,
        },
      });
      expect(result).toEqual(expectedResult);
    });

    it('should save a result without placement (null for non-top-3)', async () => {
      const resultData = {
        horseId: 3,
        showId: 2,
        score: 65.2,
        placement: null,
        discipline: 'Racing',
        runDate: new Date('2024-05-25'),
        showName: 'Spring Classic',
      };

      const expectedResult = { id: 2, ...resultData, createdAt: new Date() };
      mockPrisma.competitionResult.create.mockResolvedValue(expectedResult);

      const result = await saveResult(resultData);

      expect(mockPrisma.competitionResult.create).toHaveBeenCalledWith({
        data: {
          horseId: 3,
          showId: 2,
          score: 65.2,
          placement: null,
          discipline: 'Racing',
          runDate: new Date('2024-05-25'),
          showName: 'Spring Classic',
          prizeWon: 0,
          statGains: null,
        },
        include: {
          horse: {
            include: {
              breed: true,
            },
          },
          show: true,
        },
      });
      expect(result).toEqual(expectedResult);
    });

    it('should throw error if horseId is missing', async () => {
      const resultData = {
        showId: 2,
        score: 85.5,
        placement: '1st',
        discipline: 'Racing',
        runDate: new Date('2024-05-25'),
        showName: 'Spring Classic',
      };

      await expect(saveResult(resultData)).rejects.toThrow('Horse ID is required');
      expect(mockPrisma.competitionResult.create).not.toHaveBeenCalled();
    });

    it('should throw error if showId is missing', async () => {
      const resultData = {
        horseId: 1,
        score: 85.5,
        placement: '1st',
        discipline: 'Racing',
        runDate: new Date('2024-05-25'),
        showName: 'Spring Classic',
      };

      await expect(saveResult(resultData)).rejects.toThrow('Show ID is required');
      expect(mockPrisma.competitionResult.create).not.toHaveBeenCalled();
    });

    it('should throw error if score is missing', async () => {
      const resultData = {
        horseId: 1,
        showId: 2,
        placement: '1st',
        discipline: 'Racing',
        runDate: new Date('2024-05-25'),
      };

      await expect(saveResult(resultData)).rejects.toThrow('Score is required');
      expect(mockPrisma.competitionResult.create).not.toHaveBeenCalled();
    });

    it('should throw error if discipline is missing', async () => {
      const resultData = {
        horseId: 1,
        showId: 2,
        score: 85.5,
        placement: '1st',
        runDate: new Date('2024-05-25'),
      };

      await expect(saveResult(resultData)).rejects.toThrow('Discipline is required');
      expect(mockPrisma.competitionResult.create).not.toHaveBeenCalled();
    });

    it('should throw error if runDate is missing', async () => {
      const resultData = {
        horseId: 1,
        showId: 2,
        score: 85.5,
        placement: '1st',
        discipline: 'Racing',
      };

      await expect(saveResult(resultData)).rejects.toThrow('Run date is required');
      expect(mockPrisma.competitionResult.create).not.toHaveBeenCalled();
    });

    it('should validate score is a number', async () => {
      const resultData = {
        horseId: 1,
        showId: 2,
        score: 'invalid',
        placement: '1st',
        discipline: 'Racing',
        runDate: new Date('2024-05-25'),
        showName: 'Spring Classic',
      };

      await expect(saveResult(resultData)).rejects.toThrow('Score must be a number');
      expect(mockPrisma.competitionResult.create).not.toHaveBeenCalled();
    });

    it('should validate horseId is a positive integer', async () => {
      const resultData = {
        horseId: -1,
        showId: 2,
        score: 85.5,
        placement: '1st',
        discipline: 'Racing',
        runDate: new Date('2024-05-25'),
        showName: 'Spring Classic',
      };

      await expect(saveResult(resultData)).rejects.toThrow('Horse ID must be a positive integer');
      expect(mockPrisma.competitionResult.create).not.toHaveBeenCalled();
    });

    it('should validate showId is a positive integer', async () => {
      const resultData = {
        horseId: 1,
        showId: 0,
        score: 85.5,
        placement: '1st',
        discipline: 'Racing',
        runDate: new Date('2024-05-25'),
        showName: 'Spring Classic',
      };

      await expect(saveResult(resultData)).rejects.toThrow('Show ID must be a positive integer');
      expect(mockPrisma.competitionResult.create).not.toHaveBeenCalled();
    });

    it('should throw error if showName is missing', async () => {
      const resultData = {
        horseId: 1,
        showId: 2,
        score: 85.5,
        placement: '1st',
        discipline: 'Racing',
        runDate: new Date('2024-05-25'),
        // showName missing
      };

      await expect(saveResult(resultData)).rejects.toThrow('Show name is required');
      expect(mockPrisma.competitionResult.create).not.toHaveBeenCalled();
    });

    it('should throw error if showName is not a string', async () => {
      const resultData = {
        horseId: 1,
        showId: 2,
        score: 85.5,
        placement: '1st',
        discipline: 'Racing',
        runDate: new Date('2024-05-25'),
        showName: 123, // Not a string
      };

      await expect(saveResult(resultData)).rejects.toThrow('Show name is required');
      expect(mockPrisma.competitionResult.create).not.toHaveBeenCalled();
    });

    it('should handle prizeWon as string and convert to float', async () => {
      const resultData = {
        horseId: 1,
        showId: 2,
        score: 85.5,
        placement: '1st',
        discipline: 'Racing',
        runDate: new Date('2024-05-25'),
        showName: 'Spring Classic',
        prizeWon: '500.75', // String that should be converted
      };

      const expectedResult = { id: 1, ...resultData, createdAt: new Date() };
      mockPrisma.competitionResult.create.mockResolvedValue(expectedResult);

      await saveResult(resultData);

      expect(mockPrisma.competitionResult.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          prizeWon: 500.75, // Should be converted to float
        }),
        include: expect.any(Object),
      });
    });

    it('should handle database errors gracefully', async () => {
      const resultData = {
        horseId: 1,
        showId: 2,
        score: 85.5,
        placement: '1st',
        discipline: 'Racing',
        runDate: new Date('2024-05-25'),
        showName: 'Spring Classic',
      };

      mockPrisma.competitionResult.create.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(saveResult(resultData)).rejects.toThrow(
        'Database error in saveResult: Database connection failed',
      );
    });
  });

  describe('getResultsByHorse', () => {
    it('should retrieve all results for a specific horse', async () => {
      const horseId = 1;
      const expectedResults = [
        {
          id: 1,
          horseId: 1,
          showId: 2,
          score: 85.5,
          placement: '1st',
          discipline: 'Racing',
          runDate: new Date('2024-05-25'),
          horse: { id: 1, name: 'Thunder', breed: { name: 'Thoroughbred' } },
          show: { id: 2, name: 'Spring Classic', discipline: 'Racing' },
        },
        {
          id: 2,
          horseId: 1,
          showId: 3,
          score: 78.2,
          placement: '2nd',
          discipline: 'Show Jumping',
          runDate: new Date('2024-05-20'),
          horse: { id: 1, name: 'Thunder', breed: { name: 'Thoroughbred' } },
          show: { id: 3, name: 'Elite Jumping', discipline: 'Show Jumping' },
        },
      ];

      mockPrisma.competitionResult.findMany.mockResolvedValue(expectedResults);

      const results = await getResultsByHorse(horseId);

      expect(mockPrisma.competitionResult.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.competitionResult.findMany).toHaveBeenCalledWith({
        where: { horseId: 1 },
        include: {
          horse: {
            include: {
              breed: true,
            },
          },
          show: true,
        },
        orderBy: { runDate: 'desc' },
      });
      expect(results).toEqual(expectedResults);
    });

    it('should return empty array if no results found for horse', async () => {
      const horseId = 999;
      mockPrisma.competitionResult.findMany.mockResolvedValue([]);

      const results = await getResultsByHorse(horseId);

      expect(results).toEqual([]);
    });

    it('should validate horseId is a positive integer', async () => {
      await expect(getResultsByHorse(-1)).rejects.toThrow('Horse ID must be a positive integer');
      await expect(getResultsByHorse('invalid')).rejects.toThrow(
        'Horse ID must be a positive integer',
      );
      expect(mockPrisma.competitionResult.findMany).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.competitionResult.findMany.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(getResultsByHorse(1)).rejects.toThrow(
        'Database error in getResultsByHorse: Database connection failed',
      );
    });
  });

  describe('getResultsByShow', () => {
    it('should retrieve all results for a specific show', async () => {
      const showId = 2;
      const expectedResults = [
        {
          id: 1,
          horseId: 1,
          showId: 2,
          score: 85.5,
          placement: '1st',
          discipline: 'Racing',
          runDate: new Date('2024-05-25'),
          horse: { id: 1, name: 'Thunder', breed: { name: 'Thoroughbred' } },
          show: { id: 2, name: 'Spring Classic', discipline: 'Racing' },
        },
        {
          id: 3,
          horseId: 4,
          showId: 2,
          score: 82.1,
          placement: '2nd',
          discipline: 'Racing',
          runDate: new Date('2024-05-25'),
          horse: { id: 4, name: 'Lightning', breed: { name: 'Arabian' } },
          show: { id: 2, name: 'Spring Classic', discipline: 'Racing' },
        },
      ];

      mockPrisma.competitionResult.findMany.mockResolvedValue(expectedResults);

      const results = await getResultsByShow(showId);

      expect(mockPrisma.competitionResult.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.competitionResult.findMany).toHaveBeenCalledWith({
        where: { showId: 2 },
        include: {
          horse: {
            include: {
              breed: true,
            },
          },
          show: true,
        },
        orderBy: { score: 'desc' },
      });
      expect(results).toEqual(expectedResults);
    });

    it('should return empty array if no results found for show', async () => {
      const showId = 999;
      mockPrisma.competitionResult.findMany.mockResolvedValue([]);

      const results = await getResultsByShow(showId);

      expect(results).toEqual([]);
    });

    it('should validate showId is a positive integer', async () => {
      await expect(getResultsByShow(-1)).rejects.toThrow('Show ID must be a positive integer');
      await expect(getResultsByShow('invalid')).rejects.toThrow(
        'Show ID must be a positive integer',
      );
      expect(mockPrisma.competitionResult.findMany).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.competitionResult.findMany.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(getResultsByShow(1)).rejects.toThrow(
        'Database error in getResultsByShow: Database connection failed',
      );
    });
  });

  describe('getResultById', () => {
    it('should retrieve a specific result by ID', async () => {
      const resultId = 1;
      const expectedResult = {
        id: 1,
        horseId: 1,
        showId: 2,
        score: 85.5,
        placement: '1st',
        discipline: 'Racing',
        runDate: new Date('2024-05-25'),
        horse: { id: 1, name: 'Thunder', breed: { name: 'Thoroughbred' } },
        show: { id: 2, name: 'Spring Classic', discipline: 'Racing' },
      };

      mockPrisma.competitionResult.findUnique.mockResolvedValue(expectedResult);

      const result = await getResultById(resultId);

      expect(mockPrisma.competitionResult.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrisma.competitionResult.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          horse: {
            include: {
              breed: true,
            },
          },
          show: true,
        },
      });
      expect(result).toEqual(expectedResult);
    });

    it('should return null if result not found', async () => {
      const resultId = 999;
      mockPrisma.competitionResult.findUnique.mockResolvedValue(null);

      const result = await getResultById(resultId);

      expect(result).toBeNull();
    });

    it('should validate resultId is a positive integer', async () => {
      await expect(getResultById(-1)).rejects.toThrow('Result ID must be a positive integer');
      await expect(getResultById('invalid')).rejects.toThrow(
        'Result ID must be a positive integer',
      );
      expect(mockPrisma.competitionResult.findUnique).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.competitionResult.findUnique.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(getResultById(1)).rejects.toThrow(
        'Database error in getResultById: Database connection failed',
      );
    });
  });

  describe('createResult', () => {
    it('should be an alias for saveResult and work identically', async () => {
      const resultData = {
        horseId: 1,
        showId: 2,
        score: 85.5,
        placement: '1st',
        discipline: 'Racing',
        runDate: new Date('2024-05-25'),
        showName: 'Spring Classic',
      };

      const expectedResult = { id: 1, ...resultData, createdAt: new Date() };
      mockPrisma.competitionResult.create.mockResolvedValue(expectedResult);

      const result = await createResult(resultData);

      expect(mockPrisma.competitionResult.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should throw same validation errors as saveResult', async () => {
      await expect(createResult({ showId: 2 })).rejects.toThrow('Horse ID is required');
    });
  });

  describe('getResultsByUser', () => {
    beforeEach(() => {
      // Add horse relation to mock
      mockPrisma.competitionResult.findMany = jest.fn();
    });

    it('should retrieve results for all user horses with default options', async () => {
      const userId = 'user123';
      const expectedResults = [
        {
          id: 1,
          horseId: 1,
          score: 85.5,
          placement: '1st',
          discipline: 'Racing',
          runDate: new Date('2024-05-25'),
          horse: { id: 1, name: 'Thunder', userId: 'user123', breed: { name: 'Thoroughbred' } },
          show: { id: 2, name: 'Spring Classic' },
        },
      ];

      mockPrisma.competitionResult.findMany.mockResolvedValue(expectedResults);

      const results = await getResultsByUser(userId);

      expect(mockPrisma.competitionResult.findMany).toHaveBeenCalledWith({
        where: {
          horse: {
            userId: 'user123',
          },
        },
        include: {
          horse: {
            include: {
              breed: true,
            },
          },
          show: true,
        },
        orderBy: {
          runDate: 'desc',
        },
        take: 50,
        skip: 0,
      });
      expect(results).toEqual(expectedResults);
    });

    it('should handle custom options (limit, offset, discipline)', async () => {
      const userId = 'user123';
      const options = { limit: 10, offset: 5, discipline: 'Racing' };

      mockPrisma.competitionResult.findMany.mockResolvedValue([]);

      await getResultsByUser(userId, options);

      expect(mockPrisma.competitionResult.findMany).toHaveBeenCalledWith({
        where: {
          horse: {
            userId: 'user123',
          },
          discipline: 'Racing',
        },
        include: expect.any(Object),
        orderBy: { runDate: 'desc' },
        take: 10,
        skip: 5,
      });
    });

    it('should cap limit at 100 and ensure non-negative offset', async () => {
      const userId = 'user123';
      const options = { limit: 200, offset: -5 };

      mockPrisma.competitionResult.findMany.mockResolvedValue([]);

      await getResultsByUser(userId, options);

      expect(mockPrisma.competitionResult.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100, // Capped at 100
          skip: 0, // Non-negative
        }),
      );
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.competitionResult.findMany.mockRejectedValue(new Error('Database error'));

      await expect(getResultsByUser('user123')).rejects.toThrow('Database error');
    });
  });

  describe('parseInt conversion edge cases', () => {
    it('should handle string IDs in getResultsByHorse', async () => {
      mockPrisma.competitionResult.findMany.mockResolvedValue([]);

      await getResultsByHorse('123'); // String ID

      expect(mockPrisma.competitionResult.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { horseId: 123 }, // Should be converted to number
        }),
      );
    });

    it('should handle string IDs in getResultsByShow', async () => {
      mockPrisma.competitionResult.findMany.mockResolvedValue([]);

      await getResultsByShow('456'); // String ID

      expect(mockPrisma.competitionResult.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { showId: 456 }, // Should be converted to number
        }),
      );
    });

    it('should handle string IDs in getResultById', async () => {
      mockPrisma.competitionResult.findUnique.mockResolvedValue(null);

      await getResultById('789'); // String ID

      expect(mockPrisma.competitionResult.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 789 }, // Should be converted to number
        }),
      );
    });
  });
});
