/**
 * Horse page Current Status (Equoria-0l0tq): GET /api/v1/horses/:id/overview
 * carries the dates and the SERVER's verdicts for Last Shod / Last Trained /
 * Last Groomed. The verdicts come from the rules the train and groom actions
 * apply: training eligibility plus the weekly cooldown, and the groom action's
 * one-interaction-per-game-day limit. Real DB, real HTTP, no mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';
import { createTestHorse } from '../helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../utils/gameTime.mjs';

const uid = () => randomBytes(5).toString('hex');
const dayMs = 24 * 60 * 60 * 1000;
const cleanup = createCleanupTracker();
const horseIds = [];
let owner;
let token;
let groom;

const overview = async horseId => {
  const res = await request(app)
    .get(`/api/v1/horses/${horseId}/overview`)
    .set('Origin', 'http://localhost:3000')
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  return res.body.data;
};

const makeHorse = (fields = {}) =>
  createTestHorse(
    prisma,
    {
      name: `TestFixture-0l0tq-${uid()}`,
      sex: 'Mare',
      age: 7,
      dateOfBirth: gameCalendarDate(new Date(), -7 * 7),
      userId: owner.id,
      lastFedDate: new Date(),
      lastVettedDate: gameCalendarDate(),
      healthStatus: 'Excellent',
      ...fields,
    },
    horseIds,
  );

beforeAll(async () => {
  owner = await prisma.user.create({
    data: {
      email: `0l0tq-${uid()}@test.local`,
      username: `0l0tq${uid()}`,
      password: 'irrelevant-hash',
      firstName: 'Care',
      lastName: 'Status',
      money: 0,
    },
  });
  token = generateTestToken({ id: owner.id, email: owner.email, role: 'user' });
  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-0l0tq-g-${uid()}`,
      speciality: 'showHandling',
      personality: 'gentle',
      skillLevel: 'expert',
      user: { connect: { id: owner.id } },
    },
  });
  cleanup.add(() => prisma.groomInteraction.deleteMany({ where: { foalId: { in: horseIds } } }), 'interactions');
  cleanup.add(() => prisma.trainingLog.deleteMany({ where: { horseId: { in: horseIds } } }), 'training logs');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.groom.deleteMany({ where: { id: groom.id } }), 'groom');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'user');
}, 60000);

afterAll(() => cleanup.run(), 60000);

describe('overview Current Status verdicts (Equoria-0l0tq)', () => {
  it('reports lastShod and lastGroomed as stored, and null when never', async () => {
    const shod = new Date(Date.now() - 3 * dayMs);
    const horse = await makeHorse({ lastShod: shod, lastGroomed: shod });
    const data = await overview(horse.id);
    expect(new Date(data.lastShod).getTime()).toBe(shod.getTime());
    expect(new Date(data.lastGroomed).getTime()).toBe(shod.getTime());

    const never = await makeHorse();
    const neverData = await overview(never.id);
    expect(neverData.lastShod).toBeNull();
    expect(neverData.lastTrainedAt).toBeNull();
  });

  it('canTrainNow follows the train call: yes when eligible, no inside the weekly cooldown', async () => {
    const horse = await makeHorse();
    expect((await overview(horse.id)).canTrainNow).toBe(true);

    const trainedAt = new Date(Date.now() - 2 * dayMs);
    await prisma.trainingLog.create({ data: { horseId: horse.id, discipline: 'Dressage', trainedAt } });
    // The cooldown is Horse.trainingCooldown, the column the train call claims.
    await prisma.horse.update({
      where: { id: horse.id },
      data: { trainingCooldown: new Date(trainedAt.getTime() + 7 * dayMs) },
    });
    const data = await overview(horse.id);
    expect(data.canTrainNow).toBe(false);
    expect(new Date(data.lastTrainedAt).getTime()).toBe(trainedAt.getTime());

    await prisma.horse.update({
      where: { id: horse.id },
      data: { trainingCooldown: new Date(Date.now() - dayMs) },
    });
    expect((await overview(horse.id)).canTrainNow).toBe(true);
  });

  it('canTrainNow is false for a horse the train call refuses: Bad health, and under age', async () => {
    const bad = await makeHorse({
      lastVettedDate: gameCalendarDate(new Date(), -29),
    });
    expect((await overview(bad.id)).canTrainNow).toBe(false);

    const foal = await makeHorse({ age: 1, dateOfBirth: gameCalendarDate(new Date(), -7) });
    expect((await overview(foal.id)).canTrainNow).toBe(false);
  });

  it('canGroomToday follows the groom action: yes until an interaction today', async () => {
    const horse = await makeHorse();
    expect((await overview(horse.id)).canGroomToday).toBe(true);

    await prisma.groomInteraction.create({
      data: {
        foalId: horse.id,
        groomId: groom.id,
        interactionType: 'brushing',
        duration: 20,
        timestamp: new Date(),
      },
    });
    expect((await overview(horse.id)).canGroomToday).toBe(false);
  });
});
