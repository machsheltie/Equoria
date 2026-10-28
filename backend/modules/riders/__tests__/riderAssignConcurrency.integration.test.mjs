/**
 * POST /api/v1/riders/assignments under concurrency (Equoria-j8s5c): two
 * DIFFERENT riders assigned to the SAME horse leave exactly one active rider on
 * it, and ONE rider assigned to two horses is active on only one of them; in
 * both cases the active assignment rows say who rides.
 *
 * Assigning a rider replaces whoever rides the horse. Since Equoria-6p398.6
 * the transaction locks the Horse row before it
 * deactivates the horse's active assignment, so a second transaction for the
 * same horse waits on that row and then sees the first one's committed
 * assignment. This test pins that.
 *
 * HOW THE RACE IS FORCED: a dedicated client holds the horse row FOR UPDATE;
 * both requests are started and observed queued behind it, then it is released.
 *
 * Real DB, real HTTP, real CSRF, scoped fail-loud fixtures. No mocks.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createBarrierClient, horseRowLock, raceBehindLock } from '../../../__tests__/helpers/rowLockBarrier.mjs';

const ORIGIN = 'http://localhost:3000';
const fixturePrefix = 'TestFixture-j8s5c-rider';
const tag = () => randomBytes(6).toString('hex');
const barrierClient = createBarrierClient();

describe('rider assign under concurrency (Equoria-j8s5c)', () => {
  const cleanup = createCleanupTracker();
  let owner;
  let token;
  let horses;
  let riders;

  beforeEach(async () => {
    const suffix = tag();
    owner = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `${fixturePrefix}-${suffix}`,
        email: `${fixturePrefix}-${suffix}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'J8s5c',
        lastName: 'Owner',
        money: 0,
      },
    });
    token = generateTestToken({ id: owner.id, email: owner.email, role: 'user' });
    horses = [];
    riders = [];
    for (const label of ['a', 'b']) {
      horses.push(
        await prisma.horse.create({
          data: {
            ...fixtureColor(),
            name: `${fixturePrefix}-horse-${label}-${suffix}`,
            sex: 'Mare',
            dateOfBirth: new Date('2019-06-15'),
            age: 6,
            userId: owner.id,
            healthStatus: 'Excellent',
          },
        }),
      );
      riders.push(
        await prisma.rider.create({
          data: {
            firstName: 'TestFixture',
            lastName: `J8s5c-${label}-${tag()}`,
            personality: 'daring',
            skillLevel: 'experienced',
            speciality: 'Jumping',
            weeklyRate: 200,
            userId: owner.id,
          },
        }),
      );
    }
    cleanup.add(() => prisma.riderAssignment.deleteMany({ where: { userId: owner.id } }), 'riderAssignment');
    cleanup.add(() => prisma.rider.deleteMany({ where: { userId: owner.id } }), 'riders');
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: owner.id } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'user');
  }, 30000);

  afterEach(() => cleanup.run(), 30000);
  afterAll(() => barrierClient.$disconnect(), 30000);

  const assign = (riderId, horseId) => async () => {
    const csrf = await fetchCsrf(app);
    return request(app)
      .post('/api/v1/riders/assignments')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ riderId, horseId });
  };

  it('leaves exactly one active rider on the horse', async () => {
    const horse = horses[0];
    const responses = await raceBehindLock(
      barrierClient,
      horseRowLock(horse.id),
      riders.map(r => assign(r.id, horse.id)),
    );
    expect(responses.map(r => r.status)).toEqual([201, 201]);

    const active = await prisma.riderAssignment.findMany({ where: { horseId: horse.id, isActive: true } });
    expect(active).toHaveLength(1);
  }, 60000);

  // One rider assigned to two horses at once. Pre-fix both requests read "this
  // rider has no active assignment" before either inserted (they lock
  // different horse rows), and the rider went active on both. The barrier
  // holds the RIDER row: pre-fix both queue at their assignment insert (its
  // foreign key needs a share lock on the rider) after the check already
  // passed; post-fix both queue at the rider-row lock taken before the check.
  //
  // Owner ruling 2026-10-28 (q254, Equoria-r2wix) changed the contract: a rider
  // rides up to 20 horses (old contract: one). The race now targets the LAST
  // place: a rider already on 19 horses, assigned to two more at once, ends on
  // exactly 20.
  it('one rider at 19 horses assigned to two more at once ends on exactly 20', async () => {
    const rider = riders[0];
    const seated = [];
    for (let i = 0; i < 19; i += 1) {
      seated.push(
        await prisma.horse.create({
          data: {
            ...fixtureColor(),
            name: `${fixturePrefix}-horse-seated${i}-${tag()}`,
            sex: 'Mare',
            dateOfBirth: new Date('2019-06-15'),
            age: 6,
            userId: owner.id,
            healthStatus: 'Excellent',
          },
        }),
      );
    }
    await prisma.riderAssignment.createMany({
      data: seated.map(h => ({ riderId: rider.id, horseId: h.id, userId: owner.id, isActive: true })),
    });
    const responses = await raceBehindLock(
      barrierClient,
      tx => tx.$queryRaw`SELECT "id" FROM "riders" WHERE "id" = ${rider.id} FOR UPDATE`,
      horses.map(h => assign(rider.id, h.id)),
    );
    expect(responses.map(r => r.status).sort()).toEqual([201, 400]);

    const active = await prisma.riderAssignment.findMany({ where: { riderId: rider.id, isActive: true } });
    expect(active).toHaveLength(20);
    const raced = active.filter(a => horses.some(h => h.id === a.horseId));
    expect(raced).toHaveLength(1);
  }, 60000);
});
