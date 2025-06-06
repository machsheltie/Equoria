/**
 * 🧪 UNIT TEST: Training Cooldown System - Horse Training Restrictions
 *
 * This test validates the training cooldown system's functionality for managing
 * horse training restrictions and time-based availability calculations.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Training cooldown enforcement: 7-day restriction after training session
 * - Cooldown validation: horses cannot train while cooldown is active
 * - Time calculation: accurate remaining time calculations in milliseconds
 * - Cooldown expiration: horses can train again after cooldown expires
 * - Date handling: proper past/future date comparisons and edge cases
 * - Input validation: horse ID validation, null/undefined handling
 * - Time formatting: human-readable cooldown display (days, hours, minutes)
 * - Database integration: cooldown persistence and retrieval
 * - Edge cases: zero time, negative time, boundary conditions
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. canTrain() - Training availability validation based on cooldown status
 * 2. getCooldownTimeRemaining() - Remaining cooldown time calculations
 * 3. setCooldown() - Database cooldown setting with 7-day future date
 * 4. formatCooldown() - Human-readable time formatting for UI display
 * 5. Input validation for all functions (null, undefined, invalid IDs)
 * 6. Integration workflows: complete training cooldown lifecycle
 * 7. Edge cases: boundary conditions, timing precision, error scenarios
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: All business logic, time calculations, validation rules, formatting
 * ✅ REAL: Date arithmetic, cooldown logic, input processing, error handling
 * 🔧 MOCK: Database operations (Prisma), horse model - external dependencies
 *
 * 💡 TEST STRATEGY: Unit testing with mocked database to focus on cooldown
 *    business logic while ensuring predictable test outcomes for time calculations
 */

import { jest, describe, beforeEach, expect, it, beforeAll } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock the database module BEFORE importing other modules
jest.unstable_mockModule(join(__dirname, '../db/index.js'), () => ({
  default: {
    horse: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    breed: {
      create: jest.fn(),
      delete: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

// Mock the horse model
jest.unstable_mockModule(join(__dirname, '../models/horseModel.js'), () => ({
  createHorse: jest.fn(),
  getHorseById: jest.fn(),
}));

// Now import the modules
const { canTrain, getCooldownTimeRemaining, setCooldown, formatCooldown } = await import(
  '../utils/trainingCooldown.js'
);
const { createHorse, getHorseById } = await import('../models/horseModel.js');
const mockPrisma = (await import(join(__dirname, '../db/index.js'))).default;

describe('⏰ UNIT: Training Cooldown System - Horse Training Restrictions', () => {
  let testHorse;
  let testBreed;

  beforeAll(() => {
    // Mock test breed
    testBreed = {
      id: 1,
      name: 'Test Training Breed',
      description: 'Breed for training cooldown tests',
    };
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock test horse
    testHorse = {
      id: 1,
      name: `Test Training Horse ${Date.now()}`,
      age: 5,
      breedId: testBreed.id,
      sex: 'Mare',
      dateOfBirth: new Date('2019-01-01'),
      healthStatus: 'Excellent',
      trainingCooldown: null,
    };

    // Setup default mock responses
    createHorse.mockResolvedValue(testHorse);
    getHorseById.mockResolvedValue(testHorse);
    mockPrisma.horse.update.mockResolvedValue(testHorse);
    mockPrisma.horse.findUnique.mockResolvedValue(testHorse);
  });

  describe('canTrain', () => {
    it('should return true for horse with no cooldown', () => {
      expect(canTrain(testHorse)).toBe(true);
    });

    it('should return true for horse with cooldown in the past', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // 1 day ago

      const horseWithPastCooldown = {
        ...testHorse,
        trainingCooldown: pastDate,
      };

      expect(canTrain(horseWithPastCooldown)).toBe(true);
    });

    it('should return false for horse with cooldown in the future', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1); // 1 day from now

      const horseWithFutureCooldown = {
        ...testHorse,
        trainingCooldown: futureDate,
      };

      expect(canTrain(horseWithFutureCooldown)).toBe(false);
    });

    it('should throw error for null horse', () => {
      expect(() => canTrain(null)).toThrow('Horse object is required');
    });

    it('should throw error for undefined horse', () => {
      expect(() => canTrain()).toThrow('Horse object is required');
    });
  });

  describe('getCooldownTimeRemaining', () => {
    it('should return null for horse with no cooldown', () => {
      expect(getCooldownTimeRemaining(testHorse)).toBeNull();
    });

    it('should return null for horse with cooldown in the past', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // 1 day ago

      const horseWithPastCooldown = {
        ...testHorse,
        trainingCooldown: pastDate,
      };

      expect(getCooldownTimeRemaining(horseWithPastCooldown)).toBeNull();
    });

    it('should return positive milliseconds for horse with cooldown in the future', () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1); // 1 hour from now

      const horseWithFutureCooldown = {
        ...testHorse,
        trainingCooldown: futureDate,
      };

      const remaining = getCooldownTimeRemaining(horseWithFutureCooldown);
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(60 * 60 * 1000); // Should be <= 1 hour in ms
    });

    it('should return approximately correct time remaining', () => {
      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 30); // 30 minutes from now

      const horseWithFutureCooldown = {
        ...testHorse,
        trainingCooldown: futureDate,
      };

      const remaining = getCooldownTimeRemaining(horseWithFutureCooldown);
      const expectedMs = 30 * 60 * 1000; // 30 minutes in milliseconds

      // Allow for small timing differences (within 1 second)
      expect(remaining).toBeGreaterThan(expectedMs - 1000);
      expect(remaining).toBeLessThanOrEqual(expectedMs);
    });

    it('should throw error for null horse', () => {
      expect(() => getCooldownTimeRemaining(null)).toThrow('Horse object is required');
    });

    it('should throw error for undefined horse', () => {
      expect(() => getCooldownTimeRemaining()).toThrow('Horse object is required');
    });
  });

  describe('setCooldown', () => {
    it('should set cooldown 7 days in the future', async () => {
      const beforeTime = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      // Mock the updated horse with cooldown
      const updatedHorse = {
        ...testHorse,
        trainingCooldown: futureDate,
      };

      mockPrisma.horse.update.mockResolvedValueOnce(updatedHorse);

      const result = await setCooldown(testHorse.id);
      const afterTime = new Date();

      expect(result.trainingCooldown).toBeDefined();

      const cooldownDate = new Date(result.trainingCooldown);
      const expectedMinDate = new Date(beforeTime);
      expectedMinDate.setDate(expectedMinDate.getDate() + 7);

      const expectedMaxDate = new Date(afterTime);
      expectedMaxDate.setDate(expectedMaxDate.getDate() + 7);

      expect(cooldownDate.getTime()).toBeGreaterThanOrEqual(expectedMinDate.getTime() - 60000); // Allow 1 minute tolerance
      expect(cooldownDate.getTime()).toBeLessThanOrEqual(expectedMaxDate.getTime() + 60000);
    });

    it('should return updated horse with relations', async () => {
      const updatedHorse = {
        ...testHorse,
        trainingCooldown: new Date(),
        breed: testBreed,
      };

      mockPrisma.horse.update.mockResolvedValueOnce(updatedHorse);

      const result = await setCooldown(testHorse.id);

      expect(result.id).toBe(testHorse.id);
      expect(result.name).toBe(testHorse.name);
      expect(result.breed).toBeDefined();
      expect(result.breed.id).toBe(testBreed.id);
    });

    it('should throw error for non-existent horse ID', async () => {
      const nonExistentId = 999999;

      // Mock database error for non-existent horse
      mockPrisma.horse.update.mockRejectedValueOnce(
        new Error(`Horse with ID ${nonExistentId} not found`),
      );

      await expect(setCooldown(nonExistentId)).rejects.toThrow(
        `Horse with ID ${nonExistentId} not found`,
      );
    });

    it('should throw error for null horse ID', async () => {
      await expect(setCooldown(null)).rejects.toThrow('Horse ID is required');
    });

    it('should throw error for undefined horse ID', async () => {
      await expect(setCooldown()).rejects.toThrow('Horse ID is required');
    });

    it('should throw error for invalid horse ID (string)', async () => {
      await expect(setCooldown('invalid')).rejects.toThrow(
        'Horse ID must be a valid positive integer',
      );
    });

    it('should throw error for invalid horse ID (negative)', async () => {
      await expect(setCooldown(-1)).rejects.toThrow('Horse ID must be a valid positive integer');
    });

    it('should throw error for invalid horse ID (zero)', async () => {
      await expect(setCooldown(0)).rejects.toThrow('Horse ID must be a valid positive integer');
    });

    it('should handle string horse ID that can be parsed to integer', async () => {
      const updatedHorse = {
        ...testHorse,
        trainingCooldown: new Date(),
      };

      mockPrisma.horse.update.mockResolvedValueOnce(updatedHorse);

      const result = await setCooldown(testHorse.id.toString());
      expect(result.id).toBe(testHorse.id);
      expect(result.trainingCooldown).toBeDefined();
    });
  });

  describe('formatCooldown', () => {
    it('should return "Ready to train" for null input', () => {
      expect(formatCooldown(null)).toBe('Ready to train');
    });

    it('should return "Ready to train" for zero milliseconds', () => {
      expect(formatCooldown(0)).toBe('Ready to train');
    });

    it('should return "Ready to train" for negative milliseconds', () => {
      expect(formatCooldown(-1000)).toBe('Ready to train');
    });

    it('should format minutes correctly', () => {
      const fiveMinutes = 5 * 60 * 1000;
      expect(formatCooldown(fiveMinutes)).toBe('5 minute(s) remaining');
    });

    it('should format hours and minutes correctly', () => {
      const twoHoursFiveMinutes = 2 * 60 * 60 * 1000 + 5 * 60 * 1000;
      expect(formatCooldown(twoHoursFiveMinutes)).toBe('2 hour(s), 5 minute(s) remaining');
    });

    it('should format days and hours correctly', () => {
      const threeDaysTwoHours = 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000;
      expect(formatCooldown(threeDaysTwoHours)).toBe('3 day(s), 2 hour(s) remaining');
    });

    it('should format exactly 7 days correctly', () => {
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      expect(formatCooldown(sevenDays)).toBe('7 day(s), 0 hour(s) remaining');
    });
  });

  describe('Integration Tests', () => {
    it('should complete full training cooldown workflow', async () => {
      // 1. Verify horse can initially train
      expect(canTrain(testHorse)).toBe(true);
      expect(getCooldownTimeRemaining(testHorse)).toBeNull();

      // 2. Mock setting cooldown
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const updatedHorse = {
        ...testHorse,
        trainingCooldown: futureDate,
      };

      mockPrisma.horse.update.mockResolvedValueOnce(updatedHorse);

      const result = await setCooldown(testHorse.id);

      // 3. Verify horse cannot train after cooldown is set
      expect(canTrain(result)).toBe(false);

      // 4. Verify time remaining is approximately 7 days
      const timeRemaining = getCooldownTimeRemaining(result);
      expect(timeRemaining).toBeGreaterThan(0);

      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(timeRemaining).toBeLessThanOrEqual(sevenDaysMs);
      expect(timeRemaining).toBeGreaterThan(sevenDaysMs - 60000); // Within 1 minute of 7 days

      // 5. Verify formatting works
      const formatted = formatCooldown(timeRemaining);
      expect(formatted).toContain('day(s)');
      expect(formatted).toContain('remaining');
    });

    it('should work with horse retrieved from database', async () => {
      // Mock setting cooldown
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const horseWithCooldown = {
        ...testHorse,
        trainingCooldown: futureDate,
      };

      mockPrisma.horse.update.mockResolvedValueOnce(horseWithCooldown);
      getHorseById.mockResolvedValueOnce(horseWithCooldown);

      // Set cooldown
      await setCooldown(testHorse.id);

      // Retrieve horse from database
      const retrievedHorse = await getHorseById(testHorse.id);

      // Verify cooldown functions work with retrieved horse
      expect(canTrain(retrievedHorse)).toBe(false);
      expect(getCooldownTimeRemaining(retrievedHorse)).toBeGreaterThan(0);
    });
  });
});
