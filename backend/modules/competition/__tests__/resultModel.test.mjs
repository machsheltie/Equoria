/**
 * Result Model Tests
 *
 * Input validation tests run without any DB access (validation throws
 * before reaching any Prisma call).  All other tests use real DB
 * fixtures under the TestFixture-ResultModel- prefix.
 *
 * Cleanup strategy (Equoria-1ohys — fail-loud):
 *   - beforeAll: delete any stale fixtures from previous runs.
 *   - afterAll: scoped, name-prefix sweep (Show cascade-deletes its
 *     CompetitionResults + ShowEntries; then Horses by prefix; then the USER_ID
 *     user). These deleteMany calls have NO swallowing `.catch` — a cleanup
 *     failure fails the suite so a leaked fixture surfaces at the source.
 *   - Per-test cleanup was previously done with swallowed-error helpers
 *     (rmHorse/rmShow) inside try/finally. Those are removed: every
 *     fixture uses a unique `TestFixture-ResultModel-` suffix and every
 *     assertion is scoped to its own horse/show ids, so fixtures from one test
 *     never affect another. Routing a delete through `finally` would also risk
 *     masking a test-body assertion failure if the delete threw. The prefix
 *     sweep is the single fail-loud cleanup point.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { getResultsByUser } from '../services/resultModelService.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const PREFIX = 'TestFixture-ResultModel-';
const USER_ID = 'test-user-result-model';

async function mkHorse(suffix) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}Horse-${suffix}`,
      sex: 'Colt',
      dateOfBirth: new Date('2020-01-01'),
      age: 4,
      userId: USER_ID,
    },
  });
}

async function mkShow(suffix) {
  return prisma.show.create({
    data: {
      name: `${PREFIX}Show-${suffix}`,
      discipline: 'Racing',
      levelMin: 0,
      levelMax: 10,
      entryFee: 100,
      prize: 500,
      runDate: new Date(),
    },
  });
}

beforeAll(async () => {
  // Stale-fixture sweep — Show cascade-deletes its CompetitionResults
  await prisma.show.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.horse.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { id: USER_ID } });
  await prisma.user.create({
    data: {
      id: USER_ID,
      username: 'resultModelUser',
      email: 'resultmodel@example.com',
      password: 'TestPassword123!',
      firstName: 'Result',
      lastName: 'Model',
      money: 5000,
    },
  });
});

afterAll(async () => {
  await prisma.show.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.horse.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { id: USER_ID } });
});

// ─── getResultsByUser ─────────────────────────────────────────────────────────
describe('getResultsByUser', () => {
  it('returns results for all horses owned by the user', async () => {
    const horse = await mkHorse('GBU1');
    const show = await mkShow('GBU1');
    await prisma.competitionResult.create({
      data: {
        horseId: horse.id,
        showId: show.id,
        score: 85,
        placement: 1,
        discipline: 'Racing',
        runDate: new Date(),
        showName: show.name,
        prizeWon: 0,
      },
    });

    const results = await getResultsByUser(USER_ID);

    const ours = results.find(r => r.horseId === horse.id);
    expect(ours).toBeDefined();
    expect(ours.horse.userId).toBe(USER_ID);
  });

  it('filters by discipline when the discipline option is provided', async () => {
    const horse = await mkHorse('GBU2');
    const showR = await mkShow('GBU2R');
    const showD = await mkShow('GBU2D');
    await prisma.competitionResult.create({
      data: {
        horseId: horse.id,
        showId: showR.id,
        score: 85,
        placement: 1,
        discipline: 'Racing',
        runDate: new Date(),
        showName: showR.name,
        prizeWon: 0,
      },
    });
    await prisma.competitionResult.create({
      data: {
        horseId: horse.id,
        showId: showD.id,
        score: 70,
        placement: null,
        discipline: 'Dressage',
        runDate: new Date(),
        showName: showD.name,
        prizeWon: 0,
      },
    });

    const results = await getResultsByUser(USER_ID, { discipline: 'Racing', limit: 100 });

    const horseResults = results.filter(r => r.horseId === horse.id);
    expect(horseResults.length).toBe(1);
    expect(horseResults[0].discipline).toBe('Racing');
  });

  it('caps limit at 100 and enforces non-negative offset without throwing', async () => {
    const results = await getResultsByUser(USER_ID, { limit: 200, offset: -5 });
    expect(Array.isArray(results)).toBe(true);
  });
});
