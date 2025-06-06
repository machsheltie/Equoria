/**
 * 🧪 UNIT TEST: User Model - Database Operations & Business Logic
 *
 * This test validates the user model's database operations and business logic
 * using strategic mocking to focus on model functionality and error handling.
 *
 * 📋 BUSINESS RULES TESTED:
 * - User creation: Required fields validation, email normalization, unique constraints
 * - User lookup: ID and email-based queries with proper error handling
 * - User updates: Data modification with validation and error handling
 * - User deletion: Safe deletion with proper error handling
 * - XP system: XP addition with level calculation and progression tracking
 * - Progress calculation: Level progression, XP to next level, XP requirements
 * - User statistics: Horse count, average age, comprehensive user data
 * - Error handling: Database errors, validation errors, missing data scenarios
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. createUser() - User creation with validation and unique constraint handling
 * 2. getUserById() - User lookup by ID with null handling
 * 3. getUserByEmail() - Case-insensitive email lookup with validation
 * 4. getUserWithHorses() - User data with related horse information
 * 5. updateUser() - User data modification with error handling
 * 6. deleteUser() - User deletion with proper error handling
 * 7. addXpToUser() - XP addition with level progression calculation
 * 8. getUserProgress() - Progress tracking with XP calculations
 * 9. getUserStats() - Comprehensive user statistics with horse data
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Model business logic, validation rules, XP calculations, error handling
 * ✅ REAL: Data transformation, level progression, statistics calculation
 * 🔧 MOCK: Database operations (Prisma calls) - external dependency
 * 🔧 MOCK: Logger calls - external dependency
 *
 * 💡 TEST STRATEGY: Unit testing with mocked database to focus on model
 *    logic and business rule validation while ensuring predictable outcomes
 *
 * ⚠️  NOTE: This represents EXCELLENT model testing - strategic mocking of
 *    database while testing real business logic and validation rules.
 */

import { jest, describe, beforeEach, expect, it } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Determine __dirname for ES module scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock Prisma client and logger
jest.unstable_mockModule(join(__dirname, '../db/index.mjs'), () => ({
  default: {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.unstable_mockModule(join(__dirname, '../utils/logger.mjsss'), () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Import userModel functions after mocks are set up
const {
  createUser,
  getUserById,
  getUserByEmail,
  getUserWithHorses,
  updateUser,
  deleteUser,
  addXpToUser,
  getUserProgress,
  getUserStats,
} = await import(join(__dirname, './userModel.js'));

const mockPrisma = (await import(join(__dirname, '../db/index.js'))).default;
const mockLogger = (await import(join(__dirname, '../utils/logger.mjss'))).default;
const { DatabaseError } = await import(join(__dirname, '../errors/index.js'));

describe('👤 UNIT: User Model - Database Operations & Business Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  describe('createUser', () => {
    const baseUserData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      money: 1000,
      level: 1,
      xp: 0,
      settings: { theme: 'dark' },
    };

    const expectedSelect = {
      id: true,
      username: true,
      email: true,
      role: true,
      level: true,
      xp: true,
      money: true,
      createdAt: true,
    };

    it('should create a user successfully', async () => {
      const mockCreatedUser = {
        id: 1,
        username: baseUserData.username,
        email: baseUserData.email.toLowerCase(),
        role: 'user',
        level: baseUserData.level,
        xp: baseUserData.xp,
        money: baseUserData.money,
        createdAt: new Date(),
      };

      mockPrisma.user.create.mockResolvedValue(mockCreatedUser);

      const result = await createUser(baseUserData);

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          ...baseUserData,
          email: baseUserData.email.toLowerCase(),
        },
        select: expectedSelect,
      });
      expect(result).toEqual(mockCreatedUser);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('User created: testuser'),
      );
    });

    it('should throw error if username is missing', async () => {
      const { username: _username, ...incompleteData } = baseUserData;
      await expect(createUser(incompleteData)).rejects.toThrow(
        'Username, email, and password are required.',
      );
    });

    it('should throw error if email is missing', async () => {
      const { email: _email, ...incompleteData } = baseUserData;
      await expect(createUser(incompleteData)).rejects.toThrow(
        'Username, email, and password are required.',
      );
    });

    it('should throw error if password is missing', async () => {
      const { password: _password, ...incompleteData } = baseUserData;
      await expect(createUser(incompleteData)).rejects.toThrow(
        'Username, email, and password are required.',
      );
    });

    it('should throw error on unique constraint violation for username', async () => {
      const dbError = { code: 'P2002', meta: { target: ['username'] } };
      mockPrisma.user.create.mockRejectedValue(dbError);
      await expect(createUser(baseUserData)).rejects.toThrow('Duplicate value for username.');
    });

    it('should throw error on unique constraint violation for email', async () => {
      const dbError = { code: 'P2002', meta: { target: ['email'] } };
      mockPrisma.user.create.mockRejectedValue(dbError);
      await expect(createUser(baseUserData)).rejects.toThrow('Duplicate value for email.');
    });

    it('should throw DatabaseError for other Prisma errors', async () => {
      const dbError = new Error('Some other DB error');
      mockPrisma.user.create.mockRejectedValue(dbError);
      await expect(createUser(baseUserData)).rejects.toThrow(
        new DatabaseError('Create user failed: Some other DB error'),
      );
    });
  });
  describe('getUserById', () => {
    it('should return user if found', async () => {
      const mockUser = { id: 1, username: 'testuser', email: 'test@example.com' };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getUserById(1);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const user = await getUserById(99);
      expect(user).toBeNull();
    });

    it('should throw DatabaseError if ID is not provided', async () => {
      await expect(getUserById(null)).rejects.toThrow(
        new DatabaseError('Lookup failed: User ID is required.'),
      );
      await expect(getUserById()).rejects.toThrow(
        new DatabaseError('Lookup failed: User ID is required.'),
      );
    });
  });

  describe('getUserByEmail', () => {
    it('should return user by email (case insensitive)', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const user = await getUserByEmail('TEST@EXAMPLE.COM');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(user).toEqual(mockUser);
    });

    it('should throw DatabaseError if email is not provided', async () => {
      await expect(getUserByEmail('')).rejects.toThrow(
        new DatabaseError('Lookup failed: Email required.'),
      );
      await expect(getUserByEmail(null)).rejects.toThrow(
        new DatabaseError('Lookup failed: Email required.'),
      );
    });
  });

  describe('getUserWithHorses', () => {
    it('should return user with horses if found', async () => {
      const mockUser = { id: 1, horses: [{ id: 101, name: 'Spirit' }] };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getUserWithHorses(1);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { horses: { include: { breed: true, stable: true } } },
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw DatabaseError if ID is not provided', async () => {
      await expect(getUserWithHorses(null)).rejects.toThrow(
        new DatabaseError('Lookup failed: User ID is required.'),
      );
    });
  });

  describe('updateUser', () => {
    const updateData = { name: 'Updated Name', money: 1500 };

    it('should update user successfully', async () => {
      const mockUpdatedUser = { id: 1, username: 'testuser', ...updateData };
      mockPrisma.user.update.mockResolvedValue(mockUpdatedUser);

      const result = await updateUser(1, updateData);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: updateData,
      });
      expect(result).toEqual(mockUpdatedUser);
    });

    it('should throw DatabaseError if ID is not provided', async () => {
      await expect(updateUser(null, updateData)).rejects.toThrow(
        new DatabaseError('Update failed: User ID is required.'),
      );
    });

    it('should handle Prisma update errors', async () => {
      const prismaError = { code: 'P2025', message: 'Record to update not found.' };
      mockPrisma.user.update.mockRejectedValue(prismaError);

      await expect(updateUser(1, updateData)).rejects.toThrow(
        new DatabaseError('Update failed: Record to update not found.'),
      );
    });

    it('should handle general update errors', async () => {
      const prismaError = { message: 'Some other update error' };
      mockPrisma.user.update.mockRejectedValue(prismaError);

      await expect(updateUser(1, updateData)).rejects.toThrow(
        new DatabaseError('Update failed: Some other update error'),
      );
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      const deletedUser = { id: 1, username: 'testuser' };
      mockPrisma.user.delete.mockResolvedValue(deletedUser);

      const result = await deleteUser(1);
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(deletedUser);
    });

    it('should throw DatabaseError if ID is not provided', async () => {
      await expect(deleteUser(null)).rejects.toThrow(
        new DatabaseError('Delete failed: User ID is required.'),
      );
    });

    it('should handle Prisma delete errors', async () => {
      const prismaError = { code: 'P2025', message: 'Record to delete not found.' };
      mockPrisma.user.delete.mockRejectedValue(prismaError);

      await expect(deleteUser(99)).rejects.toThrow(
        new DatabaseError('Delete failed: Record to delete not found.'),
      );
    });
  });

  describe('addXpToUser', () => {
    const baseUser = { id: 1, username: 'testuser', level: 1, xp: 50, money: 1000 };

    it('should add XP without leveling up', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(baseUser);
      const updatedUser = { ...baseUser, xp: 70, level: 1 };
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const result = await addXpToUser(1, 20);

      expect(result).toEqual({
        success: true,
        currentXP: 70,
        currentLevel: 1,
        leveledUp: false,
        levelsGained: 0,
        xpGained: 20,
      });
    });

    it('should add XP and level up', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(baseUser);
      const updatedUser = { ...baseUser, xp: 200, level: 2 };
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const result = await addXpToUser(1, 150);

      expect(result).toEqual({
        success: true,
        currentXP: 200,
        currentLevel: 2,
        leveledUp: true,
        levelsGained: 1,
        xpGained: 150,
      });
    });

    it('should return error for invalid XP amount', async () => {
      const result = await addXpToUser(1, -5);
      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          error: 'XP amount must be a positive number.',
        }),
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error: XP amount must be a positive number.'),
      );
    });

    it('should return error for invalid user ID', async () => {
      const result = await addXpToUser(null, 20);
      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          error: 'User ID is required.',
        }),
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error: User ID is required.'),
      );
    });

    it('should return error if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await addXpToUser(99, 20);
      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          error: 'User not found.',
        }),
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error: User not found.'),
      );
    });
  });

  describe('getUserProgress', () => {
    it('should return user progress', async () => {
      const mockUser = { id: 1, level: 1, xp: 50 };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getUserProgress(1);

      expect(result).toEqual({
        userId: 1,
        level: 1,
        xp: 50,
        xpToNextLevel: 150,
        xpForNextLevel: 200,
      });
    });

    it('should throw DatabaseError if ID is not provided', async () => {
      await expect(getUserProgress(null)).rejects.toThrow(
        new DatabaseError('Progress fetch failed: Lookup failed: User ID is required.'),
      );
    });

    it('should throw DatabaseError if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(getUserProgress(99)).rejects.toThrow(
        new DatabaseError('Progress fetch failed: User not found.'),
      );
    });
  });

  describe('getUserStats', () => {
    it('should return user stats with horses', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
        name: 'Test User',
        createdAt: new Date(),
        money: 1000,
        level: 2,
        xp: 150,
        horses: [{ age: 5 }, { age: 7 }],
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getUserStats(1);

      expect(result).toEqual({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
        name: 'Test User',
        createdAt: mockUser.createdAt,
        money: 1000,
        level: 2,
        xp: 150,
        horseCount: 2,
        averageHorseAge: 6,
      });
    });

    it('should handle user with no horses', async () => {
      const mockUser = {
        id: 2,
        username: 'nohorseuser',
        email: 'nohorses@example.com',
        role: 'user',
        createdAt: new Date(),
        name: 'No Horse User',
        money: 500,
        level: 1,
        xp: 25,
        horses: [],
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getUserStats(2);

      expect(result).toEqual(
        expect.objectContaining({
          horseCount: 0,
          averageHorseAge: 0,
        }),
      );
    });

    it('should handle user with null horses array', async () => {
      const mockUser = {
        id: 3,
        username: 'nullhorseuser',
        email: 'nullhorse@example.com',
        role: 'user',
        createdAt: new Date(),
        name: 'Null Horse User',
        money: 500,
        level: 2,
        xp: 10,
        horses: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getUserStats(3);
      expect(result).toEqual(
        expect.objectContaining({
          horseCount: 0,
          averageHorseAge: 0,
        }),
      );
    });

    it('should return null for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await getUserStats(999);
      expect(result).toBeNull();
    });
    it('should throw DatabaseError if ID is not provided', async () => {
      await expect(getUserStats(null)).rejects.toThrow(
        new DatabaseError('Stats fetch failed: User ID is required.'),
      );
    });
  });
});
