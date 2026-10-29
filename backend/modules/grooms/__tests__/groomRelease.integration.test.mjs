/**
 * The groom Release button (Equoria-hwboq) — owner ruling 2026-10-29 (q285).
 *
 *   - One click (POST /api/v1/grooms/:id/release) releases one of the player's own
 *     grooms: no confirmation step, no receipt (no notification), nothing charged.
 *   - The released groom goes to the grooms-for-hire pool like every other leaver: at
 *     its current level with its reveals intact (q177), its engagement closed, its
 *     active assignments ended; another player can see it in the pool.
 *   - Another stable's groom, or one that is not the caller's, is 404 and untouched.
 *   - Owner ruling 2026-10-29 (q299): release works any time, like riders, not only
 *     when the roster is full — a player with one groom can release it.
 *
 * Real app, real DB; id-scoped fail-loud cleanup.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';
import { recordStaffShowsTx } from '../../../services/staffGrowthService.mjs';

const ORIGIN = 'http://localhost:3000';
const prefix = 'TestFixture-hwboq-release';
const tag = () => randomBytes(4).toString('hex');
const userIds = [];
const groomIds = [];
const horseIds = [];
const cleanup = createCleanupTracker();

async function makeUser() {
  const t = tag();
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `${prefix}-${t}`,
      email: `${prefix}-${t}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Groom',
      lastName: 'Release',
      money: 5000,
      settings: {},
    },
  });
  userIds.push(user.id);
  return { user, token: generateTestToken({ id: user.id, email: user.email, role: 'user' }) };
}

async function call(method, path, token, body) {
  const csrf = await fetchCsrf(app);
  const agent = request(app);
  const req = agent[method](path)
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken);
  return body ? req.send(body) : req;
}

async function hireGroom(user, token) {
  const marketplaceId = `mkt-${tag()}`;
  await prisma.staffMarketplaceState.create({
    data: {
      userId: user.id,
      staffType: 'groom',
      refreshCount: 0,
      offers: [
        {
          marketplaceId,
          firstName: 'TestFixture',
          lastName: `hwboq-${tag()}`,
          specialty: 'general',
          skillLevel: 'novice',
          starLevel: 'rookie',
          weeklyFee: 100,
          personality: 'gentle',
          experience: 1,
          sessionRate: 15,
          bio: 'hire fixture',
          availability: true,
        },
      ],
    },
  });
  const res = await call('post', '/api/v1/groom-marketplace/hire', token, { marketplaceId });
  expect(res.status).toBe(201);
  const groom = await prisma.groom.findFirst({ where: { userId: user.id }, orderBy: { id: 'desc' } });
  groomIds.push(groom.id);
  return groom;
}

beforeAll(() => {
  cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { groomId: { in: groomIds } } }), 'groomAssignment');
  cleanup.add(() => prisma.groomEngagement.deleteMany({ where: { groomId: { in: groomIds } } }), 'groomEngagement');
  cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: groomIds } } }), 'groom');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horse');
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: userIds } } }), 'notification');
  cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }), 'userTransaction');
  cleanup.add(
    () => prisma.staffMarketplaceState.deleteMany({ where: { userId: { in: userIds } } }),
    'staffMarketplaceState',
  );
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'user');
});

afterAll(() => cleanup.run(), 60000);

describe('groom Release button (Equoria-hwboq, q285)', () => {
  it('releases the groom to the hiring pool at its level with its reveals, ends its care, and sends no receipt', async () => {
    const { user, token } = await makeUser();
    const { token: otherToken } = await makeUser();
    const groom = await hireGroom(user, token);
    // 100 shows in all: Novice, 3 items shown (q279).
    await prisma.$transaction(tx => recordStaffShowsTx(tx, 'groom', groom.id, 100));
    const before = await prisma.groomGrowthProfile.findUnique({ where: { groomId: groom.id } });
    const horse = await createTestHorse(
      prisma,
      {
        name: `${prefix}-horse-${tag()}`,
        sex: 'Mare',
        age: 6,
        dateOfBirth: birthDateForAge(6),
        userId: user.id,
      },
      horseIds,
    );
    await prisma.groomAssignment.create({
      data: { foalId: horse.id, groomId: groom.id, userId: user.id, isActive: true },
    });
    const moneyBefore = (await prisma.user.findUnique({ where: { id: user.id } })).money;
    const noticesBefore = await prisma.notification.count({ where: { userId: user.id } });

    const res = await call('post', `/api/v1/grooms/${groom.id}/release`, token);

    expect(res.status).toBe(200);
    const released = await prisma.groom.findUnique({ where: { id: groom.id } });
    expect(released).toMatchObject({ userId: null, retired: false, starLevel: 'novice' });
    expect((await prisma.groomGrowthProfile.findUnique({ where: { groomId: groom.id } })).items).toEqual(before.items);
    const engagement = await prisma.groomEngagement.findFirst({
      where: { groomId: groom.id },
      orderBy: { id: 'desc' },
    });
    expect(engagement.endReason).toBe('released');
    expect(engagement.endedAt).not.toBeNull();
    expect(await prisma.groomAssignment.count({ where: { groomId: groom.id, isActive: true } })).toBe(0);
    // No receipt and no charge.
    expect(await prisma.notification.count({ where: { userId: user.id } })).toBe(noticesBefore);
    expect((await prisma.user.findUnique({ where: { id: user.id } })).money).toBe(moneyBefore);

    const pool = await call('get', '/api/v1/groom-marketplace/free-agents?limit=100', otherToken);
    expect(pool.status).toBe(200);
    const listed = pool.body.data.grooms.find(g => g.id === groom.id);
    expect(listed).toBeDefined();
    expect(listed.starLevel).toBe('novice');
    expect(listed.growth.revealedCount).toBe(3);
  }, 60000);

  it('releases the only groom of a player whose roster has plenty of room (q299)', async () => {
    const { user, token } = await makeUser();
    const groom = await hireGroom(user, token);
    expect(await prisma.groom.count({ where: { userId: user.id, retired: false } })).toBe(1);

    expect((await call('post', `/api/v1/grooms/${groom.id}/release`, token)).status).toBe(200);
    expect(await prisma.groom.count({ where: { userId: user.id, retired: false } })).toBe(0);
  }, 60000);

  it("refuses another stable's groom with 404 and leaves it on that stable", async () => {
    const { user, token } = await makeUser();
    const { token: otherToken } = await makeUser();
    const groom = await hireGroom(user, token);

    const res = await call('post', `/api/v1/grooms/${groom.id}/release`, otherToken);

    expect(res.status).toBe(404);
    expect((await prisma.groom.findUnique({ where: { id: groom.id } })).userId).toBe(user.id);
  }, 60000);
});
