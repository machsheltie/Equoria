/**
 * Farrier HTTP integration tests (owner ruling 2026-10-23, Equoria-zmqzf).
 *
 * OLD CONTRACT (Equoria-rr7): GET /farrier/services listed four tiered services
 * (trim 80 / shoeing 180 / corrective 320 / emergency 250) and
 * POST /farrier/book-service booked one, setting hoofCondition and
 * lastFarrierDate. NEW RULING: the farrier has one action, "Shoe horse", once a
 * week for 50 coins; it sets lastShod and gives +1 to one random stat.
 *
 * Real routes (supertest), real DB. Routes live under authRouter at /api/v1.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

// The twelve horse stats a shoeing can raise.
const horseStatKeys = [
  'speed',
  'stamina',
  'agility',
  'endurance',
  'strength',
  'precision',
  'balance',
  'intelligence',
  'focus',
  'obedience',
  'boldness',
  'flexibility',
];
const ORIGIN = 'http://localhost:3000';
// The owner-ruled price (2026-10-23), pinned here rather than imported.
const shoeingCost = 50;
const DAY = 24 * 60 * 60 * 1000;
const uid = () => `${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;

const userIds = [];
const horseIds = [];
const cleanup = createCleanupTracker();
cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }), 'ledger');
cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
afterAll(() => cleanup.run(), 30000);

async function makePlayer(money = 10000, horseData = {}) {
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `farrier-${uid()}@test.com`,
      username: `farrier${uid()}`,
      password: 'irrelevant-hash',
      firstName: 'Farrier',
      lastName: 'Tester',
      money,
    },
  });
  userIds.push(user.id);
  const horse = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `TestFixture-FarrierHorse-${uid()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2017-01-01'),
      age: 8,
      userId: user.id,
      healthStatus: 'Good',
      ...horseData,
    }),
  });
  horseIds.push(horse.id);
  const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  return { user, horse, token };
}

async function shoe(token, body) {
  const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  return request(app)
    .post('/api/v1/farrier/shoe-horse')
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

const statSum = h => horseStatKeys.reduce((n, k) => n + (h[k] ?? 0), 0);

describe('POST /api/v1/farrier/shoe-horse', () => {
  it('shoes the horse: 50 coins, lastShod set, +1 to exactly one stat, one ledger row', async () => {
    const { user, horse, token } = await makePlayer(1000);
    const before = await prisma.horse.findUnique({ where: { id: horse.id } });
    expect(before.lastShod).toBeNull();

    const res = await shoe(token, { horseId: horse.id });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.cost).toBe(shoeingCost);
    expect(res.body.data.remainingMoney).toBe(950);
    expect(res.body.data.horse.lastShod).toBeTruthy();
    expect(horseStatKeys).toContain(res.body.data.statGained);

    const after = await prisma.horse.findUnique({ where: { id: horse.id } });
    expect(after.lastShod).not.toBeNull();
    expect(statSum(after) - statSum(before)).toBe(1);
    expect(after[res.body.data.statGained] - before[res.body.data.statGained]).toBe(1);

    const money = await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } });
    expect(Number(money.money)).toBe(950);
    const rows = await prisma.userTransaction.findMany({ where: { userId: user.id, category: 'farrierService' } });
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].amount)).toBe(50);
  });

  it('refuses a second shoeing inside the week with 409 and charges nothing', async () => {
    const { user, horse, token } = await makePlayer(1000);
    expect((await shoe(token, { horseId: horse.id })).status).toBe(200);
    const mid = await prisma.horse.findUnique({ where: { id: horse.id } });

    const res = await shoe(token, { horseId: horse.id });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    const money = await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } });
    expect(Number(money.money)).toBe(950);
    const after = await prisma.horse.findUnique({ where: { id: horse.id } });
    expect(statSum(after)).toBe(statSum(mid));
    expect(after.lastShod).toEqual(mid.lastShod);
  });

  it('refuses at six days and allows again after eight (Eastern calendar days)', async () => {
    const six = await makePlayer(1000, { lastShod: new Date(Date.now() - 6 * DAY) });
    expect((await shoe(six.token, { horseId: six.horse.id })).status).toBe(409);

    const eight = await makePlayer(1000, { lastShod: new Date(Date.now() - 8 * DAY) });
    expect((await shoe(eight.token, { horseId: eight.horse.id })).status).toBe(200);
  });

  it('returns 400 and changes nothing when the player cannot afford it', async () => {
    const { user, horse, token } = await makePlayer(10);
    const res = await shoe(token, { horseId: horse.id });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Insufficient funds');
    const money = await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } });
    expect(Number(money.money)).toBe(10);
    const after = await prisma.horse.findUnique({ where: { id: horse.id } });
    expect(after.lastShod).toBeNull();
  });

  it('returns 404 for a horse the player does not own', async () => {
    const mine = await makePlayer(1000);
    const other = await makePlayer(1000);
    expect((await shoe(mine.token, { horseId: other.horse.id })).status).toBe(404);
    expect((await shoe(mine.token, { horseId: 999999999 })).status).toBe(404);
  });

  it('returns 400 for a missing horseId and 401 without auth', async () => {
    const { token } = await makePlayer(1000);
    expect((await shoe(token, {})).status).toBe(400);
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/farrier/shoe-horse')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: 1 });
    expect(res.status).toBe(401);
  });

  it('the old tiered service list and booking routes are gone', async () => {
    const { token, horse } = await makePlayer(1000);
    const list = await request(app)
      .get('/api/v1/farrier/services')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(404);
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const book = await request(app)
      .post('/api/v1/farrier/book-service')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, serviceId: 'hoof-trim' });
    expect(book.status).toBe(404);
  });
});
