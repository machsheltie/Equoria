/**
 * horseResponsesLiveAge.integration.test.mjs (Equoria-6pbka)
 *
 * Follow-up to Equoria-66qkj. Defect: several responses passed the stored
 * `Horse.age` column through as `age`. The nightly birthday job (00:05 Eastern)
 * writes that column, so from Eastern midnight until it runs a horse whose
 * birthday it is answered yesterday's age while `dateOfBirth` (and `ageYears`
 * beside it) already said the new one: the horse list and detail, the horse
 * overview's `age`, the admin foal-development list, and the vet list and
 * booking (whose health words read the age without the birth date).
 *
 * Contract: every one of those responses uses the live age
 * (utils/horseAge.mjs liveHorseAgeYears; a birthday counts from 00:00 Eastern,
 * owner ruling 2026-10-09). With consistent data (stored age = dateOfBirth age)
 * the answer is today's age, as before.
 *
 * Real DB, real HTTP. Only `Date` is faked (to 23:30 / 00:30 Eastern around a
 * birthday); timers and the database are real. Id-scoped fail-loud cleanup.
 */

import { describe, it, expect, jest, beforeAll, afterAll, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { checkedInDeviceCookie } from '../../../tests/helpers/staffDeviceFixture.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { withAgeYears } from '../../../utils/horseAge.mjs';

const prefix = 'TestFixture-6pbka-liveAge';
const origin = 'http://localhost:3000';

const realExceptDate = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
];

// The birthday is 2026-07-26 (EDT). Birth dates are date-only.
const lateEve = new Date('2026-07-26T03:30:00.000Z'); // 23:30 EDT Jul 25
const afterMidnight = new Date('2026-07-26T04:30:00.000Z'); // 00:30 EDT Jul 26
const dob = iso => new Date(`${iso}T00:00:00.000Z`);
const fiveOnBirthday = dob('2026-06-21'); // + 35 days = Jul 26
const twoOnBirthday = dob('2026-07-12'); // + 14 days
const oneOnBirthday = dob('2026-07-19'); // + 7 days
const twentyOneOnBirthday = dob('2026-03-01'); // + 147 days

const tag = () => randomBytes(5).toString('hex');
const cleanup = createCleanupTracker();
const horseIds = [];
let breedId;
let owner;
let admin;

async function makeUser(label, role) {
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `${prefix}-${label}-${tag()}`,
      email: `${prefix}-${label}-${tag()}@example.com`.toLowerCase(),
      password: 'irrelevant-not-a-login-test',
      firstName: 'Live',
      lastName: 'Age',
      money: 5000,
      role,
    },
  });
  return user;
}

async function makeHorse(label, dateOfBirth, storedAge, extra = {}) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${prefix}-${label}-${tag()}`,
      sex: 'Mare',
      dateOfBirth,
      age: storedAge,
      breedId,
      userId: owner.id,
      healthStatus: 'Good',
      lastFedDate: lateEve,
      ...extra,
    },
  });
  horseIds.push(horse.id);
  return horse;
}

const at = instant => jest.useFakeTimers({ now: instant, doNotFake: realExceptDate });
const ownerToken = () => generateTestToken({ id: owner.id, email: owner.email, role: 'user' });
const get = (path, token) => request(app).get(path).set('Origin', origin).set('Authorization', `Bearer ${token}`);
const listed = async () => {
  const res = await get('/api/v1/horses?limit=200', ownerToken());
  expect(res.status).toBe(200);
  return new Map(res.body.data.map(h => [h.id, h]));
};

beforeAll(async () => {
  breedId = (await prisma.breed.findUnique({ where: { name: 'Thoroughbred' } })).id;
  owner = await makeUser('owner', 'user');
  admin = await makeUser('admin', 'admin');
  const users = [owner.id, admin.id];
  cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: owner.id } }), 'ledger');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: users } } }), 'users');
}, 60000);

afterEach(() => {
  jest.useRealTimers();
});

afterAll(() => cleanup.run(), 60000);

describe('GET /horses and GET /horses/:id carry the live age (Equoria-6pbka)', () => {
  it('at 23:30 Eastern the evening before the birthday the horse is still 4', async () => {
    at(lateEve);
    const horse = await makeHorse('list-eve', fiveOnBirthday, 4);

    const item = (await listed()).get(horse.id);
    const one = await get(`/api/v1/horses/${horse.id}`, ownerToken());

    expect(item).toMatchObject({ age: 4, ageYears: 4 });
    expect(one.body.data).toMatchObject({ age: 4, ageYears: 4 });
  });

  it('at 00:30 Eastern on the birthday, before the nightly job, the horse is 5', async () => {
    at(afterMidnight);
    const pending = await makeHorse('list-pending', fiveOnBirthday, 4);
    const aged = await makeHorse('list-aged', fiveOnBirthday, 5);

    const byId = await listed();
    const one = await get(`/api/v1/horses/${pending.id}`, ownerToken());

    expect(byId.get(pending.id)).toMatchObject({ age: 5, ageYears: 5 });
    expect(byId.get(aged.id)).toMatchObject({ age: 5, ageYears: 5 });
    expect(one.status).toBe(200);
    expect(one.body.data).toMatchObject({ age: 5, ageYears: 5 });
  });
});

describe('GET /horses/:id/overview age (Equoria-6pbka)', () => {
  it('reads 4 at 23:30 Eastern and 5 at 00:30 Eastern on the birthday', async () => {
    at(lateEve);
    const horse = await makeHorse('overview', fiveOnBirthday, 4);
    const eve = await get(`/api/v1/horses/${horse.id}/overview`, ownerToken());
    expect(eve.status).toBe(200);
    expect(eve.body.data).toMatchObject({ age: 4, ageYears: 4 });

    at(afterMidnight);
    const morning = await get(`/api/v1/horses/${horse.id}/overview`, ownerToken());
    expect(morning.status).toBe(200);
    expect(morning.body.data).toMatchObject({ age: 5, ageYears: 5 });
  });
});

describe('GET /admin/foals/development lists foals by their live age (Equoria-6pbka)', () => {
  async function foals(instant) {
    at(instant);
    const token = generateTestToken({ id: admin.id, email: admin.email, role: 'admin' });
    const device = await checkedInDeviceCookie(admin.id);
    const res = await get('/api/v1/admin/foals/development', token).set('Cookie', device);
    expect(res.status).toBe(200);
    return new Map(res.body.data.foals.map(f => [f.id, f]));
  }

  it('a foal turning 2 drops off at 00:30 Eastern; one turning 1 reads 1', async () => {
    at(lateEve);
    const turningTwo = await makeHorse('foal-two', twoOnBirthday, 1);
    const turningOne = await makeHorse('foal-one', oneOnBirthday, 0);

    const eve = await foals(lateEve);
    expect(eve.get(turningTwo.id)).toMatchObject({ age: 1 });
    expect(eve.get(turningOne.id)).toMatchObject({ age: 0 });

    const morning = await foals(afterMidnight);
    expect(morning.has(turningTwo.id)).toBe(false);
    expect(morning.get(turningOne.id)).toMatchObject({ age: 1 });
  });
});

describe('the vet reads the live age (Equoria-6pbka)', () => {
  const vetList = async () => {
    const res = await get('/api/v1/vet/horses', ownerToken());
    expect(res.status).toBe(200);
    return new Map(res.body.data.map(h => [h.id, h]));
  };

  it('a horse turning 21 leaves the vet list at 00:30 Eastern; an in-foal mare stays', async () => {
    at(lateEve);
    const turning = await makeHorse('vet-21', twentyOneOnBirthday, 20);
    const inFoal = await makeHorse('vet-21-foal', twentyOneOnBirthday, 20, { inFoalSinceDate: dob('2026-07-20') });

    const eve = await vetList();
    expect(eve.has(turning.id)).toBe(true);
    expect(eve.has(inFoal.id)).toBe(true);

    at(afterMidnight);
    const morning = await vetList();
    expect(morning.has(turning.id)).toBe(false);
    expect(morning.has(inFoal.id)).toBe(true);
  });

  it('the booking response answers like a mare the nightly job already aged to 21', async () => {
    at(afterMidnight);
    const pending = await makeHorse('vet-book-pending', twentyOneOnBirthday, 20, {
      inFoalSinceDate: dob('2026-07-20'),
      lastVettedDate: dob('2026-06-01'),
    });
    const aged = await makeHorse('vet-book-aged', twentyOneOnBirthday, 21, {
      inFoalSinceDate: dob('2026-07-20'),
      lastVettedDate: dob('2026-06-01'),
    });
    const token = ownerToken();
    const book = async horseId => {
      const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
      return request(app)
        .post('/api/v1/vet/book-appointment')
        .set('Origin', origin)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ horseId, serviceId: 'health-check' });
    };

    const pendingRes = await book(pending.id);
    const agedRes = await book(aged.id);

    expect(pendingRes.status).toBe(200);
    expect(agedRes.status).toBe(200);
    const pick = h => ({ vetHealth: h.vetHealth, feedHealth: h.feedHealth, displayedHealth: h.displayedHealth });
    expect(pick(pendingRes.body.data.horse)).toEqual(pick(agedRes.body.data.horse));
  });
});

describe('withAgeYears serializes the live age on the Eastern calendar (Equoria-6pbka)', () => {
  it('replaces a lagging stored age only from 00:00 Eastern on the birthday', () => {
    const horse = { id: 1, age: 4, dateOfBirth: fiveOnBirthday };
    expect(withAgeYears(horse, lateEve)).toMatchObject({ age: 4, ageYears: 4 });
    expect(withAgeYears(horse, afterMidnight)).toMatchObject({ age: 5, ageYears: 5 });
  });

  it('leaves a horse without an age field without one', () => {
    expect('age' in withAgeYears({ id: 1, dateOfBirth: fiveOnBirthday }, afterMidnight)).toBe(false);
  });
});
