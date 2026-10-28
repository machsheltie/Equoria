/**
 * vetServicePicker.integration.test.mjs (Equoria-7dmzp)
 *
 * Owner ruling 2026-10-26 (q78): the Veterinarian offers exactly two services,
 * General Health Check (100 coins) and Genetic Testing (500 coins), each acting
 * on one horse chosen from a dropdown. A horse already vetted, or already
 * tested, is greyed out; a horse too old (21+, retired) is not listed at all.
 *
 * "Already vetted" follows the health bands (utils/horseHealth.getVetHealth):
 * a horse whose vet health is still Excellent (vetted within the last 7 Eastern
 * game days) gains nothing from another check, so it is greyed out.
 *
 * Old contract: four services (150/350/200/120), a vet visit could be booked
 * again at once, no genetics test existed. Owner ruling 2026-10-27 supersedes
 * the flat 100: the health check costs 100 per vet-health level below Excellent
 * (see vetHealthCheckFee.integration.test.mjs); the "due" fixture here was last
 * vetted in 2024, so its vet health is Bad and the check costs 400.
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
const startMoney = 5000;
const cleanup = createCleanupTracker();

let user;
let token;
const horses = {};

const authed = req => req.set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);

async function book(horseId, serviceId) {
  const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  return authed(request(app).post('/api/v1/vet/book-appointment'))
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ horseId, serviceId });
}

const money = async () => (await prisma.user.findUnique({ where: { id: user.id } })).money;
const day = date => date.toISOString().slice(0, 10);

async function makeHorse(key, data) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-VetPicker-${key}-${randomBytes(3).toString('hex')}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-01-01'),
      age: 6,
      userId: user.id,
      healthStatus: 'Excellent',
      lastVettedDate: new Date('2024-01-01'),
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
      emailVerified: true,
      email: `vetpick-${tag}@test.com`,
      username: `vetpick${tag}`,
      password: 'irrelevant-hash',
      firstName: 'Vet',
      lastName: 'Picker',
      money: startMoney,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: user.id } }), 'ledger');

  await makeHorse('due', {});
  await makeHorse('vettedToday', { lastVettedDate: gameCalendarDate() });
  await makeHorse('tested', { colorGeneticsTested: true });
  await makeHorse('retired', { age: 21 });
  await makeHorse('old20', { age: 20 });
  // Equoria-1re40: a 21-year-old mare still in foal (owner ruling 2026-10-23).
  await makeHorse('retiredInFoal', { age: 21, inFoalSinceDate: new Date() });
  // Horses were registered first, so they are cleaned before the user (FK Restrict).
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

describe('GET /vet/services lists exactly the two owner-set services', () => {
  it('returns General Health Check at 100 and Genetic Testing at 500, nothing else', async () => {
    const res = await authed(request(app).get('/api/v1/vet/services'));
    expect(res.status).toBe(200);
    expect(res.body.data.map(s => [s.id, s.name, s.cost, s.actionLabel])).toEqual([
      ['health-check', 'General Health Check', 100, 'Vet Horse'],
      ['genetic-testing', 'Genetic Testing', 500, 'Run Panel'],
    ]);
  });
});

describe('GET /vet/horses feeds the two dropdowns', () => {
  it('lists every horse under 21 and no retired horse, with its vetted and tested state', async () => {
    const res = await authed(request(app).get('/api/v1/vet/horses'));
    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.body.data.map(h => [h.id, h]));
    expect(byId[horses.retired.id]).toBeUndefined();
    expect(byId[horses.old20.id]).toBeDefined();
    expect(byId[horses.due.id]).toMatchObject({ vetted: false, geneticsTested: false });
    expect(byId[horses.vettedToday.id]).toMatchObject({ vetted: true, geneticsTested: false });
    expect(byId[horses.tested.id]).toMatchObject({ vetted: false, geneticsTested: true });
  });
});

describe('GET /vet/horses lists a 21-year-old mare still in foal (Equoria-1re40)', () => {
  // Owner ruling 2026-10-23: a mare in foal when she turns 21 can still be vetted,
  // because the foal depends on it. Her vet care is read as if she were not retired:
  // last vetted in 2024, so Bad, and the health check costs 400.
  it('lists her with her real vet health and its fee, not as retired', async () => {
    const res = await authed(request(app).get('/api/v1/vet/horses'));
    expect(res.status).toBe(200);
    const mare = res.body.data.find(h => h.id === horses.retiredInFoal.id);
    expect(mare).toMatchObject({ vetted: false, vetHealth: 'Bad', healthCheckFee: 400 });
  });
});

describe('General Health Check', () => {
  it('charges the Bad-health fee (400) and records today as the vet date', async () => {
    const before = await money();
    const res = await book(horses.due.id, 'health-check');
    expect(res.status).toBe(200);
    expect(before - (await money())).toBe(400);
    const row = await prisma.horse.findUnique({ where: { id: horses.due.id } });
    expect(day(row.lastVettedDate)).toBe(day(gameCalendarDate()));
    const ledger = await prisma.userTransaction.findFirst({
      where: { userId: user.id, category: 'vetService' },
    });
    expect(Number(ledger.amount)).toBe(400);
  });

  it('now lists that horse as vetted, and refuses a second paid check without charging', async () => {
    const list = await authed(request(app).get('/api/v1/vet/horses'));
    expect(list.body.data.find(h => h.id === horses.due.id).vetted).toBe(true);
    const before = await money();
    const res = await book(horses.due.id, 'health-check');
    expect(res.status).toBe(409);
    expect(await money()).toBe(before);
  });

  it('refuses a horse already vetted today without charging', async () => {
    const before = await money();
    expect((await book(horses.vettedToday.id, 'health-check')).status).toBe(409);
    expect(await money()).toBe(before);
  });
});

describe('Genetic Testing', () => {
  it('charges 500 and marks the horse tested, leaving the vet date alone', async () => {
    const before = await money();
    const res = await book(horses.old20.id, 'genetic-testing');
    expect(res.status).toBe(200);
    expect(before - (await money())).toBe(500);
    const row = await prisma.horse.findUnique({ where: { id: horses.old20.id } });
    expect(row.colorGeneticsTested).toBe(true);
    expect(day(row.lastVettedDate)).toBe('2024-01-01');
  });

  it('lists a tested horse as tested and refuses a second panel without charging', async () => {
    const before = await money();
    const res = await book(horses.tested.id, 'genetic-testing');
    expect(res.status).toBe(409);
    expect(await money()).toBe(before);
  });

  it('refuses for lack of funds and leaves the horse untested', async () => {
    await prisma.user.update({ where: { id: user.id }, data: { money: 499 } });
    const res = await book(horses.due.id, 'genetic-testing');
    expect(res.status).toBe(400);
    expect(await money()).toBe(499);
    const row = await prisma.horse.findUnique({ where: { id: horses.due.id } });
    expect(row.colorGeneticsTested).toBe(false);
  });
});

describe('the retired services are gone', () => {
  it.each(['treatment', 'dental', 'vaccination'])('%s is not a service any more', async id => {
    expect((await book(horses.due.id, id)).status).toBe(404);
  });
});
