/**
 * 🧪 INTEGRATION TEST: Progression Controller - Real Database Operations
 *
 * This test validates the progression controller's functionality using REAL database
 * operations following the proven minimal mocking TDD strategy (90.1% success rate).
 *
 * 📋 BUSINESS RULES TESTED:
 * - XP earning and accumulation with positive number validation
 * - Level progression (REAL behavior, source of truth = backend/models/userModel.mjs;
 *   the progressionController shim was REMOVED in the module refactor and this
 *   suite imports addXpToUser/getUserProgress directly from userModel —
 *   Equoria-u70px): cumulative-XP, LINEAR thresholds.
 *   xpThreshold(level) = 100 * level, so the level-up boundary for reaching
 *   level N is 100 * N total XP. XP is NOT reset on level-up — it accumulates
 *   (db xp keeps the running total). e.g. 230 total XP => level 2 (230 >= 200,
 *   but 230 < 300), db xp stays 230.
 *   addXpToUser returns { success, currentXP, currentLevel, leveledUp,
 *   levelsGained, xpGained } on success and { success:false, error } on bad
 *   input (it does NOT throw). getUserProgress returns { userId, level, xp,
 *   xpToNextLevel, xpForNextLevel } (no legacy `valid` flag). The assertions
 *   below match the executed (linear, cumulative) path, verified against the
 *   canonical DB (Equoria-xade6 / u70px).
 * - Single and multiple level-ups from large cumulative XP totals
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

// Strategic mocking: Only mock external dependencies (logger)
const mockLogger = {
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};

jest.mock('../backend/utils/logger.mjs', () => ({
  default: mockLogger,
}));

// Import real modules. The progressionController shim was removed in the module
// refactor (Equoria-u70px) — addXpToUser/getUserProgress now live in userModel,
// and db/index.mjs was deleted in favour of the packages/database prismaClient.
import prisma from '../packages/database/prismaClient.mjs';
import {
  addXpToUser,
  getUserProgress,
} from '../backend/modules/users/services/userModelService.mjs';
import { cleanupProgressionFixtures } from './helpers/scopedTestCleanup.mjs';

describe('📈 INTEGRATION: Progression Controller - Real Database Operations', () => {
  beforeEach(async () => {
    // Scoped cleanup — canonical DB (CLAUDE.md §2); never wipe all users.
    await cleanupProgressionFixtures(prisma);

    // Create test users with different XP and levels (persisted to the canonical
    // DB; referenced by id in the assertions, not by these locals).
    await prisma.user.create({
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

    await prisma.user.create({
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

    await prisma.user.create({
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

    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Scoped cleanup — canonical DB (CLAUDE.md §2); never wipe all users.
    await cleanupProgressionFixtures(prisma);
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
        where: { id: 'test-user-1' },
      });
      expect(updatedUser.xp).toBe(20);
      expect(updatedUser.level).toBe(1);
    });

    it('should stay level 1 at exactly 100 cumulative XP (level-2 threshold is 200) using real database', async () => {
      const result = await addXpToUser('test-user-2', 10); // 90 + 10 = 100 cumulative XP

      expect(result.success).toBe(true);
      expect(result.currentXP).toBe(100); // cumulative, not reset
      expect(result.currentLevel).toBe(1); // 100 < 200 (xpThreshold(2)) => still level 1
      expect(result.leveledUp).toBe(false);
      expect(result.levelsGained).toBe(0);

      // Verify in database: cumulative XP retained, level unchanged
      const updatedUser = await prisma.user.findUnique({
        where: { id: 'test-user-2' },
      });
      expect(updatedUser.xp).toBe(100);
      expect(updatedUser.level).toBe(1);
    });

    it('should accumulate XP without resetting on partial progress using real database', async () => {
      const result = await addXpToUser('test-user-2', 25); // 90 + 25 = 115 cumulative XP

      expect(result.success).toBe(true);
      expect(result.currentXP).toBe(115); // cumulative; no rollover/reset
      expect(result.currentLevel).toBe(1); // 115 < 200 => still level 1
      expect(result.leveledUp).toBe(false);
      expect(result.levelsGained).toBe(0);

      // Verify in database
      const updatedUser = await prisma.user.findUnique({
        where: { id: 'test-user-2' },
      });
      expect(updatedUser.xp).toBe(115);
      expect(updatedUser.level).toBe(1);
    });

    it('should level up once when crossing a cumulative threshold using real database', async () => {
      const result = await addXpToUser('test-user-1', 230); // 0 + 230 cumulative XP

      expect(result.success).toBe(true);
      expect(result.currentXP).toBe(230); // cumulative; not reset on level-up
      expect(result.currentLevel).toBe(2); // 230 >= 200 (level 2) but < 300 (level 3)
      expect(result.leveledUp).toBe(true);
      expect(result.levelsGained).toBe(1); // From level 1 to level 2

      // Verify in database: cumulative XP retained, level advanced once
      const updatedUser = await prisma.user.findUnique({
        where: { id: 'test-user-1' },
      });
      expect(updatedUser.xp).toBe(230);
      expect(updatedUser.level).toBe(2);
    });
  });

  describe('User Progress Reporting', () => {
    it('should return correct progress for level 1 user using real database', async () => {
      const result = await getUserProgress('test-user-1');

      // userModel.getUserProgress returns { userId, level, xp, xpToNextLevel,
      // xpForNextLevel } — there is no legacy `valid` flag (that belonged to the
      // removed progressionController shim). xpThreshold(level+1) = 100*(level+1),
      // so for a level-1 user with 0 xp: xpForNextLevel = 200, xpToNextLevel = 200.
      expect(result.userId).toBe('test-user-1');
      expect(result.level).toBe(1);
      expect(result.xp).toBe(0);
      expect(result.xpForNextLevel).toBe(200);
      expect(result.xpToNextLevel).toBe(200);
    });

    it('should return correct progress for level 2 user using real database', async () => {
      const result = await getUserProgress('test-user-3');

      // Level-2 user with 75 xp: xpForNextLevel = 100*3 = 300, xpToNextLevel = 225.
      expect(result.userId).toBe('test-user-3');
      expect(result.level).toBe(2);
      expect(result.xp).toBe(75);
      expect(result.xpForNextLevel).toBe(300);
      expect(result.xpToNextLevel).toBe(225);
    });

    it('should handle non-existent user in getUserProgress', async () => {
      await expect(getUserProgress('non-existent-user')).rejects.toThrow();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    // NOTE (Equoria-u70px): userModel.addXpToUser does NOT throw on bad input —
    // it catches internally and returns a { success:false, error } envelope (and
    // does NOT mutate the row). The removed progressionController shim threw; these
    // assertions now match the model's real return-based error contract. The
    // no-mutation check guards against a partial-write side effect.
    it('should reject negative XP amounts (success:false, no mutation)', async () => {
      const result = await addXpToUser('test-user-1', -5);
      expect(result.success).toBe(false);
      expect(result.error).toBe('XP amount must be a positive number.');

      const user = await prisma.user.findUnique({ where: { id: 'test-user-1' } });
      expect(user.xp).toBe(0);
      expect(user.level).toBe(1);
    });

    it('should reject zero XP amounts (success:false, no mutation)', async () => {
      const result = await addXpToUser('test-user-1', 0);
      expect(result.success).toBe(false);
      expect(result.error).toBe('XP amount must be a positive number.');

      const user = await prisma.user.findUnique({ where: { id: 'test-user-1' } });
      expect(user.xp).toBe(0);
    });

    it('should reject an empty-string user ID (success:false)', async () => {
      const result = await addXpToUser('', 10);
      expect(result.success).toBe(false);
      expect(result.error).toBe('User ID is required.');
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
      // Add competition XP — 90 + 30 = 120 cumulative XP (still below the
      // level-2 threshold of 200, so no level-up; XP accumulates).
      const result = await addXpToUser('test-user-2', 30);

      expect(result.success).toBe(true);
      expect(result.currentXP).toBe(120); // cumulative, not reset
      expect(result.currentLevel).toBe(1); // 120 < 200 => still level 1
      expect(result.leveledUp).toBe(false);

      // Verify final state: cumulative XP retained at current level
      const progress = await getUserProgress('test-user-2');
      expect(progress.xp).toBe(120);
      expect(progress.level).toBe(1);
    });
  });
});
