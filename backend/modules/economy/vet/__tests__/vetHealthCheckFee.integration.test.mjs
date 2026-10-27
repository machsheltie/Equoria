/**
 * vetHealthCheckFee.integration.test.mjs
 *
 * Owner ruling 2026-10-27: a health check always restores a horse to Excellent,
 * and its fee is 100 for each health level below Excellent: Very Good 100,
 * Good 200, Fair 300, Bad 400. A horse already Excellent is refused (409) and
 * charged nothing. The server computes the fee from the horse's vet health.
 *
 * Old contract: the General Health Check was a flat 100 whatever the horse's
 * health, so a Bad horse could not be brought back to Excellent at the
 * advertised price.
 *
 * Real DB, real routes via supertest, scoped fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../../app.mjs';
import prisma from '../../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../../utils/gameTime.mjs';

const ORIGIN = 'http://localhost:3000';
const cleanup = createCleanupTracker();

let user;
let token;
const horses = {};

const authed = req => req.set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);

async function book(horseId, serviceId = 'health-check') {
  const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  return authed(request(app).post('/api/v1/vet/book-appointment'))
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ horseId, serviceId });
}

const money = async () => (await prisma.user.findUnique({ where: { id: user.id } })).money;
const setMoney = amount => prisma.user.update({ where: { id: user.id }, data: { money: amount } });
const dayOf = date => date.toISOString().slice(0, 10);

// Days since the last vet visit that land in each vet-health band.
const levels = [
  { key: 'veryGood', word: 'Very Good', days: 10, fee: 100 },
  { key: 'good', word: 'Good', days: 18, fee: 200 },
  { key: 'fair', word: 'Fair', days: 25, fee: 300 },
  { key: 'bad', word: 'Bad', days: 40, fee: 400 },
];

async function makeHorse(key, data) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-VetFee-${key}-${randomBytes(3).toString('hex')}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-01-01'),
      age: 6,
      userId: user.id,
      healthStatus: 'Excellent',
      lastFedDate: new Date(),
      ...data,
    },
  });
  horses[key] = horse;
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), `horse ${key}`);
}

beforeAll(async () => {
  const tag = randomBytes(8).toString('hex');
  user = await prisma.user.create({
    data: {
      email: `vetfee-${tag}@test.com`,
      username: `vetfee${tag}`,
      password: 'irrelevant-hash',
      firstName: 'Vet',
      lastName: 'Fee',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: user.id } }), 'ledger');

  for (const level of levels) {
    await makeHorse(level.key, { lastVettedDate: gameCalendarDate(new Date(), -level.days) });
  }
  await makeHorse('excellent', { lastVettedDate: gameCalendarDate() });
  await makeHorse('brokeBad', { lastVettedDate: gameCalendarDate(new Date(), -40) });
  await makeHorse('hungryBad', {
    lastVettedDate: gameCalendarDate(new Date(), -40),
    lastFedDate: new Date('2024-01-01'),
  });
  // Horses were registered first, so they are cleaned before the user (FK Restrict).
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

describe('GET /vet/services describes the health check honestly', () => {
  it('says it restores Excellent health, with a base cost of 100 and a per-level note', async () => {
    const res = await authed(request(app).get('/api/v1/vet/services'));
    const check = res.body.data.find(s => s.id === 'health-check');
    expect(check.description).toBe('Restores a horse to Excellent health');
    expect(check.cost).toBe(100);
    expect(check.costNote).toMatch(/100/);
    expect(JSON.stringify(check)).not.toMatch(/for a week/i);
  });
});

describe('GET /vet/horses shows each horse its vet health and fee', () => {
  it('lists the vet health word and the health check fee per horse', async () => {
    const res = await authed(request(app).get('/api/v1/vet/horses'));
    const byId = Object.fromEntries(res.body.data.map(h => [h.id, h]));
    for (const level of levels) {
      expect(byId[horses[level.key].id]).toMatchObject({
        vetHealth: level.word,
        healthCheckFee: level.fee,
        vetted: false,
      });
    }
    expect(byId[horses.excellent.id]).toMatchObject({
      vetHealth: 'Excellent',
      healthCheckFee: null,
      vetted: true,
    });
  });
});

describe('General Health Check fee by vet-health level', () => {
  it.each(levels)('$word costs $fee, restores Excellent, and the ledger carries that fee', async ({ key, fee }) => {
    const before = await money();
    const res = await book(horses[key].id);
    expect(res.status).toBe(200);
    expect(res.body.data.cost).toBe(fee);
    expect(res.body.data.horse.vetHealth).toBe('Excellent');
    expect(before - (await money())).toBe(fee);

    const row = await prisma.horse.findUnique({ where: { id: horses[key].id } });
    expect(dayOf(row.lastVettedDate)).toBe(dayOf(gameCalendarDate()));
    expect(row.healthStatus).toBe('Excellent');

    const entries = await prisma.userTransaction.findMany({
      where: { userId: user.id, metadata: { path: ['horseId'], equals: horses[key].id } },
    });
    expect(entries.map(t => `${t.category}:${Number(t.amount)}`).sort()).toEqual([
      `vetService:${fee}`,
      `vetServiceBurn:${fee}`,
    ]);
  });

  it('refuses a horse already Excellent with 409 and charges nothing', async () => {
    const before = await money();
    const res = await book(horses.excellent.id);
    expect(res.status).toBe(409);
    expect(await money()).toBe(before);
  });

  it('refuses a second check right after the first, charging nothing', async () => {
    const before = await money();
    expect((await book(horses.bad.id)).status).toBe(409);
    expect(await money()).toBe(before);
  });

  it('sends feedHealth and displayedHealth so a hungry horse can be told to eat', async () => {
    const res = await book(horses.hungryBad.id);
    expect(res.status).toBe(200);
    expect(res.body.data.horse.vetHealth).toBe('Excellent');
    expect(res.body.data.horse.feedHealth).toBe('Bad');
    expect(res.body.data.horse.displayedHealth).toBe('Good');
  });

  it('checks funds against the per-horse fee and leaves the horse unvetted', async () => {
    await setMoney(399);
    const res = await book(horses.brokeBad.id);
    expect(res.status).toBe(400);
    expect(res.body.data.required).toBe(400);
    expect(res.body.message).toMatch(/400/);
    expect(await money()).toBe(399);
    const row = await prisma.horse.findUnique({ where: { id: horses.brokeBad.id } });
    expect(dayOf(row.lastVettedDate)).toBe(dayOf(gameCalendarDate(new Date(), -40)));

    await setMoney(400);
    expect((await book(horses.brokeBad.id)).status).toBe(200);
    expect(await money()).toBe(0);
  });
});
