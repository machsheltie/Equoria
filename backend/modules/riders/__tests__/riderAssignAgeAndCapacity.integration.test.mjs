/**
 * POST /api/v1/riders/assignments — who a rider may ride.
 *
 *   Equoria-y2ksc (audit STAFF-01): a horse is ridden from age 3, the age it can
 *   enter shows. A rider assigned to a foal is refused with code horseTooYoung.
 *   The age is the horse's live age, so a third birthday today counts at once.
 *
 *   Equoria-r2wix (owner ruling 2026-10-28, q254): one rider rides up to 20
 *   horses. Old contract: one horse per rider ("Rider is already assigned to a
 *   horse. Unassign first."). A 21st horse is refused with code riderAtCapacity.
 *
 * Real DB, real HTTP, real CSRF, id-scoped fail-loud cleanup. No mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import config from '../../../config/config.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

const prefix = 'TestFixture-y2ksc-rider';
const rand = () => randomBytes(4).toString('hex');
const cleanup = createCleanupTracker();
const horseIds = [];
let user;
let token;
let breedId;

/** A horse `days` Eastern calendar days old, with the stored age the nightly job last wrote. */
async function makeHorse(days, storedAge) {
  const horse = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `${prefix}-${rand()}`,
      sex: 'Mare',
      dateOfBirth: gameCalendarDate(new Date(), -days),
      age: storedAge,
      userId: user.id,
      breedId,
      healthStatus: 'Excellent',
    }),
  });
  horseIds.push(horse.id);
  return horse;
}

async function makeRider() {
  return prisma.rider.create({
    data: {
      userId: user.id,
      firstName: 'Seed',
      lastName: `Rider${rand()}`,
      personality: 'calm',
      skillLevel: 'experienced',
      speciality: 'Show Jumping',
      weeklyRate: 100,
    },
  });
}

async function assign(riderId, horseId) {
  const csrf = await fetchCsrf(app);
  return request(app)
    .post('/api/v1/riders/assignments')
    .set('Origin', 'http://localhost:3000')
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ riderId, horseId });
}

beforeAll(async () => {
  breedId = (await prisma.breed.findFirst({ select: { id: true } })).id;
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `${prefix}-${rand()}`,
      email: `${prefix}-${rand()}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Rider',
      lastName: 'Rules',
    },
  });
  token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: '1h' });
  cleanup.add(() => prisma.riderAssignment.deleteMany({ where: { userId: user.id } }), 'rider assignments');
  cleanup.add(() => prisma.rider.deleteMany({ where: { userId: user.id } }), 'riders');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 60000);

afterAll(() => cleanup.run(), 60000);

describe('a rider is never assigned to a horse under 3 (Equoria-y2ksc)', () => {
  it('refuses a two-year-old with code horseTooYoung and writes nothing', async () => {
    const rider = await makeRider();
    const foal = await makeHorse(2 * 7 + 3, 2);
    const res = await assign(rider.id, foal.id);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('horseTooYoung');
    expect(res.body.message).toMatch(/too young for a rider/);
    expect(await prisma.riderAssignment.count({ where: { horseId: foal.id } })).toBe(0);
  });

  it('accepts a horse whose third birthday is today, before the nightly job ages it', async () => {
    const rider = await makeRider();
    const birthday = await makeHorse(3 * 7, 2);
    const res = await assign(rider.id, birthday.id);
    expect(res.status).toBe(201);
  });
});

describe('one rider rides up to twenty horses (Equoria-r2wix, q254)', () => {
  it('rides a second horse without giving up the first', async () => {
    const rider = await makeRider();
    const first = await makeHorse(5 * 7, 5);
    const second = await makeHorse(5 * 7, 5);
    expect((await assign(rider.id, first.id)).status).toBe(201);
    expect((await assign(rider.id, second.id)).status).toBe(201);
    const active = await prisma.riderAssignment.findMany({
      where: { riderId: rider.id, isActive: true },
      select: { horseId: true },
    });
    expect(active.map(a => a.horseId).sort()).toEqual([first.id, second.id].sort());
  });

  it('refuses a twenty-first horse with code riderAtCapacity', async () => {
    const rider = await makeRider();
    const horses = [];
    for (let i = 0; i < 21; i += 1) {
      horses.push(await makeHorse(5 * 7, 5));
    }
    await prisma.riderAssignment.createMany({
      data: horses.slice(0, 20).map(h => ({
        riderId: rider.id,
        horseId: h.id,
        userId: user.id,
        isActive: true,
      })),
    });

    const res = await assign(rider.id, horses[20].id);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('riderAtCapacity');
    expect(res.body.message).toMatch(/already rides 20 horses/);
    expect(await prisma.riderAssignment.count({ where: { riderId: rider.id, isActive: true } })).toBe(20);

    // A horse it already rides is refused as already assigned, not as a 21st horse.
    const again = await assign(rider.id, horses[0].id);
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/already assigned to this horse/);
  });
});
