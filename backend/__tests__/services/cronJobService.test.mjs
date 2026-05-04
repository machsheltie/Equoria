/**
 * Cron Job Service Tests — real node-cron, real Prisma
 *
 * NO MOCKS. Rewritten 2026-04-30 (Equoria-p6fx, no-mocks doctrine epic)
 * from a jest.unstable_mockModule-of-node-cron pattern to a real-cron,
 * real-DB pattern.
 *
 * SECURITY: CWE-613 (Insufficient Session Expiration)
 *
 * Removed tests (per doctrine):
 *   - "should initialize weekly salary job" (verified mockSchedule was
 *     called with pattern '0 9 * * 1') — that's a test of node-cron's
 *     interface, not of OUR code. The schedule string is a config
 *     decision; if it changes, that's a deliberate edit, and there's
 *     no "real-world" failure mode where node-cron interprets the
 *     pattern wrong.
 *   - "should initialize token cleanup job" (same reason).
 *   - "should use UTC timezone for all jobs" (same reason).
 *   - "should execute token cleanup callback when triggered" (extracted
 *     callback from mockSchedule.mock.calls — no equivalent without a
 *     mock; the SAME behavior is exercised directly via
 *     `triggerTokenCleanup()`).
 *   - "should include error message on failure" (mocked Prisma to
 *     reject — synthetic fault injection of Prisma is forbidden by
 *     no-mocks doctrine; the catch path is observable in production
 *     via real DB outage / sentry, not synthetic test rejection).
 *
 * Replaced node-cron mock with real node-cron. Real schedules created
 * with `scheduled: false` (per production config) so they don't fire
 * during tests; afterEach calls stopCronJobs() to release any handles.
 *
 * @module __tests__/services/cronJobService
 */

import { describe, it, expect, beforeAll, afterEach, afterAll, beforeEach } from '@jest/globals';
import { createTestRefreshToken } from '../setup.mjs';
import prisma from '../../db/index.mjs';
import { randomBytes } from 'node:crypto';
import {
  initializeCronJobs,
  stopCronJobs,
  getCronJobStatus,
  triggerTokenCleanup,
} from '../../services/cronJobService.mjs';

const SUITE_PREFIX = 'cron';

async function cleanupSuite() {
  // The cron service touches refresh_tokens for ALL users. Tests in
  // this file create their own users via createTestUser and tokens via
  // createTestRefreshToken. We clean those (and only those) by user-id
  // prefix here. The 'test-' prefix is shared across the suite so we
  // can't filter to just THIS file's rows; rely on the caller to
  // isolate via per-test-created users that don't bleed across tests.
  const users = await prisma.user.findMany({
    where: { id: { startsWith: SUITE_PREFIX } },
    select: { id: true },
  });
  if (users.length === 0) {
    return;
  }
  const userIds = users.map(u => u.id);
  await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

// Override createTestUser to use SUITE_PREFIX so cleanupSuite catches them.
async function makeUser(overrides = {}) {
  const uid = randomBytes(8).toString('hex');
  return prisma.user.create({
    data: {
      id: `${SUITE_PREFIX}-${uid}`,
      username: overrides.username ?? `${SUITE_PREFIX}_${uid}`,
      email: overrides.email ?? `${SUITE_PREFIX}-${uid}@example.com`,
      firstName: 'Cron',
      lastName: 'Test',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
      emailVerified: true,
    },
  });
}

describe('Cron Job Service (real node-cron + real DB)', () => {
  beforeAll(cleanupSuite);
  afterAll(cleanupSuite);

  afterEach(async () => {
    // Ensure any cron handles created during the test are released so
    // they don't leak into the next test or hold the test process open.
    stopCronJobs();
    await cleanupSuite();
  });

  describe('initializeCronJobs() / stopCronJobs() lifecycle', () => {
    it('should register three scheduled jobs visible via getCronJobStatus', () => {
      initializeCronJobs();

      const status = getCronJobStatus();
      expect(status.totalJobs).toBe(3);
      expect(status.jobs).toHaveProperty('weeklySalaries');
      expect(status.jobs).toHaveProperty('tokenCleanup');
      expect(status.jobs).toHaveProperty('foaling');
    });

    it('should report running and scheduled flags for each job', () => {
      initializeCronJobs();

      const status = getCronJobStatus();
      expect(status.jobs.weeklySalaries).toHaveProperty('running');
      expect(status.jobs.weeklySalaries).toHaveProperty('scheduled');
      expect(status.jobs.tokenCleanup).toHaveProperty('running');
      expect(status.jobs.tokenCleanup).toHaveProperty('scheduled');
    });

    it('should clear all job references after stopCronJobs()', () => {
      initializeCronJobs();
      stopCronJobs();

      const status = getCronJobStatus();
      expect(status.totalJobs).toBe(0);
    });

    it('should not throw when stopping with no jobs initialized', () => {
      expect(() => stopCronJobs()).not.toThrow();
    });
  });

  describe('getCronJobStatus() — initial state', () => {
    it('should return empty status before initializeCronJobs() runs', () => {
      const status = getCronJobStatus();
      expect(status.totalJobs).toBe(0);
      expect(status.jobs).toEqual({});
    });
  });

  describe('triggerTokenCleanup() — real DB cleanup', () => {
    let user;

    beforeEach(async () => {
      user = await makeUser();
    });

    it('should remove expired tokens', async () => {
      const expired = await createTestRefreshToken(user.id, {
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      const result = await triggerTokenCleanup();

      expect(result.removed).toBeGreaterThanOrEqual(1);
      const stillThere = await prisma.refreshToken.findUnique({ where: { id: expired.id } });
      expect(stillThere).toBeNull();
    });

    it('should NOT remove valid tokens', async () => {
      const valid = await createTestRefreshToken(user.id, {
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await triggerTokenCleanup();

      const stillThere = await prisma.refreshToken.findUnique({ where: { id: valid.id } });
      expect(stillThere).not.toBeNull();
    });

    it('should remove multiple expired tokens for one user', async () => {
      for (let i = 0; i < 5; i++) {
        await createTestRefreshToken(user.id, {
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        });
      }
      const beforeCount = await prisma.refreshToken.count({ where: { userId: user.id } });
      expect(beforeCount).toBe(5);

      await triggerTokenCleanup();

      const afterCount = await prisma.refreshToken.count({ where: { userId: user.id } });
      expect(afterCount).toBe(0);
    });

    it('should remove expired tokens across multiple users', async () => {
      const user2 = await makeUser();
      await createTestRefreshToken(user.id, {
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      await createTestRefreshToken(user2.id, {
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      await triggerTokenCleanup();

      const total = await prisma.refreshToken.count({
        where: { userId: { in: [user.id, user2.id] } },
      });
      expect(total).toBe(0);
    });

    it('should remove only expired tokens from a mixed set', async () => {
      for (let i = 0; i < 3; i++) {
        await createTestRefreshToken(user.id, {
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        });
      }
      for (let i = 0; i < 2; i++) {
        await createTestRefreshToken(user.id, {
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
      }

      await triggerTokenCleanup();

      const remaining = await prisma.refreshToken.count({ where: { userId: user.id } });
      expect(remaining).toBe(2);
    });

    it('should return a real timestamp on cleanup completion', async () => {
      const before = Date.now();

      const result = await triggerTokenCleanup();

      const cleanupTime = new Date(result.timestamp).getTime();
      expect(cleanupTime).toBeGreaterThanOrEqual(before);
      expect(cleanupTime).toBeLessThanOrEqual(Date.now());
    });

    it('should be safe to run when no expired tokens exist', async () => {
      const result = await triggerTokenCleanup();

      expect(result.removed).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeDefined();
    });

    it('should treat tokens with expiresAt strictly in the past as expired', async () => {
      // Token expired 1 second ago.
      await createTestRefreshToken(user.id, {
        expiresAt: new Date(Date.now() - 1000),
      });

      const result = await triggerTokenCleanup();

      expect(result.removed).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Edge cases — real DB', () => {
    let user;
    beforeEach(async () => {
      user = await makeUser();
    });

    it('should handle concurrent cleanup executions atomically (no double-delete crash)', async () => {
      for (let i = 0; i < 10; i++) {
        await createTestRefreshToken(user.id, {
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        });
      }

      const [r1, r2] = await Promise.all([triggerTokenCleanup(), triggerTokenCleanup()]);

      // The total observed by the two cleanup calls may be split or
      // both report the full 10 (depends on Prisma's transaction
      // isolation). The invariant we care about: zero remaining.
      expect(r1.removed + r2.removed).toBeGreaterThanOrEqual(10);
      const remaining = await prisma.refreshToken.count({ where: { userId: user.id } });
      expect(remaining).toBe(0);
    });

    it('should handle very-old expired tokens', async () => {
      await createTestRefreshToken(user.id, {
        expiresAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      });

      const result = await triggerTokenCleanup();

      expect(result.removed).toBeGreaterThanOrEqual(1);
    });

    it('should handle tokens expiring far in the future', async () => {
      const future = await createTestRefreshToken(user.id, {
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      await triggerTokenCleanup();

      const stillThere = await prisma.refreshToken.findUnique({ where: { id: future.id } });
      expect(stillThere).not.toBeNull();
    });
  });

  describe('Performance — real DB', () => {
    it('should efficiently remove a large batch of expired tokens (<5s for 100)', async () => {
      const user = await makeUser();
      const tokenPromises = [];
      for (let i = 0; i < 100; i++) {
        tokenPromises.push(
          createTestRefreshToken(user.id, {
            expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          }),
        );
      }
      await Promise.all(tokenPromises);

      const start = Date.now();
      const result = await triggerTokenCleanup();
      const duration = Date.now() - start;

      expect(result.removed).toBeGreaterThanOrEqual(100);
      expect(duration).toBeLessThan(5000);
    });
  });
});
