/**
 * The host's weekly count and the coded create refusals (Equoria-oey96.13).
 *
 * The Create Show screen says "3 of 10 shows this week" from the server, and
 * names an unaffordable prize or a taken name from a refusal code, never from
 * the server's wording. Real routes, real database.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { startOfShowWeek } from '../rules/showHostingLimits.mjs';

const uid = () => randomBytes(5).toString('hex');
const cleanup = createCleanupTracker();
let user;
let token;
let csrf;

const authed = req =>
  req
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .set('Authorization', `Bearer ${token}`);

const createShowRequest = body => authed(request(app).post('/api/v1/shows/create')).send(body);
const hostingRequest = () => authed(request(app).get('/api/v1/shows/hosting'));

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `hoststat-${uid()}@test.com`,
      username: `hst${uid()}`,
      password: 'irrelevant-hash',
      firstName: 'Host',
      lastName: 'Status',
      money: 1000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  cleanup.add(async () => {
    await prisma.show.deleteMany({ where: { createdByUserId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }, 'hostingStatusUser');
}, 30000);

afterAll(() => cleanup.run(), 30000);

describe('GET /api/v1/shows/hosting', () => {
  it('reports zero hosted and the weekly limit for a new host', async () => {
    const res = await hostingRequest();
    expect(res.status).toBe(200);
    expect(res.body.data.hostedThisWeek).toBe(0);
    expect(res.body.data.weeklyLimit).toBe(10);
    expect(res.body.data.weekStartedAt).toBe(startOfShowWeek(new Date()).toISOString());
  });

  it('counts a show created this week', async () => {
    const created = await createShowRequest({
      name: `TestFixture-host-${uid()}`,
      discipline: 'Dressage',
      entryFee: 5,
    });
    expect(created.status).toBe(201);

    const res = await hostingRequest();
    expect(res.body.data.hostedThisWeek).toBe(1);
  });

  it('does not count last week or another host', async () => {
    const other = await prisma.user.create({
      data: {
        email: `hostother-${uid()}@test.com`,
        username: `hso${uid()}`,
        password: 'irrelevant-hash',
        firstName: 'Other',
        lastName: 'Host',
      },
    });
    cleanup.add(async () => {
      await prisma.show.deleteMany({ where: { createdByUserId: other.id } });
      await prisma.user.delete({ where: { id: other.id } });
    }, 'otherHost');
    const now = new Date();
    const lastWeek = new Date(startOfShowWeek(now).getTime() - 1000);
    const row = (createdByUserId, createdAt) => ({
      name: `TestFixture-hostrow-${uid()}`,
      discipline: 'Dressage',
      levelMin: 1,
      levelMax: 999,
      entryFee: 0,
      prize: 0,
      runDate: new Date(createdAt.getTime() + 7 * 24 * 3600 * 1000),
      openDate: createdAt,
      closeDate: new Date(createdAt.getTime() + 7 * 24 * 3600 * 1000),
      createdAt,
      createdByUserId,
    });
    await prisma.show.createMany({ data: [row(user.id, lastWeek), row(other.id, now)] });

    const res = await hostingRequest();
    expect(res.body.data.hostedThisWeek).toBe(1);
  });

  it('requires a signed-in player', async () => {
    const res = await request(app).get('/api/v1/shows/hosting');
    expect([401, 403]).toContain(res.status);
  });
});

describe('POST /api/v1/shows/create refusal codes', () => {
  it('names an unaffordable prize with insufficientFunds, debiting nothing', async () => {
    const before = await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } });
    const res = await createShowRequest({
      name: `TestFixture-host-poor-${uid()}`,
      discipline: 'Dressage',
      entryFee: 100_000,
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('insufficientFunds');
    const after = await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } });
    expect(after.money).toBe(before.money);
  });

  it('names a taken show name with showNameTaken', async () => {
    const name = `TestFixture-host-dup-${uid()}`;
    const first = await createShowRequest({ name, discipline: 'Dressage', entryFee: 0 });
    expect(first.status).toBe(201);
    const second = await createShowRequest({ name, discipline: 'Dressage', entryFee: 0 });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('showNameTaken');
  });
});
