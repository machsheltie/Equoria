/**
 * Notification backfill-prune in bounded, resumable steps — real DB
 * (Equoria-ctyia, follow-up of Equoria-uuhq1 / ADR-007).
 *
 * The backfill used to walk every user inside one HTTP request, which would
 * hit the 30s request timeout once the user table grew. It now stops taking
 * new users after a time budget and returns a cursor to resume from; each
 * user's prune is its own short transaction. This suite proves:
 *   (a) a scan forced to stop after every user, resumed by cursor over more
 *       users than one batch, ends with every user at the same retained set
 *       as one uninterrupted scan (newest 100 kept, under-cap untouched);
 *   (b) an uninterrupted scan over several batches gives the same result;
 *   (c) the admin endpoint accepts and returns the cursor, and rejects a bad
 *       one.
 *
 * Fixture users get ids under a per-run prefix that sorts after every uuid,
 * so a scan started at the prefix sees only this suite's users. No mocks.
 */
import request from 'supertest';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf, attachCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { notificationRetentionCount, pruneNotificationsForAllUsers } from '../../../utils/notificationService.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ROUTE = '/api/v1/admin/notifications/backfill-prune';
const ORIGIN = 'http://localhost:3000';
const CAP = notificationRetentionCount;

describe('Admin notification backfill-prune, chunked and resumable (Equoria-ctyia)', () => {
  const tag = randomBytes(5).toString('hex');
  const prefix = `zzzzctyia${tag}`;
  // Per-user seeded totals, in id order: three over the cap, two under.
  const fixtures = [
    { suffix: 'a', total: CAP + 30 },
    { suffix: 'b', total: CAP + 1 },
    { suffix: 'c', total: CAP + 150 },
    { suffix: 'd', total: 7 },
    { suffix: 'e', total: 0 },
  ];
  const expectedRowsPruned = 30 + 1 + 150;
  const createdUserIds = [];
  const cleanup = createCleanupTracker();
  let adminToken;

  const makeUser = async (label, extra = {}) => {
    const u = await prisma.user.create({
      data: {
        ...extra,
        username: `TestFixture-ctyia-${label}-${tag}`,
        email: `TestFixture-ctyia-${label}-${tag}@example.com`,
        password: await bcrypt.hash('AdminPassword123!', 1),
        firstName: 'TestFixture',
        lastName: 'Ctyia',
        dateOfBirth: new Date('1990-01-01'),
      },
    });
    createdUserIds.push(u.id);
    return u;
  };

  const fixtureId = suffix => `${prefix}${suffix}`;

  const reseed = async () => {
    const ids = fixtures.map(f => fixtureId(f.suffix));
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    const baseTime = Date.now() - 3600 * 1000;
    const rows = fixtures.flatMap(f =>
      Array.from({ length: f.total }, (_, idx) => ({
        userId: fixtureId(f.suffix),
        type: 'statGain',
        payload: { idx, tag: 'TestFixture-ctyia' },
        createdAt: new Date(baseTime + idx * 1000),
      })),
    );
    await prisma.notification.createMany({ data: rows });
  };

  const expectRetainedSet = async () => {
    for (const f of fixtures) {
      const rows = await prisma.notification.findMany({
        where: { userId: fixtureId(f.suffix) },
        orderBy: { createdAt: 'asc' },
        select: { payload: true },
      });
      const firstKept = Math.max(0, f.total - CAP);
      const expected = Array.from({ length: f.total - firstKept }, (_, i) => firstKept + i);
      expect({ user: f.suffix, kept: rows.map(r => r.payload.idx) }).toEqual({
        user: f.suffix,
        kept: expected,
      });
    }
  };

  const postAsAdmin = async body => {
    const csrf = await fetchCsrf(app, {
      origin: ORIGIN,
      extraCookies: [`accessToken=${adminToken}`],
    });
    return attachCsrf(
      request(app).post(ROUTE).set('Origin', ORIGIN).set('Authorization', `Bearer ${adminToken}`),
      csrf,
    ).send(body);
  };

  beforeAll(async () => {
    const admin = await makeUser('admin', { role: 'admin' });
    adminToken = generateTestToken({ id: admin.id, role: 'admin' });
    for (const f of fixtures) {
      await makeUser(f.suffix, { id: fixtureId(f.suffix) });
    }
  }, 60000);

  afterAll(async () => {
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: createdUserIds } } }), 'notification');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }), 'user');
    await cleanup.run();
  }, 60000);

  it('a scan stopped after every user and resumed by cursor ends with the same retained set', async () => {
    await reseed();
    const totals = { usersProcessed: 0, usersPruned: 0, rowsPruned: 0 };
    let cursor = prefix;
    let calls = 0;
    do {
      const step = await pruneNotificationsForAllUsers({ batchSize: 2, cursor, timeBudgetMs: 0 });
      calls += 1;
      totals.usersProcessed += step.usersProcessed;
      totals.usersPruned += step.usersPruned;
      totals.rowsPruned += step.rowsPruned;
      cursor = step.nextCursor;
      expect(calls).toBeLessThanOrEqual(fixtures.length + 1);
    } while (cursor !== null);

    // One user per call under a zero budget, plus the final empty call.
    expect(calls).toBe(fixtures.length + 1);
    expect(totals).toEqual({
      usersProcessed: fixtures.length,
      usersPruned: 3,
      rowsPruned: expectedRowsPruned,
    });
    await expectRetainedSet();
  }, 120000);

  it('an uninterrupted scan over several batches ends with the same retained set', async () => {
    await reseed();
    const result = await pruneNotificationsForAllUsers({ batchSize: 2, cursor: prefix });
    expect(result).toEqual({
      usersProcessed: fixtures.length,
      usersPruned: 3,
      rowsPruned: expectedRowsPruned,
      nextCursor: null,
    });
    await expectRetainedSet();
  }, 120000);

  it('the admin endpoint resumes from a cursor and reports when it is done', async () => {
    await reseed();
    const res = await postAsAdmin({ batchSize: 2, cursor: prefix });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      usersProcessed: fixtures.length,
      usersPruned: 3,
      rowsPruned: expectedRowsPruned,
      nextCursor: null,
      done: true,
    });
    await expectRetainedSet();
  }, 120000);

  it('the admin endpoint rejects a cursor that is not a string', async () => {
    const res = await postAsAdmin({ cursor: 42 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  }, 60000);
});
