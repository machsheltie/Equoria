/**
 * Equoria-r9u5k: a rider retired by the weekly career job leaves no active
 * assignment on the horses they rode.
 *
 * The weekly job (processRiderRetirement; autoRetireOverdueRiders before
 * Equoria-or2ua) flips Rider.retired and deactivates the RiderAssignment rows
 * in one transaction. (It once also had to clear a denormalised Horse.rider
 * JSON copy; that column is gone, Equoria-97se, so the assignment rows are the
 * only record.)
 *
 * Also covered: a player assign racing that retirement. assignRider checked
 * `retired` on an unlocked read, so a rider retired while the assign was in
 * flight could still be put on a horse. The barrier locks the rider row, the
 * assign is observed queued on it (it has already read "not retired"), and the
 * barrier retires the rider before releasing.
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
import { createBarrierClient, holdLock } from '../../../__tests__/helpers/rowLockBarrier.mjs';
import { processRiderRetirement } from '../../riders/index.mjs';

const ORIGIN = 'http://localhost:3000';
const fixturePrefix = 'TestFixture-r9u5k';
const tag = () => randomBytes(6).toString('hex');
const barrierClient = createBarrierClient();

describe('rider retirement ends the assignment on the horse (Equoria-r9u5k)', () => {
  const cleanup = createCleanupTracker();
  let owner;
  let token;
  let horse;
  let rider;

  beforeEach(async () => {
    const suffix = tag();
    owner = await prisma.user.create({
      data: {
        username: `${fixturePrefix}-${suffix}`,
        email: `${fixturePrefix}-${suffix}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'R9u5k',
        lastName: 'Owner',
        money: 0,
      },
    });
    token = generateTestToken({ id: owner.id, email: owner.email, role: 'user' });
    horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${fixturePrefix}-horse-${suffix}`,
        sex: 'Mare',
        dateOfBirth: new Date('2019-06-15'),
        age: 6,
        userId: owner.id,
        healthStatus: 'Excellent',
      },
    });
    rider = await prisma.rider.create({
      data: {
        firstName: 'TestFixture',
        lastName: `R9u5k-${tag()}`,
        personality: 'daring',
        skillLevel: 'experienced',
        speciality: 'Jumping',
        weeklyRate: 200,
        userId: owner.id,
      },
    });
    cleanup.add(() => prisma.riderAssignment.deleteMany({ where: { userId: owner.id } }), 'riderAssignment');
    cleanup.add(() => prisma.rider.deleteMany({ where: { userId: owner.id } }), 'rider');
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: owner.id } }), 'horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'user');
  }, 30000);

  afterEach(() => cleanup.run(), 30000);
  afterAll(() => barrierClient.$disconnect(), 30000);

  const assign = async () => {
    const csrf = await fetchCsrf(app);
    return request(app)
      .post('/api/v1/riders/assignments')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ riderId: rider.id, horseId: horse.id });
  };

  it('the weekly retirement ends the horse assignment', async () => {
    // Put the rider on the horse through the real assign route, so the
    // assignment is exactly what a player produces.
    expect((await assign()).status).toBe(201);
    expect(
      await prisma.riderAssignment.count({ where: { riderId: rider.id, horseId: horse.id, isActive: true } }),
    ).toBe(1);

    // Owner ruling 2026-10-23 (Equoria-or2ua): the rider is at their hidden
    // retirement age and the one-week notice went out in an earlier pass.
    await prisma.rider.update({
      where: { id: rider.id },
      data: {
        startAge: 20,
        careerWeeks: 30,
        riderRetirementSchedule: {
          create: { retirementAge: 50, noticeSentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      },
    });
    const result = await processRiderRetirement();
    expect(result.retiredIds).toContain(rider.id);

    const active = await prisma.riderAssignment.count({ where: { riderId: rider.id, isActive: true } });
    expect(active).toBe(0);
    expect((await prisma.rider.findUnique({ where: { id: rider.id } })).retired).toBe(true);
  }, 60000);

  it('a rider retired while an assign is in flight is not put on the horse', async () => {
    let barrierTx;
    const barrier = await holdLock(barrierClient, async tx => {
      barrierTx = tx;
      await tx.$queryRaw`SELECT "id" FROM "riders" WHERE "id" = ${rider.id} FOR UPDATE`;
    });
    const inFlight = assign();
    try {
      await barrier.waitForQueued(1);
      await barrierTx.rider.update({ where: { id: rider.id }, data: { retired: true } });
    } finally {
      await barrier.release();
    }
    const res = await inFlight;

    expect(res.status).toBe(400);
    expect(await prisma.riderAssignment.count({ where: { riderId: rider.id } })).toBe(0);
  }, 60000);
});
