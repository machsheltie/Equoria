/**
 * GET /api/v1/horses and GET /api/v1/horses/:id — mare-only breeding
 * cooldown, in-foal state, the pending stud request and the stud listing
 * fields (Equoria-q4uem.9 slice 6; UX-proposal backend need 1).
 *
 * Owner rulings (Stacey): the mare cooldown is 7 game days, mares only (S-Q1
 * 2026-10-16; 2026-10-02 "cooldowns mares only") — a stallion never shows one;
 * game days are Eastern calendar days (2026-10-09). S-Q4 (2026-10-16): a mare
 * with a pending private request may not be bred elsewhere — her OWNER sees
 * which request is holding her. Stud mode and fee are the player's listing
 * (2026-10-02 / 2026-10-15).
 *
 * Characterizes the existing list and detail shapes first: fields are only
 * ADDED. Real DB, real HTTP, scoped fail-loud fixtures.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate, gameDayIndex, startOfGameDayIndex } from '../../../utils/gameTime.mjs';

const PREFIX = 'TestFixture-q4uem9-listfields';
const FIVE_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000;

// The list item's keys before slice 6 (HORSE_LIST_SELECT + withHealth +
// withAgeYears + the latest-event/championship fields): all must remain.
const EXISTING_LIST_KEYS = [
  'id',
  'name',
  'age',
  'dateOfBirth',
  'sex',
  'healthStatus',
  'lastFedDate',
  'lastVettedDate',
  'forSale',
  'salePrice',
  'breedId',
  'userId',
  'createdAt',
  'speed',
  'stamina',
  'agility',
  'balance',
  'precision',
  'intelligence',
  'boldness',
  'flexibility',
  'obedience',
  'focus',
  'strength',
  'endurance',
  'totalEarnings',
  'trait',
  'temperament',
  'titlePoints',
  'currentTitle',
  'breedingValueBoost',
  'phenotype',
  'breed',
  'user',
  'feedHealth',
  'vetHealth',
  'displayedHealth',
  'ageYears',
  'latestEvent',
  'firstPlaceWins',
  'hasChampionship',
];

const REAL_EXCEPT_DATE = [
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

function tag() {
  return randomBytes(6).toString('hex');
}

describe('horse list/detail: mare cooldown, in-foal, pending stud request, stud fields (Equoria-q4uem.9 slice 6)', () => {
  const cleanup = createCleanupTracker();
  const userIds = [];
  const horseIds = [];
  let breed;

  async function player(role, userRole = 'user') {
    const suffix = tag();
    const user = await prisma.user.create({
      data: {
        username: `${PREFIX}-${role}-${suffix}`,
        email: `${PREFIX}-${role}-${suffix}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'List',
        lastName: role,
        money: 1000,
        role: userRole,
      },
    });
    userIds.push(user.id);
    return {
      user,
      token: () => generateTestToken({ id: user.id, email: user.email, role: userRole }),
    };
  }

  async function horse({ ownerId, sex, ...overrides }) {
    const h = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${PREFIX}-${sex}-${tag()}`,
        sex,
        dateOfBirth: new Date(Date.now() - FIVE_YEARS_MS),
        age: 5,
        breedId: breed.id,
        userId: ownerId,
        healthStatus: 'Good',
        lastFedDate: new Date(),
        ...overrides,
      },
    });
    horseIds.push(h.id);
    return h;
  }

  async function pendingRequest(sire, dam, mareOwner, stallionOwner) {
    return prisma.breedingRecord.create({
      data: {
        kind: 'PRIVATE_STUD',
        status: 'PENDING',
        fee: 250,
        sireId: sire.id,
        damId: dam.id,
        mareOwnerId: mareOwner.id,
        stallionOwnerId: stallionOwner.id,
        sireName: sire.name,
        damName: dam.name,
        mareOwnerName: mareOwner.username,
        stallionOwnerName: stallionOwner.username,
      },
    });
  }

  function list(token, query = '') {
    return request(app).get(`/api/v1/horses?limit=500${query}`).set('Authorization', `Bearer ${token}`);
  }

  function detail(token, id) {
    return request(app).get(`/api/v1/horses/${id}`).set('Authorization', `Bearer ${token}`);
  }

  beforeEach(async () => {
    userIds.length = 0;
    horseIds.length = 0;
    breed = await prisma.breed.upsert({
      where: { name: 'Thoroughbred' },
      update: {},
      create: { name: 'Thoroughbred', description: 'Shared test breed' },
    });
    const ids = horseIds;
    const users = userIds;
    cleanup.add(
      () =>
        prisma.breedingRecord.deleteMany({
          where: { OR: [{ damId: { in: ids } }, { sireId: { in: ids } }] },
        }),
      'breedingRecords',
    );
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: ids } } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: users } } }), 'users');
  });

  afterEach(async () => {
    jest.useRealTimers();
    await cleanup.run();
  });

  it('characterization: every existing list key is still present, and the new fields are added', async () => {
    const owner = await player('owner');
    const mare = await horse({ ownerId: owner.user.id, sex: 'Mare' });

    const res = await list(owner.token());

    expect(res.status).toBe(200);
    const item = res.body.data.find(h => h.id === mare.id);
    expect(Object.keys(item)).toEqual(expect.arrayContaining(EXISTING_LIST_KEYS));
    expect(item).toEqual(
      expect.objectContaining({
        studStatus: 'Not at Stud',
        studFee: 0,
        breedingCooldownEndsAt: null,
        inFoal: false,
        pendingStudRequest: null,
      }),
    );
  });

  it('stud fields come from the player-set listing (studStatus, studFee; a legacy null fee reads 0)', async () => {
    const owner = await player('owner');
    const priv = await horse({ ownerId: owner.user.id, sex: 'Stallion', studStatus: 'At Private Stud', studFee: 500 });
    const legacy = await horse({
      ownerId: owner.user.id,
      sex: 'Stallion',
      studStatus: 'At Public Stud',
      studFee: null,
    });

    const res = await list(owner.token());

    const byId = new Map(res.body.data.map(h => [h.id, h]));
    expect(byId.get(priv.id)).toMatchObject({ studStatus: 'At Private Stud', studFee: 500 });
    expect(byId.get(legacy.id)).toMatchObject({ studStatus: 'At Public Stud', studFee: 0 });
  });

  describe('mare-only cooldown on the Eastern calendar, at an evening instant (20:00-24:00 ET)', () => {
    const EVENING = new Date('2026-10-17T00:30:00.000Z'); // 2026-10-16 20:30 EDT

    it('a mare bred 3 Eastern days ago shows the end of her 7-day cooldown; one bred 7 days ago and a stallion show none', async () => {
      jest.useFakeTimers({ now: EVENING, doNotFake: REAL_EXCEPT_DATE });
      const owner = await player('owner');
      const recent = await horse({ ownerId: owner.user.id, sex: 'Mare', lastBredDate: gameCalendarDate(EVENING, -3) });
      const done = await horse({ ownerId: owner.user.id, sex: 'Mare', lastBredDate: gameCalendarDate(EVENING, -7) });
      const stallion = await horse({
        ownerId: owner.user.id,
        sex: 'Stallion',
        lastBredDate: gameCalendarDate(EVENING, -1),
      });

      const res = await list(owner.token());
      const one = await detail(owner.token(), recent.id);

      expect(res.status).toBe(200);
      const byId = new Map(res.body.data.map(h => [h.id, h]));
      // 00:00 Eastern on bred-day + 7 = the start of the 4th Eastern day after EVENING's Eastern date.
      const expected = startOfGameDayIndex(gameDayIndex(EVENING) + 4).toISOString();
      expect(byId.get(recent.id).breedingCooldownEndsAt).toBe(expected);
      expect(byId.get(done.id).breedingCooldownEndsAt).toBeNull();
      expect(byId.get(stallion.id).breedingCooldownEndsAt).toBeNull();
      expect(one.status).toBe(200);
      expect(one.body.data.breedingCooldownEndsAt).toBe(expected);
    });
  });

  // Review round: boundary, DST and a cross-check against the real breeding
  // guard. Every expected instant is written by hand (not computed with the
  // production gameTime helpers), so the expectation is independent of them.
  // lastBredDate is a date-only column: a calendar date stored as UTC midnight.
  describe('cooldown boundary, DST and the real guard (hand-written instants)', () => {
    const calendarDate = ymd => new Date(`${ymd}T00:00:00.000Z`);

    async function cooldownOf(owner, mare) {
      const res = await detail(owner.token(), mare.id);
      expect(res.status).toBe(200);
      return res.body.data.breedingCooldownEndsAt;
    }

    async function breed(owner, stallion, mare) {
      const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${owner.token()}`] });
      return request(app)
        .post('/api/v1/horses/foals')
        .set('Authorization', `Bearer ${owner.token()}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ sireId: stallion.id, damId: mare.id });
    }

    it('at 00:05 EDT on 2026-10-20: bred 6 Eastern days ago -> ends 2026-10-21 00:00 EDT; bred exactly 7 days ago -> null', async () => {
      jest.useFakeTimers({ now: new Date('2026-10-20T04:05:00.000Z'), doNotFake: REAL_EXCEPT_DATE });
      const owner = await player('owner');
      const six = await horse({ ownerId: owner.user.id, sex: 'Mare', lastBredDate: calendarDate('2026-10-14') });
      const seven = await horse({ ownerId: owner.user.id, sex: 'Mare', lastBredDate: calendarDate('2026-10-13') });

      expect(await cooldownOf(owner, six)).toBe('2026-10-21T04:00:00.000Z');
      expect(await cooldownOf(owner, seven)).toBeNull();
    });

    it('spring forward (2026-03-08): bred 2026-03-04 -> ends 2026-03-11 00:00 EDT = 04:00Z', async () => {
      jest.useFakeTimers({ now: new Date('2026-03-08T12:00:00.000Z'), doNotFake: REAL_EXCEPT_DATE });
      const owner = await player('owner');
      const mare = await horse({ ownerId: owner.user.id, sex: 'Mare', lastBredDate: calendarDate('2026-03-04') });

      expect(await cooldownOf(owner, mare)).toBe('2026-03-11T04:00:00.000Z');
    });

    it('fall back (2026-11-01): bred 2026-10-26 -> ends 2026-11-02 00:00 EST = 05:00Z', async () => {
      jest.useFakeTimers({ now: new Date('2026-11-01T12:00:00.000Z'), doNotFake: REAL_EXCEPT_DATE });
      const owner = await player('owner');
      const mare = await horse({ ownerId: owner.user.id, sex: 'Mare', lastBredDate: calendarDate('2026-10-26') });

      expect(await cooldownOf(owner, mare)).toBe('2026-11-02T05:00:00.000Z');
    });

    it.each([
      ['23:55 EDT, the last minutes of day 6', '2026-10-20T03:55:00.000Z', false],
      ['00:05 EDT, the first minutes of day 7', '2026-10-20T04:05:00.000Z', true],
    ])(
      'cross-check at %s: the field is null exactly when the real breeding guard allows the breeding',
      async (_label, instant, guardAllows) => {
        jest.useFakeTimers({ now: new Date(instant), doNotFake: REAL_EXCEPT_DATE });
        const owner = await player('owner');
        const stallion = await horse({ ownerId: owner.user.id, sex: 'Stallion' });
        const mare = await horse({ ownerId: owner.user.id, sex: 'Mare', lastBredDate: calendarDate('2026-10-13') });

        const field = await cooldownOf(owner, mare);
        const bred = await breed(owner, stallion, mare);

        expect(field === null).toBe(guardAllows);
        expect(bred.status).toBe(guardAllows ? 200 : 400);
        if (!guardAllows) {
          expect(field).toBe('2026-10-20T04:00:00.000Z');
          expect(bred.body.message).toMatch(/breeding cooldown/);
        }
      },
    );
  });

  it('inFoal reflects the pregnancy; the detail endpoint carries the same new fields', async () => {
    const owner = await player('owner');
    const pregnant = await horse({ ownerId: owner.user.id, sex: 'Mare', inFoalSinceDate: new Date() });

    const listed = await list(owner.token());
    const one = await detail(owner.token(), pregnant.id);

    expect(listed.body.data.find(h => h.id === pregnant.id).inFoal).toBe(true);
    expect(one.body.data).toMatchObject({ inFoal: true, breedingCooldownEndsAt: null, pendingStudRequest: null });
  });

  it("S-Q4: the mare's OWNER sees which pending request holds her, in the list and the detail", async () => {
    const owner = await player('owner');
    const studOwner = await player('studOwner');
    const mare = await horse({ ownerId: owner.user.id, sex: 'Mare' });
    const stud = await horse({
      ownerId: studOwner.user.id,
      sex: 'Stallion',
      studStatus: 'At Private Stud',
      studFee: 250,
    });
    const pending = await pendingRequest(stud, mare, owner.user, studOwner.user);

    const listed = await list(owner.token());
    const one = await detail(owner.token(), mare.id);

    const expected = { id: pending.id, stallionId: stud.id, stallionName: stud.name };
    expect(listed.body.data.find(h => h.id === mare.id).pendingStudRequest).toEqual(expected);
    expect(one.body.data.pendingStudRequest).toEqual(expected);
  });

  it("owner-only: another player gets neither the mare's detail nor her in a list; an admin listing her sees no request details", async () => {
    const owner = await player('owner');
    const studOwner = await player('studOwner');
    const admin = await player('admin', 'admin');
    const mare = await horse({ ownerId: owner.user.id, sex: 'Mare' });
    const stud = await horse({
      ownerId: studOwner.user.id,
      sex: 'Stallion',
      studStatus: 'At Private Stud',
      studFee: 250,
    });
    await pendingRequest(stud, mare, owner.user, studOwner.user);

    const strangerDetail = await detail(studOwner.token(), mare.id);
    const strangerList = await list(studOwner.token(), `&userId=${owner.user.id}`);
    const adminList = await list(admin.token(), `&userId=${owner.user.id}`);

    expect(strangerDetail.status).toBe(404);
    expect(strangerList.body.data.some(h => h.id === mare.id)).toBe(false);
    const seenByAdmin = adminList.body.data.find(h => h.id === mare.id);
    expect(seenByAdmin).toBeDefined();
    expect(seenByAdmin.pendingStudRequest).toBeNull();
  });
});
