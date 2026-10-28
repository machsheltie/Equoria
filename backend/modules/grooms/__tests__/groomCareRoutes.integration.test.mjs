/**
 * Daily care: "groom horse", the care status and the not-yet-groomed list
 * (Equoria-l7xag, Equoria-35qwc, Equoria-08luj, Equoria-j765w.2, Equoria-gveno).
 *
 * Owner rulings under test:
 *  - grooming happens only when the player presses "groom horse", once per
 *    horse per Eastern game day, and needs a groom who can work (2026-10-20);
 *  - bond starts at 0 and each groom adds +5, capped at 100 (q87, 2026-10-26);
 *  - a foal (days 1..21 of life) follows one band schedule and the player picks
 *    one of the band's activities (q67, q70, 2026-10-26).
 *
 * Real DB, real HTTP, real auth, real CSRF, no mocks. Scoped fail-loud fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  createBarrierClient,
  holdLock,
  horseRowLock,
  raceBehindLock,
} from '../../../__tests__/helpers/rowLockBarrier.mjs';
import { gameCalendarDate, gameDayBounds } from '../../../utils/gameTime.mjs';

const ORIGIN = 'http://localhost:3000';
const runTag = `care-${randomBytes(4).toString('hex')}`;
const barrierClient = createBarrierClient();
const cleanup = createCleanupTracker();

const userIds = [];
const horseIds = [];
const groomIds = [];

async function makeUser(label) {
  const name = `${runTag}-${label}`;
  const user = await prisma.user.create({
    data: {
      email: `${name}@test.com`,
      username: name,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Care',
      lastName: 'Test',
      money: 1000,
    },
  });
  userIds.push(user.id);
  const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${token}`] });
  return { user, token, csrf };
}

/** A horse born `ageDays` Eastern days ago (0 = born today, day 1 of life). */
async function makeHorse(owner, label, { ageDays = 2100, bondScore = 0 } = {}) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${runTag}-${label}`,
      sex: 'Mare',
      dateOfBirth: gameCalendarDate(new Date(), -ageDays),
      age: Math.floor(ageDays / 7),
      bondScore,
      temperament: 'Calm',
      userId: owner.user.id,
    },
  });
  horseIds.push(horse.id);
  return horse;
}

async function makeGroom(owner, label, extra = {}) {
  const groom = await prisma.groom.create({
    data: {
      name: `${runTag}-${label}`,
      speciality: 'foalCare',
      skillLevel: 'intermediate',
      personality: 'patient',
      experience: 5,
      sessionRate: 20,
      userId: owner.user.id,
      isActive: true,
      ...extra,
    },
  });
  groomIds.push(groom.id);
  return groom;
}

async function assign(owner, horse, groom) {
  return prisma.groomAssignment.create({
    data: { foalId: horse.id, groomId: groom.id, userId: owner.user.id, isActive: true },
  });
}

const get = (owner, url) => request(app).get(url).set('Origin', ORIGIN).set('Authorization', `Bearer ${owner.token}`);

const post = (owner, url, body = {}) =>
  request(app)
    .post(url)
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${owner.token}`)
    .set('X-CSRF-Token', owner.csrf.csrfToken)
    .set('Cookie', owner.csrf.cookieHeader)
    .send(body);

const groomUrl = horse => `/api/v1/grooms/care/${horse.id}/groom`;
const statusUrl = horse => `/api/v1/grooms/care/${horse.id}`;

let alice;
let bob;

beforeAll(async () => {
  alice = await makeUser('alice');
  bob = await makeUser('bob');
  cleanup.add(() => prisma.groomInteraction.deleteMany({ where: { foalId: { in: horseIds } } }), 'groomInteraction');
  cleanup.add(() => prisma.foalActivity.deleteMany({ where: { foalId: { in: horseIds } } }), 'foalActivity');
  cleanup.add(() => prisma.groomHorseSynergy.deleteMany({ where: { horseId: { in: horseIds } } }), 'groomHorseSynergy');
  cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { foalId: { in: horseIds } } }), 'groomAssignment');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: groomIds } } }), 'grooms');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
}, 60000);

afterAll(async () => {
  try {
    await cleanup.run();
  } finally {
    await barrierClient.$disconnect();
  }
}, 60000);

describe('groom horse: a grown horse', () => {
  it('shows it can be groomed, then grooming adds +5 bond once and records one session', async () => {
    const horse = await makeHorse(alice, 'adult', { bondScore: 40 });
    const groom = await makeGroom(alice, 'adult-groom');
    const assignment = await assign(alice, horse, groom);

    const before = await get(alice, statusUrl(horse));
    expect(before.status).toBe(200);
    expect(before.body.data).toMatchObject({
      horseId: horse.id,
      bond: 40,
      lastGroomedAt: null,
      groomedToday: false,
      canGroomToday: true,
      refusal: null,
      groom: { id: groom.id, name: groom.name },
      foal: null,
    });

    const res = await post(alice, groomUrl(horse));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      bond: 45,
      groomedToday: true,
      canGroomToday: false,
      refusal: { code: 'alreadyGroomedToday' },
      foal: null,
    });
    expect(res.body.data.lastGroomedAt).not.toBeNull();
    // No receipt: the answer is the care status, nothing else.
    expect(Object.keys(res.body)).toEqual(['success', 'data']);

    const row = await prisma.horse.findUnique({ where: { id: horse.id } });
    expect(row.bondScore).toBe(45);
    expect(row.daysGroomedInARow).toBe(1);
    expect(row.taskLog).toEqual({ groomHorse: 1 });

    const interactions = await prisma.groomInteraction.findMany({ where: { foalId: horse.id } });
    expect(interactions).toHaveLength(1);
    expect(interactions[0]).toMatchObject({
      groomId: groom.id,
      assignmentId: assignment.id,
      interactionType: 'groomHorse',
      taskType: 'groomHorse',
      bondingChange: 5,
      milestoneWindowId: null,
    });
    expect(await prisma.foalActivity.count({ where: { foalId: horse.id } })).toBe(1);
    const synergy = await prisma.groomHorseSynergy.findFirst({
      where: { horseId: horse.id, groomId: groom.id },
    });
    expect(synergy.sessionsTogether).toBe(1);
  }, 60000);

  it('refuses a second groom the same Eastern day and changes nothing', async () => {
    const horse = await makeHorse(alice, 'twice', { bondScore: 10 });
    await assign(alice, horse, await makeGroom(alice, 'twice-groom'));

    expect((await post(alice, groomUrl(horse))).status).toBe(200);
    const again = await post(alice, groomUrl(horse));
    expect(again.status).toBe(409);
    expect(again.body).toMatchObject({ success: false, data: { code: 'alreadyGroomedToday' } });
    expect(again.body.message).toContain('already been groomed today');

    expect((await prisma.horse.findUnique({ where: { id: horse.id } })).bondScore).toBe(15);
    expect(await prisma.groomInteraction.count({ where: { foalId: horse.id } })).toBe(1);
  }, 60000);

  it('a groom on the previous Eastern day does not use up today', async () => {
    const horse = await makeHorse(alice, 'yesterday', { bondScore: 20 });
    const groom = await makeGroom(alice, 'yesterday-groom');
    await assign(alice, horse, groom);
    const lateYesterday = new Date(gameDayBounds().start.getTime() - 60_000);
    await prisma.groomInteraction.create({
      data: {
        foalId: horse.id,
        groomId: groom.id,
        interactionType: 'groomHorse',
        duration: 0,
        timestamp: lateYesterday,
      },
    });
    await prisma.horse.update({
      where: { id: horse.id },
      data: { lastGroomed: lateYesterday, daysGroomedInARow: 3, taskLog: { groomHorse: 3 } },
    });

    const res = await post(alice, groomUrl(horse));
    expect(res.status).toBe(200);
    expect(res.body.data.bond).toBe(25);
    const row = await prisma.horse.findUnique({ where: { id: horse.id } });
    expect(row.daysGroomedInARow).toBe(4);
    expect(row.taskLog).toEqual({ groomHorse: 4 });
  }, 60000);

  it('bond never goes past 100', async () => {
    const nearly = await makeHorse(alice, 'cap98', { bondScore: 98 });
    const full = await makeHorse(alice, 'cap100', { bondScore: 100 });
    const groom = await makeGroom(alice, 'cap-groom');
    await assign(alice, nearly, groom);
    await assign(alice, full, groom);

    expect((await post(alice, groomUrl(nearly))).body.data.bond).toBe(100);
    expect((await post(alice, groomUrl(full))).body.data.bond).toBe(100);
    const changes = await prisma.groomInteraction.findMany({
      where: { foalId: { in: [nearly.id, full.id] } },
      orderBy: { foalId: 'asc' },
    });
    expect(changes.map(c => c.bondingChange)).toEqual([2, 0]);
  }, 60000);

  // Equoria-tvmyx: the old flag-multiplier path turned a base gain of 5 into 6.5
  // (Affectionate) or 3.5 (Aloof), which an Int column rejects. Grooming now adds
  // the ruled +5 and no trait or flag changes it, so the write is always an integer.
  it('an Affectionate horse (and a stale Aloof flag) still gains exactly +5, a whole number', async () => {
    const horse = await makeHorse(alice, 'flags', { bondScore: 20 });
    await prisma.horse.update({
      where: { id: horse.id },
      data: {
        epigeneticFlags: ['affectionate', 'aloof'],
        epigeneticModifiers: { positive: ['affectionate'], negative: [], hidden: [] },
      },
    });
    const groom = await makeGroom(alice, 'flags-groom');
    await assign(alice, horse, groom);

    const res = await post(alice, groomUrl(horse));
    expect(res.status).toBe(200);
    expect(res.body.data.bond).toBe(25);

    const row = await prisma.horse.findUnique({ where: { id: horse.id } });
    expect(row.bondScore).toBe(25);
    const [interaction] = await prisma.groomInteraction.findMany({ where: { foalId: horse.id } });
    expect(interaction.bondingChange).toBe(5);
    expect(Number.isInteger(interaction.bondingChange)).toBe(true);
  }, 60000);

  it('refuses an activity for a grown horse', async () => {
    const horse = await makeHorse(alice, 'adult-activity');
    await assign(alice, horse, await makeGroom(alice, 'adult-activity-groom'));
    const res = await post(alice, groomUrl(horse), { activity: 'leading' });
    expect(res.status).toBe(400);
    expect(res.body.data.code).toBe('activityNotOffered');
    expect(await prisma.groomInteraction.count({ where: { foalId: horse.id } })).toBe(0);
  }, 60000);
});

describe('groom horse: refusals before any change', () => {
  it('a horse with no groom cannot be groomed', async () => {
    const horse = await makeHorse(alice, 'nogroom');
    const status = await get(alice, statusUrl(horse));
    expect(status.body.data).toMatchObject({
      canGroomToday: false,
      groom: null,
      refusal: { code: 'noGroomAssigned' },
    });
    const res = await post(alice, groomUrl(horse));
    expect(res.status).toBe(409);
    expect(res.body.data.code).toBe('noGroomAssigned');
    expect(await prisma.groomInteraction.count({ where: { foalId: horse.id } })).toBe(0);
  }, 60000);

  it('a groom waiting on its fee cannot work', async () => {
    const horse = await makeHorse(alice, 'unpaid', { bondScore: 30 });
    await assign(alice, horse, await makeGroom(alice, 'unpaid-groom', { feeUnpaidSince: new Date() }));
    const res = await post(alice, groomUrl(horse));
    expect(res.status).toBe(409);
    expect(res.body.data.code).toBe('groomCannotWork');
    expect(res.body.message).toContain("this week's fee");
    expect((await prisma.horse.findUnique({ where: { id: horse.id } })).bondScore).toBe(30);
  }, 60000);

  it("another player's horse is not found, for status and for grooming", async () => {
    const horse = await makeHorse(alice, 'private');
    await assign(alice, horse, await makeGroom(alice, 'private-groom'));
    expect((await get(bob, statusUrl(horse))).status).toBe(404);
    expect((await post(bob, groomUrl(horse))).status).toBe(404);
    expect(await prisma.groomInteraction.count({ where: { foalId: horse.id } })).toBe(0);
  }, 60000);

  it('two presses in flight groom the horse exactly once', async () => {
    const horse = await makeHorse(alice, 'race', { bondScore: 0 });
    await assign(alice, horse, await makeGroom(alice, 'race-groom'));
    const responses = await raceBehindLock(barrierClient, horseRowLock(horse.id), [
      () => post(alice, groomUrl(horse)),
      () => post(alice, groomUrl(horse)),
    ]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.groomInteraction.count({ where: { foalId: horse.id } })).toBe(1);
    expect((await prisma.horse.findUnique({ where: { id: horse.id } })).bondScore).toBe(5);
  }, 120000);

  it('no interaction row is visible before the bond change commits', async () => {
    const horse = await makeHorse(alice, 'atomic', { bondScore: 10 });
    await assign(alice, horse, await makeGroom(alice, 'atomic-groom'));
    // FOR SHARE lets a child insert through (FOR KEY SHARE) but blocks the horse
    // lock the groom takes first, so a non-atomic write order would show here.
    const barrier = await holdLock(barrierClient, horseRowLock(horse.id, 'SHARE'));
    const inFlight = Promise.resolve(post(alice, groomUrl(horse)));
    let visibleWhileBlocked;
    try {
      await barrier.waitForQueued(1);
      visibleWhileBlocked = await barrierClient.groomInteraction.count({ where: { foalId: horse.id } });
    } finally {
      await barrier.release();
    }
    const res = await inFlight;
    expect(visibleWhileBlocked).toBe(0);
    expect(res.status).toBe(200);
    expect((await prisma.horse.findUnique({ where: { id: horse.id } })).bondScore).toBe(15);
    expect(await prisma.groomInteraction.count({ where: { foalId: horse.id } })).toBe(1);
  }, 120000);
});

describe('groom horse: foals follow the band schedule', () => {
  it('a day-4 foal offers the Socialization and Environment activities', async () => {
    const foal = await makeHorse(alice, 'day4', { ageDays: 3 });
    await assign(alice, foal, await makeGroom(alice, 'day4-groom'));
    const res = await get(alice, statusUrl(foal));
    expect(res.status).toBe(200);
    expect(res.body.data.foal).toEqual({
      day: 4,
      band: {
        id: 'socialEnvironment',
        label: 'Socialization and Environment',
        firstDay: 3,
        lastDay: 4,
      },
      activities: [
        { id: 'leading', label: 'Leading' },
        { id: 'tyingPractice', label: 'Tying' },
        { id: 'hoofHandling', label: 'Hoof Handling' },
        { id: 'desensitization', label: 'Desensitization' },
        { id: 'stableExposure', label: 'Stable Life' },
      ],
      todaysActivity: null,
    });
  }, 60000);

  it('a foal needs one of today’s activities, and the chosen one is recorded', async () => {
    const foal = await makeHorse(alice, 'pick', { ageDays: 3 });
    await assign(alice, foal, await makeGroom(alice, 'pick-groom'));

    const none = await post(alice, groomUrl(foal));
    expect(none.status).toBe(400);
    expect(none.body.data.code).toBe('activityRequired');

    const wrongBand = await post(alice, groomUrl(foal), { activity: 'gentleTouch' });
    expect(wrongBand.status).toBe(400);
    expect(wrongBand.body.data.code).toBe('activityNotOffered');
    expect(await prisma.groomInteraction.count({ where: { foalId: foal.id } })).toBe(0);

    const ok = await post(alice, groomUrl(foal), { activity: 'leading' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.bond).toBe(5);
    expect(ok.body.data.foal.todaysActivity).toEqual({ id: 'leading', label: 'Leading' });

    const row = await prisma.groomInteraction.findFirst({ where: { foalId: foal.id } });
    expect(row).toMatchObject({
      interactionType: 'leading',
      taskType: 'leading',
      milestoneWindowId: 'socialEnvironment',
      bondingChange: 5,
    });
    const activity = await prisma.foalActivity.findFirst({ where: { foalId: foal.id } });
    expect(activity).toMatchObject({ activityType: 'leading', day: 3 });
    expect((await prisma.horse.findUnique({ where: { id: foal.id } })).taskLog).toEqual({
      leading: 1,
    });
  }, 60000);

  it('the birth day is day 1, day 21 is the last foal day, and day 22 is grown', async () => {
    const newborn = await makeHorse(alice, 'born-today', { ageDays: 0 });
    const lastDay = await makeHorse(alice, 'day21', { ageDays: 20 });
    const grown = await makeHorse(alice, 'day22', { ageDays: 21 });

    const a = (await get(alice, statusUrl(newborn))).body.data.foal;
    expect(a.day).toBe(1);
    expect(a.band.id).toBe('imprintingTrust');
    const b = (await get(alice, statusUrl(lastDay))).body.data.foal;
    expect(b.day).toBe(21);
    expect(b.band.id).toBe('showgroundReady');
    expect((await get(alice, statusUrl(grown))).body.data.foal).toBeNull();
  }, 60000);
});

describe('horses not yet groomed today', () => {
  it('lists only horses with a groom and no groom today, foals first', async () => {
    const owner = await makeUser('list');
    const groom = await makeGroom(owner, 'list-groom');
    const unpaid = await makeGroom(owner, 'list-unpaid', { feeUnpaidSince: new Date() });
    const adult = await makeHorse(owner, 'list-adult');
    const foal = await makeHorse(owner, 'list-foal', { ageDays: 5 });
    const done = await makeHorse(owner, 'list-done');
    const waiting = await makeHorse(owner, 'list-waiting');
    await makeHorse(owner, 'list-nogroom');
    await assign(owner, adult, groom);
    await assign(owner, foal, groom);
    await assign(owner, done, groom);
    await assign(owner, waiting, unpaid);
    expect((await post(owner, groomUrl(done))).status).toBe(200);

    const res = await get(owner, '/api/v1/grooms/care/ungroomed-today');
    expect(res.status).toBe(200);
    expect(res.body.data.horses).toEqual([
      { horseId: foal.id, horseName: foal.name, isFoal: true, canGroomToday: true },
      { horseId: adult.id, horseName: adult.name, isFoal: false, canGroomToday: true },
      { horseId: waiting.id, horseName: waiting.name, isFoal: false, canGroomToday: false },
    ]);
  }, 60000);
});

describe('home reminder: next-actions groom-foal', () => {
  it('leaves out a foal already groomed today and keeps one that is not', async () => {
    const owner = await makeUser('nextact');
    const groom = await makeGroom(owner, 'nextact-groom');
    const groomed = await makeHorse(owner, 'nextact-groomed', { ageDays: 2 });
    const waiting = await makeHorse(owner, 'nextact-waiting', { ageDays: 2 });
    for (const foal of [groomed, waiting]) {
      await assign(owner, foal, groom);
      await prisma.foalDevelopment.create({ data: { foalId: foal.id } });
    }
    cleanup.add(
      () => prisma.foalDevelopment.deleteMany({ where: { foalId: { in: [groomed.id, waiting.id] } } }),
      'foalDevelopment',
    );
    expect((await post(owner, groomUrl(groomed), { activity: 'leading' })).status).toBe(200);

    const res = await get(owner, '/api/v1/next-actions');
    expect(res.status).toBe(200);
    const foalIds = res.body.data.actions.filter(a => a.type === 'groom-foal').map(a => a.horseId);
    expect(foalIds).toEqual([waiting.id]);
  }, 60000);
});

describe('the old grooming doors are retired', () => {
  it.each([
    ['/api/v1/grooms/interact', h => ({ foalId: h.id, groomId: 1, interactionType: 'brushing', duration: 30 })],
    [
      '/api/v1/grooms/enhanced/interact',
      h => ({ horseId: h.id, groomId: 1, interactionType: 'dailyCare', variation: 'x', duration: 30 }),
    ],
  ])(
    '%s answers 410 and grooms nothing',
    async (url, bodyFor) => {
      const horse = await makeHorse(alice, `retired-${url.length}`);
      await assign(alice, horse, await makeGroom(alice, `retired-groom-${url.length}`));
      const res = await post(alice, url, bodyFor(horse));
      expect(res.status).toBe(410);
      expect(res.body.data.code).toBe('useGroomHorse');
      expect(await prisma.groomInteraction.count({ where: { foalId: horse.id } })).toBe(0);
    },
    60000,
  );
});
