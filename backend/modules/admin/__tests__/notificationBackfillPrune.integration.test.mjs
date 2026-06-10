/**
 * 🔔 Notification backfill-prune admin endpoint — real-DB integration
 * (Equoria-uuhq1, ADR-007 notification-retention-policy one-time backfill)
 *
 * ADR-007 (Equoria-1fqs) implemented prune-on-write: a user's notifications
 * are only trimmed to the 100-row cap when that user's NEXT notification is
 * created. Accounts that never insert again keep their pre-cap backlog. This
 * admin-only endpoint iterates ALL users and calls the existing
 * `pruneOldNotifications(userId)` for each to reclaim storage immediately.
 *
 * This suite proves:
 *   (a) an over-cap user (>100 notifications) is reduced to exactly 100,
 *   (b) an at/under-cap user is left untouched,
 *   (c) the endpoint is admin-gated: a non-admin gets 403, and a non-admin's
 *       backlog is NOT pruned.
 *
 * No mocks. Real Express app, real DB, real JWT, real CSRF. SCOPED
 * TestFixture- fixtures with id-scoped cleanup — never a bare deleteMany.
 */

import request from 'supertest';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf, attachCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { NOTIFICATION_RETENTION_COUNT } from '../../../utils/notificationService.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ROUTE = '/api/v1/admin/notifications/backfill-prune';
const ORIGIN = 'http://localhost:3000';

describe('Admin notification backfill-prune (Equoria-uuhq1)', () => {
  let adminUser;
  let overCapUser;
  let underCapUser;
  let nonAdminUser;
  let adminToken;
  let nonAdminToken;
  const ts = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;
  const createdUserIds = [];
  const cleanup = createCleanupTracker();

  // Counts chosen so the over-cap user has a clear excess and the under-cap
  // user is comfortably below the 100 cap.
  const OVER_CAP_TOTAL = NOTIFICATION_RETENTION_COUNT + 25; // 125
  const UNDER_CAP_TOTAL = 7;
  const NON_ADMIN_TOTAL = NOTIFICATION_RETENTION_COUNT + 15; // 115

  const makeUser = async overrides => {
    const pw = await bcrypt.hash('AdminPassword123!', 1);
    const u = await prisma.user.create({
      data: {
        username: `TestFixture-uuhq1-${overrides.tag}-${ts}`,
        email: `TestFixture-uuhq1-${overrides.tag}-${ts}@example.com`,
        password: pw,
        firstName: 'TestFixture',
        lastName: 'Uuhq1',
        dateOfBirth: new Date('1990-01-01'),
        role: overrides.role ?? 'user',
      },
    });
    createdUserIds.push(u.id);
    return u;
  };

  const seedNotifications = async (userId, count) => {
    const baseTime = Date.now();
    const rows = Array.from({ length: count }, (_, idx) => ({
      userId,
      type: 'stat_gain',
      payload: { idx, tag: 'TestFixture-uuhq1' },
      createdAt: new Date(baseTime + idx * 1000),
    }));
    await prisma.notification.createMany({ data: rows });
  };

  beforeAll(async () => {
    adminUser = await makeUser({ tag: 'admin', role: 'admin' });
    overCapUser = await makeUser({ tag: 'over' });
    underCapUser = await makeUser({ tag: 'under' });
    nonAdminUser = await makeUser({ tag: 'nonadmin' });

    adminToken = generateTestToken({ id: adminUser.id, role: 'admin' });
    nonAdminToken = generateTestToken({ id: nonAdminUser.id, role: 'user' });

    await seedNotifications(overCapUser.id, OVER_CAP_TOTAL);
    await seedNotifications(underCapUser.id, UNDER_CAP_TOTAL);
    await seedNotifications(nonAdminUser.id, NON_ADMIN_TOTAL);
  }, 120000);

  afterAll(async () => {
    // Scoped, fail-loud cleanup (Equoria-1ohys) — delete notifications + users
    // by the ids this suite created. Never a bare deleteMany against the
    // canonical DB. Notifications (FK to user) before users.
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: createdUserIds } } }), 'notification');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }), 'user');
    await cleanup.run();
  }, 120000);

  it('non-admin user is blocked with 403 and its backlog is NOT pruned', async () => {
    const csrf = await fetchCsrf(app, { origin: ORIGIN });
    const res = await attachCsrf(
      request(app).post(ROUTE).set('Origin', ORIGIN).set('Authorization', `Bearer ${nonAdminToken}`),
      csrf,
    ).send({});

    expect(res.status).toBe(403);

    // The non-admin's over-cap backlog must be untouched by the rejected call.
    const count = await prisma.notification.count({ where: { userId: nonAdminUser.id } });
    expect(count).toBe(NON_ADMIN_TOTAL);
  });

  it('admin call prunes over-cap user to exactly the cap and leaves under-cap user untouched', async () => {
    const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${adminToken}`] });
    const res = await attachCsrf(
      request(app).post(ROUTE).set('Origin', ORIGIN).set('Authorization', `Bearer ${adminToken}`),
      csrf,
    ).send({ batchSize: 500 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({});
    // The endpoint scans all users; the summary must be at least our 4 fixtures.
    expect(res.body.data.usersProcessed).toBeGreaterThanOrEqual(4);

    // (a) over-cap user reduced to exactly the cap.
    const overCount = await prisma.notification.count({ where: { userId: overCapUser.id } });
    expect(overCount).toBe(NOTIFICATION_RETENTION_COUNT);

    // The surviving rows are the NEWEST ones (oldest deleted).
    const survivors = await prisma.notification.findMany({
      where: { userId: overCapUser.id },
      orderBy: { createdAt: 'asc' },
      select: { payload: true },
    });
    expect(survivors).toHaveLength(NOTIFICATION_RETENTION_COUNT);
    // We seeded OVER_CAP_TOTAL rows idx 0..(OVER_CAP_TOTAL-1); deleting the
    // oldest 25 leaves idx 25..124 as the survivors.
    expect(survivors[0].payload).toMatchObject({ idx: OVER_CAP_TOTAL - NOTIFICATION_RETENTION_COUNT });
    expect(survivors[survivors.length - 1].payload).toMatchObject({ idx: OVER_CAP_TOTAL - 1 });

    // (b) under-cap user untouched.
    const underCount = await prisma.notification.count({ where: { userId: underCapUser.id } });
    expect(underCount).toBe(UNDER_CAP_TOTAL);
  }, 120000);
});
