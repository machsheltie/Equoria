/**
 * Equoria-6p398.14 follow-ups — no NEW staff for a retired horse; an in-foal 21+
 * mare's groom is billed as usual.
 *
 * Owner rulings 2026-10-23 (Stacey):
 * 1. Assigning NEW staff (groom, rider, trainer) to a retired horse — 21 or over
 *    and not in foal — is REFUSED with a clear message (400, code 'horseRetired').
 * 2. A mare of 21+ still in foal keeps her groom until she foals, and that groom
 *    is charged the NORMAL weekly fee meanwhile. She is not retired from staff
 *    yet, so she may also be given new staff.
 *
 * Every assign door is exercised through the real Express app (supertest, real
 * auth + CSRF) against the real database: POST /api/v1/grooms/assign,
 * POST /api/v1/groom-assignments, POST /api/v1/riders/assignments and
 * POST /api/v1/trainers/assignments. A 20-year-old is the control on each door.
 * The weekly fee pass is the real one, scoped to this suite's own user
 * (groomSalaryPassScoped sentinel). No mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import prisma from '../../../../packages/database/prismaClient.mjs';
import app from '../../../app.mjs';
import config from '../../../config/config.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { processWeeklySalaries } from '../../grooms/index.mjs';

const scope = 'TestFixture-6p398_14-newStaff';
const run = randomBytes(5).toString('hex');
const dayMs = 24 * 60 * 60 * 1000;
const daysAgo = days => gameCalendarDate(new Date(), -days);

const cleanup = createCleanupTracker();
const horseIds = [];
const groomIds = [];
const riderIds = [];
const trainerIds = [];
let user;
let breedId;
let auth;

async function makeHorse(key, { daysOld, storedAge, ...extra }) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${scope}-${key}-${run}`,
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

async function makeGroom(key) {
  const groom = await prisma.groom.create({
    data: {
      name: `${scope}-groom-${key}-${run}`,
      speciality: 'general',
      personality: 'gentle',
      skillLevel: 'novice',
      startAge: 20,
      userId: user.id,
    },
  });
  groomIds.push(groom.id);
  return groom;
}

async function makeRider(key) {
  const rider = await prisma.rider.create({
    data: {
      firstName: `${scope}-rider-${key}`,
      lastName: run,
      personality: 'calm',
      skillLevel: 'rookie',
      speciality: 'Dressage',
      userId: user.id,
    },
  });
  riderIds.push(rider.id);
  return rider;
}

async function makeTrainer(key) {
  const trainer = await prisma.trainer.create({
    data: {
      firstName: `${scope}-trainer-${key}`,
      lastName: run,
      personality: 'calm',
      skillLevel: 'novice',
      speciality: 'Dressage',
      userId: user.id,
    },
  });
  trainerIds.push(trainer.id);
  return trainer;
}

function post(path, body) {
  return request(app)
    .post(path)
    .set('Origin', 'http://localhost:3000')
    .set('Authorization', `Bearer ${auth.token}`)
    .set('Cookie', auth.csrf.cookieHeader)
    .set('X-CSRF-Token', auth.csrf.csrfToken)
    .send(body);
}

/** The four doors, each as (staff member, horse) -> response. */
const doors = {
  groomAssign: (groom, horse) => post('/api/v1/grooms/assign', { foalId: horse.id, groomId: groom.id }),
  groomAssignments: (groom, horse) => post('/api/v1/groom-assignments', { groomId: groom.id, horseId: horse.id }),
  riderAssignments: (rider, horse) => post('/api/v1/riders/assignments', { riderId: rider.id, horseId: horse.id }),
  trainerAssignments: (trainer, horse) =>
    post('/api/v1/trainers/assignments', { trainerId: trainer.id, horseId: horse.id }),
};

function expectRetiredRefusal(res) {
  expect(res.status).toBe(400);
  expect(res.body.success).toBe(false);
  expect(res.body.code).toBe('horseRetired');
  expect(res.body.message).toMatch(/retired/i);
}

async function activeStaffOn(horseId) {
  const [grooms, riders, trainers] = await Promise.all([
    prisma.groomAssignment.count({ where: { foalId: horseId, isActive: true } }),
    prisma.riderAssignment.count({ where: { horseId, isActive: true } }),
    prisma.trainerAssignment.count({ where: { horseId, isActive: true } }),
  ]);
  return { grooms, riders, trainers };
}

let retired22;
let active20;
let inFoal21;

beforeAll(async () => {
  const breed = await prisma.breed.upsert({
    where: { name: 'Thoroughbred' },
    update: {},
    create: { name: 'Thoroughbred', description: '6p398.14 test breed' },
  });
  breedId = breed.id;
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `${scope}-${run}@test.com`,
      username: `newstaff${run}`,
      password: 'irrelevant-hash',
      firstName: 'Retired',
      lastName: 'NewStaff',
      money: 10000,
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
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');

  // 156 Eastern game days = game-year 22; the nightly pass has stored age 22.
  retired22 = await makeHorse('retired22', { daysOld: 156, storedAge: 22 });
  active20 = await makeHorse('active20', { daysOld: 140, storedAge: 20 });
  const sire = await makeHorse('sire', { daysOld: 70, storedAge: 10, sex: 'Stallion' });
  // Bred at 20, turned 21 in foal: not retired from staff until she foals.
  inFoal21 = await makeHorse('inFoal21', {
    daysOld: 147,
    storedAge: 21,
    inFoalSinceDate: new Date(Date.now() - 3 * dayMs),
    pregnancySireId: sire.id,
  });

  auth = {
    token: jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: '1h' }),
    csrf: await fetchCsrf(app),
  };
}, 60_000);

afterAll(() => cleanup.run(), 60_000);

describe('Equoria-6p398.14 — a retired horse (21+, not in foal) is given no new staff', () => {
  it('POST /grooms/assign refuses a groom for the retired horse; a 20-year-old gets one', async () => {
    const groom = await makeGroom('assign');
    expectRetiredRefusal(await doors.groomAssign(groom, retired22));

    const ok = await doors.groomAssign(groom, active20);
    expect(ok.status).toBe(201);
  });

  it('POST /groom-assignments refuses a groom for the retired horse', async () => {
    const groom = await makeGroom('assignments');
    expectRetiredRefusal(await doors.groomAssignments(groom, retired22));
  });

  it('POST /riders/assignments refuses a rider for the retired horse; a 20-year-old gets one', async () => {
    const rider = await makeRider('retired');
    expectRetiredRefusal(await doors.riderAssignments(rider, retired22));

    const ok = await doors.riderAssignments(rider, active20);
    expect(ok.status).toBe(201);
  });

  it('POST /trainers/assignments refuses a trainer for the retired horse; a 20-year-old gets one', async () => {
    const trainer = await makeTrainer('retired');
    expectRetiredRefusal(await doors.trainerAssignments(trainer, retired22));

    const ok = await doors.trainerAssignments(trainer, active20);
    expect(ok.status).toBe(201);
  });

  it('nothing was written for the retired horse: no active assignment', async () => {
    expect(await activeStaffOn(retired22.id)).toEqual({
      grooms: 0,
      riders: 0,
      trainers: 0,
    });
    const control = await activeStaffOn(active20.id);
    expect(control).toMatchObject({ grooms: 1, riders: 1, trainers: 1 });
  });
});

describe('Equoria-6p398.14 — a mare who is 21 and in foal is not retired from staff yet', () => {
  let groomForInFoal;

  beforeAll(async () => {
    groomForInFoal = await makeGroom('inFoal');
  });

  it('she may be given a new groom, rider and trainer', async () => {
    const groomRes = await doors.groomAssignments(groomForInFoal, inFoal21);
    expect(groomRes.status).toBe(201);
    const riderRes = await doors.riderAssignments(await makeRider('inFoal'), inFoal21);
    expect(riderRes.status).toBe(201);
    const trainerRes = await doors.trainerAssignments(await makeTrainer('inFoal'), inFoal21);
    expect(trainerRes.status).toBe(201);
    expect(await activeStaffOn(inFoal21.id)).toMatchObject({ grooms: 1, riders: 1, trainers: 1 });
  });

  it('her groom is charged the normal weekly fee while she is in foal', async () => {
    // Owner ruling 2026-10-28 (q228): the groom's star level price per week (a Rookie,
    // 100), however many horses; it was 70 per horse under Equoria-95yrv.
    const results = await processWeeklySalaries(new Date(), { userId: user.id });
    expect(results.errors).toEqual([]);
    const payment = await prisma.groomSalaryPayment.findFirst({
      where: { userId: user.id, groomId: groomForInFoal.id },
      select: { amount: true, status: true },
    });
    expect(payment).toEqual({ amount: 100, status: 'paid' });
  }, 60_000);
});
