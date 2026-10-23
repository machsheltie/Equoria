/**
 * Player-hosted shows: ten a week, enforced on the server (Equoria-whfj4).
 *
 * Owner ruling 2026-10-23 (q60): a basic player creates at most ten shows per
 * game-time (Eastern) week; the limit is one lookup that premium tiers will
 * extend. Real routes, real database; two parallel creates must never make an
 * eleventh.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { startOfShowWeek, weeklyShowCreationLimit } from '../rules/showHostingLimits.mjs';

const uid = () => randomBytes(5).toString('hex');
const cleanup = createCleanupTracker();
let user;
let token;
let csrf;

async function createShowRequest(name) {
  return request(app)
    .post('/api/v1/shows/create')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .set('Authorization', `Bearer ${token}`)
    .send({ name, discipline: 'Dressage' });
}

function showRow(name, createdAt) {
  const closeDate = new Date(createdAt.getTime() + 7 * 24 * 3600 * 1000);
  return {
    name,
    discipline: 'Dressage',
    levelMin: 1,
    levelMax: 999,
    entryFee: 0,
    prize: 0,
    runDate: closeDate,
    openDate: createdAt,
    closeDate,
    createdAt,
    createdByUserId: user.id,
  };
}

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `wklimit-${uid()}@test.com`,
      username: `wkl${uid()}`,
      password: 'irrelevant-hash',
      firstName: 'Week',
      lastName: 'Limit',
      money: 50000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  cleanup.add(async () => {
    await prisma.show.deleteMany({ where: { createdByUserId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }, 'weeklyLimitUser');
}, 30000);

afterAll(() => cleanup.run(), 30000);

describe('the weekly limit is one lookup, on game time', () => {
  it('lets a basic player create ten shows a week', () => {
    expect(weeklyShowCreationLimit({ role: 'user' })).toBe(10);
  });

  it('starts the week Monday 00:00 Eastern, not UTC', () => {
    // Sunday 25 Oct 2026, 23:30 EDT is already Monday in UTC.
    expect(startOfShowWeek(new Date('2026-10-26T03:30:00Z')).toISOString()).toBe('2026-10-19T04:00:00.000Z');
    // Monday 26 Oct 2026, 00:30 EDT begins the next week.
    expect(startOfShowWeek(new Date('2026-10-26T04:30:00Z')).toISOString()).toBe('2026-10-26T04:00:00.000Z');
  });
});

describe('POST /api/v1/shows/create enforces ten per game-time week', () => {
  it('refuses an eleventh show in the week, with nothing debited or created', async () => {
    const weekStart = startOfShowWeek(new Date());
    // Ten already created this week (just after the week began).
    await prisma.show.createMany({
      data: Array.from({ length: 10 }, (_, i) =>
        showRow(`TestFixture-wk-full-${uid()}-${i}`, new Date(weekStart.getTime() + 1000 + i)),
      ),
    });
    const before = await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } });

    const res = await createShowRequest(`TestFixture-wk-11th-${uid()}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('weeklyShowLimitReached');
    const after = await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } });
    expect(after.money).toBe(before.money);
    expect(await prisma.show.count({ where: { createdByUserId: user.id } })).toBe(10);
  });

  it('does not count shows from last week', async () => {
    await prisma.show.deleteMany({ where: { createdByUserId: user.id } });
    const weekStart = startOfShowWeek(new Date());
    await prisma.show.createMany({
      data: Array.from({ length: 10 }, (_, i) =>
        showRow(`TestFixture-wk-last-${uid()}-${i}`, new Date(weekStart.getTime() - 1000 - i)),
      ),
    });

    const res = await createShowRequest(`TestFixture-wk-new-${uid()}`);

    expect(res.status).toBe(201);
  });

  it('two parallel creates can never make an eleventh', async () => {
    await prisma.show.deleteMany({ where: { createdByUserId: user.id } });
    const weekStart = startOfShowWeek(new Date());
    await prisma.show.createMany({
      data: Array.from({ length: 9 }, (_, i) =>
        showRow(`TestFixture-wk-nine-${uid()}-${i}`, new Date(weekStart.getTime() + 1000 + i)),
      ),
    });

    const results = await Promise.all([0, 1, 2].map(i => createShowRequest(`TestFixture-wk-race-${uid()}-${i}`)));

    expect(results.map(r => r.status).sort()).toEqual([201, 409, 409]);
    expect(await prisma.show.count({ where: { createdByUserId: user.id } })).toBe(10);
  });
});
