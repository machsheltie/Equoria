/**
 * Notification retention prune — one prune per burst, same retained set
 * (Equoria-y9n99, ADR-007).
 *
 * Every notification insert used to fire its own retention prune, so a
 * producer writing many notifications for one user in a row (a payroll loop,
 * several placements in one show) ran one redundant prune per row. The prune
 * is now coalesced per user. This suite proves, on the real database:
 *   (a) a burst of N post-insert prune requests for one user runs the prune
 *       once, and exactly once more when they arrive while one is running;
 *   (b) after a burst the user keeps exactly the newest
 *       notificationRetentionCount rows, the same rows the per-insert prune
 *       kept;
 *   (c) a burst through the public createNotification path ends at the cap
 *       with the newest rows kept.
 *
 * No mocks: real Prisma, real notificationService. The counting prune in (a)
 * is the real pruneOldNotifications with a counter around it.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../packages/database/prismaClient.mjs';
import {
  notificationRetentionCount,
  createNotification,
  createPruneScheduler,
  finalizeNotificationAfterCommit,
  pruneOldNotifications,
  settleScheduledPrunes,
} from '../utils/notificationService.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

const BURST = 60;

describe('notification prune coalescing (Equoria-y9n99)', () => {
  const tag = randomBytes(5).toString('hex');
  const createdUserIds = [];
  const cleanup = createCleanupTracker();
  let user;

  const makeUser = async label => {
    const u = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `TestFixture-y9n99-${label}-${tag}`,
        email: `TestFixture-y9n99-${label}-${tag}@example.com`,
        password: await bcrypt.hash('NotifPrune123!', 1),
        firstName: 'TestFixture',
        lastName: 'Y9n99',
        dateOfBirth: new Date('1990-01-01'),
      },
    });
    createdUserIds.push(u.id);
    return u;
  };

  // Rows with strictly increasing createdAt so "newest" is unambiguous.
  const seed = async (userId, count, startIdx, baseTime) => {
    await prisma.notification.createMany({
      data: Array.from({ length: count }, (_, i) => ({
        userId,
        type: 'statGain',
        payload: { idx: startIdx + i },
        createdAt: new Date(baseTime + (startIdx + i) * 1000),
      })),
    });
  };

  const retainedIdx = async userId => {
    const rows = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { payload: true },
    });
    return rows.map(r => r.payload.idx);
  };

  const range = (from, to) => Array.from({ length: to - from }, (_, i) => from + i);

  beforeAll(async () => {
    user = await makeUser('burst');
  }, 30000);

  afterAll(async () => {
    await settleScheduledPrunes();
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: createdUserIds } } }), 'notification');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }), 'user');
    await cleanup.run();
  }, 30000);

  it('runs one prune for a burst of requests made together, keeping the newest rows', async () => {
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    const total = notificationRetentionCount + BURST;
    await seed(user.id, total, 0, Date.now() - total * 1000);

    let runs = 0;
    const scheduler = createPruneScheduler(async userId => {
      runs += 1;
      return pruneOldNotifications(userId);
    });
    for (let i = 0; i < BURST; i += 1) {
      scheduler.schedule(user.id);
    }
    await scheduler.settle();

    expect(runs).toBe(1);
    expect(await retainedIdx(user.id)).toEqual(range(BURST, total));
  }, 60000);

  it('runs exactly one more prune for requests arriving while a prune is running', async () => {
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    const baseTime = Date.now() - 10 * (notificationRetentionCount + BURST) * 1000;
    await seed(user.id, notificationRetentionCount, 0, baseTime);

    // The first prune is held open until the whole burst has been written, so
    // every request in the burst arrives while a prune is running.
    let runs = 0;
    let started;
    let release;
    const firstStarted = new Promise(resolve => {
      started = resolve;
    });
    const burstWritten = new Promise(resolve => {
      release = resolve;
    });
    const scheduler = createPruneScheduler(async userId => {
      runs += 1;
      if (runs === 1) {
        started();
        await burstWritten;
      }
      return pruneOldNotifications(userId);
    });

    // A producer loop: each insert commits, then asks for a prune.
    scheduler.schedule(user.id);
    await firstStarted;
    for (let i = 0; i < BURST; i += 1) {
      await seed(user.id, 1, notificationRetentionCount + i, baseTime);
      scheduler.schedule(user.id);
    }
    release();
    await scheduler.settle();

    expect(runs).toBe(2);
    const total = notificationRetentionCount + BURST;
    expect(await retainedIdx(user.id)).toEqual(range(BURST, total));
  }, 60000);

  it('finalizeNotificationAfterCommit bursts end with the same newest rows kept', async () => {
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    const total = notificationRetentionCount + BURST;
    await seed(user.id, total, 0, Date.now() - total * 1000);

    for (let i = 0; i < BURST; i += 1) {
      finalizeNotificationAfterCommit(user.id, 'statGain', { idx: i });
    }
    await settleScheduledPrunes();

    expect(await retainedIdx(user.id)).toEqual(range(BURST, total));
  }, 60000);

  it('a createNotification burst ends at the cap with the burst rows kept', async () => {
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    // Seeded rows are older than anything createNotification writes now.
    await seed(user.id, notificationRetentionCount, 0, Date.now() - 3600 * 1000);

    for (let i = 0; i < BURST; i += 1) {
      await createNotification(user.id, 'statGain', { idx: 1000 + i });
    }
    await settleScheduledPrunes();

    const kept = await retainedIdx(user.id);
    expect(kept).toHaveLength(notificationRetentionCount);
    expect(kept).toEqual(expect.arrayContaining(range(1000, 1000 + BURST)));
    expect(kept.slice(0, notificationRetentionCount - BURST)).toEqual(range(BURST, notificationRetentionCount));
  }, 60000);
});
