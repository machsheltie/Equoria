/**
 * quarantinedShowResultsDelayed.integration.test.mjs (Equoria-c7mx0.1, owner ruling q30)
 *
 * A show the reaper quarantined after three failed executions is an operator
 * matter. Players are told only "Results delayed": in their horse's show
 * history and in the show views, never the stored word "quarantined".
 * Real app + real DB; the show is a fixture row in the quarantined state.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

const ORIGIN = 'http://localhost:3000';
const uid = () => randomBytes(5).toString('hex');
const cleanup = createCleanupTracker();
let owner;
let token;
let horse;
let show;

const get = path => request(app).get(path).set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: show.id } }), 'showEntry');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: show.id } }), 'show');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'user');
  owner = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `c7mx01-${uid()}@test.local`,
      username: `c7mx01${uid()}`,
      password: 'irrelevant-hash',
      firstName: 'Results',
      lastName: 'Delayed',
      money: 0,
    },
  });
  token = generateTestToken({ id: owner.id, email: owner.email, role: 'user' });
  horse = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `TestFixture-c7mx01-horse-${uid()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-01-01'),
      age: 7,
      userId: owner.id,
    }),
  });
  show = await prisma.show.create({
    data: {
      name: `TestFixture-c7mx01-${uid()}`,
      discipline: 'Dressage',
      prize: 1000,
      entryFee: 0,
      levelMin: 1,
      levelMax: 10,
      status: 'quarantined',
      executionAttempts: 3,
      runDate: new Date('2026-10-20T07:00:00.000Z'),
    },
  });
  await prisma.showEntry.create({
    data: { showId: show.id, horseId: horse.id, userId: owner.id, feePaid: 0 },
  });
});

afterAll(() => cleanup.run(), 60000);

describe('a quarantined show reads "Results delayed" to players (q30)', () => {
  it('in the horse’s show history', async () => {
    const res = await get(`/api/v1/competition/results/horse/${horse.id}`);

    expect(res.status).toBe(200);
    const row = res.body.data.find(r => r.showId === show.id);
    expect(row).toMatchObject({
      status: 'resultsDelayed',
      statusLabel: 'Results delayed',
      placement: null,
    });
  });

  it('in the show’s results view', async () => {
    const res = await get(`/api/v1/competition/show/${show.id}/results`);

    expect(res.status).toBe(200);
    expect(res.body.show).toMatchObject({ status: 'resultsDelayed', statusLabel: 'Results delayed' });
  });

  it('in the show’s entered-field view', async () => {
    const res = await get(`/api/v1/competition/show/${show.id}/entries`);

    expect(res.status).toBe(200);
    expect(res.body.show).toMatchObject({ status: 'resultsDelayed', statusLabel: 'Results delayed' });
  });

  it('never shows the stored word to a player', async () => {
    const bodies = await Promise.all([
      get(`/api/v1/competition/results/horse/${horse.id}`),
      get(`/api/v1/competition/show/${show.id}/results`),
      get(`/api/v1/competition/show/${show.id}/entries`),
    ]);
    for (const res of bodies) {
      expect(JSON.stringify(res.body).toLowerCase()).not.toContain('quarantine');
    }
  });
});
