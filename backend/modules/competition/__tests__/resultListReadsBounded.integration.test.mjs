/**
 * A show's result list is bounded and select-scoped (Equoria-cmw85.12).
 *
 * The defect: the show results read returned EVERY result, each with the whole
 * horse row (genotype, colour genotype, epigenetic modifiers and every other
 * JSONB column) and the whole show row (its staged ordering of every entrant,
 * escrow columns, creator id). The list grew without limit with a show's field,
 * and carried other players' horses' internals.
 *
 * The contract now: at most 100 rows, score first, id breaking ties so pages are
 * stable, and only the result's own columns, the horse's id/name/breed and the
 * show's public fields. A show's list omits statGains, which only the horse's
 * owner may see (owner ruling R7).
 *
 * Equoria-a7f1p (owner ruling 2026-10-28, q151): GET /competition/horse/:horseId/results
 * and its getResultsByHorse service were removed as duplicate lookups, with the two
 * cases that read them. The Show Results tab reads GET /competition/results/horse/:horseId.
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
let bigShow;

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
      emailVerified: true,
      email: `${PREFIX}-${tag}@test.local`,
      username: `${PREFIX}-${tag}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Result',
      lastName: 'Lists',
      money: 0,
    },
  });
  userIds.push(owner.id);

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

describe('result list reads (Equoria-cmw85.12)', () => {
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
});
