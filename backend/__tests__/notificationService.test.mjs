import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../packages/database/prismaClient.mjs';
import {
  createNotification,
  pruneOldNotifications,
  NOTIFICATION_RETENTION_COUNT,
} from '../utils/notificationService.mjs';
import { createTestUser, cleanupTestData } from '../tests/helpers/testAuth.mjs';

describe('notificationService', () => {
  let user;

  beforeAll(async () => {
    const result = await createTestUser({
      username: `notif_svc_${Date.now()}`,
      email: `notif_svc_${Date.now()}@test.com`,
    });
    user = result.user;
  }, 30000);

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    await cleanupTestData();
  }, 30000);

  it('inserts a Notification row for a valid userId', async () => {
    const payload = { horseName: 'TestHorse', stat: 'speed', amount: 1, feedName: 'Grain' };
    await createNotification(user.id, 'stat_gain', payload);

    const rows = await prisma.notification.findMany({
      where: { userId: user.id, type: 'stat_gain' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].isRead).toBe(false);
    expect(rows[0].payload).toMatchObject(payload);
  });

  it('does NOT throw when given a non-existent userId', async () => {
    await expect(createNotification('00000000-0000-0000-0000-000000000000', 'stat_gain', {})).resolves.toBeUndefined();
  });

  // Equoria-1fqs: per-user Notification rows must be capped after each
  // insert so the table cannot grow unbounded. The newest N rows are
  // retained; older ones are deleted.
  describe('per-user retention cap (Equoria-1fqs)', () => {
    let capUser;

    beforeAll(async () => {
      const result = await createTestUser({
        username: `notif_cap_${Date.now()}`,
        email: `notif_cap_${Date.now()}@test.com`,
      });
      capUser = result.user;
    }, 30000);

    afterAll(async () => {
      await prisma.notification.deleteMany({ where: { userId: capUser.id } });
    }, 30000);

    it('pruneOldNotifications retains the newest N rows and deletes the rest', async () => {
      // Seed N+10 rows with synthetic createdAt timestamps so ordering is
      // deterministic regardless of insert speed.
      const total = NOTIFICATION_RETENTION_COUNT + 10;
      const baseTime = Date.now();
      const rows = Array.from({ length: total }, (_, idx) => ({
        userId: capUser.id,
        type: 'stat_gain',
        payload: { idx },
        createdAt: new Date(baseTime + idx * 1000),
      }));
      await prisma.notification.createMany({ data: rows });

      const deleted = await pruneOldNotifications(capUser.id);
      expect(deleted).toBe(10);

      const remaining = await prisma.notification.findMany({
        where: { userId: capUser.id },
        orderBy: { createdAt: 'asc' },
        select: { payload: true },
      });
      expect(remaining).toHaveLength(NOTIFICATION_RETENTION_COUNT);
      // The OLDEST surviving row is the one at index 10 (we deleted 0..9).
      expect(remaining[0].payload).toMatchObject({ idx: 10 });
      // The NEWEST surviving row is the one at index N+9.
      expect(remaining[remaining.length - 1].payload).toMatchObject({ idx: total - 1 });
    }, 60000);

    it('createNotification fires the prune after each insert (eventual cap)', async () => {
      // Reset the user to empty before this scenario.
      await prisma.notification.deleteMany({ where: { userId: capUser.id } });

      // Bulk-seed via prisma so the prune does not run during seeding.
      // Seed createdAt is in the PAST so the helper-created row below
      // is genuinely the newest by createdAt — otherwise the prune would
      // evict our sentinel.
      const baseTime = Date.now() - (NOTIFICATION_RETENTION_COUNT + 60) * 1000;
      const seedRows = Array.from({ length: NOTIFICATION_RETENTION_COUNT }, (_, idx) => ({
        userId: capUser.id,
        type: 'stat_gain',
        payload: { idx, seeded: true },
        createdAt: new Date(baseTime + idx * 1000),
      }));
      await prisma.notification.createMany({ data: seedRows });

      // Now insert one more via the production helper. The fire-and-forget
      // prune should bring the table back to N.
      await createNotification(capUser.id, 'stat_gain', { sentinel: true });

      // Wait for the prune microtask to settle. The prune is async so we
      // poll briefly rather than sleeping a fixed duration.
      let count = NOTIFICATION_RETENTION_COUNT + 1;
      for (let attempt = 0; attempt < 20 && count > NOTIFICATION_RETENTION_COUNT; attempt += 1) {
        await new Promise(r => setTimeout(r, 100));
        count = await prisma.notification.count({ where: { userId: capUser.id } });
      }
      expect(count).toBe(NOTIFICATION_RETENTION_COUNT);

      const newest = await prisma.notification.findFirst({
        where: { userId: capUser.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(newest?.payload).toMatchObject({ sentinel: true });
    }, 60000);
  });
});
