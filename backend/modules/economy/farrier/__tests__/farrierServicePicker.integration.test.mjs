/**
 * farrierServicePicker.integration.test.mjs (Equoria-zz14s)
 *
 * Owner ruling 2026-10-26 (q78): the Farrier offers one selectable service for
 * now, Basic Shoes at 50 coins (the list is data; more shoe types come later),
 * acting on a horse chosen from a dropdown. A horse shod within the week is
 * greyed out; a retired horse (21+) is not listed. The action itself is the
 * existing weekly "Shoe horse" (Equoria-zmqzf): once a week, +1 random stat.
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

const ORIGIN = 'http://localhost:3000';
const cleanup = createCleanupTracker();
let user;
let token;
const horses = {};

const authed = req => req.set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);

async function shoe(body) {
  const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  return authed(request(app).post('/api/v1/farrier/shoe-horse'))
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

const money = async () => (await prisma.user.findUnique({ where: { id: user.id } })).money;

async function makeHorse(key, data) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-FarrierPicker-${key}-${randomBytes(3).toString('hex')}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-01-01'),
      age: 6,
      userId: user.id,
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
      email: `farrpick-${tag}@test.com`,
      username: `farrpick${tag}`,
      password: 'irrelevant-hash',
      firstName: 'Farrier',
      lastName: 'Picker',
      money: 1000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: user.id } }), 'ledger');
  await makeHorse('needs', {});
  await makeHorse('oldShoes', { lastShod: new Date(Date.now() - 9 * 86400000) });
  await makeHorse('shodYesterday', { lastShod: new Date(Date.now() - 86400000) });
  await makeHorse('retired', { age: 21 });
  // Horses were registered first, so they are cleaned before the user (FK Restrict).
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

describe('GET /farrier/shoe-types is data', () => {
  it('offers Basic Shoes at 50 and nothing else yet', async () => {
    const res = await authed(request(app).get('/api/v1/farrier/shoe-types'));
    expect(res.status).toBe(200);
    expect(res.body.data.map(s => [s.id, s.name, s.cost])).toEqual([['basic-shoes', 'Basic Shoes', 50]]);
  });
});

describe('GET /farrier/horses feeds the dropdown', () => {
  it('omits retired horses and flags the horses shod this week', async () => {
    const res = await authed(request(app).get('/api/v1/farrier/horses'));
    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.body.data.map(h => [h.id, h]));
    expect(byId[horses.retired.id]).toBeUndefined();
    expect(byId[horses.needs.id].shod).toBe(false);
    expect(byId[horses.oldShoes.id].shod).toBe(false);
    expect(byId[horses.shodYesterday.id].shod).toBe(true);
  });
});

describe('POST /farrier/shoe-horse with the Basic Shoes service', () => {
  it('charges 50, shoes the horse and then lists it as shod', async () => {
    const before = await money();
    const res = await shoe({ horseId: horses.needs.id, serviceId: 'basic-shoes' });
    expect(res.status).toBe(200);
    expect(before - (await money())).toBe(50);
    const list = await authed(request(app).get('/api/v1/farrier/horses'));
    expect(list.body.data.find(h => h.id === horses.needs.id).shod).toBe(true);
  });

  it('refuses a horse shod this week without charging', async () => {
    const before = await money();
    const res = await shoe({ horseId: horses.shodYesterday.id, serviceId: 'basic-shoes' });
    expect(res.status).toBe(409);
    expect(await money()).toBe(before);
  });

  it('still shoes when no serviceId is sent (the one service)', async () => {
    expect((await shoe({ horseId: horses.oldShoes.id })).status).toBe(200);
  });

  it('answers 404 for an unknown shoe type and charges nothing', async () => {
    const before = await money();
    expect((await shoe({ horseId: horses.needs.id, serviceId: 'gold-shoes' })).status).toBe(404);
    expect(await money()).toBe(before);
  });
});
