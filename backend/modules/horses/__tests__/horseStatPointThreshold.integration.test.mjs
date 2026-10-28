/**
 * horseStatPointThreshold.integration.test.mjs (Equoria-576c0 B13)
 *
 * Owner ruling C15 (2026-10-16; bible 13 "1,000 Horse Points per stat
 * allocation"): a horse earns one stat allocation per 1,000 Horse Points.
 * Old contract: one per 100.
 *
 * Allocations are a stored counter (Horse.availableStatPoints) credited when
 * the accumulated points cross a threshold and spent one at a time, so a
 * horse's allocations already earned and stored are kept as they are (owner
 * ruling 2026-10-07: no data conversion); new points earn allocations at the
 * new rate. GET /horses/:id/xp reports progress toward the next allocation and
 * the threshold itself, which the frontend bar reads.
 *
 * Real DB, real HTTP for the status route.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { addXpToHorse, getHorseXpStatus, HORSE_POINTS_PER_STAT_POINT } from '../services/horseXpModelService.mjs';

const rand = () => randomBytes(5).toString('hex');
const cleanup = createCleanupTracker();
const horseIds = [];
let user;
let token;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `b13-${rand()}@test.local`,
      username: `b13${rand()}`,
      password: 'irrelevant-hash',
      firstName: 'Horse',
      lastName: 'Points',
      money: 0,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  cleanup.add(() => prisma.horseXpEvent.deleteMany({ where: { horseId: { in: horseIds } } }), 'xpEvents');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 60000);

afterAll(() => cleanup.run(), 60000);

function makeHorse(fields = {}) {
  return createTestHorse(
    prisma,
    {
      name: `TestFixture-b13-${rand()}`,
      sex: 'Mare',
      age: 5,
      dateOfBirth: new Date('2018-01-01'),
      healthStatus: 'healthy',
      userId: user.id,
      ...fields,
    },
    horseIds,
  );
}

describe('1,000 Horse Points per stat allocation (C15)', () => {
  it('the threshold is 1,000', () => {
    expect(HORSE_POINTS_PER_STAT_POINT).toBe(1000);
  });

  it('999 points earn nothing; the 1,000th earns one allocation', async () => {
    const horse = await makeHorse();
    const first = await addXpToHorse(horse.id, 999, 'TestFixture b13');
    expect(first).toMatchObject({ success: true, statPointsGained: 0, availableStatPoints: 0 });
    const second = await addXpToHorse(horse.id, 1, 'TestFixture b13');
    expect(second).toMatchObject({ success: true, statPointsGained: 1, availableStatPoints: 1 });
  });

  it('one award crossing two thresholds earns two', async () => {
    const horse = await makeHorse({ horseXp: 500 });
    const result = await addXpToHorse(horse.id, 2000, 'TestFixture b13');
    expect(result).toMatchObject({ statPointsGained: 2, currentXP: 2500 });
  });

  it('a horse keeps the allocations it already has stored; new points use the new rate', async () => {
    // Earned under the old rule: 450 points, 4 allocations stored.
    const horse = await makeHorse({ horseXp: 450, availableStatPoints: 4 });
    const result = await addXpToHorse(horse.id, 100, 'TestFixture b13'); // 550: no threshold crossed
    expect(result).toMatchObject({ statPointsGained: 0, availableStatPoints: 4 });
  });

  it('the status reports progress toward the next allocation and the threshold', async () => {
    const horse = await makeHorse({ horseXp: 450, availableStatPoints: 4 });
    const expected = {
      currentXP: 450,
      availableStatPoints: 4,
      nextStatPointAt: 1000,
      xpToNextStatPoint: 550,
      pointsPerStatPoint: 1000,
    };
    expect((await getHorseXpStatus(horse.id)).data).toMatchObject(expected);

    const res = await request(app)
      .get(`/api/v1/horses/${horse.id}/xp`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject(expected);
  });
});
