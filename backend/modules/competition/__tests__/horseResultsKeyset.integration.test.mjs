/**
 * A horse's career history on the keyset convention (Equoria-cmw85.22).
 *
 * GET /api/v1/horses/:horseId/competition-history. Equoria-a7f1p (owner ruling
 * 2026-10-28, q151): GET /competition/horse/:horseId/results was removed as a
 * duplicate lookup, with its Equoria-cmw85.20 cases. One horse with 105 results TIED
 * on runDate (one per show). The career
 * statistics must still count every result while the list is bounded.
 * Real backend, real auth, real database.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const RUN = randomBytes(5).toString('hex');
const TIED = new Date('2026-03-07T05:00:00.000Z');
const TOTAL = 105;
const cleanup = createCleanupTracker();

let user;
let horse;
let token;
let shows;

const showData = i => ({
  name: `TestFixture-HRKeyset-${i}-${RUN}`,
  discipline: 'Dressage',
  entryFee: 0,
  levelMin: 1,
  levelMax: 999,
  prize: 1000,
  runDate: TIED,
  status: 'completed',
});

const resultData = show => ({
  horseId: horse.id,
  showId: show.id,
  score: 50,
  placement: 1,
  discipline: 'Dressage',
  runDate: TIED,
  showName: show.name,
  prizeWon: 10,
});

const get = (path, query) =>
  request(app)
    .get(path)
    .set('Authorization', `Bearer ${token}`)
    .query(query ?? {});

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `hrkeyset-${RUN}@test.com`,
      username: `hrkeyset${RUN}`,
      password: 'irrelevant-hash',
      firstName: 'Horse',
      lastName: 'Results',
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-HRKeyset-${RUN}`,
      sex: 'Mare',
      dateOfBirth: new Date('2018-01-01'),
      age: 5,
      userId: user.id,
    },
  });
  await prisma.show.createMany({ data: Array.from({ length: TOTAL + 1 }, (_, i) => showData(i)) });
  shows = await prisma.show.findMany({
    where: { name: { endsWith: RUN, startsWith: 'TestFixture-HRKeyset-' } },
    orderBy: { id: 'asc' },
  });
  await prisma.competitionResult.createMany({ data: shows.slice(0, TOTAL).map(resultData) });
}, 120_000);

afterAll(async () => {
  cleanup.add(() => prisma.competitionResult.deleteMany({ where: { horseId: horse.id } }), 'results');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: shows.map(s => s.id) } } }), 'shows');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
  await cleanup.run();
}, 120_000);

describe('GET /horses/:horseId/competition-history (Equoria-cmw85.22)', () => {
  const path = () => `/api/v1/horses/${horse.id}/competition-history`;

  it('bounds the list at 100 while the statistics still count the whole career', async () => {
    const res = await get(path(), { limit: 5000 });
    expect(res.status).toBe(200);
    expect(res.body.competitions).toHaveLength(100);
    expect(res.body.pageInfo.hasMore).toBe(true);
    expect(res.body.statistics.totalCompetitions).toBeGreaterThanOrEqual(TOTAL);
    expect(res.body.statistics.wins).toBe(res.body.statistics.totalCompetitions);
    expect(res.body.statistics.totalPrizeMoney).toBe(res.body.statistics.totalCompetitions * 10);
  }, 60_000);

  it('continues by cursor and answers 400 for a bad one', async () => {
    const first = await get(path(), { limit: 60 });
    const second = await get(path(), { limit: 60, cursor: first.body.pageInfo.nextCursor });
    expect(second.status).toBe(200);
    const seen = [...first.body.competitions, ...second.body.competitions].map(c => c.competitionId);
    expect(new Set(seen).size).toBe(seen.length);
    const bad = await get(path(), { cursor: 'c1:nonsense' });
    expect(bad.status).toBe(400);
  }, 60_000);
});
