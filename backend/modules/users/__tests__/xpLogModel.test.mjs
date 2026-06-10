/**
 * XP Log Model Tests
 *
 * Tests the real logXpEvent / getUserXpEvents / getUserXpSummary /
 * getRecentXpEvents functions end-to-end against the real DB.
 * No mocks of any kind.
 *
 * Fixtures:
 *   - One User (test-user-xp-log) — created in beforeAll, deleted in afterAll
 *   - XpEvents created per-test via prisma.xpEvent.create or logXpEvent
 *
 * Cleanup: user.delete cascades to xpEvents (userId FK, onDelete: Cascade).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { logXpEvent, getUserXpEvents, getUserXpSummary, getRecentXpEvents } from '../services/xpLogModelService.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const USER_ID = 'test-user-xp-log';

// ─── date helpers ─────────────────────────────────────────────────────────────

const daysAgo = n => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

// ─── setup / teardown ─────────────────────────────────────────────────────────

// Fail-loud, scoped cleanup tracker (Equoria-cu3t5). The getRecentXpEvents
// test records its event id here so the suite-level afterAll deletes it by id
// instead of via a swallowed per-test finally-catch.
const cleanup = createCleanupTracker();
const createdEventIds = [];

beforeAll(async () => {
  await prisma.xpEvent.deleteMany({ where: { userId: USER_ID } });
  await prisma.user.deleteMany({ where: { id: USER_ID } });
  await prisma.user.create({
    data: {
      id: USER_ID,
      username: 'xpLogTestUser',
      email: 'xplog@example.com',
      password: 'TestPassword123!',
      firstName: 'Xp',
      lastName: 'Log',
      money: 1000,
    },
  });
  // Delete tracked events by id first, then the user (cascade covers the rest).
  cleanup.add(() => prisma.xpEvent.deleteMany({ where: { id: { in: createdEventIds } } }), 'xpEvents');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: USER_ID } }), 'user');
});

afterAll(() => cleanup.run());

// ─── logXpEvent ───────────────────────────────────────────────────────────────

describe('logXpEvent', () => {
  it('creates an XP event and returns the record', async () => {
    const result = await logXpEvent({
      userId: USER_ID,
      amount: 5,
      reason: 'Trained horse in Dressage',
    });

    expect(result.id).toBeDefined();
    expect(result.userId).toBe(USER_ID);
    expect(result.amount).toBe(5);
    expect(result.reason).toBe('Trained horse in Dressage');
    expect(result.timestamp).toBeTruthy(); // DateTime returned by Prisma

    // Verify the event was persisted to the DB
    const persisted = await prisma.xpEvent.findUnique({ where: { id: result.id } });
    expect(persisted).not.toBeNull();
    expect(persisted.amount).toBe(5);
  });

  it('creates an XP event with a negative amount', async () => {
    const result = await logXpEvent({
      userId: USER_ID,
      amount: -10,
      reason: 'XP penalty for rule violation',
    });

    expect(result.amount).toBe(-10);
    expect(result.userId).toBe(USER_ID);
  });

  it('throws when userId is missing', async () => {
    await expect(logXpEvent({ amount: 5, reason: 'Test reason' })).rejects.toThrow('User ID is required');
  });

  it('throws when amount is not a number', async () => {
    await expect(logXpEvent({ userId: USER_ID, amount: 'invalid', reason: 'Test reason' })).rejects.toThrow(
      'Amount must be a number',
    );
  });

  it('throws when reason is missing', async () => {
    await expect(logXpEvent({ userId: USER_ID, amount: 5 })).rejects.toThrow('Reason is required and must be a string');
  });
});

// ─── getUserXpEvents ──────────────────────────────────────────────────────────

describe('getUserXpEvents', () => {
  it('returns events ordered newest-first with pagination', async () => {
    const uid = 'test-user-xp-log-events';
    await prisma.user.deleteMany({ where: { id: uid } });
    await prisma.user.create({
      data: {
        id: uid,
        username: 'xpEventsUser',
        email: 'xpevents@example.com',
        password: 'TestPassword123!',
        firstName: 'Ev',
        lastName: 'User',
        money: 1000,
      },
    });

    try {
      // Create two events with distinct timestamps
      await prisma.xpEvent.create({
        data: { userId: uid, amount: 20, reason: '1st place in Racing', timestamp: daysAgo(2) },
      });
      await prisma.xpEvent.create({
        data: { userId: uid, amount: 5, reason: 'Training session', timestamp: daysAgo(1) },
      });

      const events = await getUserXpEvents(uid, { limit: 50, offset: 0 });

      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(2);
      // Ordered by timestamp desc: newest (daysAgo(1)) first
      expect(events[0].amount).toBe(5);
      expect(events[1].amount).toBe(20);
    } finally {
      await prisma.user.deleteMany({ where: { id: uid } });
    }
  });

  it('filters events by date range', async () => {
    const uid = 'test-user-xp-log-datefilter';
    await prisma.user.deleteMany({ where: { id: uid } });
    await prisma.user.create({
      data: {
        id: uid,
        username: 'xpDateFilterUser',
        email: 'xpdatefilter@example.com',
        password: 'TestPassword123!',
        firstName: 'Date',
        lastName: 'Filter',
        money: 1000,
      },
    });

    try {
      await prisma.xpEvent.create({
        data: { userId: uid, amount: 10, reason: 'Old event', timestamp: daysAgo(5) },
      });
      await prisma.xpEvent.create({
        data: { userId: uid, amount: 20, reason: 'Mid event', timestamp: daysAgo(3) },
      });
      await prisma.xpEvent.create({
        data: { userId: uid, amount: 30, reason: 'Recent event', timestamp: daysAgo(1) },
      });

      // Filter to only the mid event
      const events = await getUserXpEvents(uid, {
        startDate: daysAgo(4),
        endDate: daysAgo(2),
      });

      expect(events.length).toBe(1);
      expect(events[0].amount).toBe(20);
      expect(events[0].reason).toBe('Mid event');
    } finally {
      await prisma.user.deleteMany({ where: { id: uid } });
    }
  });
});

// ─── getUserXpSummary ─────────────────────────────────────────────────────────

describe('getUserXpSummary', () => {
  it('calculates totalGained, totalLost, netTotal, and totalEvents', async () => {
    const uid = 'test-user-xp-log-summary';
    await prisma.user.deleteMany({ where: { id: uid } });
    await prisma.user.create({
      data: {
        id: uid,
        username: 'xpSummaryUser',
        email: 'xpsummary@example.com',
        password: 'TestPassword123!',
        firstName: 'Sum',
        lastName: 'Mary',
        money: 1000,
      },
    });

    try {
      for (const [amount, reason] of [
        [20, 'Competition win'],
        [15, 'Training bonus'],
        [5, 'Daily login'],
        [-5, 'Rule violation'],
        [10, 'Quest reward'],
      ]) {
        await prisma.xpEvent.create({ data: { userId: uid, amount, reason } });
      }

      const summary = await getUserXpSummary(uid);

      expect(summary.totalGained).toBe(50); // 20 + 15 + 5 + 10
      expect(summary.totalLost).toBe(5); // abs(-5)
      expect(summary.netTotal).toBe(45); // 50 - 5
      expect(summary.totalEvents).toBe(5);
    } finally {
      await prisma.user.deleteMany({ where: { id: uid } });
    }
  });

  it('returns all-zero summary for user with no events', async () => {
    const uid = 'test-user-xp-log-empty';
    await prisma.user.deleteMany({ where: { id: uid } });
    await prisma.user.create({
      data: {
        id: uid,
        username: 'xpEmptyUser',
        email: 'xpempty@example.com',
        password: 'TestPassword123!',
        firstName: 'Em',
        lastName: 'Pty',
        money: 1000,
      },
    });

    try {
      const summary = await getUserXpSummary(uid);

      expect(summary.totalGained).toBe(0);
      expect(summary.totalLost).toBe(0);
      expect(summary.netTotal).toBe(0);
      expect(summary.totalEvents).toBe(0);
    } finally {
      await prisma.user.deleteMany({ where: { id: uid } });
    }
  });

  it('filters summary by date range', async () => {
    const uid = 'test-user-xp-log-sumdate';
    await prisma.user.deleteMany({ where: { id: uid } });
    await prisma.user.create({
      data: {
        id: uid,
        username: 'xpSumDateUser',
        email: 'xpsumdate@example.com',
        password: 'TestPassword123!',
        firstName: 'Sum',
        lastName: 'Date',
        money: 1000,
      },
    });

    try {
      await prisma.xpEvent.create({
        data: { userId: uid, amount: 100, reason: 'Old win', timestamp: daysAgo(10) },
      });
      await prisma.xpEvent.create({
        data: { userId: uid, amount: 25, reason: 'Recent win', timestamp: daysAgo(1) },
      });

      // Only the recent event falls within the last 3 days
      const summary = await getUserXpSummary(uid, daysAgo(3), new Date());

      expect(summary.totalGained).toBe(25);
      expect(summary.totalEvents).toBe(1);
    } finally {
      await prisma.user.deleteMany({ where: { id: uid } });
    }
  });
});

// ─── getRecentXpEvents ────────────────────────────────────────────────────────

describe('getRecentXpEvents', () => {
  it('returns events with user relation included', async () => {
    // Create an event for USER_ID and verify it appears in the global feed
    const event = await prisma.xpEvent.create({
      data: { userId: USER_ID, amount: 99, reason: 'Global feed test event' },
    });
    // Tracked for scoped, fail-loud cleanup in afterAll (Equoria-cu3t5).
    createdEventIds.push(event.id);

    const results = await getRecentXpEvents({ limit: 200, offset: 0 });

    expect(Array.isArray(results)).toBe(true);
    const found = results.find(e => e.id === event.id);
    expect(found).toBeDefined();
    expect(found.user).toBeDefined();
    expect(found.user.id).toBe(USER_ID);
    expect(found.user.username).toBe('xpLogTestUser');
  });

  it('uses default limit of 100 and returns an array', async () => {
    const results = await getRecentXpEvents();

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeLessThanOrEqual(100);
  });
});
