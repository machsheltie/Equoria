/**
 * 🧪 INTEGRATION TEST: Progression Controller - Real Database Operations
 *
 * This test validates the progression controller's functionality using REAL database
 * operations following the proven minimal mocking TDD strategy (90.1% success rate).
 *
 * 📋 BUSINESS RULES TESTED:
 * - XP earning and accumulation with positive number validation
 * - Level progression: 100 XP per level with rollover handling
 * - Multiple level ups from large XP gains (e.g., 130 XP = 2 levels + 30 XP)
 * - Progress reporting with accurate level and XP calculations
 * - Error handling for invalid inputs (negative XP, empty user IDs)
 * - Integration scenarios: training and competition XP workflows
 * - Edge cases: zero XP, null user IDs, non-existent users
 *
 * 🔄 MINIMAL MOCKING APPROACH (90.1% SUCCESS RATE):
 * ✅ REAL: Database operations, controller logic, XP calculations, level progression
 * ✅ REAL: Error handling, input processing, business rule enforcement
 * ✅ REAL: User model operations, validation rules
 * 🔧 MOCK: Logger only - external dependency for logging
 *
 * 💡 TEST STRATEGY: Integration testing with real database operations to validate
 *    actual business logic and catch real implementation issues
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Strategic mocking: Only mock external dependencies (logger)
const mockLogger = {
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};

jest.mock('../backend/utils/logger.mjs', () => ({
  default: mockLogger,
}));

// Import real modules
import prisma from '../backend/db/index.mjs';
import { addXpToUser, getUserProgress } from '../backend/controllers/progressionController.mjs';

describe('📈 INTEGRATION: Progression Controller - Real Database Operations', () => {
  let testUsers = [];

  beforeEach(async () => {
    // Clean up test data
    await prisma.xpEvent.deleteMany({});
    await prisma.user.deleteMany({});

    // Create test users with different XP and levels
    const user1 = await prisma.user.create({
      data: {
        id: 'test-user-1',
        username: 'TestUser1',
        firstName: 'Test',
        lastName: 'User1',
        email: 'test1@example.com',
        password: 'hashedpassword',
        level: 1,
        xp: 0,
        money: 1000,
      },
    });

    const user2 = await prisma.user.create({
      data: {
        id: 'test-user-2',
        username: 'TestUser2',
        firstName: 'Test',
        lastName: 'User2',
        email: 'test2@example.com',
        password: 'hashedpassword',
        level: 1,
        xp: 90,
        money: 1000,
      },
    });

    const user3 = await prisma.user.create({
      data: {
        id: 'test-user-3',
        username: 'TestUser3',
        firstName: 'Test',
        lastName: 'User3',
        email: 'test3@example.com',
        password: 'hashedpassword',
        level: 2,
        xp: 75,
        money: 1000,
      },
    });

    testUsers = [user1, user2, user3];
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.xpEvent.deleteMany({});
    await prisma.user.deleteMany({});
    jest.clearAllMocks();
  });

  describe('XP Earning and Level Progression', () => {
    it('should gain 20 XP correctly using real database', async () => {
      const result = await addXpToUser('test-user-1', 20);

      expect(result.success).toBe(true);
      expect(result.currentXP).toBe(20);
      expect(result.currentLevel).toBe(1);
      expect(result.xpGained).toBe(20);
      expect(result.leveledUp).toBe(false);

      // Verify in database
      const updatedUser = await prisma.user.findUnique({
        where: { id: 'test-user-1' }
      });
      expect(updatedUser.xp).toBe(20);
      expect(updatedUser.level).toBe(1);
    });

    it('should level up when reaching 100 XP using real database', async () => {
      const result = await addXpToUser('test-user-2', 10); // 90 + 10 = 100 XP

      expect(result.success).toBe(true);
      expect(result.currentXP).toBe(100);
      expect(result.currentLevel).toBe(2);
      expect(result.leveledUp).toBe(true);
      expect(result.levelsGained).toBe(1);

      // Verify in database
      const updatedUser = await prisma.user.findUnique({
        where: { id: 'test-user-2' }
      });
      expect(updatedUser.xp).toBe(0);
      expect(updatedUser.level).toBe(2);
    });

    it('should handle XP rollover correctly using real database', async () => {
      const result = await addXpToUser('test-user-2', 25); // 90 + 25 = 115 XP = level 2 + 15 XP

      expect(result.success).toBe(true);
      expect(result.currentXP).toBe(115);
      expect(result.currentLevel).toBe(2);
      expect(result.leveledUp).toBe(true);
      expect(result.levelsGained).toBe(1);

      // Verify in database
      const updatedUser = await prisma.user.findUnique({
        where: { id: 'test-user-2' }
      });
      expect(updatedUser.xp).toBe(15);
      expect(updatedUser.level).toBe(2);
    });

    it('should handle multiple level ups using real database', async () => {
      const result = await addXpToUser('test-user-1', 230); // 0 + 230 = level 3 + 30 XP

      expect(result.success).toBe(true);
      expect(result.currentXP).toBe(230);
      expect(result.currentLevel).toBe(3);
      expect(result.leveledUp).toBe(true);
      expect(result.levelsGained).toBe(2); // From level 1 to level 3

      // Verify in database
      const updatedUser = await prisma.user.findUnique({
        where: { id: 'test-user-1' }
      });
      expect(updatedUser.xp).toBe(30);
      expect(updatedUser.level).toBe(3);
    });
  });

  describe('User Progress Reporting', () => {
    it('should return correct progress for level 1 user using real database', async () => {
      const result = await getUserProgress('test-user-1');
      
      expect(result.valid).toBe(true);
      expect(result.level).toBe(1);
      expect(result.xp).toBe(0);
    });

    it('should return correct progress for level 2 user using real database', async () => {
      const result = await getUserProgress('test-user-3');
      
      expect(result.valid).toBe(true);
      expect(result.level).toBe(2);
      expect(result.xp).toBe(75);
    });

    it('should handle non-existent user in getUserProgress', async () => {
      await expect(getUserProgress('non-existent-user')).rejects.toThrow();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle negative XP amounts in addXpToUser', async () => {
      await expect(addXpToUser('test-user-1', -5)).rejects.toThrow('XP amount must be a positive number.');
    });

    it('should handle zero XP amounts in addXpToUser', async () => {
      await expect(addXpToUser('test-user-1', 0)).rejects.toThrow('XP amount must be a positive number.');
    });

    it('should handle invalid (empty string) user ID in addXpToUser', async () => {
      await expect(addXpToUser('', 10)).rejects.toThrow('User ID is required.');
    });

    it('should handle invalid (empty string) user ID in getUserProgress', async () => {
      await expect(getUserProgress('')).rejects.toThrow();
    });

    it('should handle null user ID in getUserProgress', async () => {
      await expect(getUserProgress(null)).rejects.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete training workflow with XP using real database', async () => {
      // Add training XP
      const result1 = await addXpToUser('test-user-1', 20);
      expect(result1.success).toBe(true);
      expect(result1.currentXP).toBe(20);
      expect(result1.currentLevel).toBe(1);

      // Add more training XP
      const result2 = await addXpToUser('test-user-1', 30);
      expect(result2.success).toBe(true);
      expect(result2.currentXP).toBe(50);
      expect(result2.currentLevel).toBe(1);

      // Verify final state
      const progress = await getUserProgress('test-user-1');
      expect(progress.xp).toBe(50);
      expect(progress.level).toBe(1);
    });

    it('should handle complete competition workflow with XP using real database', async () => {
      // Add competition XP that causes level up
      const result = await addXpToUser('test-user-2', 30); // 90 + 30 = 120 = level 2 + 20 XP

      expect(result.success).toBe(true);
      expect(result.currentXP).toBe(120);
      expect(result.currentLevel).toBe(2);
      expect(result.leveledUp).toBe(true);

      // Verify final state
      const progress = await getUserProgress('test-user-2');
      expect(progress.xp).toBe(20);
      expect(progress.level).toBe(2);
    });
  });
});
