/**
 * 🧪 UNIT TEST: Horse Model - Discipline Score Management
 *
 * This test validates the horse model's discipline score tracking functionality,
 * focusing on the business logic for updating and retrieving training scores.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Discipline scores are stored as JSON objects on horse records
 * - Scores can be added incrementally (cumulative training progress)
 * - Multiple disciplines can be tracked independently per horse
 * - Invalid inputs (negative scores, invalid IDs) are properly rejected
 * - Non-existent horses are handled gracefully with appropriate errors
 * - Score retrieval returns empty object for horses with no training history
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. updateDisciplineScore() - Adding and updating training scores
 * 2. getDisciplineScores() - Retrieving current training progress
 * 3. createHorse() - Basic horse creation for test setup
 * 4. Input validation and error handling for all operations
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Business logic for score calculations, validation, error handling
 * ✅ REAL: JSON manipulation, data transformation, input validation
 * 🔧 MOCK: Database operations (Prisma calls) - external dependency
 * 🔧 MOCK: Logger calls - external dependency for error reporting
 *
 * 💡 TEST STRATEGY: Unit testing with mocked database to focus on business logic
 *    validation while avoiding database complexity and ensuring fast execution
 */

import { jest, describe, beforeEach, afterEach, expect, it } from '@jest/globals';

// Create mock objects BEFORE mocking modules
const mockPrismaHorse = {
  create: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
};

const mockPrisma = {
  horse: mockPrismaHorse,
};

const mockLogger = {
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

// Use unstable_mockModule for ESM mocking
jest.unstable_mockModule('../db/index.mjs', () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule('../utils/logger.mjs', () => ({
  default: mockLogger,
}));

// Import the module under test AFTER mocking
const { createHorse, updateDisciplineScore, getDisciplineScores } = await import(
  '../models/horseModel.mjs'
);

describe('🐎 UNIT: Horse Model - Discipline Score Management', () => {
  beforeEach(() => {
    // Jest config has clearMocks: true, but we call it explicitly for clarity
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore all mocks after each test
    jest.restoreAllMocks();
  });

  describe('updateDisciplineScore', () => {
    it('should update discipline score for existing horse', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Horse',
        age: 4,
        breed: { connect: { id: 1 } },
        sex: 'mare',
      };
      const mockFoundHorse = {
        id: 1,
        disciplineScores: null,
        breed: { id: 1, name: 'Arabian' },
        owner: null,
        stable: null,
        player: null,
      };
      const mockUpdatedHorse = {
        id: 1,
        disciplineScores: { Dressage: 5 },
        breed: { id: 1, name: 'Arabian' },
        owner: null,
        stable: null,
        player: null,
      };

      mockPrismaHorse.create.mockResolvedValue(mockHorse);
      mockPrismaHorse.findUnique.mockResolvedValue(mockFoundHorse);
      mockPrismaHorse.update.mockResolvedValue(mockUpdatedHorse);

      const horse = await createHorse({
        name: 'Test Horse',
        age: 4,
        breed: { connect: { id: 1 } },
        sex: 'mare',
        dateOfBirth: new Date(),
      });

      const updatedHorse = await updateDisciplineScore(horse.id, 'Dressage', 5);

      expect(updatedHorse).toBeDefined();
      expect(updatedHorse.disciplineScores).toEqual({ Dressage: 5 });
      expect(updatedHorse.breed).toBeDefined();
    });

    it('should add to existing discipline score', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Horse',
        age: 4,
        breed: { connect: { id: 1 } },
        sex: 'mare',
      };
      const mockFoundHorse1 = { id: 1, disciplineScores: null };
      const mockFoundHorse2 = { id: 1, disciplineScores: { Dressage: 5 } };
      const mockUpdatedHorse1 = { id: 1, disciplineScores: { Dressage: 5 } };
      const mockUpdatedHorse2 = { id: 1, disciplineScores: { Dressage: 10 } };

      mockPrismaHorse.create.mockResolvedValue(mockHorse);
      mockPrismaHorse.findUnique
        .mockResolvedValueOnce(mockFoundHorse1)
        .mockResolvedValueOnce(mockFoundHorse2);
      mockPrismaHorse.update
        .mockResolvedValueOnce(mockUpdatedHorse1)
        .mockResolvedValueOnce(mockUpdatedHorse2);

      const horse = await createHorse({
        name: 'Test Horse',
        age: 4,
        breed: { connect: { id: 1 } },
        sex: 'mare',
        dateOfBirth: new Date(),
      });

      await updateDisciplineScore(horse.id, 'Dressage', 5);
      const updatedHorse = await updateDisciplineScore(horse.id, 'Dressage', 5);

      expect(updatedHorse.disciplineScores).toEqual({ Dressage: 10 });
    });

    it('should handle multiple disciplines independently', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Horse',
        age: 4,
        breed: { connect: { id: 1 } },
        sex: 'mare',
      };
      const mockFoundHorse1 = { id: 1, disciplineScores: null };
      const mockFoundHorse2 = { id: 1, disciplineScores: { Dressage: 5 } };
      const mockUpdatedHorse1 = { id: 1, disciplineScores: { Dressage: 5 } };
      const mockUpdatedHorse2 = { id: 1, disciplineScores: { Dressage: 5, 'Show Jumping': 3 } };

      mockPrismaHorse.create.mockResolvedValue(mockHorse);
      mockPrismaHorse.findUnique
        .mockResolvedValueOnce(mockFoundHorse1)
        .mockResolvedValueOnce(mockFoundHorse2);
      mockPrismaHorse.update
        .mockResolvedValueOnce(mockUpdatedHorse1)
        .mockResolvedValueOnce(mockUpdatedHorse2);

      const horse = await createHorse({
        name: 'Test Horse',
        age: 4,
        breed: { connect: { id: 1 } },
        sex: 'mare',
        dateOfBirth: new Date(),
      });

      await updateDisciplineScore(horse.id, 'Dressage', 5);
      const updatedHorse = await updateDisciplineScore(horse.id, 'Show Jumping', 3);

      expect(updatedHorse.disciplineScores).toEqual({
        Dressage: 5,
        'Show Jumping': 3,
      });
    });

    it('should throw error for invalid horse ID', async () => {
      await expect(updateDisciplineScore(-1, 'Dressage', 5)).rejects.toThrow(
        'Invalid horse ID provided'
      );

      await expect(updateDisciplineScore('invalid', 'Dressage', 5)).rejects.toThrow(
        'Invalid horse ID provided'
      );
    });

    it('should throw error for non-existent horse', async () => {
      mockPrismaHorse.findUnique.mockResolvedValue(null);

      await expect(updateDisciplineScore(99999, 'Dressage', 5)).rejects.toThrow(
        'Horse with ID 99999 not found'
      );
    });

    it('should throw error for invalid discipline', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Horse',
        age: 4,
        breed: { id: 1, name: 'Arabian' },
        owner: null,
        stable: null,
        player: null,
      };

      mockPrismaHorse.create.mockResolvedValue(mockHorse);

      const horse = await createHorse({
        name: 'Test Horse',
        age: 4,
        breed: { connect: { id: 1 } },
        sex: 'mare',
        dateOfBirth: new Date(),
      });

      await expect(updateDisciplineScore(horse.id, '', 5)).rejects.toThrow(
        'Discipline must be a non-empty string'
      );

      await expect(updateDisciplineScore(horse.id, null, 5)).rejects.toThrow(
        'Discipline must be a non-empty string'
      );
    });

    it('should throw error for invalid points', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Horse',
        age: 4,
        breed: { id: 1, name: 'Arabian' },
        owner: null,
        stable: null,
        player: null,
      };

      mockPrismaHorse.create.mockResolvedValue(mockHorse);

      const horse = await createHorse({
        name: 'Test Horse',
        age: 4,
        breed: { connect: { id: 1 } },
        sex: 'mare',
        dateOfBirth: new Date(),
      });

      await expect(updateDisciplineScore(horse.id, 'Dressage', 0)).rejects.toThrow(
        'Points to add must be a positive number'
      );

      await expect(updateDisciplineScore(horse.id, 'Dressage', -5)).rejects.toThrow(
        'Points to add must be a positive number'
      );

      await expect(updateDisciplineScore(horse.id, 'Dressage', 'invalid')).rejects.toThrow(
        'Points to add must be a positive number'
      );
    });
  });

  describe('getDisciplineScores', () => {
    it('should return empty object for horse with no scores', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Horse',
        age: 4,
        breed: { connect: { id: 1 } },
        sex: 'mare',
      };
      const mockHorseWithNoScores = {
        id: 1,
        disciplineScores: null,
      };

      mockPrismaHorse.create.mockResolvedValue(mockHorse);
      mockPrismaHorse.findUnique.mockResolvedValue(mockHorseWithNoScores);

      const horse = await createHorse({
        name: 'Test Horse',
        age: 4,
        breed: { connect: { id: 1 } },
        sex: 'mare',
        dateOfBirth: new Date(),
      });

      const scores = await getDisciplineScores(horse.id);
      expect(scores).toEqual({});
    });

    it('should return discipline scores for horse with scores', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Horse',
        age: 4,
        breed: { connect: { id: 1 } },
        sex: 'mare',
      };
      const mockHorseWithScores = {
        id: 1,
        disciplineScores: { Dressage: 5, 'Show Jumping': 3 },
      };

      mockPrismaHorse.create.mockResolvedValue(mockHorse);
      mockPrismaHorse.findUnique.mockResolvedValue(mockHorseWithScores);

      const horse = await createHorse({
        name: 'Test Horse',
        age: 4,
        breed: { connect: { id: 1 } },
        sex: 'mare',
        dateOfBirth: new Date(),
      });

      const scores = await getDisciplineScores(horse.id);
      expect(scores).toEqual({
        Dressage: 5,
        'Show Jumping': 3,
      });
    });

    it('should throw error for invalid horse ID', async () => {
      await expect(getDisciplineScores(-1)).rejects.toThrow('Invalid horse ID provided');

      await expect(getDisciplineScores('invalid')).rejects.toThrow('Invalid horse ID provided');
    });

    it('should throw error for non-existent horse', async () => {
      mockPrismaHorse.findUnique.mockResolvedValue(null);

      await expect(getDisciplineScores(99999)).rejects.toThrow('Horse with ID 99999 not found');
    });
  });
});
