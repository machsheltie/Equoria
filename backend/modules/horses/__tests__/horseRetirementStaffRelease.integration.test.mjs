/**
 * Equoria-6p398.14 — a horse that turns 21 retires, and its staff go free.
 *
 * Owner rulings 2026-10-23 (Stacey):
 * - A horse is retired at age 21 or over on the game clock; there is no separate
 *   retire action. Its grooms, rider and trainer are removed from it
 *   automatically when it turns 21, so no staff member stays tied up on, or is
 *   charged for, a retired horse.
 * - A mare still in foal when she turns 21 stays in foal until her due date and
 *   KEEPS her staff meanwhile; she can still be fed and vetted, because the foal
 *   depends on it. Once she foals, her staff are removed and feeding stops.
 *
 * The nightly aging pass (processHorseBirthdays, 00:05 Eastern) is where a horse
 * turns 21, so the release happens there, in the birthday's transaction; the
 * foaling transaction releases an in-foal mare's staff. A horse turning 20 keeps
 * its staff. The weekly groom fee basis skips retired horses that are not in
 * foal, which also covers a horse already 21+ before this rule existed.
 *
 * Real DB, real aging pass, real foaling, real feed service, the real vet route
 * via supertest and the real weekly groom fee pass (scoped to this suite's own
 * user, groomSalaryPassScoped sentinel); no mocks. Assignments are ENDED, never deleted: rows stay as history, exactly
 * as a sale ends them.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { processHorseBirthdays } from '../../../utils/horseAgingSystem.mjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../../app.mjs';
import config from '../../../config/config.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { processWeeklySalaries } from '../../grooms/index.mjs';
import { SYSTEM_ACCOUNT_BURN } from '../../economy/index.mjs';
import { feedHorse } from '../services/horseFeedService.mjs';
import { createFoalFromPregnancy } from '../services/foalingService.mjs';

const SCOPE = 'TestFixture-6p398_14-retire';
const RUN = randomBytes(5).toString('hex');
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = days => gameCalendarDate(new Date(), -days);

const cleanup = createCleanupTracker();
const horseIds = [];
const groomIds = [];
const riderIds = [];
const trainerIds = [];
let user;
let breedId;

async function makeHorse(key, { daysOld, storedAge, ...extra }) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${SCOPE}-${key}-${RUN}`,
      sex: 'Mare',
      dateOfBirth: daysAgo(daysOld),
      age: storedAge,
      breedId,
      healthStatus: 'Good',
      userId: user.id,
      ...extra,
    },
  });
  horseIds.push(horse.id);
  return horse;
}

/** One groom, one rider and one trainer, each actively assigned to `horse`. */
async function staffHorse(key, horse) {
  const groom = await prisma.groom.create({
    data: {
      name: `${SCOPE}-groom-${key}-${RUN}`,
      speciality: 'general',
      personality: 'gentle',
      skillLevel: 'novice',
      startAge: 20,
      userId: user.id,
    },
  });
  groomIds.push(groom.id);
  const rider = await prisma.rider.create({
    data: {
      firstName: `${SCOPE}-rider-${key}`,
      lastName: RUN,
      personality: 'calm',
      skillLevel: 'rookie',
      speciality: 'Dressage',
      userId: user.id,
    },
  });
  riderIds.push(rider.id);
  const trainer = await prisma.trainer.create({
    data: {
      firstName: `${SCOPE}-trainer-${key}`,
      lastName: RUN,
      personality: 'calm',
      skillLevel: 'novice',
      speciality: 'Dressage',
      userId: user.id,
    },
  });
  trainerIds.push(trainer.id);

  await prisma.groomAssignment.create({
    data: { groomId: groom.id, foalId: horse.id, userId: user.id, isActive: true },
  });
  await prisma.riderAssignment.create({
    data: { riderId: rider.id, horseId: horse.id, userId: user.id, isActive: true },
  });
  await prisma.trainerAssignment.create({
    data: { trainerId: trainer.id, horseId: horse.id, userId: user.id, isActive: true },
  });
  await prisma.horse.update({
    where: { id: horse.id },
    data: { rider: { id: rider.id, name: `${rider.firstName} ${rider.lastName}`, level: 1 } },
  });
  return { groom, rider, trainer };
}

async function staffState(horseId) {
  const [horse, grooms, riders, trainers] = await Promise.all([
    prisma.horse.findUnique({ where: { id: horseId }, select: { age: true, rider: true } }),
    prisma.groomAssignment.findMany({
      where: { foalId: horseId },
      select: { isActive: true, endDate: true },
    }),
    prisma.riderAssignment.findMany({ where: { horseId }, select: { isActive: true } }),
    prisma.trainerAssignment.findMany({ where: { horseId }, select: { isActive: true } }),
  ]);
  return { horse, grooms, riders, trainers };
}

function expectAllStaffEnded(state) {
  expect(state.horse.rider).toBeNull();
  // Ended, not deleted: each row survives as history.
  expect(state.grooms).toHaveLength(1);
  expect(state.grooms[0].isActive).toBe(false);
  // Jest's vm realm makes toBeInstanceOf(Date) unreliable for Prisma dates.
  expect(Number.isFinite(new Date(state.grooms[0].endDate).getTime())).toBe(true);
  expect(state.riders).toEqual([{ isActive: false }]);
  expect(state.trainers).toEqual([{ isActive: false }]);
}

function expectAllStaffKept(state, riderId) {
  expect(state.horse.rider).toMatchObject({ id: riderId });
  expect(state.grooms).toEqual([{ isActive: true, endDate: null }]);
  expect(state.riders).toEqual([{ isActive: true }]);
  expect(state.trainers).toEqual([{ isActive: true }]);
}

let turning21;
let turning20;
let legacyRetired;
let inFoal21;
let staff20;
let staffLegacy;
let staffInFoal;
let summary;

beforeAll(async () => {
  await prisma.systemAccount.upsert({
    where: { name: SYSTEM_ACCOUNT_BURN },
    create: { name: SYSTEM_ACCOUNT_BURN, balance: 0 },
    update: {},
  });
  const breed = await prisma.breed.upsert({
    where: { name: 'Thoroughbred' },
    update: {},
    create: { name: 'Thoroughbred', description: '6p398.14 test breed' },
  });
  breedId = breed.id;
  user = await prisma.user.create({
    data: {
      email: `${SCOPE}-${RUN}@test.com`,
      username: `retire${RUN}`,
      password: 'irrelevant-hash',
      firstName: 'Retire',
      lastName: 'Staff',
      money: 10000,
      settings: {
        inventory: [{ id: 'feed-elite', itemId: 'elite', category: 'feed', name: 'Elite Feed', quantity: 5 }],
      },
    },
  });
  cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { foalId: { in: horseIds } } }), 'groom assignments');
  cleanup.add(() => prisma.riderAssignment.deleteMany({ where: { horseId: { in: horseIds } } }), 'rider assignments');
  cleanup.add(
    () => prisma.trainerAssignment.deleteMany({ where: { horseId: { in: horseIds } } }),
    'trainer assignments',
  );
  cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: groomIds } } }), 'grooms');
  cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: riderIds } } }), 'riders');
  cleanup.add(() => prisma.trainer.deleteMany({ where: { id: { in: trainerIds } } }), 'trainers');
  cleanup.add(() => prisma.groomSalaryPayment.deleteMany({ where: { userId: user.id } }), 'salary payments');
  cleanup.add(() => prisma.groomEngagement.deleteMany({ where: { userId: user.id } }), 'engagements');
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: user.id } }), 'notifications');
  cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: user.id } }), 'transactions');
  cleanup.add(() => prisma.horse.deleteMany({ where: { damId: { in: horseIds } } }), 'foals');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');

  // 147 Eastern game days = game-year 21: today is the 21st birthday.
  turning21 = await makeHorse('turning21', { daysOld: 147, storedAge: 20 });
  // 140 days = game-year 20: a birthday, but not retirement.
  turning20 = await makeHorse('turning20', { daysOld: 140, storedAge: 19 });
  // Already 22 before the rule existed, age current, still staffed (legacy row).
  legacyRetired = await makeHorse('legacy22', { daysOld: 156, storedAge: 22 });
  // Bred at 20 and still in foal on her 21st birthday.
  const sire = await makeHorse('sire', { daysOld: 70, storedAge: 10, sex: 'Stallion' });
  inFoal21 = await makeHorse('inFoal21', {
    daysOld: 147,
    storedAge: 20,
    inFoalSinceDate: new Date(Date.now() - 3 * DAY_MS),
    pregnancySireId: sire.id,
    equippedFeedType: 'elite',
  });
  await staffHorse('h21', turning21);
  staff20 = await staffHorse('h20', turning20);
  staffLegacy = await staffHorse('legacy', legacyRetired);
  staffInFoal = await staffHorse('inFoal', inFoal21);

  summary = await processHorseBirthdays({
    horseIds: [turning21.id, turning20.id, legacyRetired.id, inFoal21.id],
  });
}, 60_000);

afterAll(() => cleanup.run(), 60_000);

describe('Equoria-6p398.14 — staff leave a horse when it turns 21', () => {
  it('the aging pass ran cleanly: three birthdays, two retirements', () => {
    expect(summary.errors).toBe(0);
    expect(summary.birthdaysFound).toBe(3);
    const byId = Object.fromEntries(summary.results.map(r => [r.horseId, r]));
    expect(byId[turning21.id]).toMatchObject({ newAge: 21, hadBirthday: true });
    expect(byId[turning21.id].milestonesTriggered).toEqual(['retirement']);
    expect(byId[inFoal21.id]).toMatchObject({ newAge: 21, hadBirthday: true });
    expect(byId[turning20.id]).toMatchObject({ newAge: 20, hadBirthday: true });
  });

  it('a horse turning 21, not in foal, loses every active groom, rider and trainer assignment', async () => {
    const state = await staffState(turning21.id);
    expect(state.horse.age).toBe(21);
    expectAllStaffEnded(state);
  });

  it('a horse turning 20 keeps all of its staff', async () => {
    const state = await staffState(turning20.id);
    expect(state.horse.age).toBe(20);
    expectAllStaffKept(state, staff20.rider.id);
  });

  it('a retired horse that is not in foal is still not fed (existing rule)', async () => {
    const result = await feedHorse({ userId: user.id, horseId: turning21.id, rng: () => 0.99 });
    expect(result.skipped).toBe('retired');
  });
});

describe('Equoria-6p398.14 — a mare who turns 21 in foal keeps her staff until she foals', () => {
  it('on her 21st birthday she keeps her groom, rider and trainer', async () => {
    const state = await staffState(inFoal21.id);
    expect(state.horse.age).toBe(21);
    expectAllStaffKept(state, staffInFoal.rider.id);
  });

  it('she can still be fed', async () => {
    const result = await feedHorse({ userId: user.id, horseId: inFoal21.id, rng: () => 0.99 });
    expect(result.skipped).toBeUndefined();
    expect(result.feed).toMatchObject({ tier: 'elite' });
    const row = await prisma.horse.findUnique({
      where: { id: inFoal21.id },
      select: { lastFedDate: true, pregnancyFeedingsByTier: true },
    });
    expect(row.lastFedDate).not.toBeNull();
    expect(row.pregnancyFeedingsByTier).toMatchObject({ elite: 1 });
  });

  it('she can still be vetted', async () => {
    const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: '1h' });
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/vet/book-appointment')
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: inFoal21.id, serviceId: 'health-check' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('after she foals, her staff are gone and feeding stops', async () => {
    const result = await createFoalFromPregnancy({ damId: inFoal21.id });
    expect(result.foal.damId).toBe(inFoal21.id);

    expectAllStaffEnded(await staffState(inFoal21.id));
    const fed = await feedHorse({ userId: user.id, horseId: inFoal21.id, rng: () => 0.99 });
    expect(fed.skipped).toBe('retired');
  }, 60_000);
});

describe('Equoria-6p398.14 — the weekly groom fee pass bills no retired horse', () => {
  it('bills only the 20-year-old: not the 21-year-old, the foaled mare, or the legacy 22-year-old', async () => {
    // Fee is 70 per billable horse (Equoria-95yrv). The legacy 22-year-old still
    // has an ACTIVE assignment (it retired before staff were released), so only
    // the retirement filter keeps it off the bill.
    const results = await processWeeklySalaries(new Date(), { userId: user.id });
    expect(results.errors).toEqual([]);
    expect(results.totalAmount).toBe(70);
    const legacy = await prisma.groomAssignment.findFirst({
      where: { groomId: staffLegacy.groom.id },
      select: { isActive: true },
    });
    expect(legacy.isActive).toBe(true);
  }, 60_000);
});
