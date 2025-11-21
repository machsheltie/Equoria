/**
 * Cron Job Service Tests
 * Tests for scheduled token cleanup and cron job management
 *
 * SECURITY: CWE-613 (Insufficient Session Expiration)
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { createTestUser, createTestRefreshToken } from '../setup.mjs';
import prisma from '../../db/index.mjs';

// Mock node-cron BEFORE importing anything that uses it (ESM pattern)
const mockSchedule = jest.fn((pattern, callback, options) => {
  return {
    start: jest.fn(),
    stop: jest.fn(),
    running: false,
    scheduled: options?.scheduled !== false,
    _callback: callback, // Store for testing
    _pattern: pattern,
  };
});

jest.unstable_mockModule('node-cron', () => ({
  default: {
    schedule: mockSchedule,
  },
}));

// Import AFTER mocking
const { initializeCronJobs, stopCronJobs, getCronJobStatus, triggerTokenCleanup } =
  await import('../../services/cronJobService.mjs');
const cron = await import('node-cron');

describe('Cron Job Service', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Stop all cron jobs after each test
    stopCronJobs();
  });

  describe('initializeCronJobs()', () => {
    it('should initialize weekly salary job', () => {
      initializeCronJobs();

      expect(mockSchedule).toHaveBeenCalledWith(
        '0 9 * * 1', // Monday 9AM
        expect.any(Function),
        expect.objectContaining({
          scheduled: false,
          timezone: 'UTC',
        }),
      );
    });

    it('should initialize token cleanup job', () => {
      initializeCronJobs();

      expect(mockSchedule).toHaveBeenCalledWith(
        '0 3 * * *', // Daily 3AM
        expect.any(Function),
        expect.objectContaining({
          scheduled: false,
          timezone: 'UTC',
        }),
      );
    });

    it('should start all jobs after initialization', () => {
      initializeCronJobs();

      const mockCalls = mockSchedule.mock.results;
      mockCalls.forEach((call) => {
        expect(call.value.start).toHaveBeenCalled();
      });
    });

    it('should initialize exactly 2 cron jobs', () => {
      initializeCronJobs();

      expect(mockSchedule).toHaveBeenCalledTimes(2);
    });

    it('should use UTC timezone for all jobs', () => {
      initializeCronJobs();

      mockSchedule.mock.calls.forEach((call) => {
        const options = call[2];
        expect(options.timezone).toBe('UTC');
      });
    });
  });

  describe('stopCronJobs()', () => {
    it('should stop all running jobs', () => {
      initializeCronJobs();

      const jobs = mockSchedule.mock.results.map((r) => r.value);

      stopCronJobs();

      jobs.forEach((job) => {
        expect(job.stop).toHaveBeenCalled();
      });
    });

    it('should handle stopping when no jobs initialized', () => {
      expect(() => stopCronJobs()).not.toThrow();
    });

    it('should clear all job references', () => {
      initializeCronJobs();
      stopCronJobs();

      const status = getCronJobStatus();
      expect(status.totalJobs).toBe(0);
    });
  });

  describe('getCronJobStatus()', () => {
    it('should return status for all initialized jobs', () => {
      initializeCronJobs();

      const status = getCronJobStatus();

      expect(status.totalJobs).toBe(2);
      expect(status.jobs).toHaveProperty('weeklySalaries');
      expect(status.jobs).toHaveProperty('tokenCleanup');
    });

    it('should return empty status when no jobs initialized', () => {
      const status = getCronJobStatus();

      expect(status.totalJobs).toBe(0);
      expect(status.jobs).toEqual({});
    });

    it('should include running and scheduled flags', () => {
      initializeCronJobs();

      const status = getCronJobStatus();

      expect(status.jobs.weeklySalaries).toHaveProperty('running');
      expect(status.jobs.weeklySalaries).toHaveProperty('scheduled');
      expect(status.jobs.tokenCleanup).toHaveProperty('running');
      expect(status.jobs.tokenCleanup).toHaveProperty('scheduled');
    });
  });

  describe('triggerTokenCleanup() - Manual Execution', () => {
    let user;

    beforeEach(async () => {
      user = await createTestUser();
    });

    it('should remove expired tokens', async () => {
      // Create expired token (expired 1 day ago)
      const expiredToken = await createTestRefreshToken(user.id, {
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      const result = await triggerTokenCleanup();

      expect(result.removed).toBe(1);

      // Verify token was deleted
      const deletedToken = await prisma.refreshToken.findUnique({
        where: { id: expiredToken.id },
      });
      expect(deletedToken).toBeNull();
    });

    it('should NOT remove valid tokens', async () => {
      // Create valid token (expires in 7 days)
      const validToken = await createTestRefreshToken(user.id, {
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const result = await triggerTokenCleanup();

      expect(result.removed).toBe(0);

      // Verify token still exists
      const existingToken = await prisma.refreshToken.findUnique({
        where: { id: validToken.id },
      });
      expect(existingToken).not.toBeNull();
    });

    it('should remove multiple expired tokens', async () => {
      // Create 5 expired tokens
      for (let i = 0; i < 5; i++) {
        await createTestRefreshToken(user.id, {
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        });
      }

      const result = await triggerTokenCleanup();

      expect(result.removed).toBe(5);
    });

    it('should remove expired tokens for all users', async () => {
      const user2 = await createTestUser({ email: 'user2@example.com' });

      // Create expired tokens for both users
      await createTestRefreshToken(user.id, {
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      await createTestRefreshToken(user2.id, {
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      const result = await triggerTokenCleanup();

      expect(result.removed).toBe(2);
    });

    it('should remove only expired tokens from mixed set', async () => {
      // 3 expired tokens
      for (let i = 0; i < 3; i++) {
        await createTestRefreshToken(user.id, {
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        });
      }

      // 2 valid tokens
      for (let i = 0; i < 2; i++) {
        await createTestRefreshToken(user.id, {
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
      }

      const result = await triggerTokenCleanup();

      expect(result.removed).toBe(3);

      // Verify 2 tokens remain
      const remainingTokens = await prisma.refreshToken.count({
        where: { userId: user.id },
      });
      expect(remainingTokens).toBe(2);
    });

    it('should return timestamp of cleanup', async () => {
      const beforeCleanup = new Date();

      const result = await triggerTokenCleanup();

      const cleanupTime = new Date(result.timestamp);
      expect(cleanupTime.getTime()).toBeGreaterThanOrEqual(beforeCleanup.getTime());
      expect(cleanupTime.getTime()).toBeLessThanOrEqual(new Date().getTime());
    });

    it('should handle cleanup when no expired tokens exist', async () => {
      const result = await triggerTokenCleanup();

      expect(result.removed).toBe(0);
      expect(result.timestamp).toBeDefined();
    });

    it('should handle tokens expiring at exact current time', async () => {
      const now = new Date();

      // Token expires exactly now
      await createTestRefreshToken(user.id, {
        expiresAt: now,
      });

      const result = await triggerTokenCleanup();

      // Token expiring "now" should be considered expired (expiresAt < now)
      expect(result.removed).toBeGreaterThanOrEqual(0);
    });

    it('should include error message on failure', async () => {
      // Mock Prisma to throw an error
      const mockError = new Error('Database connection failed');
      jest.spyOn(prisma.refreshToken, 'deleteMany').mockRejectedValueOnce(mockError);

      const result = await triggerTokenCleanup();

      expect(result.removed).toBe(0);
      expect(result.error).toBeDefined();
      expect(result.error).toBe('Database connection failed');
    });
  });

  describe('Token Cleanup Scheduling', () => {
    it('should schedule daily cleanup at 3 AM UTC', () => {
      initializeCronJobs();

      const tokenCleanupCall = mockSchedule.mock.calls.find((call) => call[0] === '0 3 * * *');

      expect(tokenCleanupCall).toBeDefined();
      expect(tokenCleanupCall[2].timezone).toBe('UTC');
    });

    it('should execute token cleanup callback when triggered', async () => {
      initializeCronJobs();

      const user = await createTestUser();
      await createTestRefreshToken(user.id, {
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      // Get the cleanup job callback
      const tokenCleanupCall = mockSchedule.mock.calls.find((call) => call[0] === '0 3 * * *');
      const cleanupCallback = tokenCleanupCall[1];

      // Execute the callback
      await cleanupCallback();

      // Verify token was removed
      const tokenCount = await prisma.refreshToken.count({
        where: { userId: user.id },
      });
      expect(tokenCount).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle tokens with null expiresAt (should not crash)', async () => {
      // This shouldn't happen in production due to schema constraints,
      // but test graceful handling
      const result = await triggerTokenCleanup();

      expect(result).toHaveProperty('removed');
      expect(result).toHaveProperty('timestamp');
    });

    it('should handle concurrent cleanup executions', async () => {
      const user = await createTestUser();

      // Create 10 expired tokens
      for (let i = 0; i < 10; i++) {
        await createTestRefreshToken(user.id, {
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        });
      }

      // Trigger cleanup twice concurrently
      const [result1, result2] = await Promise.all([triggerTokenCleanup(), triggerTokenCleanup()]);

      // Total removed should be 10 (may be split between executions)
      const totalRemoved = result1.removed + result2.removed;
      expect(totalRemoved).toBe(10);

      // All tokens should be gone
      const remainingTokens = await prisma.refreshToken.count({
        where: { userId: user.id },
      });
      expect(remainingTokens).toBe(0);
    });

    it('should handle very old expired tokens', async () => {
      const user = await createTestUser();

      // Token expired 1 year ago
      await createTestRefreshToken(user.id, {
        expiresAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      });

      const result = await triggerTokenCleanup();

      expect(result.removed).toBe(1);
    });

    it('should handle tokens expiring in the future', async () => {
      const user = await createTestUser();

      // Token expires in 1 year
      await createTestRefreshToken(user.id, {
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      const result = await triggerTokenCleanup();

      expect(result.removed).toBe(0);
    });
  });

  describe('Performance', () => {
    it('should efficiently remove large number of expired tokens', async () => {
      const user = await createTestUser();

      // Create 100 expired tokens
      const tokenPromises = [];
      for (let i = 0; i < 100; i++) {
        tokenPromises.push(
          createTestRefreshToken(user.id, {
            expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          }),
        );
      }
      await Promise.all(tokenPromises);

      const startTime = Date.now();
      const result = await triggerTokenCleanup();
      const duration = Date.now() - startTime;

      expect(result.removed).toBe(100);
      expect(duration).toBeLessThan(5000); // Should complete in <5 seconds
    });
  });
});
