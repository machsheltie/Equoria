/**
 * A horse's and a show's result lists are bounded and select-scoped
 * (Equoria-cmw85.12).
 *
 * The defect: getResultsByHorse (GET /api/v1/competition/horse/:horseId/results
 * and the horse history read) and the show results read returned EVERY result, each
 * with the whole horse row (genotype, colour genotype, epigenetic modifiers and
 * every other JSONB column) and the whole show row (its staged ordering of
 * every entrant, escrow columns, creator id). The lists grew without limit with
 * a horse's career or a show's field, and a show's list carried other players'
 * horses' internals.
 *
 * The contract now: at most 100 rows, newest first for a horse (score first for
 * a show, id breaking ties so pages are stable), and only the result's own
 * columns, the horse's id/name/breed and the show's public fields. A show's
 * list omits statGains, which only the horse's owner may see (owner ruling R7).
 *
 * Real DB, real route (supertest, real JWT), scoped fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { getResultsByHorse } from '../services/resultModelService.mjs';

const PREFIX = 'TestFixture-cmw8512';
const ORIGIN = 'http://localhost:3000';
const ROWS = 105;
const LIMIT = 100;
const tag = randomBytes(4).toString('hex');
const cleanup = createCleanupTracker();

const userIds = [];
const horseIds = [];
const showIds = [];
let owner;
let careerHorse;
let bigShow;

const horseKeys = ['breed', 'id', 'name'];
const privatePattern = /genotype|epigeneticModifiers|stagedOrdering|feeEscrow|prizeEscrow|createdByUserId/i;

cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId: { in: showIds } } }), 'results');
cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'shows');
cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'user');

function horseData(label) {
  return {
    ...fixtureColor(),
    name: `${PREFIX}-${label}-${tag}`,
    sex: 'Mare',
    dateOfBirth: new Date('2018-01-01'),
    age: 7,
    userId: owner.id,
    healthStatus: 'healthy',
  };
}

function showData(label) {
  return {
    name: `${PREFIX}-show-${label}-${tag}`,
    discipline: 'Dressage',
    entryFee: 0,
    levelMin: 1,
    levelMax: 999,
    prize: 1000,
    runDate: new Date(),
    status: 'completed',
    stagedOrdering: [{ horseId: 1, userId: 'someone-else', score: 1, placement: 1 }],
  };
}

beforeAll(async () => {
  owner = await prisma.user.create({
    data: {
      email: `${PREFIX}-${tag}@test.local`,
      username: `${PREFIX}-${tag}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Result',
      lastName: 'Lists',
      money: 0,
    },
  });
  userIds.push(owner.id);

  // A horse with a long career: one result in each of ROWS shows.
  careerHorse = await prisma.horse.create({ data: horseData('career') });
  horseIds.push(careerHorse.id);
  await prisma.show.createMany({
    data: Array.from({ length: ROWS }, (_, i) => showData(`career-${i}`)),
  });
  const careerShows = await prisma.show.findMany({
    where: { name: { startsWith: `${PREFIX}-show-career-` }, AND: { name: { endsWith: tag } } },
    select: { id: true, name: true },
  });
  expect(careerShows).toHaveLength(ROWS);
  showIds.push(...careerShows.map(s => s.id));
  const base = Date.now() - ROWS * 60_000;
  await prisma.competitionResult.createMany({
    data: careerShows.map((show, i) => ({
      horseId: careerHorse.id,
      showId: show.id,
      score: 50,
      placement: 1,
      discipline: 'Dressage',
      runDate: new Date(base + i * 60_000),
      showName: show.name,
      prizeWon: 10,
      statGains: { stat: 'speed', gain: 1 },
    })),
  });

  // A show with a big field: ROWS horses, one result each.
  bigShow = await prisma.show.create({ data: showData('field') });
  showIds.push(bigShow.id);
  await prisma.horse.createMany({ data: Array.from({ length: ROWS }, (_, i) => horseData(`field-${i}`)) });
  const fieldHorses = await prisma.horse.findMany({
    where: { userId: owner.id, name: { startsWith: `${PREFIX}-field-` } },
    select: { id: true },
  });
  expect(fieldHorses).toHaveLength(ROWS);
  horseIds.push(...fieldHorses.map(h => h.id));
  await prisma.competitionResult.createMany({
    data: fieldHorses.map((horse, i) => ({
      horseId: horse.id,
      showId: bigShow.id,
      score: i % 50,
      placement: i + 1,
      discipline: 'Dressage',
      runDate: new Date(),
      showName: bigShow.name,
      prizeWon: 0,
      statGains: { stat: 'speed', gain: 1 },
    })),
  });
}, 120000);

afterAll(() => cleanup.run(), 60000);

function expectScopedRow(row) {
  expect(Object.keys(row.horse).sort()).toEqual(horseKeys);
  expect(row.show).toBeDefined();
  expect(row.show.name).toBeDefined();
  expect(JSON.stringify(row)).not.toMatch(privatePattern);
}

describe('result list reads (Equoria-cmw85.12)', () => {
  it("a horse's results: the newest 100, scoped", async () => {
    const results = await getResultsByHorse(careerHorse.id);

    expect(results).toHaveLength(LIMIT);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].runDate >= results[i].runDate).toBe(true);
    }
    const newest = await prisma.competitionResult.findMany({
      where: { horseId: careerHorse.id },
      orderBy: [{ runDate: 'desc' }, { id: 'desc' }],
      take: LIMIT,
      select: { id: true },
    });
    expect(results.map(r => r.id)).toEqual(newest.map(r => r.id));
    for (const row of results) {
      expectScopedRow(row);
    }
    // The owner's own list keeps the recorded stat gain.
    expect(results[0].statGains).toEqual({ stat: 'speed', gain: 1 });
  }, 60000);

  it("a show's results (GET /competition/show/:showId/results): the top 100 by placement, scoped, no foreign stat gains", async () => {
    const token = generateTestToken({ id: owner.id, email: owner.email, role: 'user' });
    const res = await request(app)
      .get(`/api/v1/competition/show/${bigShow.id}/results`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // ROWS (105) results exist; the route never returns, or loads, more than LIMIT.
    expect(res.body.count).toBe(LIMIT);
    expect(res.body.results).toHaveLength(LIMIT);
    // The cut is the top of the field: placements 1..LIMIT, in order.
    expect(res.body.results.map(r => r.placement)).toEqual(Array.from({ length: LIMIT }, (_, i) => i + 1));
    expect(JSON.stringify(res.body)).not.toMatch(privatePattern);
  }, 60000);

  it('GET /api/v1/competition/horse/:horseId/results keeps its shape, bounded and scoped', async () => {
    const token = generateTestToken({ id: owner.id, email: owner.email, role: 'user' });
    const res = await request(app)
      .get(`/api/v1/competition/horse/${careerHorse.id}/results`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.horseId).toBe(careerHorse.id);
    expect(res.body.count).toBe(LIMIT);
    expect(res.body.results).toHaveLength(LIMIT);
    expect(res.body.results[0]).toMatchObject({
      horseId: careerHorse.id,
      placement: 1,
      discipline: 'Dressage',
      horse: { id: careerHorse.id, name: careerHorse.name },
    });
    expect(JSON.stringify(res.body)).not.toMatch(privatePattern);
  }, 60000);
});
