/**
 * horseHistoryStatGains.integration.test.mjs (Equoria-q4uem.10 follow-up)
 *
 * GET /api/v1/horses/:id/history ran `JSON.parse(result.statGains)` on every
 * result. Prisma returns that JSONB column as an object, so any horse with a
 * recorded stat gain (written by the nightly executor since q4uem.10 A1) or a
 * conformation ribbon answered 500. Only resultModelService.saveResult (no
 * production callers)
 * ever stored a JSON *string* there.
 *
 * The reader now goes through the competition result guards, which accept the
 * stored object or that legacy string: a ridden row's gain is `statGain`, a
 * conformation row's ribbon is `conformationAward`, anything else is null.
 *
 * Real app + real DB; result rows are fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../app.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const uid = () => randomBytes(5).toString('hex');
const cleanup = createCleanupTracker();
let owner;
let token;
let show;
const horses = {};

async function makeHorse(tag) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-histgain-${tag}-${uid()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-01-01'),
      age: 7,
      userId: owner.id,
    },
  });
}

function resultFor(horse, discipline, statGains) {
  return {
    horseId: horse.id,
    showId: show.id,
    score: 70,
    placement: '1',
    discipline,
    runDate: new Date('2026-10-10T07:00:00.000Z'),
    showName: show.name,
    prizeWon: 0,
    ...(statGains === undefined ? {} : { statGains }),
  };
}

beforeAll(async () => {
  owner = await prisma.user.create({
    data: {
      email: `histgain-${uid()}@test.local`,
      username: `histgain${uid()}`,
      password: 'irrelevant-hash',
      firstName: 'History',
      lastName: 'Owner',
      money: 0,
    },
  });
  token = generateTestToken({ id: owner.id, email: owner.email, role: 'user' });
  show = await prisma.show.create({
    data: {
      name: `TestFixture-histgain-show-${uid()}`,
      discipline: 'Dressage',
      prize: 0,
      entryFee: 0,
      levelMin: 1,
      levelMax: 10,
      runDate: new Date('2026-10-10T07:00:00.000Z'),
      status: 'completed',
    },
  });
  horses.ridden = await makeHorse('ridden');
  horses.ribbon = await makeHorse('ribbon');
  horses.legacy = await makeHorse('legacy');
  horses.none = await makeHorse('none');
  const horseIds = Object.values(horses).map(h => h.id);

  cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId: show.id } }), 'competitionResult');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: show.id } }), 'show');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'user');

  await prisma.competitionResult.createMany({
    data: [
      resultFor(horses.ridden, 'Dressage', { stat: 'focus', gain: 1 }),
      resultFor(horses.ribbon, 'conformation', { ribbon: 'Blue', titlePoints: 10 }),
      // The form saveResult (no production callers) wrote: a JSON string in the JSONB column.
      resultFor(horses.legacy, 'Dressage', JSON.stringify({ stat: 'speed', gain: 1 })),
      resultFor(horses.none, 'Dressage'),
    ],
  });
});

afterAll(() => cleanup.run(), 60000);

function getHistory(horse) {
  return request(app)
    .get(`/api/v1/horses/${horse.id}/history`)
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${token}`);
}

describe('GET /api/v1/horses/:id/history reads recorded stat gains and ribbons', () => {
  it('returns a ridden result’s recorded stat gain', async () => {
    const res = await getHistory(horses.ridden);

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({
      statGain: { stat: 'focus', gain: 1 },
      conformationAward: null,
    });
  });

  it('returns a conformation result’s ribbon as a conformation award, not a stat gain', async () => {
    const res = await getHistory(horses.ribbon);

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({
      statGain: null,
      conformationAward: { ribbon: 'Blue', titlePoints: 10 },
    });
  });

  it('still reads the legacy JSON-string form', async () => {
    const res = await getHistory(horses.legacy);

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ statGain: { stat: 'speed', gain: 1 } });
  });

  it('returns null when nothing was recorded', async () => {
    const res = await getHistory(horses.none);

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ statGain: null, conformationAward: null });
  });
});
